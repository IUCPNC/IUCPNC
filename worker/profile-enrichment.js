import {profileRoute} from './profile-api.js';
import {sectionByKey,validateSection} from './profile-schema.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const allowed={personal:null,overview:['preferredName','employmentType','dateJoined','workLocation','businessUnit'],employment:['grade','costCentre','appointmentDate','confirmationDate','probationStart','probationEnd','contractStart','contractExpiry','noticePeriod','workingHours','faculty'],qualifications:null,compensation:['basicSalary','tax','bankName','bankAccount']};
const empty=v=>v===undefined||v===null||v==='';
async function authorised(request,env){
 if(!env.PROFILE_ENRICHMENT_KEY||env.PROFILE_ENRICHMENT_KEY.length<32||!env.PROFILE_ENRICHMENT_EXPIRES||Date.now()>=Date.parse(env.PROFILE_ENRICHMENT_EXPIRES)||!Number.isFinite(Date.parse(env.PROFILE_ENRICHMENT_EXPIRES)))return false;
 const actual=request.headers.get('x-profile-enrichment-key');if(!actual)return false;
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(actual),digest(env.PROFILE_ENRICHMENT_KEY)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export async function enrichmentRoute(request,env){
 if(new URL(request.url).pathname!=='/api/migration/profile-enrichment')return null;
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(!await authorised(request,env))return json({error:'Enrichment is unavailable'},403);
 try{
  const reader=request.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();if(!reader)return json({error:'Missing request'},400);for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>100000){await reader.cancel();return json({error:'Request too large'},413)}raw+=decoder.decode(chunk.value,{stream:true})}
  const input=JSON.parse(raw+decoder.decode());if(!['preview','apply'].includes(input.mode)||typeof input.employeeId!=='string'||typeof input.email!=='string'||typeof input.employeeName!=='string'||!Array.isArray(input.changes)||input.changes.length>100)throw Error('Invalid enrichment request');
  const e=await env.DB.prepare('SELECT employee_id,employee_name,email,active FROM employees WHERE employee_id=?').bind(input.employeeId).first();
  if(!e||e.employee_name!==input.employeeName||e.email!==input.email||!e.active)return json({error:'Active employee identity does not match'},409);
  const rows=(await env.DB.prepare('SELECT section,data_json,version FROM employee_profile_sections WHERE employee_id=?').bind(e.employee_id).all()).results;
  const sections=new Map(rows.map(r=>[r.section,r])),plans=new Map(),conflicts=[],unchanged=[];
  for(const change of input.changes){
   const {section,field,value,source}=change,spec=sectionByKey(section);
   if(!Object.hasOwn(allowed,section)||!spec?.fields.some(f=>f.key===field)||(allowed[section]&&!allowed[section].includes(field))||empty(value))throw Error('Only supported non-empty profile fields can be enriched');
   const sourceAllowed=source&&typeof source.url==='string'&&(/^https:\/\/(?:drive\.google\.com|docs\.google\.com|mail\.google\.com)\//.test(source.url)||(env.PROFILE_ENRICHMENT_SOURCE_SHA256&&source.url==='attachment:sha256:'+env.PROFILE_ENRICHMENT_SOURCE_SHA256));
   if(!sourceAllowed||typeof source.locator!=='string'||!source.locator.trim()||source.locator.length>500)throw Error('Every field requires an authorised source and location');
   const old=sections.get(section),data=old?JSON.parse(old.data_json):{},candidate=validateSection(section,{...data,[field]:value})[field];
   if(!empty(data[field])){(String(data[field])===String(candidate)?unchanged:conflicts).push(section+'.'+field);continue;}
   if(!plans.has(section))plans.set(section,{section,version:old?.version||0,data,sources:[]});
   const plan=plans.get(section);if(plan.sources.some(s=>s.field===field))throw Error('Duplicate field');plan.data[field]=candidate;plan.sources.push({field,url:source.url,locator:source.locator});
  }
  const proposed=[...plans.values()].flatMap(p=>p.sources.map(s=>p.section+'.'+s.field));
  if(input.mode==='preview')return json({employeeId:e.employee_id,proposed,conflicts,unchanged,versions:Object.fromEntries([...plans].map(([k,p])=>[k,p.version]))});
  for(const p of plans.values())if(input.versions?.[p.section]!==p.version)return json({error:'Profile changed; preview again',section:p.section},409);
  const applied=[];
  for(const p of plans.values()){
   const origin=new URL(request.url).origin,response=await profileRoute(new Request(origin+'/api/profiles/'+encodeURIComponent(e.employee_id)+'/sections/'+p.section,{method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify({data:p.data,version:p.version})}),env,{user:{userId:'authorised-profile-enrichment',email:'h.r@innovative.edu.my'},isPc:()=>true,importSource:{account:'h.r@innovative.edu.my',fields:p.sources}});
   if(!response.ok)return json({error:'Profile section could not be saved',section:p.section,applied,status:response.status},response.status);applied.push(...p.sources.map(s=>p.section+'.'+s.field));
  }
  return json({employeeId:e.employee_id,applied,conflicts,unchanged});
 }catch(error){return json({error:error instanceof SyntaxError?'Invalid JSON':error.message},400)}
}
