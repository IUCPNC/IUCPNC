import {PARTICIPANT_CURRENT} from './academic-participant-policy.js';
import {q,rows,fail,clean,date,record,parse,today,now,json,audit,assertRow,grantAssert,guard,commit,permits} from './academic-core.js';
import {ACTIVE} from './connect-core.js';
export const contributorCategories={
 'student-supervisor':'Student supervisor',
 'part-time-supervisor':'Part-time supervisor (IUC employee)',
 'external-academic-examiner':'External academic examiner',
 'external-industry-advisor':'External industry advisor',
 'external-academic-advisor':'External academic advisor'
};
const required=(d,key,max=2000)=>{const v=clean(d[key]||'',max);if(!v)throw fail('Appointment review requires '+key+'.');return v;};
export async function participantInput(db,d,programmeId,employeeId){
 if(!Object.hasOwn(contributorCategories,d.category))throw fail('Choose an academic contributor category.');
 const programme=await record(db,programmeId,'programme');if(programme.status!=='Published')throw fail('Publish the approved programme before appointing academic contributors.');
 const personId=required(d,'personId',500),accountUserId=required(d,'accountUserId',500),person=await q(db,'SELECT * FROM people WHERE person_id=? AND archived_at IS NULL',personId).first();
 if(!person?.primary_email)throw fail('Use an existing Person Master identity with a verified account email.');
 const employee=await q(db,'SELECT e.* FROM employees e WHERE e.person_id=? AND '+ACTIVE,personId).first();
 if(employeeId&&(!employee||employee.employee_id!==employeeId||employee.account_user_id!==accountUserId||employee.email.toLowerCase()!==person.primary_email.toLowerCase()))throw fail('An internal supervisor must match the active employee and bound account.');
 if(d.category.startsWith('external-')&&(employee||employeeId))throw fail('External appointments require an external Person Master identity.');
 if(employee&&!employeeId)throw fail('Link the existing employee profile for an internal supervisor.');
 if(d.category==='part-time-supervisor'){if(!employeeId)throw fail('Part-time supervisors are IUC employees. Link their existing employee profile.');const sections=await rows(db,"SELECT section,data_json FROM employee_profile_sections WHERE employee_id=? AND section IN ('overview','employment')",employeeId);const classification=Object.fromEntries(sections.map(r=>[r.section,parse(r.data_json)]));if((classification.employment?.workingTime||(classification.overview?.employmentType==='Part-Time'?'Part-time':null))!=='Part-time')throw fail('Record part-time employment in the canonical employee profile before appointment.');}
 const effective=date(d.effective),expires=date(d.expires);if(expires<effective)throw fail('Check appointment dates.');
 if(!['Cleared','Managed'].includes(d.conflictStatus))throw fail('Review and resolve conflicts before submitting an appointment.');
 const data={category:d.category,personId,accountUserId,effective,expires,appointmentReference:required(d,'appointmentReference'),approvalAuthority:required(d,'approvalAuthority'),qualificationEvidence:required(d,'qualificationEvidence'),expertiseEvidence:required(d,'expertiseEvidence'),standardSource:required(d,'standardSource'),eligibilityReview:required(d,'eligibilityReview',5000),duties:required(d,'duties',5000),workScope:required(d,'workScope',3000),conflictDeclaration:required(d,'conflictDeclaration',3000),conflictStatus:d.conflictStatus,managementPlan:clean(d.managementPlan||'',3000),affiliation:required(d,'affiliation'),independenceReviewed:d.independenceReviewed===true,supervisionPolicy:clean(d.supervisionPolicy||'',3000),identityEmail:person.primary_email.toLowerCase()};
 if(data.conflictStatus==='Managed'&&!data.managementPlan)throw fail('Record the approved conflict management plan.');
 if(data.category==='external-academic-examiner'&&(!data.independenceReviewed||data.conflictStatus!=='Cleared'))throw fail('An external examiner requires an independent, conflict-free appointment review.');
 if(['student-supervisor','part-time-supervisor'].includes(data.category)&&!data.supervisionPolicy)throw fail('Record applicable supervision qualification, capacity, training and ethics policy review.');
 return data;
}
export function participantIdentityAssert(db,d,employeeId){
 return assertRow(db,`SELECT 1 FROM people person WHERE person.person_id=? AND person.archived_at IS NULL AND lower(person.primary_email)=? AND (? IS NULL OR EXISTS(SELECT 1 FROM employees e WHERE e.employee_id=? AND e.person_id=person.person_id AND e.account_user_id=? AND lower(e.email)=lower(person.primary_email) AND ${ACTIVE})) AND (? NOT LIKE 'external-%' OR NOT EXISTS(SELECT 1 FROM employees e WHERE e.person_id=person.person_id AND ${ACTIVE}))`,d.personId,d.identityEmail,employeeId||null,employeeId||null,d.accountUserId,d.category);
}
function participantAssert(db,user,r){return [...participantIdentityAssert(db,r.data,r.employee_id),...assertRow(db,`SELECT 1 FROM academic_records r JOIN people person ON person.person_id=json_extract(r.data_json,'$.personId') WHERE r.id=? AND r.version=? AND ${PARTICIPANT_CURRENT} AND lower(person.primary_email)=lower(?) AND json_extract(r.data_json,'$.accountUserId')=?`,r.id,r.version,user.email,user.userId)];}
const decoded=r=>({...r,data:parse(r.data_json),data_json:undefined});
const reviewRole=(a,p)=>['administrator','approver','quality'].find(role=>permits(a,role,p));
export async function contributorOverview(db,a,user){
 const appointments=a.participantAppointments.map(decoded),ids=appointments.map(r=>r.id);
 const programmes=await rows(db,"SELECT id,code,title FROM academic_records WHERE kind='programme' AND status='Published' AND id IN (SELECT value FROM json_each(?))",JSON.stringify(appointments.map(r=>r.programme_id)));
 const submissions=(await rows(db,"SELECT * FROM academic_records WHERE kind='contributor-output' AND json_extract(data_json,'$.authorUserId')=? AND json_extract(data_json,'$.appointmentId') IN (SELECT value FROM json_each(?)) ORDER BY updated_at DESC LIMIT 300",user.userId,JSON.stringify(ids))).map(decoded);
 return {mode:'contributor',appointments,programmes,submissions,categories:contributorCategories,asOf:now()};
}
export async function contributorRegistry(db,a){
 // Confidential appointment evidence and reports are restricted to authorised academic reviewers.
 const scopes=[...new Set(a.grants.filter(g=>['administrator','approver','quality'].includes(g.role)).map(g=>g.scope))];
 const appointments=await rows(db,"SELECT r.*,p.legal_name FROM academic_records r JOIN people p ON p.person_id=json_extract(r.data_json,'$.personId') WHERE r.kind='participant' AND (?=1 OR r.programme_id IN (SELECT value FROM json_each(?))) ORDER BY r.updated_at DESC LIMIT 1001",scopes.includes('*')?1:0,JSON.stringify(scopes));
 if(appointments.length>1000)throw fail('Narrow the contributor registry before loading this view.');
 const ids=appointments.map(r=>r.id),submissions=(await rows(db,"SELECT * FROM academic_records WHERE kind='contributor-output' AND json_extract(data_json,'$.appointmentId') IN (SELECT value FROM json_each(?)) ORDER BY updated_at DESC LIMIT 1001",JSON.stringify(ids))).map(decoded);
 if(submissions.length>1000)throw fail('Narrow the contributor reports before loading this view.');
 return {appointments:appointments.map(decoded),submissions,categories:contributorCategories};
}
export async function contributorRoute(request,db,a,user,path){
 if(request.method==='GET'&&path==='contributors'){if(!a.lecturer)throw fail('Academic reviewer access is required.',403);return json(await contributorRegistry(db,a));}
 if(path==='contributors/identities'){
  if(request.method!=='POST'||!a.lecturer)throw fail('Academic administrator access is required.',403);const {bounded}=await import('./academic-core.js'),b=JSON.parse(new TextDecoder().decode(await bounded(request,10000))),programmeId=required(b,'programmeId',500);if(!permits(a,'administrator',programmeId))throw fail('Programme administrator permission is required.',403);
  await record(db,programmeId,'programme');const legalName=required(b,'legalName',300),email=required(b,'email',254).toLowerCase(),sourceReference=required(b,'sourceReference');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Enter the verified external account email.');
  if(await q(db,'SELECT 1 FROM employees WHERE lower(email)=?',email).first())throw fail('This email belongs to an employee. Use the existing employee identity.',409);
  const existing=await q(db,'SELECT person_id,legal_name,archived_at FROM people WHERE lower(primary_email)=?',email).first();if(existing){if(existing.archived_at||existing.legal_name!==legalName)throw fail('Resolve the existing Person Master identity with P&C before appointment.',409);return json({personId:existing.person_id,existing:true});}
  const personId=crypto.randomUUID();return commit(db,[...grantAssert(db,a,user,'administrator',programmeId),...assertRow(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM people WHERE lower(primary_email)=?) AND NOT EXISTS(SELECT 1 FROM employees WHERE lower(email)=?)',email,email),q(db,"INSERT INTO people(person_id,legal_name,primary_email,lifecycle_status,data_classification,updated_at) VALUES(?,?,?,'prospect','confidential',?)",personId,legalName,email,now()),audit(db,user,'external_academic_identity_registered',personId,null,{legalName,email,sourceReference,programmeId,relationship:'External academic contributor; no employment created'})],{personId,existing:false},201);
 }
 if(!path.startsWith('contributions'))return null;
 if(request.method!=='POST')throw fail('Method not allowed.',405);
 const {bounded}=await import('./academic-core.js');const b=JSON.parse(new TextDecoder().decode(await bounded(request,40000)));
 if(path==='contributions'){
  const id=clean(b.appointmentId),appointment=a.participantAppointments.find(r=>r.id===id);if(!appointment)throw fail('A current approved appointment for your account is required.',403);
  const r=decoded(appointment),title=required(b,'title',300),data={appointmentId:id,authorUserId:user.userId,category:r.data.category,workScope:r.data.workScope,sourceReference:required(b,'sourceReference'),findings:required(b,'findings',10000),recommendations:required(b,'recommendations',10000)},reportId=crypto.randomUUID();
  return commit(db,[...participantAssert(db,user,r),q(db,"INSERT INTO academic_records(id,kind,programme_id,employee_id,code,title,status,data_json,created_by,updated_by,updated_at) VALUES(?,?,?,?,?,?,'Submitted',?,?,?,?)",reportId,'contributor-output',r.programme_id,r.employee_id,reportId,title,JSON.stringify(data),user.email,user.email,now()),audit(db,user,'contributor_report_submitted',reportId,null,data)],{id:reportId,status:'Submitted'},201);
 }
 const m=path.match(/^contributions\/([^/]+)\/review$/);if(m){
  if(!a.lecturer)throw fail('Academic reviewer access is required.',403);const r=await record(db,m[1],'contributor-output'),role=reviewRole(a,r.programme_id);if(!role)throw fail('This report is outside your academic review scope.',403);
  if(r.data.authorUserId===user.userId)throw fail('An independent report reviewer is required.',403);if(r.status!=='Submitted')throw fail('This report has already been reviewed.',409);
  if(!['Accepted','Follow-up required'].includes(b.decision))throw fail('Choose a report review decision.');
  const values={status:b.decision,data_json:JSON.stringify({...r.data,review:{by:user.email,at:now(),comment:required(b,'comment',4000)}}),updated_by:user.email,updated_at:now()};
  return commit(db,[...grantAssert(db,a,user,role,r.programme_id),...guard(db,'academic_records',r.id,b.version,values),audit(db,user,'contributor_report_reviewed',r.id,r,values)],{id:r.id,status:values.status,version:r.version+1});
 }
 throw fail('Contributor endpoint not found.',404);
}
