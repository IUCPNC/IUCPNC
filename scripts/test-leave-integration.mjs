import assert from 'node:assert/strict';
import {fixture,employee,hr} from './test-profiles.mjs';
import {leaveRoute,leaveContext} from '../worker/leave-api.js';
import {attendanceRoute} from '../worker/attendance-api.js';
import {entitlement,available,today,add,UAT_CHECKS} from '../worker/leave-core.js';
import {DEFAULT_RULES} from '../worker/attendance-core.js';
let checks=0;
const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
const manager={userId:'employee-2',email:'second@example.test'},delegate={userId:'employee-3',email:'third@example.test'};
const day=today(),next=add(day,1),prior=add(day,-1);
const isPc=(_,email)=>email===hr.email;
async function setup(extra={}){
 const f=fixture();f.env.PC_EMAILS=hr.email;
 f.sqlite.prepare("INSERT INTO employees (employee_id,employee_name,email,account_user_id,department,position,active) VALUES ('TEST-003','Third Example','third@example.test','employee-3','Finance','Manager',1)").run();
 for(const id of ['TEST-002','TEST-003'])f.sqlite.prepare("INSERT INTO management_grants (employee_id,role,version,updated_by,updated_at) VALUES (?,'manager',1,'test',?)").run(id,new Date().toISOString());
 f.sqlite.prepare("INSERT INTO management_reports (employee_id,manager_id) VALUES ('TEST-001','TEST-002'),('TEST-002','TEST-003')").run();
 f.call=async(path,body,who=hr,status=200,headers={})=>{const r=await leaveRoute(new Request('https://leave.test/api/leave/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?headers:{origin:'https://leave.test','content-type':'application/json','idempotency-key':crypto.randomUUID(),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.env,{user:who,isPc});const text=await r.text();assert.equal(r.status,status,text);checks++;return JSON.parse(text);};
 f.policyBody={name:'Integration fixture annual policy',type:'Annual Leave',kind:'Institutional',effective:'2025-01-01',data:{method:'Annual allocation',days:20,chargeBasis:'Working days',proration:'None',halfDay:true,paid:true,carryLimit:5,carryMonths:3,reference:'TEST ONLY, NOT AN IUC POLICY',approved:true,...extra}};
 f.p=await f.call('policies',f.policyBody,hr,201);
 f.assignment={policyIds:[f.p.id],schedule:{approved:true,workingDays:[0,1,2,3,4,5,6],location:'Selangor',halfBoundary:'12:00'},holidayYears:[2025,2026,2027],workflow:[{kind:'Reporting manager'}]};
 for(const id of ['TEST-001','TEST-002','TEST-003']){await f.call('assignment',{employeeId:id,version:0,data:{...f.assignment,workflow:id==='TEST-001'?f.assignment.workflow:[{kind:'P&C'}]}});await f.call('allocate',{employeeId:id,year:2026});}
 await f.call('settings',{version:0,data:{stage:'Parallel Validation'}});
 f.balance=()=>f.sqlite.prepare("SELECT * FROM leave_accounts WHERE employee_id='TEST-001' AND leave_type='Annual Leave' AND year=2026").get();
 return f;
}

// A single source account, historical usage, approved future leave and pending
// future leave can be imported atomically without double deductions.
{
 const f=await setup(),rows=[
  {reference:'fixture-balance',kind:'Balance',employeeId:'TEST-001',type:'Annual Leave',year:2026,allocated:20,opening:18,carried:0},
  {reference:'fixture-history',kind:'History',employeeId:'TEST-001',type:'Annual Leave',from:'2026-09-01',to:'2026-09-02',days:2,status:'Approved'},
  {reference:'fixture-future',kind:'History',employeeId:'TEST-001',type:'Annual Leave',from:day,to:day,status:'Approved',duration:'Full day'},
  {reference:'fixture-pending',kind:'History',employeeId:'TEST-001',type:'Annual Leave',from:next,to:next,status:'Pending',duration:'Morning'}];
 const imp=await f.call('imports',{source:'Authorised synthetic Kakitangan export',rows},hr,201);same(imp.errors,[]);
 await f.call('imports/'+imp.id,{action:'Apply',version:1});same(available(f.balance()),33);same(f.balance().used,2);same(f.balance().reserved,1);
 same(f.sqlite.prepare("SELECT units FROM leave_requests WHERE source_reference='fixture-history'").get().units,4);
 const report=await f.call('reconcile/'+imp.id,{version:2});same(report.status,'Verified');same(report.historyCount,3);same(report.comparisons[0].variance,0);
 same((await leaveContext(f.env.DB,'TEST-001',day,day)).length,0);
 const duplicate=await f.call('imports',{source:'Duplicate source reference',rows:[rows[0]]},hr,201);same(duplicate.errors.length,1);
 await f.call('imports/'+duplicate.id,{action:'Apply',version:1},hr,409);await f.call('imports/'+duplicate.id,{action:'Discard',version:1,reason:'Duplicate source; no data applied'});
 const uat=Object.fromEntries(UAT_CHECKS.map(c=>[c,{approved:true,reference:'SYNTHETIC AUTOMATED TEST, NOT HUMAN UAT'}]));
 await f.call('settings',{version:1,data:{stage:'Controlled Cutover',mode:'authoritative',uat,reconciliation:{approved:true,reference:report.reference}},confirm:'APPROVE NADI LEAVE CUTOVER'});
 same((await leaveContext(f.env.DB,'TEST-001',day,day)).length,1);
 same(f.sqlite.prepare("SELECT mode FROM leave_requests WHERE source_reference='fixture-future'").get().mode,'authoritative');
 await f.call('settings',{version:2,data:{mode:'validation',stage:'Parallel Validation'}},hr,409);
 // Attendance reads the canonical approved leave. Original clock evidence stays intact.
 const config={...DEFAULT_RULES,scheduleEnabled:true,effectiveFrom:prior,workingDays:[0,1,2,3,4,5,6]};
 f.sqlite.prepare("INSERT INTO attendance_config (id,data_json,version,updated_at) VALUES ('policy',?,1,?)").run(JSON.stringify(config),new Date().toISOString());
 f.sqlite.prepare("INSERT INTO attendance_sessions (id,employee_id,business_date,clock_in,clock_out,context,rule_json,flags_json,updated_at) VALUES ('fixture-clock','TEST-001',?,?,?,'Office',?,?,?)").run(day,new Date(day+'T10:00:00+08:00').toISOString(),new Date(day+'T11:00:00+08:00').toISOString(),JSON.stringify(config),JSON.stringify(['Late clock in','Early clock out']),new Date().toISOString());
 // Fix the attendance clock at Malaysia noon so morning evidence is historical, including just after midnight.
 const attendance=async(path,who=manager)=>{const RealDate=Date,asOf=RealDate.parse(day+'T12:00:00+08:00');globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[asOf]))}static now(){return asOf}};try{const r=await attendanceRoute(new Request('https://leave.test/api/attendance/'+path),f.env,{user:who,isPc});assert.equal(r.status,200,await r.clone().text());checks++;return await r.json();}finally{globalThis.Date=RealDate}};
 const live=await attendance('dashboard?date='+day);same(live.employees[0].state,'On Leave');same(live.employees[0].flags.includes('Late clock in'),false);same(live.employees[0].approvedContext.paid,true);
 const metrics=await attendance('metrics?from='+day+'&to='+day);same(metrics.employees[0].expectedDays,0);same(metrics.employees[0].exceptionSessions,0);same(metrics.employees[0].mpcScoreAffected,false);
 const future=f.sqlite.prepare("SELECT id,version FROM leave_requests WHERE source_reference='fixture-future'").get();await f.call('applications/'+future.id,{action:'Request cancellation',version:future.version},employee);await f.call('applications/'+future.id,{action:'Approve cancellation',version:future.version+1},manager);
 const cancelled=await attendance('dashboard?date='+day);same(cancelled.employees[0].state,'Clocked Out');same(cancelled.employees[0].flags.includes('Late clock in'),true);same(f.balance().used,0);same(f.balance().reserved,1);
 // A backdated half day reconciles prior timing flags without overwriting their history.
 f.sqlite.prepare("INSERT INTO attendance_sessions (id,employee_id,business_date,clock_in,clock_out,context,rule_json,flags_json,updated_at) VALUES ('fixture-half','TEST-001',?,?,?,'Office',?,?,?)").run(prior,new Date(prior+'T12:05:00+08:00').toISOString(),new Date(prior+'T18:00:00+08:00').toISOString(),JSON.stringify(config),JSON.stringify(['Late clock in']),new Date().toISOString());
 const half=await f.call('applications',{type:'Annual Leave',dates:[prior],duration:'Morning'},employee,201);await f.call('applications/'+half.id,{action:'Approve',version:1},manager);
 const backdated=await attendance('dashboard?date='+prior);same(backdated.employees[0].flags.includes('Late clock in'),false);same(backdated.employees[0].approvedContext.fraction,.5);
 same(f.sqlite.prepare("SELECT flags_json FROM attendance_sessions WHERE id='fixture-half'").get().flags_json,'["Late clock in"]');
 same(f.sqlite.prepare('SELECT count(*) n FROM mpc_submissions').get().n,0);
 same(f.sqlite.prepare("SELECT count(*) n FROM integration_events WHERE source_module='leave'").get().n>0,true);
}

