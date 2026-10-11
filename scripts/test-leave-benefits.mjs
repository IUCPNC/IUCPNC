import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {fixture,employee,hr} from './test-profiles.mjs';
import {BENEFITS_PRESETS,verifySnapshot,snapshotFunding,benefitWarnings} from '../worker/leave-benefits.js';
import {policyInput,entitlement,calendarQuote,available,today,add,applicable} from '../worker/leave-core.js';
import {leaveRoute} from '../worker/leave-api.js';

let checks=0;
const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
const reject=(fn,re)=>{assert.throws(fn,re);checks++;};
function policy(id,extra={}){const p=structuredClone(BENEFITS_PRESETS.find(p=>p.id===id));return {id:id,name:p.name,leave_type:p.type,kind:p.kind,effective_from:'2026-01-01',status:'Published',data_json:JSON.stringify({...p.data,...extra})};}

const full=policy('iuc-full-annual'),profile={overview:{dateJoined:'2016-10-08',employmentType:'Permanent'}};
same(entitlement(full,profile,2026,'2026-10-07').allocated,42);
same(entitlement(full,profile,2026,'2026-10-08').allocated,50);
same(entitlement(full,{overview:{dateJoined:'2017-01-01'}},2026,'2026-10-08').allocated,42);
same(entitlement(full,{overview:{dateJoined:'2025-01-01'}},2026,'2027-01-01').accrued,28);
same(entitlement(full,{overview:{dateJoined:'2010-01-01'}},2026,'2027-01-01').accrued,48);
same(entitlement(full,{overview:{dateJoined:'2010-01-01'}},2026,'2027-01-01').rateDifference,-1);
same(entitlement(full,{overview:{dateJoined:'2025-01-01'}},2026,'2027-01-01').rateDifference,.4);
same(applicable(full,{overview:{employmentType:'Part-Time'}},today()),false);
same(applicable(full,{overview:{employmentType:'Contract'}},today()),true);
same(applicable(policy('iuc-part-annual'),{overview:{employmentType:'Part-Time'}},today()),true);
for(const [id,joined,expected] of [['iuc-full-medical','2025-01-01',14],['iuc-full-medical','2023-01-01',18],['iuc-full-medical','2020-01-01',22],['iuc-part-annual','2025-01-01',6],['iuc-part-annual','2023-01-01',8],['iuc-part-annual','2020-01-01',11],['iuc-part-medical','2025-01-01',10],['iuc-part-medical','2023-01-01',13],['iuc-part-medical','2020-01-01',15]])same(entitlement(policy(id),{overview:{dateJoined:joined}},2026,'2026-10-08').allocated,expected*2);
reject(()=>policyInput({name:'Invalid medical waiting period',type:'Medical Leave',kind:'Statutory',effective:'2026-01-01',data:{...JSON.parse(policy('iuc-full-medical').data_json),approved:true,complianceVerified:true,eligibilityDelayDays:90}}),/annual/i);
reject(()=>policyInput({name:'Duplicate bands',type:'Annual Leave',kind:'Institutional',effective:'2026-01-01',data:{...JSON.parse(full.data_json),approved:true,serviceBands:[{months:0,days:14},{months:0,days:18}]}}),/distinct/i);

const calendar={schedule:{approved:true,workingDays:[1,2,3,4,5],location:'Selangor'},holidayYears:[2026,2027]},maternity=policy('iuc-maternity');
same(calendarQuote({from:'2026-10-08',to:add('2026-10-08',97)},calendar,[],maternity).units,196);
reject(()=>calendarQuote({from:'2026-10-08',to:'2026-10-20'},calendar,[],maternity),/98 consecutive/);
reject(()=>calendarQuote({dates:['2026-10-08',add('2026-10-08',97)]},calendar,[],maternity),/98 consecutive/);
reject(()=>calendarQuote({from:'2026-10-08',to:add('2026-10-08',97),duration:'Morning'},calendar,[],maternity),/half-day/);
const planningQuote={start:'2026-10-08',days:[{date:'2026-10-08',units:2},{date:'2026-10-09',units:2},{date:'2026-10-12',units:2},{date:'2026-10-13',units:2}]};
same(benefitWarnings(full,planningQuote,[],'2026-10-08').length,2);
same(benefitWarnings(policy('iuc-full-medical'),planningQuote,[],'2026-10-08').some(x=>/planning|advance/i.test(x)),false);

