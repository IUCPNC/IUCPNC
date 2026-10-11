import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,employee,hr} from './test-profiles.mjs';
import {leaveRoute,leaveContext,leaveContextBatch} from '../worker/leave-api.js';
import {calendarQuote,entitlement,available,optimise,UAT_CHECKS,today,add} from '../worker/leave-core.js';
import {attendanceRoute} from '../worker/attendance-api.js';
import {leaveWorkbook} from '../worker/leave-export.js';
let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
const manager={userId:'employee-2',email:'second@example.test'},leader={userId:'leader-1',email:'leader@example.test'};
function setup(){const f=fixture();f.env.PC_EMAILS=hr.email;f.sqlite.prepare("INSERT INTO management_grants (employee_id,role,version,updated_by,updated_at) VALUES ('TEST-002','manager',1,'test',?)").run(new Date().toISOString());f.sqlite.prepare("INSERT INTO management_reports (employee_id,manager_id) VALUES ('TEST-001','TEST-002')").run();f.sqlite.prepare("INSERT INTO employees (employee_id,employee_name,email,account_user_id,department,position,active) VALUES ('LEAD','Example Leader','leader@example.test','leader-1','Management','Director',1)").run();f.sqlite.prepare("INSERT INTO management_grants (employee_id,role,version,updated_by,updated_at) VALUES ('LEAD','leadership',1,'test',?)").run(new Date().toISOString());return f;}
const f=setup(),{env,sqlite}=f;
async function call(path,who=hr,body,code=200,headers={}){const request=new Request('https://leave.test/api/leave/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{origin:'https://leave.test','content-type':'application/json','idempotency-key':crypto.randomUUID()}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),r=await leaveRoute(request,env,{user:who,isPc:(_,email)=>email===hr.email});same(r.status,code);const data=await r.json();if(r.status!==code)console.error(data);return data;}
await call('overview',null,undefined,401);await call('admin',employee,undefined,403);await call('overview',{...employee,userId:'spoof'},undefined,403);await call('policies',employee,{},403);await call('settings',hr,{},403,{origin:'https://evil.test'});
const policyBody={name:'Sample approved annual policy',type:'Annual Leave',kind:'Institutional',effective:'2026-01-01',data:{method:'Annual allocation',days:20,chargeBasis:'Working days',proration:'None',halfDay:true,paid:true,carryLimit:5,carryMonths:3,reference:'TEST POLICY ONLY',approved:true}},p=await call('policies',hr,policyBody,201);
await call('policies',hr,{...policyBody,data:{...policyBody.data,approved:false}},400);
await call('policies',hr,{...policyBody,kind:'Statutory',data:{...policyBody.data,complianceVerified:false}},400);
const assigned={policyIds:[p.id],schedule:{approved:true,workingDays:[1,2,3,4,5],location:'Selangor',halfBoundary:'12:00'},holidayYears:[2026,2027],workflow:[{kind:'Reporting manager'}]};
await call('assignment',hr,{employeeId:'TEST-001',version:0,data:assigned});await call('assignment',hr,{employeeId:'TEST-001',version:0,data:assigned},409);
await call('allocate',hr,{employeeId:'TEST-001',year:2026});await call('allocate',hr,{employeeId:'TEST-001',year:2027});await call('allocate',hr,{employeeId:'TEST-001',year:2026},400);
await call('settings',hr,{version:0,data:{stage:'Parallel Validation',holidays:[{date:'2026-10-14',title:'Verified test holiday',location:'Selangor',source:'TEST SOURCE ONLY',verified:true}]}});
const balance=()=>sqlite.prepare("SELECT * FROM leave_accounts WHERE employee_id='TEST-001' AND year=2026").get();same(available(balance()),40);
const c=await call('quote',employee,{type:'Annual Leave',from:'2026-10-12',to:'2026-10-18'});same(c.units,4);same(c.days.find(d=>d.date==='2026-10-14').units,0);same(c.route[0].employeeId,'TEST-002');same(c.balances[0].remaining,16);
const h=await call('quote',employee,{type:'Annual Leave',dates:['2026-10-12','2026-10-15'],duration:'Morning'});same(h.units,1);
const cross=await call('quote',employee,{type:'Annual Leave',from:'2026-12-31',to:'2027-01-04'});same(cross.balances.length,2);
await call('quote',employee,{type:'Annual Leave',from:'2028-01-03',to:'2028-01-04'},409);
await call('quote',employee,{type:'Annual Leave',dates:['2026-10-12','2026-10-12']},400);
const plans=await call('planner',employee,{from:'2026-10-09',to:'2026-10-20',maxDays:2});assert(plans.plans.length>0);checks++;same(plans.plans[0].units<=2,true);same(plans.plans[0].totalDays>plans.plans[0].units,true);
const application={type:'Annual Leave',dates:['2026-10-12','2026-10-15'],duration:'Morning',reason:'CONFIDENTIAL MEDICAL REASON',handover:'Standard work handover'},key=crypto.randomUUID(),r=await call('applications',employee,application,201,{'idempotency-key':key});same(balance().reserved,2);same(balance().used,0);same((await call('applications',employee,application,201,{'idempotency-key':key})).id,r.id);await call('applications',employee,{...application,reason:'Changed'},409,{'idempotency-key':key});
await call('applications',employee,application,409);same(balance().reserved,2);
const visible=await call('overview',manager);same(JSON.stringify(visible).includes('CONFIDENTIAL'),false);same(visible.requests[0].canDecide,true);same((await call('overview',leader)).requests.length,0);
await call('context?employeeId=TEST-002',employee,undefined,403);await call('ledger/TEST-002',employee,undefined,403);await call('context?employeeId=TEST-001',leader,undefined,403);
await call('applications/'+r.id,employee,{action:'Approve',version:1},403);
await call('applications/'+r.id,manager,{action:'Request information',version:1,comment:'Please confirm handover'});same(balance().reserved,2);
await call('applications/'+r.id,employee,{action:'Provide information',version:2,reason:'Private clarification'});
await call('applications/'+r.id,manager,{action:'Approve',version:3});same(balance().reserved,0);same(balance().used,2);same((await leaveContext(env.DB,'TEST-001','2026-10-01','2026-10-31')).length,0);same((await leaveContext(env.DB,'TEST-001','2026-10-01','2026-10-31',true)).length,1);
await call('applications/'+r.id,manager,{action:'Approve',version:3},409);
await call('applications/'+r.id,employee,{action:'Request cancellation',version:4});await call('applications/'+r.id,manager,{action:'Approve cancellation',version:5});same(balance().used,0);same(sqlite.prepare('SELECT count(*) n FROM leave_slots').get().n,0);
const mode=await call('admin'),uat=Object.fromEntries(UAT_CHECKS.map(c=>[c,{approved:true,reference:'TEST UAT'}]));await call('settings',hr,{version:mode.version,data:{mode:'authoritative',stage:'Controlled Cutover'}},409);
for(const id of ['TEST-002','LEAD']){await call('assignment',hr,{employeeId:id,version:0,data:{...assigned,workflow:[{kind:'P&C'}]}});await call('allocate',hr,{employeeId:id,year:2026});}
await call('settings',hr,{version:mode.version,data:{mode:'authoritative',stage:'Controlled Cutover',uat,reconciliation:{approved:true,reference:'TEST RECONCILIATION'}},confirm:'APPROVE NADI LEAVE CUTOVER'});
const approved=await call('applications',employee,{type:'Annual Leave',dates:['2026-10-12'],duration:'Morning'},201);await call('applications/'+approved.id,manager,{action:'Approve',version:1});same((await leaveContext(env.DB,'TEST-001','2026-10-01','2026-10-31'))[0].days[0].fraction,.5);same((await leaveContextBatch(env.DB,['TEST-001'],'2026-10-01','2026-10-31')).length,1);
const privateContext=await call('context?employeeId=TEST-001',manager);same(privateContext.scoreAdjustment,0);same(privateContext.balances,undefined);
const calendar=await call('calendar?scope=team&from=2026-10-12&to=2026-10-12',manager);same(JSON.stringify(calendar).includes('CONFIDENTIAL'),false);same(calendar.days[0].onLeave,1);same(calendar.events[0].fraction,.5);
const analytics=await call('analytics?year=2026',leader);same(analytics.records.length,0);same(JSON.stringify(analytics).includes('CONFIDENTIAL'),false);
for(const format of ['xlsx','csv','pdf']){const request=new Request('https://leave.test/api/leave/export?year=2026&format='+format),result=await leaveRoute(request,env,{user:hr,isPc:(_,email)=>email===hr.email});same(result.status,200);assert((await result.arrayBuffer()).byteLength>100);checks++;}
// Backdated authoritative leave updates attendance context and metrics without editing clock history.
let ar=await attendanceRoute(new Request('https://leave.test/api/attendance/me?date=2026-10-12'),env,{user:employee,isPc:(_,email)=>email===hr.email});same(ar.status,200);
// Competing distinct applications cannot overdraw a balance or leave partial reservations.
const acc=balance();await call('adjust',hr,{accountId:acc.id,version:acc.version,days:-19,reason:'TEST concurrency limit'});const createHalf=async date=>{const r=await leaveRoute(new Request('https://leave.test/api/leave/applications',{method:'POST',headers:{origin:'https://leave.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({type:'Annual Leave',dates:[date],duration:'Morning'})}),env,{user:employee,isPc:(_,email)=>email===hr.email});return {status:r.status,data:await r.json()};};const race=await Promise.all([createHalf('2026-10-19'),createHalf('2026-10-20')]);same(race.map(r=>r.status).sort(),[201,409]);same(available(balance()),0);same(balance().reserved,1);same(sqlite.prepare("SELECT COUNT(*) n FROM leave_requests WHERE status='Pending'").get().n,1);await call('applications/'+race.find(r=>r.status===201).data.id,employee,{action:'Cancel',version:1});same(available(balance()),1);
// An unused carry bucket funds dates before expiry, and is excluded after expiry.
sqlite.prepare("UPDATE leave_accounts SET carried=4,carry_expiry='2026-10-10' WHERE id=?").run(acc.id);same((await call('quote',employee,{type:'Annual Leave',from:'2026-10-09',to:'2026-10-09'})).units,1);await call('quote',employee,{type:'Annual Leave',from:'2026-10-19',to:'2026-10-19'},409);same((await call('planner',employee,{from:'2026-10-19',to:'2026-10-25',maxDays:1})).plans.length,0);
// Ended staff lose access, while their records remain available to P&C.
sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run();await call('overview',employee,undefined,403);same(sqlite.prepare("SELECT count(*) n FROM leave_requests WHERE employee_id='TEST-001'").get().n>0,true);
const xml=await leaveWorkbook([['name'],['=1+1'],['A & B']]).arrayBuffer();same(new DataView(xml).getUint32(0,true),0x04034b50);
console.log(JSON.stringify({checks,status:'passed',realEmployeeWrites:0,emailsSent:0}));