// Supporting evidence is private. Delegation grants end immediately when revoked.
{
 const f=await setup({documentRequired:true,managerMedicalAccess:true}),form=new FormData();form.set('file',new File(['%PDF-1.7\nSynthetic evidence'],'test.pdf',{type:'application/pdf'}));
 const upload=await leaveRoute(new Request('https://leave.test/api/leave/documents',{method:'POST',headers:{origin:'https://leave.test'},body:form}),f.env,{user:employee,isPc});same(upload.status,201);const doc=await upload.json();same(f.objects.size,1);
 await f.call('applications',{type:'Annual Leave',dates:[day]},employee,400);
 const request=await f.call('applications',{type:'Annual Leave',dates:[day],documents:[doc.id]},employee,201);
 const download=who=>leaveRoute(new Request('https://leave.test/api/leave/documents/'+doc.id),f.env,{user:who,isPc});same((await download(manager)).status,200);same((await download(delegate)).status,403);
 await f.call('settings',{version:1,data:{delegates:[{from:'TEST-002',to:'TEST-003',start:day,end:add(day,7)}]}});same((await download(delegate)).status,200);
 same((await f.call('overview?scope=manager',undefined,delegate)).requests[0].canDecide,true);
 f.sqlite.prepare("DELETE FROM management_grants WHERE employee_id='TEST-003'").run();same((await download(delegate)).status,403);await f.call('applications/'+request.id,{action:'Approve',version:1},delegate,403);
 await f.call('applications/'+request.id,{action:'Reject',version:1},manager);same(f.balance().reserved,0);
 const fake=new FormData();fake.set('file',new File(['not a PDF'],'fake.pdf',{type:'application/pdf'}));same((await leaveRoute(new Request('https://leave.test/api/leave/documents',{method:'POST',headers:{origin:'https://leave.test'},body:fake}),f.env,{user:employee,isPc})).status,400);same(f.objects.size,1);
 same((await leaveRoute(new Request('https://leave.test/api/leave/settings',{method:'DELETE',headers:{origin:'https://leave.test'}}),f.env,{user:hr,isPc})).status,405);
}

