import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {runSync as automaticRunSync,syncRoute} from '../worker/sheets-sync.js';
const runSync=(env,client,actor,options={})=>automaticRunSync(env,client,actor,{...options,automatic:false});
import {DATASETS,siteRecords,sheetRecords,keyFor,merge,normal,equal} from '../worker/sheets-model.js';
import {SheetsClient} from '../worker/sheets-client.js';
import {TABLE_HEADERS} from '../worker/sheets-headers.js';
import {profileRoute} from '../worker/profile-api.js';
import {validateSection} from '../worker/profile-schema.js';
import {recordIds} from '../worker/profile-record-ids.js';
let checks=0;const check=(value,message)=>{assert(value,message);checks++;};
function tablesFor(records){
 const tables=new Map([...new Set(DATASETS.map(d=>d.table))].map((name,i)=>[name,{name,title:name,sheetId:i,start:5,end:100,width:TABLE_HEADERS[name]?.length||7,headers:TABLE_HEADERS[name]||['Document ID','Employee ID','Full name','Category','Visibility','Bytes','Protected URL'],rows:[],formulas:[]} ]));
 for(const r of records.values())setRow(tables,r,r.value);
 return tables;
}
function setRow(tables,r,value){const t=tables.get(r.ds.table),ds=r.ds;let row=t.rows.find(v=>v[ds.idCol]===r.id&&v[ds.employeeCol]===r.employeeId&&(!ds.kind||v[ds.kindCol]===ds.kind));if(!row){row=[];t.rows.push(row);}row[ds.idCol]=r.id;row[ds.employeeCol]=r.employeeId;if(ds.kind)row[ds.kindCol]=ds.kind;for(const f of ds.fields)row[f.col]=value[f.key];}
class MemorySheets{
 constructor(records){this.tables=tablesFor(records);this.writes=0;this.fail=false;}
 async read(){return this.tables;}
 async write(r,value,expected){if(this.fail)throw new Error('Simulated interrupted write');const actual=sheetRecords(this.tables).get(r.key)?.value||null;if(expected&&!equal(actual,expected))throw new Error('Concurrent Google edit');setRow(this.tables,r,value);this.writes++;}
 edit(dataset,employeeId,field,value,id=employeeId){const r=sheetRecords(this.tables).get(keyFor(dataset,employeeId,id));assert(r);r.table.rows[r.row-r.table.start-1][r.ds.fields.find(f=>f.key===field).col]=value;}
}
const {env,sqlite}=fixture();env.SHEETS_SYNC_RUNNER_KEY='test-secret-'.repeat(4);
const snapshot=await siteRecords(env.DB),client=new MemorySheets(snapshot.records);
sqlite.exec("INSERT INTO sheet_sync_state (id,enabled) VALUES ('main',1)");
const req=(path='',body,user=hr,origin='https://sync.test')=>syncRoute(new Request('https://sync.test/api/people-culture/sync'+path,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{user,isPc:(_,email)=>email===hr.email});
const save=async(section,data)=>{const v=sqlite.prepare('SELECT version FROM employee_profile_sections WHERE employee_id=? AND section=?').get('TEST-001',section)?.version||0;const r=await profileRoute(new Request('https://sync.test/api/profiles/TEST-001/sections/'+section,{method:'PUT',headers:{origin:'https://sync.test'},body:JSON.stringify({data,version:v})}),env,{user:hr,isPc:()=>true});assert.equal(r.status,200,await r.text());};
check(merge({a:1,b:1},{a:2,b:1},{a:1,b:2}).action==='both','Independent changes merge');
check(merge({a:1},{a:2},{a:3}).action==='conflict','Concurrent changes conflict');
check(merge(null,{a:2},{a:3}).action==='conflict','Initial differences never overwrite');
check(merge({a:1},{a:1},null).action==='delete','Previously synced unchanged row can be deleted');
check(merge({a:1},{a:2},null).action==='conflict','Concurrent Site edit blocks deletion');
check(normal(0,'number')===0&&normal('','number')==='','Blank and zero remain distinct');
check(normal(46200,'date')==='2026-06-27','Google serial dates normalise');
let result=await runSync(env,client,hr);check(result.status==='succeeded'&&client.writes===0,'Matching initial values establish baseline without rewriting');
await save('personal',{personalMobile:'0123456789'});result=await runSync(env,client,hr);check(result.counts.toSheet===1,'Site edit exported');
check(sheetRecords(client.tables).get(keyFor('personal','TEST-001','TEST-001')).value.personalMobile==='0123456789','Exported value verified');
const writes=client.writes;await runSync(env,client,hr);check(client.writes===writes,'Unchanged run is idempotent');
client.edit('personal','TEST-001','personalMobile','0191234567');result=await runSync(env,client,hr);check(result.counts.toSite===1,'Sheet edit imported');
check(JSON.parse(sqlite.prepare("SELECT data_json FROM employee_profile_sections WHERE employee_id='TEST-001' AND section='personal'").get().data_json).personalMobile==='0191234567','Actual profile changed');
check(sqlite.prepare("SELECT count(*) n FROM profile_revisions WHERE section='personal'").get().n===2,'Import retains version history');
let data=JSON.parse(sqlite.prepare("SELECT data_json FROM employee_profile_sections WHERE employee_id='TEST-001' AND section='personal'").get().data_json);await save('personal',{...data,personalMobile:'0170000000'});client.edit('personal','TEST-001','nationality','Malaysian');result=await runSync(env,client,hr);check(result.counts.toSheet===1&&result.counts.toSite===1,'Different fields merge in both directions');
data=JSON.parse(sqlite.prepare("SELECT data_json FROM employee_profile_sections WHERE employee_id='TEST-001' AND section='personal'").get().data_json);await save('personal',{...data,personalMobile:'0110000000'});client.edit('personal','TEST-001','personalMobile','0160000000');result=await runSync(env,client,hr);check(result.counts.conflicts===1,'Same field simultaneous edits preserved');
let conflict=sqlite.prepare('SELECT * FROM sheet_sync_records WHERE issue IS NOT NULL').get();let response=await req('/resolve',{key:conflict.key,choice:'sheet',updatedAt:conflict.updated_at});check(response.status===200,'P&C can resolve');result=await runSync(env,client,hr);check(result.counts.toSite===1,'Approved resolution applied');
client.edit('directory','TEST-001','email','replacement@example.test');result=await runSync(env,client,hr);check(result.counts.conflicts===1,'Sheet cannot silently change login identity');
client.edit('directory','TEST-001','email','employee@example.test');await runSync(env,client,hr);
client.edit('overview','TEST-001','employmentStatus','Exited');result=await runSync(env,client,hr);check(result.counts.conflicts===1&&sqlite.prepare("SELECT active FROM employees WHERE employee_id='TEST-001'").get().active===1,'Lifecycle change needs review');client.edit('overview','TEST-001','employmentStatus','Active');await runSync(env,client,hr);
client.edit('attendance','TEST-001','workingDays',10);client.edit('attendance','TEST-001','daysPresent',15);result=await runSync(env,client,hr);check(result.counts.conflicts===1&&!sqlite.prepare("SELECT data_json FROM employee_profile_sections WHERE section='attendance'").get(),'Invalid attendance rejected');client.edit('attendance','TEST-001','workingDays','');client.edit('attendance','TEST-001','daysPresent','');await runSync(env,client,hr);
await save('learning',{cpdYear:2026,training:[{title:'Example course',date:'2026-09-30',verificationStatus:'Approved',cpdHours:4}]});result=await runSync(env,client,hr);check(result.counts.toSheet===2,'Training and development summary export');
const training=[...sheetRecords(client.tables).values()].find(r=>r.ds.id==='learning.training');check(!!training.id,'Training has stable ID');client.edit('learning.training','TEST-001','cpdHours',5,training.id);await runSync(env,client,hr);data=JSON.parse(sqlite.prepare("SELECT data_json FROM employee_profile_sections WHERE section='learning'").get().data_json);check(data.cpdTarget===192&&data.training[0].cpdHours===5,'CPD target retained and learning imported');
await save('personal',{personalMobile:'0180000000'});client.fail=true;await runSync(env,client,hr);check(JSON.parse(sqlite.prepare('SELECT base_json FROM sheet_sync_records WHERE key=?').get(keyFor('personal','TEST-001','TEST-001')).base_json).personalMobile==='0160000000','Failed write does not advance baseline');client.fail=false;await runSync(env,client,hr);check(sheetRecords(client.tables).get(keyFor('personal','TEST-001','TEST-001')).value.personalMobile==='0180000000','Failed write retries safely');
sqlite.exec("UPDATE sheet_sync_state SET lease_until=9999999999999 WHERE id='main'");check((await runSync(env,client,hr)).status==='busy','Concurrent runner excluded');sqlite.exec("UPDATE sheet_sync_state SET lease_until=0 WHERE id='main'");
check((await req('',null,employee)).status===403,'Employees cannot read HR sync');check((await req('',null,null)).status===401,'Anonymous caller denied');check((await req('/settings',{enabled:false},hr,'https://evil.test')).status===403,'CSRF blocked');
check((await req('/settings',{enabled:false})).status===200,'P&C pause works');const before=client.writes;check((await runSync(env,client,hr)).status==='connection_verified'&&client.writes===before,'Paused runner only verifies connection');
response=await syncRoute(new Request('https://sync.test/api/people-culture/sync/runner',{method:'POST',body:'{}'}),env,{user:null,isPc:()=>false});check(response.status===401,'Runner needs separate secret');
const ids=await recordIds('TEST-001','skills',{skills:[{skill:'Excel'},{skill:'SQL'}]});const moved=await recordIds('TEST-001','skills',{skills:ids.skills.reverse()});check(moved.skills[1].recordId===ids.skills[1].recordId,'Stable IDs survive reorder');
assert.throws(()=>validateSection('skills',{skills:[{skill:'A',recordId:'duplicate123'},{skill:'B',recordId:'duplicate123'}]}));checks++;
const duplicate=client.tables.get('PeopleCoreRecords').rows[0];client.tables.get('PeopleCoreRecords').rows.push([...duplicate]);assert.throws(()=>sheetRecords(client.tables),/Duplicate/);checks++;client.tables.get('PeopleCoreRecords').rows.pop();
sqlite.exec("UPDATE sheet_sync_state SET enabled=1 WHERE id='main'");
sqlite.prepare("INSERT INTO employees (employee_id,employee_name,email,position,department,appraiser) VALUES (?,?,?,?,?,?)").run('TEST-003','New Example Employee','new@example.test','Executive','Finance','Example Manager');
result=await runSync(env,client,hr,{limit:30});check(result.counts.toSheet>=1,'New Site employee exported without manual re-entry');
check(sheetRecords(client.tables).get(keyFor('directory','TEST-003','TEST-003')).value.employee_name==='New Example Employee','New employee name reaches master');
const mpcValues=['mpc-test','employee-1','employee@example.test','TEST-001','Example Employee','employee@example.test',2026,9,4.1,'Commendable','Completed','Acknowledged','Confirmed','',0,'{}'];
sqlite.prepare('INSERT INTO mpc_submissions (id,authenticated_user_id,authenticated_email,employee_id,employee_name,employee_email,reporting_year,month,overall_score,performance_band,check_in_status,employee_acknowledgment,appraiser_confirmation,missing_components,number_missing,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...mpcValues);
await runSync(env,client,hr);check(sheetRecords(client.tables).get(keyFor('mpc','TEST-001','mpc-test')).value.overall_score===4.1,'MPC workflow result reaches monthly history');
client.edit('mpc','TEST-001','overall_score',5,'mpc-test');result=await runSync(env,client,hr);check(result.counts.conflicts===1&&sqlite.prepare("SELECT overall_score FROM mpc_submissions WHERE id='mpc-test'").get().overall_score===4.1,'Sheet cannot replace deterministic MPC score');
conflict=sqlite.prepare('SELECT * FROM sheet_sync_records WHERE issue IS NOT NULL').get();check((await req('/resolve',{key:conflict.key,choice:'sheet',updatedAt:conflict.updated_at})).status===400,'P&C must use MPC workflow to change a score');
await req('/resolve',{key:conflict.key,choice:'site',updatedAt:conflict.updated_at});await runSync(env,client,hr);check(sheetRecords(client.tables).get(keyFor('mpc','TEST-001','mpc-test')).value.overall_score===4.1,'P&C can restore exported result');
const mpcRow=sheetRecords(client.tables).get(keyFor('mpc','TEST-001','mpc-test'));const deletedMpc=mpcRow.table.rows.splice(mpcRow.row-mpcRow.table.start-1,1)[0];result=await runSync(env,client,hr);check(result.counts.conflicts===1&&!!sqlite.prepare("SELECT id FROM mpc_submissions WHERE id='mpc-test'").get(),'Removing exported MPC row retains workflow history');mpcRow.table.rows.push(deletedMpc);await runSync(env,client,hr);
const failedRead={async read(){throw new Error('Google authorisation failed');}};await assert.rejects(runSync(env,failedRead,hr),/Google authorisation/);check(sqlite.prepare("SELECT failures,next_attempt FROM sheet_sync_state WHERE id='main'").get().next_attempt>Date.now(),'Google failure schedules backoff');check((await runSync(env,client,hr)).status==='retry_wait','Backoff prevents repeated failing calls');sqlite.exec("UPDATE sheet_sync_state SET next_attempt=0 WHERE id='main'");
// Exercise the real Google adapter against a fake HTTP boundary; no live employee data is used.
let calls=[],dataRows=[['Record ID','Employee ID','Full name','Effective date','Basic salary (RM)','Reason','Site section version'],['salary001','TEST-001','Example Employee',46200,5000,'Review','']];
const ds=DATASETS.find(d=>d.id==='compensation.salaryHistory');
const google=new SheetsClient('fake-token',async(url,options)=>{calls.push({url,options});if(url.endsWith(':batchUpdate')){const body=JSON.parse(options.body);for(const r of body.requests){if(r.updateCells){const c=r.updateCells.range.startColumnIndex,v=r.updateCells.rows[0].values[0].userEnteredValue;dataRows[1][c]=v.numberValue??v.stringValue;}}return Response.json({});}return Response.json({values:[dataRows[1]]});});
google.read=async()=>new Map([[ds.table,{name:ds.table,title:'Employee Master',sheetId:940001,start:119,end:124,width:7,rows:[dataRows[1]],formulas:[dataRows[1]]}]]);
const value={effectiveDate:'2026-06-27',basicSalary:5500,reason:'=IMPORTXML("evil")'};
await google.write({ds,id:'salary001',employeeId:'TEST-001',context:{employee:{employee_name:'Example Employee'}}},value,{effectiveDate:'2026-06-27',basicSalary:5000,reason:'Review'});
check(calls[0].url.includes('sheets.googleapis.com')&&calls[0].options.headers.Authorization==='Bearer fake-token','Token sent only to fixed Google endpoint');
const cells=JSON.parse(calls[0].options.body).requests.filter(r=>r.updateCells).map(r=>r.updateCells.rows[0].values[0].userEnteredValue);check(cells.some(v=>v.stringValue==='=IMPORTXML("evil")')&&!cells.some(v=>v.formulaValue),'Formula injection stored as plain text');check(cells.some(v=>v.numberValue===46200),'Dates written as serials');check(JSON.parse(calls[0].options.body).requests.some(r=>r.updateCells?.rows[0].values[0].userEnteredFormat?.numberFormat?.type==='DATE'),'Date serials display as readable dates');
// A full table inserts space inside its own range, leaving lower tables/formula references to shift safely.
calls=[];google.read=async()=>new Map([[ds.table,{name:ds.table,title:'Employee Master',sheetId:940001,start:119,end:122,width:7,rows:[dataRows[1],[]],formulas:[dataRows[1],[]]}]]);
await assert.rejects(google.write({ds,id:'salary002',employeeId:'TEST-001'},value,null),/expanded/);check(JSON.parse(calls[0].options.body).requests[0].insertDimension.range.startIndex===121,'Growth is inserted inside table, never overwrites lower sections');
google.tables=new Map([[ds.table,{name:ds.table,sheetId:940001,start:119,rows:[['','TEST-001','Example Employee','2026-09-30',5500,'Review']]}]]);for(const item of DATASETS)if(!google.tables.has(item.table))google.tables.set(item.table,{rows:[]});calls=[];await google.assignRecordIds();check(JSON.parse(calls[0].options.body).requests[0].updateCells.range.startColumnIndex===0,'New history row receives stable ID in only its ID cell');
check(sqlite.prepare('PRAGMA foreign_key_check').all().length===0,'Foreign keys intact');sqlite.close();
console.log(JSON.stringify({checks,passed:true,areas:['two-way changes','three-way conflict handling','initial reconciliation','idempotent retries','validation and audits','P&C authorisation','CSRF','runner lease','stable row IDs','formula injection','Google date encoding']}));
