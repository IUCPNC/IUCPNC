import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {positionRoute} from '../worker/position-api.js';
import {ROLE_TYPES,positionData} from '../worker/position-core.js';
import {positionSheetRegisters,exportPositionRegisters} from '../worker/position-sheets.js';
const {env,sqlite}=fixture();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
async function call(path='',method='GET',body,user=hr,status=200){const r=await positionRoute(new Request('https://nadi.test/api/positions'+path,{method,headers:{origin:'https://nadi.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{user,isPc:(_,email)=>email===hr.email});eq(r.status,status);return r.json()}
// Existing index-based seeds must not suppress new Program types.
for(const [i,name] of ['Primary Position','Interim Appointment','Project Director','External / Advisory'].entries())sqlite.prepare('INSERT INTO position_types(id,name,active) VALUES (?,?,1)').run('type-'+i,name);
let data=await call();eq(data.types.map(t=>t.name),ROLE_TYPES);eq(ROLE_TYPES.length,20);eq(ROLE_TYPES,[...ROLE_TYPES].sort((a,b)=>a.localeCompare(b)));eq(ROLE_TYPES.includes('Program Coordinator'),true);
const created=await call('/roles','POST',{code:'TEST-UNIFIED',title:'Program Coordinator',type:'Program Coordinator',department:'Finance',status:'Active',data:{displayTitle:'Conflicting title',acknowledgementRequired:false,division:'Corporate',faculty:'Business',unit:'Planning'}},hr,201);
let role=(await positionData(env.DB)).roles.find(r=>r.id===created.id);eq(role.data.displayTitle,role.title);
// Preserve historical metadata removed from the editor, including linked memberships.
role.data.approvalAuthority='Legacy approval';role.data.appointmentPeriod='Legacy term';role.data.committeeId='old-committee';role.data.reportsTo='Legacy reporting note';role.data.displayTitle='Older display';sqlite.prepare('UPDATE position_library SET data_json=? WHERE id=?').run(JSON.stringify(role.data),role.id);
await call('/roles/'+role.id,'PUT',{...role,title:'Senior Program Coordinator',data:{acknowledgementRequired:false,division:'Corporate',faculty:'Business',unit:'Planning'},version:role.version});
role=(await positionData(env.DB)).roles.find(r=>r.id===created.id);eq(role.title,'Senior Program Coordinator');eq(role.data.displayTitle,role.title);eq([role.data.approvalAuthority,role.data.appointmentPeriod,role.data.committeeId,role.data.reportsTo],['Legacy approval','Legacy term','old-committee','Legacy reporting note']);
await call('/roles','POST',{code:'OLD-TYPE',title:'Old type',type:'Interim Appointment',department:'Finance',status:'Draft',data:{}},hr,400);
data=await call();eq(data.organisation.every(r=>Object.keys(r).every(k=>['department','division','faculty','unit'].includes(k))),true);eq((await call('', 'GET',null,employee)).organisation,[]);
const register=positionSheetRegisters(await positionData(env.DB),[])[0];eq(register.headers.length,register.legacyHeaders.length);eq(register.headers.includes('Display title'),false);eq(register.rows[0].slice(2,8),['Senior Program Coordinator','Program Coordinator','Finance','Corporate','Business','Planning']);
let values=[register.legacyHeaders,['legacy role']],writes=0;const range={sheetId:7,startColumnIndex:0,endColumnIndex:18,startRowIndex:10,endRowIndex:110};
const client={async api(path,body){if(path.startsWith('?'))return {sheets:[{properties:{sheetId:7,title:'Admin'}}],namedRanges:[{name:register.name,range}]};if(path.startsWith('/values/'))return {values};for(const request of body.requests){assert.deepEqual(request.updateCells.range,range);values=request.updateCells.rows.map(r=>r.values.map(c=>c.userEnteredValue?.stringValue??c.userEnteredValue?.numberValue??''));writes++;}return {}}};
eq(await exportPositionRegisters(client,[register]),1);eq(values,[register.headers,...register.rows]);eq(await exportPositionRegisters(client,[register]),0);eq(writes,1);
values=[['Unexpected columns']];await assert.rejects(exportPositionRegisters(client,[register]),/headers changed/);checks++;
sqlite.close();console.log(JSON.stringify({checks,passed:true,coverage:'exact role catalogue, safe old seeds, canonical titles, retained history, scoped organisational metadata, safe legacy Sheet upgrade and idempotence'}));