// Multi-level reporting steps require separate decisions. New policy allocations
// require explicit reconciliation; reservations cannot silently change policy.
{
 const f=await setup();await f.call('assignment',{employeeId:'TEST-001',version:1,data:{...f.assignment,workflow:[{kind:'Reporting manager'},{kind:'Reporting manager'}]}});
 const request=await f.call('applications',{type:'Annual Leave',dates:[day]},employee,201);await f.call('applications/'+request.id,{action:'Approve',version:1},manager);same(f.balance().reserved,2);same(f.balance().used,0);
 await f.call('applications/'+request.id,{action:'Approve',version:2},manager,403);await f.call('applications/'+request.id,{action:'Approve',version:2},delegate);same(f.balance().used,2);
 const p=await f.call('policies',{...f.policyBody,effective:'2026-01-01',data:{...f.policyBody.data,days:22}},hr,201);
 await f.call('assignment',{employeeId:'TEST-001',version:2,data:{...f.assignment,policyIds:[p.id]}});
 await f.call('quote',{type:'Annual Leave',dates:[next]},employee,409);
 const old=f.balance();await f.call('recalculate',{accountId:old.id,version:old.version,reason:'TEST APPROVED POLICY REVISION'});same(f.balance().policy_id,p.id);same(f.balance().allocated,44);same(f.balance().used,2);same(available(f.balance()),42);
 await f.call('recalculate',{accountId:old.id,version:old.version,reason:'Stale'},hr,409);
 same(f.sqlite.prepare("SELECT count(*) n FROM leave_ledger WHERE action='Approved entitlement recalculation'").get().n,1);
}