// Totals are preserved independently of zero monthly columns. A held variance
// cannot turn into a hidden adjustment, and name-only guesses cannot match IDs.
const row={reference:'annual-fixture-source-reference',employeeId:'TEST-001',employeeName:'First Example',kind:'Balance',type:'Annual Leave',year:2026,allocated:14,sourceTaken:4.5,opening:9.5,carried:0,sourceFormat:'Annual_All',sourceAsOf:'2026-10-08',sourceSha256:'a'.repeat(64),sourceMonthly:Array(12).fill(0)};
same(verifySnapshot(row,{employee_name:'FIRST EXAMPLE'},'2026-10-08').undistributedDays,4.5);
same(verifySnapshot(row,{employee_name:'Dr. First Example'},'2026-10-08').registeredName,'Dr. First Example');
same(verifySnapshot({...row,employeeName:'Professor Dr. First Example'},{employee_name:'FIRST EXAMPLE'},'2026-10-08').taken,9);
reject(()=>verifySnapshot(row,{employee_name:'Dr. Second Example'},'2026-10-08'),/name differs/);
reject(()=>verifySnapshot({...row,allocated:14,sourceTaken:16,opening:0},{employee_name:'First Example'},'2026-10-08'),/gives -2/);
reject(()=>verifySnapshot(row,{employee_name:'Another employee'},'2026-10-08'),/name differs/);
reject(()=>verifySnapshot({...row,sourceAsOf:'2026-10-09'},{employee_name:'First Example'},'2026-10-08'),/no later/);
const funded=snapshotFunding(row,full,{},'2026-10-08');same(funded.available,9.5);same(funded.taken,9);same(funded.accrued,28);same(funded.schedule.at(-1).units,28);

const sandbox={window:{},TextDecoder,Blob,Response,DecompressionStream};vm.runInNewContext(fs.readFileSync('worker/leave-files.js','utf8'),sandbox);
const sourceRows=[['Employee','Employee ID','Entitlement','January','February','March','April','May','June','July','August','September','October','November','December','Total taken','Balance'],['First Example','TEST-001',14,...Array(12).fill(0),4.5,9.5]];
same(sandbox.window.NadiLeaveFiles.isAnnual(sourceRows),true);
const mapped=sandbox.window.NadiLeaveFiles.annualRows(sourceRows,{year:2026,asOf:'2026-10-08',sha256:'a'.repeat(64)})[0];same(mapped.sourceTaken,4.5);same(mapped.opening,9.5);same(mapped.sourceMonthly.length,12);
const csvSource=sandbox.window.NadiLeaveFiles.csv(sourceRows);
same(sandbox.window.NadiLeaveFiles.readText('\uFEFF'+csvSource)[1][1],'TEST-001');
same(sandbox.window.NadiLeaveFiles.isAnnual(sandbox.window.NadiLeaveFiles.readText(csvSource)),true);
reject(()=>sandbox.window.NadiLeaveFiles.readText('Header\n"Unclosed'),/unclosed/);
reject(()=>sandbox.window.NadiLeaveFiles.readText('Header\n'+Array(251).fill('row').join('\n')),/250/);

