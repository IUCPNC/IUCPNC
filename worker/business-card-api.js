import {hubAccess} from './people-hub-api.js';
import {positionData,professionalContact} from './position-core.js';
import {businessDate,lifecycleStatus} from './profile-schema.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private,no-store','x-content-type-options':'nosniff'}});
const clean=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
export function businessContact(employee){
 const email=clean(employee.email).toLowerCase();
 // The account email may be personal. Only the institutional work address belongs on a public card.
 return {employeeId:clean(employee.employee_id),name:clean(employee.employee_name),title:clean(employee.position),department:clean(employee.department),organisation:'Innovative University College',email:/^[^\s@]+@innovative\.edu\.my$/i.test(email)?email:'',photoUrl:'/api/people-hub/photos/'+encodeURIComponent(employee.employee_id)};
}
const escapeVcard=v=>clean(v).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,');
async function opaqueCardId(key,id){const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode('iuc-business-card:'+id))),b=>b.toString(16).padStart(2,'0')).join('')}
async function keyMatches(actual,expected){if(!actual||!expected)return false;const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));const a=await digest(actual),b=await digest(expected);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];return mismatch===0}
export function contactVcard(c){
 return ['BEGIN:VCARD','VERSION:3.0','N:;'+escapeVcard(c.name)+';;;','FN:'+escapeVcard(c.name),'ORG:'+escapeVcard(c.organisation)+';'+escapeVcard(c.department),...(c.title?['TITLE:'+escapeVcard(c.title)]:[]),...(c.email?['EMAIL;TYPE=INTERNET,WORK:'+c.email]:[]),...(c.officePhone?['TEL;TYPE=WORK:'+escapeVcard(c.officePhone)]:[]),...(c.publicUrl?['URL:'+escapeVcard(c.publicUrl)]:[]),'END:VCARD'].join('\r\n')+'\r\n';
}
export async function businessCardRoute(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;if(path!=='/api/business-cards'&&!path.startsWith('/api/business-cards/'))return null;
 const bridge=path.match(/^\/api\/business-cards\/public\/([a-f0-9]{64})(\/photo)?$/);
 const publicDirectory=path==='/api/business-cards/public-directory';
 if(bridge||publicDirectory){if(!await keyMatches(request.headers.get('x-business-card-key'),env.BUSINESS_CARD_BRIDGE_KEY))return json({error:'Unauthorised.'},401)}
 else if(!ctx.user)return json({error:'Sign in is required.'},401);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 if(!env.DB)return json({error:'Business cards are temporarily unavailable.'},503);
 try{
  const access=bridge||publicDirectory?{}:await hubAccess(env,ctx.user,ctx.isPc);if(!access)return json({error:'Active employee or P&C access is required.'},403);
  const rows=(await env.DB.prepare('SELECT employee_id,employee_name,email,position,department,active FROM employees WHERE active=1 ORDER BY employee_name').all()).results;
  const lifecycleRows=(await env.DB.prepare("SELECT employee_id,section,data_json FROM employee_profile_sections WHERE section IN ('overview','exit','qualifications','professionalProfile')").all()).results;
  const lifecycle=new Map();for(const r of lifecycleRows){const s=lifecycle.get(r.employee_id)||{};s[r.section]=JSON.parse(r.data_json);lifecycle.set(r.employee_id,s)}
  const roleMaster=await positionData(env.DB),contacts=[];
  for(const e of rows.filter(e=>!['Exited','Alumni','Resigned'].includes(lifecycleStatus(lifecycle.get(e.employee_id)||{},businessDate())))){const professional=await professionalContact(env.DB,e,roleMaster,true,lifecycle.get(e.employee_id)||{});if(professional)contacts.push({...businessContact(e),...professional});}
  if(env.BUSINESS_CARD_BRIDGE_KEY&&env.BUSINESS_CARD_PUBLIC_ORIGIN){for(const c of contacts){c.publicId=await opaqueCardId(env.BUSINESS_CARD_BRIDGE_KEY,c.employeeId);c.publicUrl=env.BUSINESS_CARD_PUBLIC_ORIGIN+'/c/'+c.publicId}}
  if(publicDirectory)return json({contacts:contacts.filter(c=>c.directoryVisible&&c.publicId).map(c=>{const {employeeId,publicId,photoUrl,directoryVisible,...safe}=c;return {...safe,photoUrl:'/api/photos/'+publicId};})});
  if(bridge){const c=contacts.find(c=>c.publicId===bridge[1]);if(!c)return json({error:'This business card is no longer available.'},404);
   if(bridge[2]){const d=await env.DB.prepare("SELECT d.storage_key,d.mime_type FROM profile_documents p JOIN document_assets d ON d.document_id=p.document_id WHERE p.employee_id=? AND p.category='Profile Photo' AND p.visibility='employee' AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 1").bind(c.employeeId).first();if(!d||!['image/png','image/jpeg'].includes(d.mime_type))return json({error:'No photo.'},404);const object=await env.PROFILE_FILES?.get(d.storage_key);if(!object)return json({error:'No photo.'},404);return new Response(object.body,{headers:{'content-type':d.mime_type,'cache-control':'private,no-store','x-content-type-options':'nosniff'}})}
   const {employeeId,publicId,photoUrl,...contact}=c;contact.photoUrl='/api/photos/'+publicId;return json({contact,vcard:contactVcard(contact)});
  }
  if(path==='/api/business-cards')return json({contacts,selfEmployeeId:access.employeeId||null});
  const id=decodeURIComponent(path.slice('/api/business-cards/'.length)),contact=contacts.find(c=>c.employeeId===id);
  if(!contact)return json({error:'This employee business card is unavailable.'},404);
  return json({contact,vcard:contactVcard(contact)});
 }catch(e){console.error('Business card request failed',e.name);return json({error:'Business cards could not be loaded. Please refresh and try again.'},503)}
}
