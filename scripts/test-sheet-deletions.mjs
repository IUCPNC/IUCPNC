import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {runSync as automaticRunSync,syncRoute} from '../worker/sheets-sync.js';
const runSync=(env,client,actor,options={})=>automaticRunSync(env,client,actor,{...options,automatic:false});
import {DATASETS,siteRecords,sheetRecords,keyFor} from '../worker/sheets-model.js';
import {TABLE_HEADERS} from '../worker/sheets-headers.js';
import {profileRoute} from '../worker/profile-api.js';
import worker from '../dist/server/index.js';
const {env,sqlite}=fixture();env.PC_EMAILS=hr.email;
// Production directory IDs are canonical; align the generic profile fixture with them.
// Preserve the existing canonical person and email to verify archive identity safety.
env.applyDirectory=(request,actor)=>worker.fetch(new Request(request,{headers:{...Object.fromEntries(request.headers),'oai-authenticated-user-id':actor.userId,'oai-authenticated-user-email':actor.email}}),env,{waitUntil(){}});
sqlite.exec("INSERT INTO sheet_sync_state (id,enabled) VALUES ('main',1)");
const save=async(section,data)=>{const version=sqlite.prepare('SELECT version FROM employee_profile_sections WHERE employee_id=? AND section=?').get('TEST-001',section)?.version||0;const res=await profileRoute(new Request('https://test/api/profiles/TEST-001/sections/'+section,{method:'PUT',headers:{origin:'https://test'},body:JSON.stringify({data,version})}),env,{user:hr,isPc:()=>true});assert.equal(res.status,200,await res.text());};
await save('personal',{personalMobile:'0123456789'});
await save('attendance',{workingDays:20,daysPresent:19,otherLeave:[{category:'Special',taken:1}]});
await save('learning',{developmentPlan:'Learn SQL',training:[{title:'SQL',cpdHours:5,verificationStatus:'Approved'},{title:'Excel',cpdHours:2,verificationStatus:'Approved'}]});
// Lifecycle automation must not restore access to an archived employee.
await save('overview',{employmentStatus:'Active'});
await save('exit',{autoLifecycle:'Enabled',resignationDate:'2020-01-01',lastWorkingDay:'2099-01-01'});
const tables=new Map([...new Set(DATASETS.map(d=>d.table))].map(name=>[name,{name,title:name,start:0,headers:TABLE_HEADERS[name],rows:[],formulas:[]}]));
function put(r,value){const t=tables.get(r.ds.table),d=r.ds;let row=t.rows.find(x=>x[d.idCol]===r.id&&x[d.employeeCol]===r.employeeId&&(!d.kind||x[d.kindCol]===d.kind));if(!row)t.rows.push(row=[]);row[d.idCol]=r.id;row[d.employeeCol]=r.employeeId;if(d.kind)row[d.kindCol]=d.kind;for(const f of d.fields)row[f.col]=value[f.key];}
for(const r of (await siteRecords(env.DB)).records.values())put(r,r.value);
let writes=0;
const client={async read(){return tables},async write(r,v){writes++;put(r,v)}};
const run=()=>runSync(env,client,hr,{limit:1000});
const value=(ds,id='TEST-001')=>sheetRecords(tables).get(keyFor(ds,'TEST-001',id));
function remove(r){r.table.rows.splice(r.row-r.table.start-1,1);}
const section=k=>JSON.parse(sqlite.prepare('SELECT data_json FROM employee_profile_sections WHERE employee_id=? AND section=?').get('TEST-001',k).data_json);
await run();
const personal=value('personal');personal.table.rows[personal.row-1][personal.ds.fields.find(f=>f.key==='personalMobile').col]='';
await run();assert.equal(section('personal').personalMobile,'');
const training=[...sheetRecords(tables).values()].find(r=>r.ds.id==='learning.training');remove(training);
await run();assert.equal(section('learning').training.length,1);assert.equal(section('learning').training[0].title,'Excel');assert.equal(section('learning').cpdTarget,192);
const after=writes;await run();assert.equal(writes,after,'Deleted training is not recreated');
remove(value('attendance'));await run();assert.equal(section('attendance').workingDays,'');assert.equal(section('attendance').otherLeave.length,1,'Summary deletion preserves separately managed rows');
const before=writes;await run();assert.equal(writes,before,'Deleted summary is not recreated');
// New Site edits intentionally restore a deleted summary.
await save('attendance',{...section('attendance'),workingDays:21});await run();assert.equal(value('attendance').value.workingDays,21);
// A row restored during the final Google re-read must not be removed from the Site.
const restored=[...sheetRecords(tables).values()].find(r=>r.ds.id==='learning.training');remove(restored);let reads=0;
await runSync(env,{...client,async read(){if(++reads===2)put(restored,restored.value);return tables}},hr,{limit:1000});assert.equal(section('learning').training.length,1);
await run();
// Concurrent Site edits create a review item; P&C may explicitly resolve the deletion.
remove(restored);await save('learning',{...section('learning'),training:[{...section('learning').training[0],title:'Changed on Site'}]});
await run();assert.equal(section('learning').training.length,1);
const conflict=sqlite.prepare('SELECT * FROM sheet_sync_records WHERE key=?').get(restored.key);assert.match(conflict.issue,/deleted while/);
const resolution=await syncRoute(new Request('https://test/api/people-culture/sync/resolve',{method:'POST',headers:{origin:'https://test'},body:JSON.stringify({key:restored.key,choice:'sheet',updatedAt:conflict.updated_at})}),env,{user:hr,isPc:()=>true});assert.equal(resolution.status,200);await run();assert.equal(section('learning').training.length,0);
// A missing table fails the run without interpreting it as mass deletion.
const held=tables.get('DevelopmentPortfolio');tables.delete('DevelopmentPortfolio');await assert.rejects(run(),/Required workbook table/);tables.set('DevelopmentPortfolio',held);sqlite.exec("UPDATE sheet_sync_state SET next_attempt=0 WHERE id='main'");
// Delete only a previously synced master row. Other employee history must be retained.
const revisions=sqlite.prepare('SELECT count(*) n FROM profile_revisions').get().n;
const removedMaster=value('directory');remove(removedMaster);await run();assert.equal(sqlite.prepare("SELECT active FROM employees WHERE employee_id='TEST-001'").get().active,0);
assert.equal(section('attendance').workingDays,21);assert.equal(sqlite.prepare('SELECT count(*) n FROM profile_revisions').get().n,revisions);
assert.equal(sqlite.prepare('SELECT resolution FROM sheet_sync_records WHERE key=?').get(keyFor('directory','TEST-001','TEST-001')).resolution,'sheet_archived');
await run();assert.equal(value('directory'),undefined,'Archived employee never exported again');
const self=await profileRoute(new Request('https://test/api/profiles/me'),env,{user:employee,isPc:()=>false});assert.equal(self.status,403);
const pc=await profileRoute(new Request('https://test/api/profiles/TEST-001'),env,{user:hr,isPc:()=>true});assert.equal(pc.status,200);assert.equal(sqlite.prepare("SELECT active FROM employees WHERE employee_id='TEST-001'").get().active,0,'Lifecycle cannot reactivate archive');
assert(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='archived_from_sheet'").get().n===1);
put(removedMaster,removedMaster.value);await run();assert.equal(sqlite.prepare("SELECT active FROM employees WHERE employee_id='TEST-001'").get().active,0,'Restoring a Sheet row cannot grant access');
assert.match(sqlite.prepare('SELECT issue FROM sheet_sync_records WHERE key=?').get(removedMaster.key).issue,/Reactivate/);
remove(value('directory'));sqlite.exec("UPDATE employees SET active=1 WHERE employee_id='TEST-001'");await run();assert(value('directory'),'Explicit P&C reactivation restores the master row');
await run();assert.equal(sqlite.prepare('SELECT resolution FROM sheet_sync_records WHERE key=?').get(removedMaster.key).resolution,null);
assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
sqlite.close();console.log('Sheet deletion integration tests passed: cell clears, row deletion, summaries, retained history, retries, conflicts, restored rows, missing tables, archival and access denial.');
