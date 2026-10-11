import {APPOINTMENT_FROM,CURRENT_APPOINTMENT} from './appointment-source.js';
import {hubAccess} from './people-hub-api.js';
import {serviceEmployee} from './hr-service-api.js';
import {FOLLOW_UP_PENDING_SQL,REQUESTED_DATE_SQL} from './hr-service-operations.js';
import {academicAccess} from './academic-core.js';
import {ACTIVE} from './connect-core.js';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const count=async(db,sql,...args)=>Number((await q(db,sql,...args).first())?.n||0);
// A read-only inbox. Each owning module retains its approvals, records and audit trail.
export async function homePrioritiesRoute(request,env,{user,isPc}){
 if(new URL(request.url).pathname!=='/api/home/priorities')return null;
 if(!user)return json({error:'Sign in is required.'},401);
 if(request.method!=='GET')return json({error:'This workspace summary is read-only.'},405);
 if(!env.DB)return json({error:'Your workspace is temporarily unavailable.'},503);
 const access=await hubAccess(env,user,isPc);
 if(!access)return json({error:'Active workspace access is required.'},403);
 const db=env.DB,employee=await serviceEmployee(env,user),day=new Date(Date.now()+28800000).toISOString().slice(0,10),until=new Date(Date.parse(day)+30*86400000).toISOString().slice(0,10),items=[],unavailable=[];
 const add=(id,label,value,href,scope,detail='')=>items.push({id,label,count:value,href,scope,detail});
 const section=async(name,fn)=>{try{await fn()}catch{unavailable.push(name)}};
 if(employee){
  const id=employee.employee_id;
  await section('My HR requests',async()=>add('hr-information','HR requests needing your information',await count(db,"SELECT COUNT(*) n FROM hr_service_requests WHERE employee_id=? AND status='Needs Information'",id),'/employee/requests','self'));
  await section('My appointments',async()=>add('appointments','Appointments awaiting acknowledgement',await count(db,"SELECT COUNT(*) n FROM "+APPOINTMENT_FROM+" WHERE p.employee_id=? AND "+CURRENT_APPOINTMENT+" AND EXISTS(SELECT 1 FROM position_documents d WHERE d.role_id=p.role_id AND d.status='Published' AND d.effective_date<=? AND (d.expiry_date IS NULL OR d.expiry_date>=?) AND NOT EXISTS(SELECT 1 FROM position_documents newer WHERE newer.role_id=d.role_id AND newer.kind=d.kind AND newer.version>d.version AND newer.status='Published' AND newer.effective_date<=? AND (newer.expiry_date IS NULL OR newer.expiry_date>=?)) AND NOT EXISTS(SELECT 1 FROM position_acknowledgements a WHERE a.assignment_id=p.id AND a.employee_id=p.employee_id AND a.document_id=d.id AND a.document_hash=d.content_hash))",id,day,day,day,day),'/employee/appointments','self'));
  await section('My learning',async()=>add('training','Upcoming approved training',await count(db,"SELECT COUNT(*) n FROM cpd_requests WHERE employee_id=? AND status='Approved' AND substr(starts_at,1,10)>=? AND substr(starts_at,1,10)<=?",id,day,until),'/employee/cpd','self','Next 30 days'));
  await section('My leave',async()=>add('leave','Leave applications in progress',await count(db,"SELECT COUNT(*) n FROM leave_requests WHERE employee_id=? AND status IN ('Pending','Information requested','Cancellation requested')",id),'/employee/leave','self'));
  await section('My teaching',async()=>{if(!(await academicAccess(env,user,isPc)).lecturer)return;add('teaching','Upcoming teaching sessions',await count(db,"SELECT COUNT(*) n FROM academic_sessions WHERE employee_id=? AND publication='Published' AND status NOT IN ('Cancelled','Superseded') AND date>=? AND date<=?",id,day,until),'/academic','self','Next 30 days · published timetable');});
 }
 if(access.role==='hr'||access.role==='manager'){
  const scope=access.role==='hr'?'institution':'assigned team';
  const filter=access.role==='hr'?'':' AND e.employee_id IN (SELECT employee_id FROM management_reports WHERE manager_id=?)',args=access.role==='hr'?[]:[access.employeeId];
  await section('Team MPC',async()=>add('team-mpc','MPC awaiting completion',await count(db,`SELECT COUNT(*) n FROM employees e WHERE ${ACTIVE}${filter} AND NOT EXISTS(SELECT 1 FROM mpc_submissions m WHERE m.employee_id=e.employee_id AND m.reporting_year=? AND m.month=? AND m.check_in_status='Completed')`,...args,+day.slice(0,4),+day.slice(5,7)),access.role==='hr'?'/admin':'/manager',scope,day.slice(0,7)));
  await section('Employment reviews',async()=>{
   const base=`FROM employee_profile_sections p JOIN employees e ON e.employee_id=p.employee_id WHERE p.section='employment' AND ${ACTIVE}${filter}`;
   for(const [key,label]of [['contractExpiry','Contracts due for review'],['probationEnd','Probation reviews due']])add(key,label,await count(db,`SELECT COUNT(*) n ${base} AND json_extract(p.data_json,'$.${key}')>=? AND json_extract(p.data_json,'$.${key}')<=?`,...args,day,until),access.role==='hr'?'/admin/profiles':'/manager',scope,'Next 30 days');
  });
  if(access.role==='manager')await section('Team training',async()=>add('team-training','Training awaiting supervisor review',await count(db,`SELECT COUNT(*) n FROM cpd_requests r JOIN employees e ON e.employee_id=r.employee_id WHERE ${ACTIVE}${filter} AND r.supervisor_id=? AND r.status='Pending Supervisor / HOD Approval'`,...args,access.employeeId),'/employee/cpd','assigned team'));
 }
 if(access.role==='leadership')await section('Workforce summary',async()=>add('workforce','Current workforce',await count(db,`SELECT COUNT(*) n FROM employees e WHERE ${ACTIVE}`),'/top-management','institutional summary','Current active employees; open the dashboard for scoped trends'));
 if(access.role==='hr'){
  await section('HR Service Desk',async()=>add('hr-requests','HR requests awaiting action',await count(db,"SELECT COUNT(*) n FROM hr_service_requests WHERE status IN ('Submitted','In Review','Approved')"),'/admin/requests','P&C'));
  await section('HR request follow-ups',async()=>{
   add('hr-follow-ups','Employee follow-ups awaiting acknowledgement',await count(db,'SELECT COUNT(*) n FROM hr_service_requests r WHERE '+FOLLOW_UP_PENDING_SQL),'/admin/requests','P&C');
   add('hr-past-requested-date','HR requests past the requested date',await count(db,'SELECT COUNT(*) n FROM hr_service_requests r WHERE '+REQUESTED_DATE_SQL+' AND r.needed_by<?',day),'/admin/requests','P&C','Employee-requested dates; delivery commitments remain subject to P&C review');
  });
  await section('Training review',async()=>add('cpd-review','Training requests awaiting review',await count(db,"SELECT COUNT(*) n FROM cpd_requests WHERE status='Pending HR / Admin Review'"),'/admin/cpd','P&C'));
 }
 await section('Academic approvals',async()=>{
  const a=await academicAccess(env,user,isPc),scopes=[...new Set(a.grants.filter(g=>g.role==='approver').map(g=>g.scope))];
  if(!scopes.length)return;
  const filter=scopes.includes('*')?'':` AND programme_id IN (${scopes.map(()=>'?').join(',')})`;
  add('academic-review','Teaching awaiting independent verification',await count(db,"SELECT COUNT(*) n FROM academic_sessions WHERE publication='Published' AND status IN ('Lecturer Submitted','Pending Verification') AND employee_id<>?"+filter,a.employeeId,...(scopes.includes('*')?[]:scopes)),'/academic','authorised academic programmes');
 });
 let readiness;
 if(access.role==='hr'){
  readiness=[];
  await section('Employee Master consistency',async()=>{
   const links=await count(db,`SELECT COUNT(*) n FROM employees e LEFT JOIN employment_records r ON r.employment_id=e.employment_id LEFT JOIN people p ON p.person_id=e.person_id WHERE ${ACTIVE} AND (p.person_id IS NULL OR r.employment_id IS NULL OR r.employee_id IS NOT e.employee_id OR r.person_id IS NOT p.person_id OR lower(r.work_email) IS NOT lower(e.email) OR p.legal_name IS NOT e.employee_name OR lower(p.primary_email) IS NOT lower(e.email) OR r.employment_status<>'active')`),identities=await count(db,"SELECT COUNT(*) n FROM (SELECT lower(email) FROM employees GROUP BY lower(email) HAVING COUNT(*)>1)");
   readiness.push({id:'employee-master',label:'Employee Master consistency',status:links||identities?'Enhancement Required':'Sources consistent',detail:links+' active employee link inconsistencies; '+identities+' conflicting email identities. This read-only check covers shared identity links; full workflow acceptance remains required.',href:'/people-culture/master-database'});
  });
  await section('Sheets health',async()=>{
   const s=await db.prepare('SELECT enabled,last_success,last_error,failures FROM sheet_sync_state LIMIT 1').first(),exceptions=await count(db,"SELECT COUNT(*) n FROM sheet_sync_records WHERE issue IS NOT NULL AND issue<>'' AND resolution IS NULL"),age=s?.last_success?Date.now()-Date.parse(s.last_success):Infinity;
   readiness.push({id:'sync',label:'Google Sheets synchronisation',status:!s?.enabled?'Configuration Required':s.last_error||exceptions?'Enhancement Required':!Number.isFinite(age)||age<0||age>10*60000?'Published but Unverified':'Recently reconciled',detail:`${exceptions} unresolved exceptions. Last success: ${s?.last_success||'No successful run recorded'}.`,href:'/admin/sync'});
  });
  await section('Academic readiness',async()=>{
   const programmes=await count(db,"SELECT COUNT(*) n FROM academic_records WHERE kind='programme' AND status='Published'");
   readiness.push({id:'academic',label:'Academic Hub configuration',status:'Configuration Required',detail:programmes+' published programmes. Institutional grants, approved sources, policies and real-account acceptance must be confirmed in Academic Hub.',...((await academicAccess(env,user,isPc)).hubEligible?{href:'/academic'}:{})});
  });
  readiness.push({id:'screening',label:'Document screening',status:env.OPENAI_API_KEY&&env.PROFILE_FILES?'Published but Unverified':'Configuration Required',detail:env.OPENAI_API_KEY&&env.PROFILE_FILES?'Connection configured; authorised document acceptance testing remains required.':'P&C document screening requires its configured extraction connection and private file storage.',...(env.OPENAI_API_KEY&&env.PROFILE_FILES?{href:'/admin/document-screening'}:{})});
  readiness.push({id:'recruitment',label:'Recruitment integration',status:'Published but Unverified',detail:'Talent Pre-Screening is listed as unverified in the institutional framework; its source, access and accepted-candidate handoff require verification.'});
  readiness.push({id:'recovery',label:'Recovery and operational acceptance',status:'Published but Unverified',detail:'Confirm provider backup ownership, retention and a tested restoration exercise. Code publication does not establish recovery readiness.'});
 }
 return json({asOf:new Date().toISOString(),businessDate:day,items,unavailable,...(readiness?{readiness}:{}),readOnly:true});
}
