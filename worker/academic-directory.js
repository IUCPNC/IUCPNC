import {PARTICIPANT_CURRENT} from './academic-participant-policy.js';
import {q,rows,parse,LECTURER_CURRENT} from './academic-core.js';
import {contributorCategories} from './academic-contributors.js';
export function employeeClassification(sections={}){
 const overview=sections.overview||{},employment=sections.employment||{};
 const workingTime=employment.workingTime||(overview.employmentType==='Part-Time'?'Part-time':'Unconfirmed');
 return {relationship:'IUC employee',workingTime,academicFunction:employment.academicFunction||null};
}
export async function directoryAcademicProfiles(db,employees){
 const profiles=await rows(db,"SELECT employee_id,section,data_json FROM employee_profile_sections WHERE section IN ('overview','employment')"),mapped=new Map();
 for(const r of profiles){if(!mapped.has(r.employee_id))mapped.set(r.employee_id,{});mapped.get(r.employee_id)[r.section]=parse(r.data_json);}
 const appointed=await rows(db,`SELECT lg.employee_id FROM academic_grants lg WHERE ${LECTURER_CURRENT}`),lecturers=new Set(appointed.map(r=>r.employee_id));
 const appointments=await rows(db,`SELECT r.id,r.employee_id,r.programme_id,r.data_json,person.person_id,person.legal_name,programme.title programme_title FROM academic_records r JOIN people person ON person.person_id=json_extract(r.data_json,'$.personId') JOIN academic_records programme ON programme.id=r.programme_id WHERE ${PARTICIPANT_CURRENT}`);
 const safe=r=>{const d=parse(r.data_json);return {id:r.id,category:d.category,label:contributorCategories[d.category],programme:r.programme_title,effective:d.effective,expires:d.expires,affiliation:d.affiliation};};
 const enhanced=employees.map(e=>({...e,...employeeClassification(mapped.get(e.employee_id)),academicFunction:lecturers.has(e.employee_id)?[employeeClassification(mapped.get(e.employee_id)).academicFunction,'Lecturer'].filter(Boolean).join(' · '):employeeClassification(mapped.get(e.employee_id)).academicFunction,academicAppointments:appointments.filter(r=>r.employee_id===e.employee_id).map(safe)}));
 const external=new Map();for(const r of appointments.filter(r=>!r.employee_id)){
  if(!external.has(r.person_id))external.set(r.person_id,{personId:r.person_id,name:r.legal_name,relationship:'External academic contributor — not an IUC employee',workingTime:'Not applicable',appointments:[]});external.get(r.person_id).appointments.push(safe(r));
 }
 return {employees:enhanced,academicContributors:[...external.values()]};
}
