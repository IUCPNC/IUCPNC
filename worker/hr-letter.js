import {PDFDocument,StandardFonts,rgb} from './vendor/pdf-lib.mjs';
import {HR_LETTERHEAD} from './hr-letterhead.js';
import {EMPLOYMENT_STATUSES} from './profile-schema.js';

export const LETTER_TYPES=['Employment confirmation letter','Salary confirmation letter','Employment verification'];
export const LETTER_DEFINITIONS={
 'Employment confirmation letter':{title:'CONFIRMATION OF EMPLOYMENT',purpose:'Confirms the employee\'s service, appointment and employment details.',requiresSalary:false,fileLabel:'Employment-Confirmation'},
 'Salary confirmation letter':{title:'SALARY CONFIRMATION',purpose:'Confirms recorded monthly basic salary and allowances together with employment details.',requiresSalary:true,fileLabel:'Salary-Confirmation'},
 'Employment verification':{title:'EMPLOYMENT VERIFICATION',purpose:'Verifies the employee\'s role, department, employment status and service dates as at the letter date.',requiresSalary:false,fileLabel:'Employment-Verification'}
};
export const letterDefinition=type=>LETTER_DEFINITIONS[type];
export const isLetter=r=>LETTER_TYPES.includes(r.request_type);
const clean=v=>typeof v==='string'?v.trim():'';
const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export const myDate=()=>new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export const hashBytes=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export const hashData=v=>hashBytes(new TextEncoder().encode(JSON.stringify(v)));

// Only official record fields are used. Request free text never supplies identity, pay or dates.
export async function letterSource(db,r,today=myDate()){
 const definition=letterDefinition(r.request_type),sectionNames=['overview','personal','employment','exit',...(definition.requiresSalary?['compensation']:[])];
 const e=await db.prepare('SELECT employee_id,employee_name,position,department,active,updated_at FROM employees WHERE employee_id=?').bind(r.employee_id).first();
 const sections=(await db.prepare('SELECT section,data_json,version FROM employee_profile_sections WHERE employee_id=? AND section IN ('+sectionNames.map(()=>'?').join(',')+') ORDER BY section').bind(r.employee_id,...sectionNames).all()).results;
 const p=Object.fromEntries(sections.map(s=>[s.section,JSON.parse(s.data_json)])),o=p.overview||{},personal=p.personal||{},employment=p.employment||{},pay=p.compensation||{},exit=p.exit||{};
 const ended=['Exited','Alumni','Resigned'].includes(o.employmentStatus)||(validDate(exit.lastWorkingDay)&&exit.lastWorkingDay<today&&exit.autoLifecycle==='Enabled');
 const snapshot={template:'iuc-hr-letters-en-v2',requestType:r.request_type,reference:'IUC.500-4/2/7-RL-'+r.employee_id+'-'+r.reference.replace('HR-',''),date:today,name:clean(personal.legalName)||clean(e.employee_name),identifier:clean(personal.nric)||clean(personal.passport),identifierLabel:clean(personal.nric)?'NRIC No.':'Passport No.',employeeId:e.employee_id,position:clean(e.position),department:clean(e.department),startDate:clean(o.dateJoined)||clean(employment.appointmentDate),endDate:clean(exit.lastWorkingDay),employmentType:clean(o.employmentType)||clean(employment.appointmentType),...(definition.requiresSalary?{basicSalary:money(pay.basicSalary),transportAllowance:money(pay.transportAllowance),fixedAllowances:money(pay.fixedAllowances)}:{}),ended,employmentStatus:clean(o.employmentStatus),accountActive:e.active};
 const missing=[];for(const [key,label] of [['name','Full employee name'],['identifier','NRIC or passport number'],['position','Position'],['department','Department'],['startDate','Employment commencement date'],['employmentType','Employment type']])if(!snapshot[key])missing.push(label);
 if(snapshot.startDate&&!validDate(snapshot.startDate))missing.push('Valid employment commencement date');
 if(validDate(snapshot.startDate)&&snapshot.startDate>today)missing.push('Commencement date must not be in the future');
 if(definition.requiresSalary&&snapshot.basicSalary===null)missing.push('Monthly basic salary');
 if(!EMPLOYMENT_STATUSES.includes(snapshot.employmentStatus))missing.push('Confirmed employment status');
 if(ended&&(!validDate(snapshot.endDate)||snapshot.endDate>today))missing.push('Confirmed last date of service');
 if(validDate(snapshot.endDate)&&validDate(snapshot.startDate)&&snapshot.endDate<snapshot.startDate)missing.push('Last date of service must follow the commencement date');
 // Standard Times fonts faithfully match the supplied English template. Do not alter unsupported names silently.
 if(Object.values(snapshot).some(v=>typeof v==='string'&&/[\u0000-\u0008\u000b-\u001f]/.test(v)))missing.push('Remove unsupported control characters from employee records');
 const guard={employee:[e.employee_name,e.position,e.department,e.active,e.updated_at??null],sectionNames,sections:sections.map(s=>[s.section,s.version,s.data_json])};
 return {snapshot,missing:[...new Set(missing)],fingerprint:await hashData(snapshot),guard};
}

