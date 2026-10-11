import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixture,employee,hr} from './test-profiles.mjs';
import {serviceDeskRoute} from '../worker/hr-service-api.js';
import {serviceOperations} from '../worker/hr-service-operations.js';
import {businessDate} from '../worker/profile-schema.js';
import {homePrioritiesRoute} from '../worker/home-priorities.js';
import worker from '../dist/server/index.js';
import {POLICIES} from '../dist/server/policy-assets.js';

const {env,sqlite,objects}=fixture();env.PC_EMAILS=hr.email;
// Use a synthetic catalogue entry so this suite needs no private institutional policies.
const policyPdf='%PDF-1.7\nSYNTHETIC PRIVATE POLICY';
const syntheticPolicy={id:'synthetic-private-policy',title:'Synthetic policy',status:'Synthetic approved fixture',statusNote:'Test only',version:'1',pages:1,description:'Synthetic access-control fixture',topics:[],jumps:[],searchText:'Synthetic policy',filename:'synthetic-policy.pdf',bytes:Buffer.byteLength(policyPdf),sha256:createHash('sha256').update(policyPdf).digest('hex')};
POLICIES.push(syntheticPolicy);
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const ctx=user=>({user,isPc:(_,email)=>email===hr.email});
const other={userId:'employee-2',email:'second@example.test'};
const day=businessDate(),shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const call=(path,user=employee,method='GET',data)=>serviceDeskRoute(new Request('https://service.test/api/hr-service'+path,{method,headers:{...(method==='GET'?{}:{origin:'https://service.test','content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env,ctx(user));
async function result(promise,status=200){const r=await promise;assert.equal(r.status,status,await r.clone().text());checks++;return r.json();}
async function create(neededBy=shift(-1),user=employee){
 const r=await serviceDeskRoute(new Request('https://service.test/api/hr-service/requests',{method:'POST',headers:{origin:'https://service.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({type:'HR query',subject:'Policy clarification',details:'Please clarify the applicable policy.',neededBy})}),env,ctx(user));
 return (await result(Promise.resolve(r),201)).request;
}
const action=(r,name,user=employee,extra={})=>call('/requests/'+r.id+'/actions',user,'POST',{action:name,version:r.version,...extra});
const events=(id,type)=>sqlite.prepare('SELECT COUNT(*) n FROM hr_service_events WHERE request_id=? AND event_type=?').get(id,type).n;
const priority=async user=>{const r=await homePrioritiesRoute(new Request('https://service.test/api/home/priorities'),env,ctx(user));eq(r.status,200);return r.json();};

for(const [needed_by,status,wanted]of [[shift(-1),'Submitted','past-requested-date'],[day,'Approved','due-today'],[shift(1),'In Review','upcoming'],[null,'Needs Information','no-date'],['2026-02-30','Submitted','no-date'],[shift(-1),'Issued','closed'],[shift(-1),'Rejected','closed'],[shift(-1),'Cancelled','closed']]){
 const o=serviceOperations({needed_by,status},day);eq(o.deadlineState,wanted);eq(o.canFollowUp,wanted==='past-requested-date');
}

let r=await create();eq(r.operations.canFollowUp,true);
const today=await create(day),future=await create(shift(1)),undated=await create(null);
await result(action(today,'followUp',employee,{message:'Not late yet'}),409);
await result(action(future,'followUp',employee,{message:'Not late yet'}),409);
await result(action(undated,'followUp',employee,{message:'No date'}),409);
await result(action(r,'followUp',employee,{message:'   '}),400);
await result(action(r,'followUp',other,{message:'Someone else’s request'}),404);
await result(action(r,'followUp',hr,{message:'Not the requester'}),403);
await result(action(r,'acknowledgeFollowUp',employee),403);
await result(action(r,'acknowledgeFollowUp',hr),409);
await result(action(r,'followUp',null,{message:'Anonymous'}),401);
await result(serviceDeskRoute(new Request('https://service.test/api/hr-service/requests/'+r.id+'/actions',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({action:'followUp',version:r.version,message:'Cross-origin'})}),env,ctx(employee)),403);

r=(await result(action(r,'saveDraft',hr,{reply:'PRIVATE DRAFT',internalNotes:'CONFIDENTIAL CASE NOTE'}))).request;
const reviewVersion=r.version;
r=(await result(action(r,'followUp',employee,{message:'Please update me on the policy clarification.'}))).request;
eq(r.status,'In Review');eq(r.version,reviewVersion+1);eq(r.operations.followUpPending,true);eq(r.operations.canFollowUp,false);eq(events(r.id,'Follow-up requested'),1);
await result(action(r,'followUp',employee,{message:'Repeated follow-up'}),409);eq(events(r.id,'Follow-up requested'),1);
let detail=await result(call('/requests/'+r.id));
eq(JSON.stringify(detail).includes('PRIVATE DRAFT'),false);eq(JSON.stringify(detail).includes('CONFIDENTIAL CASE NOTE'),false);
eq(detail.events.find(e=>e.event_type==='Follow-up requested').message,'Please update me on the policy clarification.');
eq(detail.events.some(e=>e.message.includes('"version":')),false);
const own=await result(call('/requests')),theirs=await result(call('/requests',other));
eq(own.operations.followUpPending,1);eq(own.operations.pastRequestedDate,1);eq(own.operations.dueToday,1);eq(theirs.operations.followUpPending,0);
const adminQueue=await result(call('/requests?scope=admin',hr));eq(adminQueue.requests[0].id,r.id);eq(adminQueue.operations.followUpPending,1);
let p=await priority(hr);eq(p.items.find(i=>i.id==='hr-follow-ups').count,1);eq(p.items.find(i=>i.id==='hr-past-requested-date').count,1);eq(JSON.stringify(p).includes('Policy clarification'),false);
p=await priority(employee);eq(p.items.some(i=>i.id==='hr-follow-ups'),false);

// Acknowledging a follow-up preserves approval, prepared documents and private notes.
r=(await result(action(r,'approve',hr))).request;const approval={approvedAt:r.approvedAt,status:r.status};
r=(await result(action(r,'acknowledgeFollowUp',hr))).request;
eq(r.operations.followUpPending,false);eq(r.operations.canFollowUp,true);eq(r.status,approval.status);eq(r.approvedAt,approval.approvedAt);eq(r.internalNotes,'CONFIDENTIAL CASE NOTE');eq(r.draftReply,'PRIVATE DRAFT');
await result(action(r,'acknowledgeFollowUp',hr),409);
r=(await result(action(r,'followUp',employee,{message:'Still awaiting issue.'}))).request;eq(r.status,'Approved');eq(r.approvedAt,approval.approvedAt);
// Event order uses request versions, independent of timestamps or UUID ordering.
sqlite.prepare("UPDATE hr_service_events SET created_at='2026-01-01T00:00:00.000Z' WHERE request_id=? AND event_type IN ('Follow-up requested','Follow-up acknowledged')").run(r.id);
eq((await result(call('/requests/'+r.id))).request.operations.followUpPending,true);
r=(await result(action(r,'issue',hr))).request;eq(r.operations.followUpPending,false);eq(r.operations.canFollowUp,false);
await result(action(r,'followUp',employee,{message:'Closed request'}),409);
eq((await result(call('/requests?scope=admin',hr))).operations.pastRequestedDate,0);

const awaiting=await create();sqlite.prepare("UPDATE hr_service_requests SET status='Needs Information' WHERE id=?").run(awaiting.id);
p=await priority(employee);eq(p.items.find(i=>i.id==='hr-information').count,1);
let needed=(await result(call('/requests/'+awaiting.id))).request;
needed=(await result(action(needed,'followUp',employee,{message:'I need an update.'}))).request;eq(needed.status,'Needs Information');
await result(action(needed,'information',employee,{message:'Here are the requested details.'}));
eq((await result(call('/requests/'+needed.id))).request.operations.followUpPending,true);

// Conflicts and eligibility revocation must not leave a follow-up event behind.
for(const mutation of [
 id=>sqlite.prepare('UPDATE hr_service_requests SET version=version+1 WHERE id=?').run(id),
 ()=>sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run(),
 ()=>sqlite.prepare("UPDATE employees SET account_user_id='relinked-account' WHERE employee_id='TEST-001'").run(),
 ()=>sqlite.prepare("INSERT INTO employees(employee_id,employee_name,email,active) VALUES ('DUP','Duplicate','EMPLOYEE@EXAMPLE.TEST',1)").run(),
 ()=>sqlite.prepare("INSERT INTO employee_profile_sections(employee_id,section,data_json,version,updated_by,updated_at) VALUES('TEST-001','exit',?,1,?,?)").run(JSON.stringify({autoLifecycle:'Enabled',lastWorkingDay:shift(-1)}),hr.userId,day),
]){
 const race=await create(),batch=env.DB.batch;
 env.DB.batch=async statements=>{env.DB.batch=batch;mutation(race.id);return batch.call(env.DB,statements);};
 await result(action(race,'followUp',employee,{message:'Race follow-up'}),409);eq(events(race.id,'Follow-up requested'),0);
 sqlite.prepare("UPDATE employees SET active=1,account_user_id=? WHERE employee_id='TEST-001'").run(employee.userId);sqlite.prepare("DELETE FROM employees WHERE employee_id='DUP'").run();sqlite.prepare("DELETE FROM employee_profile_sections WHERE section='exit'").run();
}

const ackRace=(await result(call('/requests/'+needed.id,hr))).request,batch=env.DB.batch;
env.DB.batch=async statements=>{env.DB.batch=batch;sqlite.prepare('UPDATE hr_service_requests SET version=version+1 WHERE id=?').run(ackRace.id);return batch.call(env.DB,statements);};
await result(action(ackRace,'acknowledgeFollowUp',hr),409);eq(events(ackRace.id,'Follow-up acknowledged'),0);

// New service and home responses cannot expose restricted employee-relations records.
sqlite.prepare("INSERT INTO employee_profile_sections(employee_id,section,data_json,version,updated_by,updated_at) VALUES('TEST-001','relations',?,1,?,?)").run(JSON.stringify({cases:[{type:'Counselling',details:'RESTRICTED CASE DETAIL',status:'Open'}]}),hr.userId,day);
const hosted=(path,user=employee)=>worker.fetch(new Request('https://service.test'+path,{headers:user?{'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email}:{}}),env,{waitUntil(){}});
for(const path of ['/api/profiles/me','/api/home/priorities','/api/hr-service/requests']){const response=await hosted(path);eq(response.status,200);eq((await response.text()).includes('RESTRICTED CASE DETAIL'),false);}
eq((await hosted('/api/profiles/TEST-001',other)).status,403);
eq((await hosted('/api/profiles/TEST-001',hr)).status,200);
const page=await hosted('/employee/requests');eq(page.status,200);const html=await page.text();eq(html.includes('id="attention-filter"'),true);eq(html.includes('href="/policies"'),true);
const policy=await hosted('/policies');eq(policy.status,200);eq((await policy.text()).includes('/employee/requests?type=HR%20query'),true);
eq((await hosted('/policies/files/'+syntheticPolicy.id,null)).status,302);
objects.set('policy-library/'+syntheticPolicy.id+'/'+syntheticPolicy.sha256+'.pdf',policyPdf);
const file=await hosted('/policies/files/'+syntheticPolicy.id);eq(file.status,200);eq(file.headers.get('cache-control'),'private, no-store');eq(file.headers.get('x-policy-sha256'),syntheticPolicy.sha256);
eq(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);sqlite.close();

// Prioritisation and counts cover the complete queue even when display is bounded.
const large=fixture();large.env.PC_EMAILS=hr.email;
const insert=large.sqlite.prepare('INSERT INTO hr_service_requests(id,reference,employee_id,created_by,request_type,subject,details,needed_by,status,last_operation,submission_key,submission_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
let oldest;
for(let i=0;i<501;i++){const id=crypto.randomUUID();if(!i)oldest=id;insert.run(id,'HR-'+i,'TEST-001',employee.userId,'HR query','Bounded request','Synthetic',shift(-1),'Submitted',id,id,'hash',new Date(i*1000).toISOString(),day);}
large.sqlite.prepare('INSERT INTO hr_service_events(id,request_id,actor_id,actor_email,actor_role,event_type,message,created_at) VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),oldest,employee.userId,employee.email,'employee','Follow-up requested',JSON.stringify({version:2,message:'Oldest pending follow-up'}),day);
const queue=await result(serviceDeskRoute(new Request('https://service.test/api/hr-service/requests?scope=admin'),large.env,ctx(hr)));
eq(queue.requests.length,500);eq(queue.requests[0].id,oldest);eq(queue.counts.total,501);eq(queue.operations.pastRequestedDate,501);eq(queue.operations.followUpPending,1);large.sqlite.close();
console.log(JSON.stringify({passed:true,checks,coverage:'Requested dates in Malaysia, ownership, same-origin writes, version-ordered follow-ups, approval preservation, atomic conflicts and eligibility revocation, scoped home counts, confidential records, private policies and bounded queue totals',productionDataUsed:false}));
