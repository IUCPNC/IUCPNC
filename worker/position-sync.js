import {positionData,primaryProjection,currentAssignment,currentRole} from './position-core.js';
import {businessDate,lifecycleStatus} from './profile-schema.js';
import {masterEmployeeStatements} from './employee-master.js';
import {appointmentState,concreteDepartment} from './position-model.js';
import {snapshotGuard} from './integration-guards.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=['position','department','appraiser'];
export {concreteDepartment} from './position-model.js';
export function managedPositionFields(e,data,today=businessDate()){
 const a=data.assignments.find(a=>a.employee_id===e.employee_id&&a.is_primary&&!data.roles.find(r=>r.id===a.role_id)?.data.entityAssignment&&appointmentState(a,data,today).current);if(!a)return {};
 const r=data.roles.find(r=>r.id===a.role_id),out={directory:['position']};
 if(concreteDepartment(r.department,'')||a.data.department)out.directory.push('department');
 if(a.data.reportingEmployeeId||r.data.reportingPositionId&&data.assignments.filter(p=>p.role_id===r.data.reportingPositionId&&p.is_primary&&appointmentState(p,data,today).current).length===1)out.directory.push('appraiser');
 const employment=[];for(const [source,target] of [['faculty','faculty'],['grade','grade'],['category','category']])if(r.data[source])employment.push(target);
 if(employment.length)out.employment=employment;if(r.data.faculty)out.overview=['businessUnit'];return out;
}
// Persist only current approved primary appointments. Access, pay, historical reviews and issued letters are untouched.
export async function reconcilePositions(env,data=null,actor={userId:'position-sync',email:'system:positions'},today=businessDate()){
 if(!env.DB)return {employees:0};const db=env.DB;data ||= await positionData(db);
 const [er,sr,pr]=await Promise.all([db.prepare('SELECT * FROM employees').all(),db.prepare('SELECT * FROM position_employee_sync').all(),db.prepare("SELECT * FROM employee_profile_sections").all()]);
 const states=new Map(sr.results.map(s=>[s.employee_id,s])),sections=new Map();for(const s of pr.results){if(!sections.has(s.employee_id))sections.set(s.employee_id,{});sections.get(s.employee_id)[s.section]={row:s,data:JSON.parse(s.data_json)};}
 const eligible=er.results.filter(e=>e.active&&!['Exited','Resigned','Alumni'].includes(lifecycleStatus(Object.fromEntries(Object.entries(sections.get(e.employee_id)||{}).map(([k,v])=>[k,v.data])),today)));
 const projected=await primaryProjection(db,er.results,data,today);let changes=0;
 for(const e of eligible){
  const p=projected.find(p=>p.employee_id===e.employee_id),previous=states.get(e.employee_id),a=p.assignmentId&&data.assignments.find(a=>a.id===p.assignmentId),role=a&&data.roles.find(r=>r.id===a.role_id),sec=sections.get(e.employee_id)||{};
  if(!a&&!previous)continue;
  const base=previous?JSON.parse(previous.base_json):{directory:Object.fromEntries(fields.map(k=>[k,e[k]||''])),employment:{},overview:{}},last=previous?JSON.parse(previous.applied_json):{directory:{},employment:{},overview:{}},next={directory:{},employment:{},overview:{}};
  if(a){const managed=managedPositionFields(e,data,today);for(const k of managed.directory||[])next.directory[k]=p[k]||'';for(const k of managed.employment||[])next.employment[k]=role.data[k];if(managed.overview)next.overview.businessUnit=role.data.faculty;}
  const row={...e},ops=[],at=new Date().toISOString();
  for(const k of fields){if(k in next.directory)row[k]=next.directory[k];else if(k in last.directory&&same(e[k]||'',last.directory[k]))row[k]=base.directory[k]||'';}
  let changed=fields.some(k=>row[k]!==e[k]);
  for(const section of ['employment','overview']){
   const old=sec[section]?.row,value={...(sec[section]?.data||{})};base[section] ||= {};for(const key of new Set([...Object.keys(last[section]||{}),...Object.keys(next[section])])){
    if(!(key in base[section]))base[section][key]=value[key]??'';
    if(key in next[section])value[key]=next[section][key];else if(same(value[key]??'',last[section][key]))value[key]=base[section][key];
   }
   if(section==='employment'&&changed){const fingerprint=JSON.stringify([a?.id||'ended',row.position,row.department,row.appraiser]),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(fingerprint)),id='position:'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');const history=[...(value.employmentHistory||[])];if(!history.some(h=>h.recordId===id))history.push({recordId:id,date:today,event:'Appointment',position:row.position,department:row.department,notes:a?'Primary appointment updated from '+role.code+'. Reporting manager: '+row.appraiser:'Primary appointment ended; previous work details restored.'});value.employmentHistory=history;}
   if(!same(value,sec[section]?.data||{})){
    ops.push(db.prepare('INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES (?,?,?,1,?,?) ON CONFLICT(employee_id,section) DO UPDATE SET data_json=excluded.data_json,version=employee_profile_sections.version+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE employee_profile_sections.version=?').bind(e.employee_id,section,JSON.stringify(value),at,actor.userId,old?.version||0));changed=true;
   }
  }
  if(changed){row.updated_at=at;ops.unshift(db.prepare('UPDATE employees SET position=?,department=?,appraiser=?,updated_at=? WHERE employee_id=?').bind(row.position,row.department,row.appraiser,at,e.employee_id));ops.push(...await masterEmployeeStatements(db,row,actor,'position_synced'));ops.push(db.prepare('INSERT INTO position_audit (id,actor_id,actor_email,action,entity_id,employee_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.userId,actor.email,'employee_master_synced',a?.id||previous.assignment_id||e.employee_id,e.employee_id,JSON.stringify({position:e.position,department:e.department,appraiser:e.appraiser}),JSON.stringify({position:row.position,department:row.department,appraiser:row.appraiser,roleId:role?.id||null}),at));changes++;}
  if(a){if(changed||!previous||previous.assignment_id!==a.id||!same(last,next))ops.push(db.prepare('INSERT INTO position_employee_sync (employee_id,assignment_id,base_json,applied_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET assignment_id=excluded.assignment_id,base_json=excluded.base_json,applied_json=excluded.applied_json,updated_at=excluded.updated_at').bind(e.employee_id,a.id,JSON.stringify(base),JSON.stringify(next),at));}
  else ops.push(db.prepare('DELETE FROM position_employee_sync WHERE employee_id=?').bind(e.employee_id));
  if(ops.length){
   if(!data.sourceRows)throw Object.assign(Error('Reload the approved appointment source before synchronising.'),{status:409});
   const guards=Object.entries(data.sourceRows).map(([table,expected])=>snapshotGuard(db,table,expected));
   // Reporting names are read from the same directory snapshot. Work-field
   // projections for another employee do not invalidate these identity fields.
   guards.push(snapshotGuard(db,'employees',er.results.map(row=>Object.fromEntries(['employee_id','employee_name','email','active','account_user_id'].map(key=>[key,row[key]])))));
   guards.push(snapshotGuard(db,'employees',[e],'employee_id',e.employee_id),snapshotGuard(db,'employee_profile_sections',pr.results.filter(s=>s.employee_id===e.employee_id),'employee_id',e.employee_id),snapshotGuard(db,'position_employee_sync',previous?[previous]:[],'employee_id',e.employee_id));
   // The profile snapshot covers all sections so a concurrent self-service edit
   // cannot be silently discarded while canonical data and history are written.
   try{await db.batch([...guards,...ops])}catch(error){throw Object.assign(Error('Employee or appointment source changed. Refresh and retry; no partial synchronisation was saved.'),{status:409,cause:error})}
  }
 }
 return {employees:changes};
}

const currentChecks=new WeakMap();
export async function ensurePositionsCurrent(env){if(!env.DB)return;const previous=currentChecks.get(env.DB);if(previous&&Date.now()-previous.at<30000)return previous.promise;const promise=reconcilePositions(env);currentChecks.set(env.DB,{at:Date.now(),promise});try{return await promise}catch(e){currentChecks.delete(env.DB);throw e}}
