import {PROFILE_SECTIONS,validateSection} from './profile-schema.js';
const excluded=new Set(['overview.employmentStatus','learning.cpdTarget','learning.cpdYear','learning.training.cpdHours','learning.training.verificationStatus','performance','talent','relations','exit','attendance','alerts','timeline','documents']);
export const blank=v=>v===undefined||v===null||v===''||Array.isArray(v)&&!v.length;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const normalize=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function screeningFields(){return PROFILE_SECTIONS.filter(s=>!excluded.has(s.key)).flatMap(s=>[...s.fields.map(f=>({section:s.key,collection:'',...f})),...(s.collections||[]).flatMap(c=>c.fields.map(f=>({section:s.key,collection:c.key,...f})))].filter(f=>!f.readOnly&&!f.key.endsWith('DocumentId')&&f.key!=='documentId'&&!excluded.has([f.section,f.collection,f.key].filter(Boolean).join('.'))));}
export function cleanExtraction(raw){
 if(!raw||typeof raw!=='object'||!raw.identity||!Array.isArray(raw.facts)||raw.facts.length>160)throw Error('The document reader returned an invalid result.');
 const defs=screeningFields(),warnings=Array.isArray(raw.warnings)?raw.warnings.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,500)):[],facts=[],seen=new Set();
 for(const input of raw.facts){const f=defs.find(f=>f.section===input.section&&f.collection===(input.collection||'')&&f.key===input.key);if(!f||typeof input.value!=='string'||!input.value.trim())continue;
  if(typeof input.evidence!=='string'||!input.evidence.trim()){warnings.push('An unsupported suggestion was omitted because it had no source evidence.');continue;}
  const row=f.collection?Number(input.row):0;if(!Number.isInteger(row)||row<0||row>49)continue;const signature=[f.section,f.collection,row,f.key].join('|');if(seen.has(signature))continue;
  let value=input.value.trim();try{if(f.type==='number'){value=Number(value.replace(/^(RM|MYR)\s*/i,'').replace(/,/g,''));if(!Number.isFinite(value))throw Error();}const spec=PROFILE_SECTIONS.find(s=>s.key===f.section);const data=f.collection?{[f.collection]:[{[f.key]:value}]}:{[f.key]:value};value=f.collection?validateSection(f.section,data)[f.collection][0][f.key]:validateSection(f.section,data)[f.key];}catch{warnings.push(f.label+' was omitted because its format could not be validated.');continue;}
  seen.add(signature);facts.push({id:'fact-'+facts.length,section:f.section,collection:f.collection,row,key:f.key,label:f.label,value,evidence:input.evidence.slice(0,1000),location:String(input.location||'').slice(0,200),restricted:f.section==='compensation'||['nric','passport','teachingPermit'].includes(f.key)});
 }
 const identity=Object.fromEntries(['name','employeeId','email'].map(k=>[k,String(raw.identity[k]||'').slice(0,300)]));return {identity,facts,warnings:[...new Set(warnings)].slice(0,20),multipleEmployees:raw.multipleEmployees===true};
}
export function employeeCandidates(identity,employees){
 const id=normalize(identity.employeeId),name=normalize(identity.name),email=String(identity.email||'').trim().toLowerCase();return employees.map(e=>{const matches=[];if(id&&normalize(e.employee_id)===id)matches.push('Employee ID');if(email&&String(e.email).toLowerCase()===email)matches.push('Work email');if(name&&normalize(e.employee_name)===name)matches.push('Full name');return {employeeId:e.employee_id,name:e.employee_name,reasons:matches,conflictingIdentity:!!(id&&normalize(e.employee_id)!==id||email&&String(e.email).toLowerCase()!==email)};}).filter(e=>e.reasons.length).sort((a,b)=>b.reasons.length-a.reasons.length);
}
export function proposals(facts,sections){return facts.map(f=>{const existing=f.collection?sections[f.section]?.[f.collection]:sections[f.section]?.[f.key];return {...f,existing:blank(existing)?null:existing,state:blank(existing)?'missing':!f.collection&&equal(existing,f.value)?'same':'existing'};});}
export function missingChanges(facts,selected,sections,employee){
 const chosen=facts.filter(f=>selected.includes(f.id)),changes={},applied=[],skipped=[];
 for(const f of chosen){const old=sections[f.section]||{};if(!blank(f.collection?old[f.collection]:old[f.key])){skipped.push(f.id);continue;}
  const section=changes[f.section]??=structuredClone(old);
  if(f.collection){const rows=section[f.collection]??=[];let r=rows.find(r=>r._screenRow===f.row);if(!r){r={_screenRow:f.row,recordId:crypto.randomUUID()};rows.push(r);}r[f.key]=f.value;if(f.section==='learning'&&f.collection==='training'){r.verificationStatus='Pending';r.cpdHours=0;}}
  else section[f.key]=f.value;applied.push(f.id);
 }
 for(const [key,data]of Object.entries(changes)){for(const c of PROFILE_SECTIONS.find(s=>s.key===key).collections||[])for(const row of data[c.key]||[])delete row._screenRow;if(key==='overview')data.employmentStatus=sections.overview?.employmentStatus||(employee.active?'Active':'Exited');changes[key]=validateSection(key,data);}
 return {changes,applied,skipped};
}