// Year-end processing is repeat-safe and records carry expiry. Per-event leave
// can be requested again without treating each event limit as an annual limit.
{
 const f=await setup();await f.call('allocate',{employeeId:'TEST-001',year:2025});await f.call('year-end',{year:2025});const a=f.balance();same(a.carried,10);same(a.carry_expiry,'2026-03-31');
 await f.call('overview',undefined,employee);same(f.balance().expired_carry,10);same(available(f.balance()),40);await f.call('year-end',{year:2025},hr,400);
 const p=await f.call('policies',{...f.policyBody,name:'Per-event test policy',type:'Compassionate Leave',data:{...f.policyBody.data,method:'Per event',days:2,carryLimit:0}},hr,201);
 await f.call('assignment',{employeeId:'TEST-001',version:1,data:{...f.assignment,policyIds:[f.p.id,p.id]}});await f.call('allocate',{employeeId:'TEST-001',year:2026});
 for(const d of [day,next]){const r=await f.call('applications',{type:'Compassionate Leave',dates:[d]},employee,201);await f.call('applications/'+r.id,{action:'Approve',version:1},manager);}
 const per=f.sqlite.prepare("SELECT * FROM leave_accounts WHERE employee_id='TEST-001' AND leave_type='Compassionate Leave'").get();same(per.used,4);same(per.accrued,4);same(available(per),0);
 await f.call('quote',{type:'Compassionate Leave',from:add(next,1),to:add(next,3)},employee,409);
}

// Calendar-day proration respects leap years. Monthly accrual does not prorate a
// joiner's yearly entitlement a second time. Contract and service bands remain explicit.
{
 const p={status:'Published',effective_from:'2026-01-01',data_json:JSON.stringify({days:24,method:'Monthly accrual',proration:'Completed months',serviceBands:[],contractDays:{Contract:12}})};
 const n=entitlement(p,{overview:{dateJoined:'2026-07-01'}},2026,'2026-10-08');same(n.allocated,24);same(n.accrued,12);same(n.schedule.at(-1).units,24);
 same(entitlement(p,{overview:{dateJoined:'2026-07-01',employmentType:'Contract'}},2026,'2026-10-08').accrued,6);
 const annual={...p,effective_from:'2024-01-01',data_json:JSON.stringify({days:12,method:'Annual allocation',proration:'Calendar days'})};
 same(entitlement(annual,{overview:{dateJoined:'2024-07-01'}},2024).allocated,Math.floor(24*184/366));
 const band={...p,data_json:JSON.stringify({days:8,method:'Annual allocation',serviceBands:[{months:24,days:12},{months:60,days:16}]})};same(entitlement(band,{overview:{dateJoined:'2020-01-01'}},2026).allocated,32);
}
console.log(JSON.stringify({checks,status:'passed',realEmployeeWrites:0,emailsSent:0,areas:['staged imports and reconciliation','formal cutover controls','attendance full/half/cancellation','private evidence and revoked delegation','multi-level approvals','policy recalculation','carry expiry','repeatable per-event leave','proration and accrual']}));
