import {PROFILE_SECTIONS} from './profile-schema.js';
export async function recordIds(employeeId,section,data){
 const out=structuredClone(data);
 for(const c of PROFILE_SECTIONS.find(s=>s.key===section)?.collections||[]){
  for(const [i,row] of (out[c.key]||[]).entries())if(!row.recordId){
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([employeeId,section,c.key,i].join('|')));
   row.recordId=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').slice(0,20);
  }
 }
 return out;
}
