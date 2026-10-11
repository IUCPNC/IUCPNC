import {validateSection} from './profile-schema.js';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
async function sameSecret(a,b){if(!a||!b)return false;const hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;}
export async function migrationRoute(request,env,dispatch){
 if(new URL(request.url).pathname!=='/api/migration/employee')return null;
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(env.MIGRATION_PENDING!=='true'||!await sameSecret(env.MIGRATION_IMPORT_KEY,request.headers.get('x-migration-key')))return json({error:'Migration is unavailable'},403);
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing import'},400);let size=0,text='';const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>250000){await reader.cancel();return json({error:'Import too large'},413);}text+=decoder.decode(part.value,{stream:true});}
  const input=JSON.parse(text+decoder.decode()),e=input.employee;
  if(!e||!['employeeId','employeeName','email','position','department','appraiser'].every(k=>typeof e[k]==='string'&&e[k].trim()&&e[k].length<=200))return json({error:'Invalid employee identity'},400);
  const sections=Object.fromEntries(Object.entries(input.sections||{}).map(([key,value])=>[key,validateSection(key,value)]));
  const actor={userId:'authorised-sheet-migration',email:'h.r@innovative.edu.my'},db=env.DB,origin=new URL(request.url).origin;
  const call=async(path,method,body)=>{const response=await dispatch(new Request(origin+path,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),{...env,PC_EMAILS:actor.email},actor);if(!response.ok)throw new Error((await response.json()).error||'Directory import failed');};
  const old=await db.prepare('SELECT * FROM employees WHERE employee_id=?').bind(e.employeeId).first();
  if(old){for(const [a,b]of [['employeeName','employee_name'],['email','email'],['position','position'],['department','department'],['appraiser','appraiser']])if(e[a]!==old[b])return json({error:'Existing employee differs; manual review required'},409);}
  else await call('/api/people-culture/employees','POST',e);
  const now=new Date().toISOString();let imported=0;const statements=[];
  const priorRows=(await db.prepare('SELECT section,data_json FROM employee_profile_sections WHERE employee_id=?').bind(e.employeeId).all()).results;const existing=new Map(priorRows.map(r=>[r.section,r]));
  for(const [section,data]of Object.entries(sections)){
   const prior=existing.get(section);
   if(prior){if(JSON.stringify(validateSection(section,JSON.parse(prior.data_json)))!==JSON.stringify(data))return json({error:'Existing profile differs; manual review required',section},409);continue;}
   const body=JSON.stringify(data);statements.push(
    db.prepare('INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES (?,?,?,1,?,?)').bind(e.employeeId,section,body,now,actor.userId),
    db.prepare('INSERT INTO profile_revisions (id,employee_id,section,version,data_json,created_at,created_by) VALUES (?,?,?,1,?,?,?)').bind(crypto.randomUUID(),e.employeeId,section,body,now,actor.userId),
    db.prepare('INSERT INTO profile_audit (id,employee_id,actor_id,actor_email,action,section,detail_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),e.employeeId,actor.userId,actor.email,'authorised_sheet_import',section,JSON.stringify({source:'IUC People Master Database',sourceExport:'2026-10-01',filesTransferred:false}),now)
   );imported++;
  }
  if(statements.length)await db.batch(statements);
  if(input.active==='No'||['Exited','Resigned','Alumni'].includes(sections.overview?.employmentStatus))await call('/api/people-culture/employees/'+encodeURIComponent(e.employeeId),'PATCH',{action:'deactivate'});
  return json({employeeId:e.employeeId,importedSections:imported,retainedDocuments:(input.documents||[]).length,mpcNotImported:(input.mpc||[]).length});
 }catch(error){return json({error:error.message||'Migration failed'},400);}
}