const f=fixture();f.env.PC_EMAILS=hr.email;const isPc=(_,email)=>email===hr.email;
async function call(path,body,who=hr,code=200){const r=await leaveRoute(new Request('https://leave.test/api/leave/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{origin:'https://leave.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.env,{user:who,isPc});assert.equal(r.status,code,await r.clone().text());checks++;return r.json();}
const actualName=f.sqlite.prepare("SELECT employee_name FROM employees WHERE employee_id='TEST-001'").get().employee_name;
const source={...row,employeeName:actualName};
await call('imports',{source:'SYNTHETIC annual snapshot',rows:[source],snapshot:{asOf:'2026-10-08',approved:true}},employee,403);
await call('imports',{source:'SYNTHETIC annual snapshot',rows:[source]},hr,400);
const imp=await call('imports',{source:'SYNTHETIC annual snapshot',rows:[source,{...source,reference:'invalid-row-fixture',employeeId:'MISSING'}],snapshot:{asOf:'2026-10-08',approved:true}},hr,201);
same(imp.rows.length,1);same(imp.errors.length,1);
await call('imports/'+imp.id,{action:'Apply',version:1},hr,409);
await call('imports/'+imp.id,{action:'Apply',version:1,allowPartial:true});
const balance=()=>f.sqlite.prepare("SELECT * FROM leave_accounts WHERE employee_id='TEST-001' AND year=2026").get();
same(balance().allocated,28);same(balance().used,9);same(available(balance()),19);
same(f.sqlite.prepare('SELECT count(*) n FROM leave_requests').get().n,0);
const report=await call('reconcile/'+imp.id,{version:2});same(report.comparisons[0].variance,0);same(report.heldExceptions.length,1);same(report.status,'Matched rows verified; source exceptions remain');
await call('imports/'+imp.id,{action:'Supersede',version:3,replacementId:imp.id,resolutions:[]},hr,409);
const corrected=await call('imports',{source:'SYNTHETIC corrected complete snapshot',rows:[{...source,reference:'corrected-synthetic-source-reference'}],snapshot:{asOf:'2026-10-08',approved:true}},hr,201);
await call('imports/'+corrected.id,{action:'Apply',version:1});
await call('imports/'+imp.id,{action:'Supersede',version:3,replacementId:corrected.id,resolutions:[]},hr,409);
await call('reconcile/'+corrected.id,{version:2});
await call('imports/'+imp.id,{action:'Supersede',version:3,replacementId:corrected.id,resolutions:[]},hr,409);
await call('imports/'+imp.id,{action:'Supersede',version:3,replacementId:corrected.id,resolutions:[{row:3,outcome:'Corrected balance',employeeId:'MISSING',reason:'Synthetic source evidence'}]},hr,409);
await call('imports/'+imp.id,{action:'Supersede',version:3,replacementId:corrected.id,resolutions:[{row:3,outcome:'Documented exclusion',reason:'Synthetic non-employee row confirmed by fixture source owner'}]});
same(f.sqlite.prepare('SELECT status FROM leave_imports WHERE id=?').get(imp.id).status,'Superseded');
same(JSON.parse(f.sqlite.prepare('SELECT data_json FROM leave_imports WHERE id=?').get(imp.id).data_json).errors.length,1);
same(available(balance()),19);
same((await call('overview',undefined,employee)).accounts[0].used,4.5);
same((await call('overview',undefined,employee)).policies.length,0);
same((await call('admin')).benefits.presets.length,6);
// Replacing the baseline with an approved benefit policy keeps the source bank
// funded once, while the policy governs subsequent leave and future years.
const benefitsBody=structuredClone(BENEFITS_PRESETS[0]);benefitsBody.effective='2026-01-01';benefitsBody.data.approved=true;
const published=await call('policies',benefitsBody,hr,201);
f.sqlite.prepare("INSERT OR REPLACE INTO employee_profile_sections (employee_id,section,data_json,updated_by,updated_at) VALUES ('TEST-001','overview',?,'test',?)").run(JSON.stringify({dateJoined:'2025-01-01',employmentType:'Permanent'}),new Date().toISOString());
await call('assignment',{employeeId:'TEST-001',version:0,data:{policyIds:[published.id],schedule:{approved:true,workingDays:[0,1,2,3,4,5,6],location:'Selangor',halfBoundary:'12:00'},holidayYears:[2026,2027],workflow:[{kind:'P&C'}]}});
await call('recalculate',{accountId:balance().id,version:balance().version,reason:'SYNTHETIC approved policy setup'});
same(balance().used,9);same(balance().allocated,28);same(available(balance()),19);
await call('overview',undefined,employee);same(balance().accrued,28);
const quote=await call('quote',{type:'Annual Leave',from:today(),to:today()},employee);same(quote.ruleWarnings.some(x=>/advance notice/.test(x)),true);
f.sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run();await call('overview',undefined,employee,403);same(balance().used,9);
// A realistic export must use a bounded number of database reads. This catches
// per-row remote lookups that made production imports take several minutes.
const bulk=fixture();bulk.env.PC_EMAILS=hr.email;let databaseReads=0;const prepare=bulk.env.DB.prepare.bind(bulk.env.DB);
bulk.env.DB.prepare=(sql)=>{const statement=prepare(sql);for(const method of ['first','all']){const original=statement[method].bind(statement);statement[method]=async()=>{databaseReads++;return original();};}return statement;};
const bulkRows=Array.from({length:50},(_,i)=>{const id='BULK-'+i,name='Import fixture '+i;bulk.sqlite.prepare('INSERT INTO employees (employee_id,employee_name,email,position,department,appraiser,active) VALUES (?,?,?,?,?,?,?)').run(id,name,id+'@example.test','Executive','Finance','Example Manager',i===49?0:1);return {...row,reference:'bulk-source-row-'+i,employeeId:id,employeeName:name};});
async function bulkCall(path,body){databaseReads=0;const response=await leaveRoute(new Request('https://leave.test/api/leave/'+path,{method:'POST',headers:{origin:'https://leave.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify(body)}),bulk.env,{user:hr,isPc});assert.equal(response.status,path==='imports'?201:200,await response.clone().text());checks++;assert.ok(databaseReads<25,'Bulk import database reads must stay bounded: '+databaseReads);checks++;return response.json();}
const bulkImport=await bulkCall('imports',{source:'SYNTHETIC 50-row annual snapshot',rows:bulkRows,snapshot:{asOf:'2026-10-08',approved:true}});
same(bulkImport.rows.length,50);same(bulkImport.summary.archived,1);
await bulkCall('imports/'+bulkImport.id,{action:'Apply',version:1});
same(bulk.sqlite.prepare('SELECT count(*) n FROM leave_accounts').get().n,50);
same(bulk.sqlite.prepare('SELECT sum(used) n FROM leave_accounts').get().n,450);
const bulkReport=await bulkCall('reconcile/'+bulkImport.id,{version:2});same(bulkReport.status,'Verified');same(bulkReport.comparisons.every(c=>c.variance===0),true);
console.log(JSON.stringify({checks,status:'passed',realEmployeeWrites:0,emailsSent:0,source:'Synthetic fixtures only'}));
