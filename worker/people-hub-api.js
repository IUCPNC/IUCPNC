import {directoryOrganisation} from './directory-organisation.js';
import {primaryProjection} from './position-core.js';
import {managementAccess} from './management-api.js';
import {profileRoute} from './profile-api.js';
import {validateSection,PROFILE_SECTIONS,lifecycleStatus,businessDate} from './profile-schema.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const q=(db,sql,...p)=>db.prepare(sql).bind(...p);
const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const blank=v=>v===null||v===undefined||v===''||Array.isArray(v)&&!v.length;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const audit=(db,user,action,detail)=>q(db,'INSERT INTO management_audit (id,actor_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),user.userId,user.email,action,JSON.stringify(detail),new Date().toISOString());
async function body(request,max=1500000){const reader=request.body?.getReader();if(!reader)throw fail('Missing request.');let size=0,text='';const decoder=new TextDecoder();for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();throw fail('Import exceeds the size limit.',413)}text+=decoder.decode(r.value,{stream:true})}return JSON.parse(text+decoder.decode())}
export async function hubAccess(env,user,isPc){
 if(!user)return null;if(isPc(env,user.email))return {role:'hr',all:true};
 const lifecycleRows=(await q(env.DB,"SELECT s.section,s.data_json FROM employee_profile_sections s JOIN employees e ON e.employee_id=s.employee_id WHERE lower(e.email)=? AND s.section IN ('overview','exit')",user.email).all()).results;const lifecycle=Object.fromEntries(lifecycleRows.map(r=>[r.section,JSON.parse(r.data_json)]));if(['Exited','Alumni','Resigned'].includes(lifecycleStatus(lifecycle,businessDate())))return null;
 const leader=await managementAccess(env,user,'leadership',isPc);if(leader)return {role:'leadership',all:true,employeeId:leader.employeeId};
 const manager=await managementAccess(env,user,'manager',isPc);if(manager)return {role:'manager',employeeId:manager.employeeId};
 let employee=await q(env.DB,'SELECT employee_id,account_user_id FROM employees WHERE lower(email)=? AND active=1',user.email).first();
 if(!employee||employee.account_user_id&&employee.account_user_id!==user.userId)return null;
 if(!employee.account_user_id){await q(env.DB,'UPDATE employees SET account_user_id=? WHERE employee_id=? AND account_user_id IS NULL',user.userId,employee.employee_id).run();employee=await q(env.DB,'SELECT employee_id,account_user_id FROM employees WHERE employee_id=?',employee.employee_id).first();if(employee.account_user_id!==user.userId)return null}
 return {role:'employee',employeeId:employee.employee_id};
}
export function validateOrganisation(data,employees){
 if(!data||!Array.isArray(data.positions)||data.positions.length>1000)throw fail('Use at most 1,000 positions.');
 const ids=new Set(),occupied=new Set();
 const positions=data.positions.map(p=>{const out={};for(const k of ['id','title','department','parentId','employeeId','code','grade','occupancy']){if(typeof (p[k]??'')!=='string'||(p[k]||'').length>200)throw fail('Invalid position field.');out[k]=(p[k]||'').trim()}
  if(!['','Unassigned','Vacant','Filled','Governance / unit'].includes(out.occupancy))throw fail('Invalid occupancy status.');out.occupancy=out.employeeId?'Filled':out.occupancy||'Unassigned';if(!out.employeeId&&out.occupancy==='Filled')throw fail('Filled positions require an employee.');
  if(!out.id||!out.title||ids.has(out.id))throw fail('Positions need a unique ID and a title.');ids.add(out.id);
  if(out.employeeId){if(!employees.some(e=>e.employee_id===out.employeeId))throw fail('Choose an existing employee.');if(occupied.has(out.employeeId))throw fail('An employee can occupy only one primary position.');occupied.add(out.employeeId)}return out;});
 const map=new Map(positions.map(p=>[p.id,p]));for(const p of positions){const seen=new Set([p.id]);let id=p.parentId;while(id){if(!map.has(id))throw fail('Reporting position does not exist.');if(seen.has(id))throw fail('Reporting lines cannot form a cycle.');seen.add(id);id=map.get(id).parentId}}
 const asOf=String(data.asOf||'');if(asOf&&(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||new Date(asOf).toISOString().slice(0,10)!==asOf))throw fail('Use a valid ISO structure date.');
 return {positions,asOf,source:String(data.source||'').slice(0,1000)};
}
async function directory(db,access){
 const employees=(await db.prepare('SELECT employee_id,employee_name,email,position,department,active,appraiser FROM employees'+(access.all?'':' WHERE active=1')+' ORDER BY employee_name').all()).results;return (await primaryProjection(db,employees)).map(({appraiser,positionId,assignmentId,...safe})=>safe);
}
function changes(existing,incoming){const additions={},conflicts={};for(const [key,value]of Object.entries(incoming)){if(blank(value)||equal(existing[key],value))continue;if(blank(existing[key]))additions[key]=value;else conflicts[key]={existing:existing[key],incoming:value}}return {additions,conflicts}}
export async function hubRoute(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/people-hub'))return null;
 if(!ctx.user)return json({error:'Sign in is required.'},401);if(!env.DB)return json({error:'People directory is unavailable.'},503);
 const db=env.DB,user=ctx.user;
 try{
  const access=await hubAccess(env,user,ctx.isPc);if(!access)throw fail('Employee or P&C access is required.',403);const hr=access.role==='hr';
  if(request.method!=='GET'){if(!hr)throw fail('Only P&C can maintain these records.',403);if(request.headers.get('origin')!==url.origin)throw fail('Refresh this page before saving.',403)}
  if(path==='/api/people-hub'&&request.method==='GET'){
   const employees=await directory(db,access),ids=new Set(employees.map(e=>e.employee_id)),org=await q(db,"SELECT version,data_json,updated_at FROM organisation_state WHERE id='main'").first();
   const structure=org?JSON.parse(org.data_json):{positions:[],asOf:'',source:''};
   const reports=access.role==='manager'?(await q(db,'SELECT employee_id FROM management_reports WHERE manager_id=?',access.employeeId).all()).results.map(r=>r.employee_id):[];
   const reportingRows=await primaryProjection(db,(await db.prepare('SELECT employee_id,employee_name,email,position,department,appraiser,active FROM employees ORDER BY employee_name').all()).results);
   const derived=directoryOrganisation(reportingRows),positions=derived.positions;
   const oldToNew=new Map(structure.positions.filter(p=>p.employeeId).map(p=>[p.id,'employee:'+p.employeeId]));
   const vacancies=structure.positions.filter(p=>!p.employeeId).map(p=>({...p,parentId:oldToNew.get(p.parentId)||p.parentId,directoryManaged:false}));
   const validIds=new Set([...positions,...vacancies].map(p=>p.id));for(const p of vacancies)if(!validIds.has(p.parentId))p.parentId='';positions.push(...vacancies);
   structure.source='Employee Master: job title, department and reporting manager';structure.directoryManaged=true;structure.issues=hr?derived.issues:[];
   return json({role:access.role,employees:employees.map(e=>({...e,profileUrl:hr?'/admin/profiles?employeeId='+encodeURIComponent(e.employee_id):e.employee_id===access.employeeId?'/employee/profile':reports.includes(e.employee_id)?'/manager?employeeId='+encodeURIComponent(e.employee_id):access.role==='leadership'?'/top-management?employeeId='+encodeURIComponent(e.employee_id):null,photoUrl:'/api/people-hub/photos/'+encodeURIComponent(e.employee_id)})),organisation:{...structure,source:hr?structure.source:'',positions,version:org?.version||0,updatedAt:org?.updated_at||null}});
  }
  const photo=path.match(/^\/api\/people-hub\/photos\/([^/]+)$/);
  if(photo&&request.method==='GET'){
   const id=decodeURIComponent(photo[1]);if(!(await directory(db,access)).some(e=>e.employee_id===id))throw fail('Employee outside your authorised scope.',403);
   const d=await q(db,"SELECT d.storage_key,d.mime_type FROM profile_documents p JOIN document_assets d ON d.document_id=p.document_id WHERE p.employee_id=? AND p.category='Profile Photo' AND d.deleted_at IS NULL"+(hr?'':" AND p.visibility='employee'")+" ORDER BY d.created_at DESC LIMIT 1",id).first();
   if(!d||!['image/png','image/jpeg'].includes(d.mime_type))throw fail('No profile photo.',404);const object=await env.PROFILE_FILES?.get(d.storage_key);if(!object)throw fail('No profile photo.',404);
   return new Response(object.body,{headers:{'content-type':d.mime_type,'cache-control':'private,no-store','x-content-type-options':'nosniff'}});
  }
  if(path==='/api/people-hub/organisation'&&request.method==='PUT'){
   const b=await body(request),employees=await directory(db,{all:true}),data=validateOrganisation(b.data,employees);
   if(!Number.isInteger(b.version)||b.version<0)throw fail('Missing structure version.');const old=await q(db,"SELECT version,data_json FROM organisation_state WHERE id='main'").first();if((old?.version||0)!==b.version)throw fail('Structure changed; refresh before saving.',409);
   const stamp=new Date().toISOString();try{await db.batch([q(db,"INSERT INTO organisation_state (id,version,data_json,updated_by,updated_at) VALUES ('main',?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=CASE WHEN organisation_state.version=? THEN organisation_state.version+1 ELSE NULL END,data_json=excluded.data_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at",b.version+1,JSON.stringify(data),user.userId,stamp,b.version),audit(db,user,'organisation_saved',{version:b.version+1,positions:data.positions.length,source:data.source,before:old?JSON.parse(old.data_json):null,after:data})])}catch{throw fail('Structure changed; refresh before saving.',409)}
   return json({saved:true,version:b.version+1});
  }
  if(path.startsWith('/api/people-hub/imports')){
   if(!hr)throw fail('P&C access is required.',403);
   if(path==='/api/people-hub/imports'&&request.method==='POST'){
    const b=await body(request);if(!Array.isArray(b.records)||!b.records.length||b.records.length>200)throw fail('Import 1–200 source records per package.');
    const statements=[],insertIndexes=[],stamp=new Date().toISOString();const knownEmployees=new Map((await db.prepare('SELECT employee_id,employee_name FROM employees').all()).results.map(e=>[e.employee_id,e]));
    for(const r of b.records){if(typeof r.id!=='string'||r.id.length>200||!r.id||typeof r.identityName!=='string'||!r.identityName||r.identityName.length>300)throw fail('Each record requires a stable source ID and employee name.');
     if(!PROFILE_SECTIONS.some(s=>s.key===r.section)||['documents','alerts'].includes(r.section))throw fail('Invalid destination section.');
     let data;try{data=validateSection(r.section,r.data)}catch(e){throw fail(e.message)}
     if(!r.source||typeof r.source.url!=='string'||!/^https:\/\/(docs|drive)\.google\.com\//.test(r.source.url)||typeof r.source.title!=='string'||JSON.stringify(r.source).length>20000)throw fail('A Google Drive source reference is required.');
     const id=typeof r.employeeId==='string'?r.employeeId:'';const employee=knownEmployees.get(id);
     const matched=employee&&normalize(employee.employee_name)===normalize(r.identityName)?id:null;
     insertIndexes.push(statements.length);statements.push(q(db,'INSERT OR IGNORE INTO employee_import_records (id,employee_id,identity_name,section,data_json,source_json,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,\'pending\',?,?,?)',r.id,matched,r.identityName,r.section,JSON.stringify(data),JSON.stringify(r.source),user.userId,stamp,stamp));
     if(typeof r.source.supersedes==='string')statements.push(q(db,"UPDATE employee_import_records SET status='superseded',updated_at=? WHERE id=? AND section=? AND status IN ('pending','dismissed') AND json_extract(source_json,'$.url')=?",stamp,r.source.supersedes,r.section,r.source.url));
    }
    statements.push(audit(db,user,'drive_import_staged',{records:b.records.length}));const result=await db.batch(statements);return json({staged:insertIndexes.reduce((n,i)=>n+(result[i].meta?.changes||0),0),received:b.records.length});
   }
   if(path==='/api/people-hub/imports'&&request.method==='GET'){
    const rows=(await db.prepare('SELECT * FROM employee_import_records ORDER BY created_at DESC,id LIMIT 2000').all()).results;
    const sections=(await db.prepare('SELECT employee_id,section,data_json FROM employee_profile_sections').all()).results;const lookup=new Map(sections.map(r=>[r.employee_id+'|'+r.section,JSON.parse(r.data_json)]));
    return json({records:rows.map(r=>({id:r.id,employeeId:r.employee_id,identityName:r.identity_name,section:r.section,status:r.status,source:JSON.parse(r.source_json),data:JSON.parse(r.data_json),...changes(lookup.get(r.employee_id+'|'+r.section)||{},JSON.parse(r.data_json)),result:r.result_json?JSON.parse(r.result_json):null})),limit:2000});
   }
   const match=path.match(/^\/api\/people-hub\/imports\/([^/]+)$/);if(match&&request.method==='PUT'){
    const b=await body(request,10000),id=decodeURIComponent(match[1]),r=await q(db,'SELECT * FROM employee_import_records WHERE id=?',id).first();if(!r)throw fail('Import record not found.',404);
    if(b.action==='dismiss'){await db.batch([q(db,"UPDATE employee_import_records SET status='dismissed',updated_at=? WHERE id=?",new Date().toISOString(),id),audit(db,user,'drive_import_dismissed',{id})]);return json({saved:true})}
    if(r.status==='superseded')throw fail('This source record has been superseded; use the corrected source.',409);
    if(!['apply','correctSource'].includes(b.action))throw fail('Invalid import action.');const target=b.employeeId||r.employee_id;if(!target)throw fail('Match this source to an employee first.');const e=await q(db,'SELECT employee_id,person_id FROM employees WHERE employee_id=?',target).first();if(!e)throw fail('Employee does not exist.');
    const old=await q(db,'SELECT data_json,version FROM employee_profile_sections WHERE employee_id=? AND section=?',target,r.section).first(),existing=old?JSON.parse(old.data_json):{},incoming=JSON.parse(r.data_json),diff=changes(existing,incoming);
    let original=null;if(b.action==='correctSource'){
     const source=JSON.parse(r.source_json);if(r.section!=='learning'||!source.supersedes)throw fail('No supported source correction.');
     original=await q(db,'SELECT * FROM employee_import_records WHERE id=?',source.supersedes).first();
     if(!original||original.employee_id!==target||original.section!==r.section||JSON.parse(original.source_json).url!==source.url)throw fail('Correction does not match the original employee and source.');
     if(!equal(existing.training,JSON.parse(original.data_json).training)&&!equal(existing.training,incoming.training))throw fail('The training portfolio changed after import; review it before applying this correction.',409);
     b.fields=['training'];b.replaceConflicts=true;
    }
    let selected=b.fields;if(!Array.isArray(selected)||selected.some(k=>!Object.hasOwn(incoming,k))||new Set(selected).size!==selected.length)throw fail('Select source fields to apply.');if(b.fillMissing===true)selected=selected.filter(k=>Object.hasOwn(diff.additions,k));
    if(selected.some(k=>Object.hasOwn(diff.conflicts,k))&&!b.replaceConflicts)throw fail('Conflicting values require explicit replacement.');const merged={...existing};for(const k of selected)merged[k]=incoming[k];
    if(selected.length){const response=await profileRoute(new Request(url.origin+'/api/profiles/'+encodeURIComponent(target)+'/sections/'+r.section,{method:'PUT',headers:{origin:url.origin,'content-type':'application/json'},body:JSON.stringify({data:merged,version:old?.version||0})}),env,ctx);if(!response.ok)return response;}
    // Apply is retry-safe: an interrupted retry compares the same source with the now-current section.
    const result={fields:selected,conflicts:Object.keys(diff.conflicts).filter(k=>!selected.includes(k)),employeeId:target};const remaining=result.conflicts.length?'review':'applied',stamp=new Date().toISOString();
    const updates=[q(db,'UPDATE employee_import_records SET employee_id=?,status=?,result_json=?,updated_at=? WHERE id=?',target,remaining,JSON.stringify(result),stamp,id),audit(db,user,'drive_import_applied',{id,employeeId:target,section:r.section,fields:selected,replaced:!!b.replaceConflicts})];
    if(original)updates.push(q(db,"UPDATE employee_import_records SET status='superseded',updated_at=? WHERE id=?",stamp,original.id));
    await db.batch(updates);return json({saved:true,status:remaining,...result});
   }
  }
  throw fail('Not found.',404);
 }catch(e){if(e.status)return json({error:e.message},e.status);if(e instanceof SyntaxError)return json({error:'Invalid JSON.'},400);console.error('People hub request failed',e.name);return json({error:'The request could not be completed. Refresh and retry.'},503)}
}
