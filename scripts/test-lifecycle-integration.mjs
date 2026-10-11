import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {profileRoute} from '../worker/profile-api.js';
import {businessDate} from '../worker/profile-schema.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const day=businessDate(),shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
const exit={autoLifecycle:'Enabled',resignationDate:shift(-10),lastWorkingDay:shift(-1),alumniApproved:'No'};
function setup(instruction=exit){
 const f=fixture();f.sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_by,updated_at) VALUES ('TEST-001','exit',?,1,?,CURRENT_TIMESTAMP)").run(JSON.stringify(instruction),hr.userId);return f;
}
async function open(f,user=hr){return profileRoute(new Request('https://profile.test/api/profiles/'+(user===hr?'TEST-001':'me')),f.env,{user,isPc:(_,email)=>email===hr.email});}
function state(f){return {...f.sqlite.prepare("SELECT active,employment_id FROM employees WHERE employee_id='TEST-001'").get(),...f.sqlite.prepare("SELECT employment_status,end_date FROM employment_records WHERE employee_id='TEST-001'").get()};}
function trail(f){return ['profile_revisions','integration_events'].map(t=>f.sqlite.prepare('SELECT COUNT(*) n FROM '+t).get().n).concat(f.sqlite.prepare("SELECT COUNT(*) n FROM profile_audit WHERE action='lifecycle_transition'").get().n);}
// One existing approved instruction, one atomic transition, no duplicate trail on reopen.
{
 const f=setup();const r=await open(f);eq(r.status,200);const payload=await r.json();eq(payload.employee.active,0);eq(payload.sections.overview.employmentStatus,'Exited');eq(payload.sourceSectionRows,undefined);eq(state(f).employment_status,'ended');eq(state(f).end_date,exit.lastWorkingDay);eq(trail(f),[1,1,1]);await open(f);eq(trail(f),[1,1,1]);eq((await open(f,employee)).status,403);eq(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}
// Simulated concurrent edits happen after reads, immediately before the D1 batch.
for(const mutate of [
 f=>f.sqlite.prepare("UPDATE employee_profile_sections SET data_json=?,version=version+1 WHERE section='exit'").run(JSON.stringify({...exit,autoLifecycle:'Disabled'})),
 f=>f.sqlite.prepare("UPDATE employee_profile_sections SET data_json=?,version=version+1 WHERE section='exit'").run(JSON.stringify({...exit,lastWorkingDay:shift(20)})),
 f=>f.sqlite.prepare("DELETE FROM employee_profile_sections WHERE section='exit'").run(),
 f=>f.sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_by,updated_at) VALUES ('TEST-001','overview','{\"employmentStatus\":\"Active\"}',1,'other',CURRENT_TIMESTAMP)").run(),
 f=>f.sqlite.prepare("UPDATE employees SET employment_id=NULL WHERE employee_id='TEST-001'").run(),
 f=>f.sqlite.prepare("UPDATE employees SET email='new@example.test',account_user_id='new-account' WHERE employee_id='TEST-001'").run(),
 f=>f.sqlite.prepare("UPDATE employment_records SET end_date=? WHERE employee_id='TEST-001'").run(shift(30))
]){
 const f=setup(),batch=f.env.DB.batch.bind(f.env.DB);let fired=false;
 f.env.DB.batch=async statements=>{if(!fired){fired=true;mutate(f)}return batch(statements)};
 const r=await open(f);eq(r.status,409);eq((await r.json()).error.includes('Refresh and retry'),true);eq(state(f).active,1);eq(state(f).employment_status,'active');eq(trail(f),[0,0,0]);eq(f.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}
// After refreshing a postponed last day, preserve the canonical employment and apply Notice Period once.
{
 const f=setup({...exit,lastWorkingDay:shift(20)});const r=await open(f);eq(r.status,200);eq((await r.json()).sections.overview.employmentStatus,'Notice Period');eq(state(f).active,1);eq(state(f).employment_status,'active');await open(f);eq(trail(f),[1,1,1]);
}
// Refresh after a real rejected race uses the new instruction and emits only one transition.
{
 const f=setup(),batch=f.env.DB.batch.bind(f.env.DB);let fired=false;
 f.env.DB.batch=async statements=>{if(!fired){fired=true;f.sqlite.prepare("UPDATE employee_profile_sections SET data_json=?,version=version+1 WHERE section='exit'").run(JSON.stringify({...exit,lastWorkingDay:shift(20)}))}return batch(statements)};
 eq((await open(f)).status,409);eq(trail(f),[0,0,0]);f.env.DB.batch=batch;
 const r=await open(f);eq(r.status,200);eq((await r.json()).sections.overview.employmentStatus,'Notice Period');eq(state(f).active,1);eq(trail(f),[1,1,1]);await open(f);eq(trail(f),[1,1,1]);
}
// Last working day is inclusive in Malaysia; disabled instructions cannot end employment.
for(const instruction of [{...exit,lastWorkingDay:day},{...exit,autoLifecycle:'Disabled'}]){
 const f=setup(instruction);eq((await open(f)).status,200);eq(state(f).active,1);eq(state(f).employment_status,'active');
}
// Mismatched canonical link fails before touching another employment record.
{
 const f=setup();f.sqlite.prepare("UPDATE employees SET employment_id='missing-link' WHERE employee_id='TEST-001'").run();eq((await open(f)).status,409);eq(state(f).active,1);eq(trail(f),[0,0,0]);
}
// Explicit alumni instruction retains the existing human-approved semantics.
{
 const f=setup({...exit,alumniApproved:'Yes'});const r=await open(f);eq(r.status,200);eq((await r.json()).sections.overview.employmentStatus,'Alumni');eq(state(f).active,0);eq(trail(f),[1,1,1]);
}
console.log(JSON.stringify({passed:true,checks,coverage:'Atomic approved exit instruction, canonical links, concurrent edits, rollback, inclusive Malaysia dates, idempotence and response consistency',productionDataUsed:false}));