const humanDate=v=>new Date(v+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const rm=v=>'RM '+v.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
function legacyRows(s){return [
 ['Name',s.name],[s.identifierLabel,s.identifier],['Employee No.',s.employeeId],['Position',s.position],['Department',s.department],['Employment Commencement Date',humanDate(s.startDate)],
 ...(s.ended?[['Last Date of Service',humanDate(s.endDate)]]:s.employmentStatus==='Notice Period'&&validDate(s.endDate)?[['Scheduled Last Working Day',humanDate(s.endDate)]]:[]),
 ['Employment Type',s.employmentType],['Monthly Basic Salary',rm(s.basicSalary)],
 ...(s.transportAllowance!==null?[['Monthly Transportation Allowance',rm(s.transportAllowance)]]:s.fixedAllowances!==null?[['Monthly Fixed Allowances',rm(s.fixedAllowances)]]:[])
 ];}
export function letterRows(s){
 if(s.template==='iuc-employment-en-v1')return legacyRows(s);
 const rows=[['Name',s.name],[s.identifierLabel,s.identifier],['Employee No.',s.employeeId],['Position',s.position],['Department',s.department],['Employment Commencement Date',humanDate(s.startDate)],
 ...(s.ended?[['Last Date of Service',humanDate(s.endDate)]]:s.employmentStatus==='Notice Period'&&validDate(s.endDate)?[['Scheduled Last Working Day',humanDate(s.endDate)]]:[]),
 ['Employment Type',s.employmentType],['Employment Status',s.employmentStatus]];
 if(s.requestType==='Employment verification')rows.push(['Verified As At',humanDate(s.date)]);
 if(letterDefinition(s.requestType).requiresSalary){rows.push(['Monthly Basic Salary',rm(s.basicSalary)]);if(s.transportAllowance!==null)rows.push(['Monthly Transportation Allowance',rm(s.transportAllowance)]);else if(s.fixedAllowances!==null)rows.push(['Monthly Fixed Allowances',rm(s.fixedAllowances)]);}
 return rows;
}
export function letterTitle(s){return (s.template==='iuc-employment-en-v1'?(s.requestType==='Salary confirmation letter'?'CONFIRMATION OF EMPLOYMENT AND SALARY':'CONFIRMATION OF EMPLOYMENT'):letterDefinition(s.requestType).title)+' - '+s.name.toUpperCase();}
export function letterText(s){
 if(s.template==='iuc-employment-en-v1')return {lead:'We refer to the above matter.',intro:'This is to confirm that the person named below '+(s.ended?'was employed':'is employed')+' by Innovative University College. The employment details below are based on the institution\'s official records:',closing:'This letter is issued at the employee\'s request for the purpose of employment verification. The institution confirms that the information stated above is accurate based on the records available as at the date of this letter.'};
 const name=s.name,when=humanDate(s.date);
 if(s.requestType==='Employment confirmation letter')return {lead:'We refer to the above matter.',intro:'This is to confirm that '+name+' '+(s.ended?'was employed':'is employed')+' by Innovative University College. The following service details are confirmed from the institution\'s official employment records:',closing:'This letter is issued at the employee\'s request as confirmation of '+(s.ended?'their period of service':'their employment')+' with Innovative University College. The information above reflects the official employment records available as at '+when+'.'};
 if(s.requestType==='Salary confirmation letter')return {lead:'We refer to the above matter.',intro:'This letter confirms the employment and recorded monthly remuneration of '+name+'. The employment details, monthly basic salary and recorded allowances below are taken from the institution\'s official records:',closing:'This letter is issued at the employee\'s request for salary confirmation. The amounts stated reflect the recorded monthly basic salary and allowances as at '+when+'; they do not represent net take-home pay.'};
 return {lead:'Verification of employment records',intro:'For employment verification purposes, Innovative University College confirms that '+name+' '+(s.ended?'was employed':'is currently employed')+' by the institution. The following information is taken from its official employment records:',closing:'This verification is provided at the employee\'s request. The information is accurate based on the official employment records available as at '+when+'.'};
}
async function letterLayout(s){
 const doc=await PDFDocument.create();doc.setTitle('IUC '+s.requestType);doc.setAuthor('Innovative University College · People & Culture');doc.setSubject(s.reference);doc.setCreator('IUC Nadi HR Service Desk');doc.setCreationDate(new Date(s.date+'T00:00:00Z'));doc.setModificationDate(new Date(s.date+'T00:00:00Z'));
 const regular=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesRomanBold);
 // WinAnsi encoder must reject unsupported characters instead of replacing the employee's legal name.
 for(const v of Object.values(s))if(typeof v==='string'){regular.encodeText(v);bold.encodeText(v.toUpperCase())}
 const width=(text,font,size)=>font.widthOfTextAtSize(text,size);
 function wrap(text,font,size,max){const lines=[];let line='';for(const word of text.split(/\s+/)){if(width(word,font,size)>max){if(line){lines.push(line);line=''}let part='';for(const c of word){if(width(part+c,font,size)>max){lines.push(part);part=''}part+=c}line=part;continue}const next=line?line+' '+word:word;if(width(next,font,size)>max){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines;}
 const body=(size)=>{
  const out=[],leading=size*1.22;let y=696;
  const line=(text,{font=regular,x=72,max=451,after=0}={})=>{for(const l of wrap(text,font,size,max)){out.push({text:l,x,y,font,size});y-=leading}y-=after};
  line('Ref. No.: '+s.reference);line('Date: '+humanDate(s.date),{after:17});
  line('TO WHOM IT MAY CONCERN,',{font:bold,after:17});line(letterTitle(s),{font:bold,after:16});
  const wording=letterText(s);line(wording.lead,{after:9});
  line(wording.intro,{after:11});
  for(const [label,value]of letterRows(s)){const left=wrap(label,regular,size,194),right=wrap(value,bold,size,242),n=Math.max(left.length,right.length);for(let i=0;i<n;i++){if(left[i])out.push({text:left[i],x:72,y,font:regular,size});if(i===0)out.push({text:':',x:270,y,font:regular,size});if(right[i])out.push({text:right[i],x:281,y,font:bold,size});y-=leading}y-=1.2}
  y-=14;line(wording.closing,{after:13});
  line('Thank you.',{after:15});line('PEOPLE & CULTURE DEPARTMENT',{font:bold});line('Innovative University College',{after:12});
  line('This document is computer-generated and does not require a signature.');
  return {out,bottom:y};
 };
 let layout;for(const size of [11,10.5,10,9.5]){layout=body(size);if(layout.bottom>=118)break}
 if(layout.bottom<118)throw Object.assign(Error('The employee details exceed this letter layout. Contact P&C to review the employee master fields.'),{status:422});
 return {doc,layout,bold};
}
export async function renderLetter(s,{sample=false}={}){
 const {doc,layout,bold}=await letterLayout(s);
 const background=await doc.embedJpg(Uint8Array.from(atob(HR_LETTERHEAD),c=>c.charCodeAt(0)));
 const page=doc.addPage([595.5,841.98]);page.drawImage(background,{x:0,y:0,width:595.5,height:841.98});
 for(const t of layout.out)page.drawText(t.text,{...t,color:rgb(0,0,0)});
 if(sample)page.drawText('SAMPLE - NOT FOR ISSUE',{x:166,y:104,size:14,font:bold,color:rgb(.6,.15,.15)});
 return doc.save();
}
export async function renderLetterPreview(s,issued=false){
 const {layout,bold}=await letterLayout(s),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=layout.out.map(t=>`<span style="left:${t.x/595.5*100}%;top:${(841.98-t.y-t.size*.9)/841.98*100}%;font-size:${t.size/595.5*100}cqw;font-weight:${t.font===bold?'700':'400'}">${esc(t.text)}</span>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IUC English employment letter preview</title><style>body{margin:0;padding:12px;background:#eae6ee}.notice{font:12px/1.5 Arial,sans-serif;text-align:center;color:#583366;margin:0 0 10px}.sheet{position:relative;container-type:inline-size;width:100%;max-width:595.5px;aspect-ratio:595.5/841.98;margin:auto;background:#fff;box-shadow:0 2px 8px #0002}.sheet img{position:absolute;width:100%;height:100%}.sheet span{position:absolute;font-family:'Times New Roman',Times,serif;line-height:1;white-space:pre}</style></head><body><p class="notice">${issued?'Approved record':'Unissued admin preview'} · English letter · ${esc(s.reference)}</p><article class="sheet" aria-label="English employment letter"><img alt="IUC letterhead" src="data:image/jpeg;base64,${HR_LETTERHEAD}">${text}</article></body></html>`;
}
