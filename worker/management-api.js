import {primaryProjection} from './position-core.js';
import {mergeProfileCredits} from './cpd-ledger.js';
import {ANNUAL_CPD_TARGET,businessDate,profileAlerts} from './profile-schema.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const query=(db,sql,...params)=>db.prepare(sql).bind(...params);
const pick=(data,keys)=>Object.fromEntries(keys.filter(k=>data?.[k]!==undefined).map(k=>[k,data[k]]));
function audit(db,user,action,detail){return query(db,'INSERT INTO management_audit (id,actor_id,actor_email,action,detail_json,created_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),user.userId,user.email,action,JSON.stringify(detail),new Date().toISOString())}
export async function managementAccess(env,user,role,isPc){
 if(!user)return null;if(isPc(env,user.email))return {hr:true};
 // Grants follow a stable employee record; the authenticated account must match its current email and binding.
 let employee=await query(env.DB,'SELECT employee_id,account_user_id FROM employees WHERE lower(email)=? AND active=1',user.email).first();
 if(!employee||employee.account_user_id&&employee.account_user_id!==user.userId)return null;
 const grant=await query(env.DB,'SELECT version FROM management_grants WHERE employee_id=? AND role=?',employee.employee_id,role).first();if(!grant)return null;
 if(!employee.account_user_id){await query(env.DB,'UPDATE employees SET account_user_id=? WHERE employee_id=? AND account_user_id IS NULL',user.userId,employee.employee_id).run();employee=await query(env.DB,'SELECT employee_id,account_user_id FROM employees WHERE employee_id=?',employee.employee_id).first();if(employee.account_user_id!==user.userId)return null;}
 return {hr:false,employeeId:employee.employee_id};
}
export function workProfile(sections){
 return {
 overview:pick(sections.overview,['preferredName','employmentStatus','businessUnit','employmentType','dateJoined','workLocation','workArrangement']),
 employment:pick(sections.employment,['category','appointmentType','grade','faculty','costCentre','secondManager','appointmentDate','confirmationDate','probationStart','probationEnd','contractStart','contractExpiry','noticePeriod','workingHours','workArrangement']),
 performance:pick(sections.performance,['managerComments','employeeComments']),
 learning:{...pick(sections.learning,['cpdYear','developmentPlan','developmentNeeds']),cpdTarget:ANNUAL_CPD_TARGET,training:(sections.learning?.training||[]).map(r=>pick(r,['title','provider','date','hours','cpdHours','category','certification','skills','reportedHours','verificationStatus','notes']))},
 qualifications:{...pick(sections.qualifications,['highestQualification','academicDiscipline','teachingSubjects','researchAreas','publications','supervision','examinerAppointments','memberships','researchGrants','orcid','scopusId','googleScholar']),academic:(sections.qualifications?.academic||[]).filter(r=>r.visibility!=='Restricted').map(r=>pick(r,['qualification','field','institution','country','year','level'])),professional:(sections.qualifications?.professional||[]).filter(r=>r.visibility!=='Restricted').map(r=>pick(r,['qualification','body','date','expiry']))},
 skills:{skills:(sections.skills?.skills||[]).map(r=>pick(r,['skill','level','years','evidence']))},
 };
}
function safeMpc(row){const out=pick(row,['reporting_year','month','kpi_score','values_rating','cpd_rating','social_rating','overall_score','performance_band','check_in_status','cpd_hours']);let payload;try{payload=JSON.parse(row.payload_json||'{}')}catch{}out.kpis=(payload?.months?.[row.month-1]?.kpis||[]).map(k=>pick(k,['kpi','title','name','description','objective','weight','rating','remarks','evidence','actual']));return out;}
function cpd(sections,year){return (sections.learning?.training||[]).filter(r=>r.date?.startsWith(String(year))&&!['Pending','Rejected'].includes(r.verificationStatus)).reduce((n,r)=>n+(Number(r.cpdHours)||0),0)}
export async function managementRoute(request,env,{user,isPc}){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/management'))return null;
 if(!user)return json({error:'Sign in is required.'},401);if(!env.DB)return json({error:'Management views are temporarily unavailable.'},503);
 const db=env.DB;
 try{
  const hr=isPc(env,user.email);
  if(path==='/api/management/access'){
   if(!hr)throw fail('P&C access is required.',403);
   if(request.method==='GET'){const [employees,grants,reports,events]=await Promise.all([db.prepare('SELECT employee_id,employee_name,email,department,active FROM employees ORDER BY employee_name').all(),db.prepare('SELECT employee_id,role,version,updated_at FROM management_grants').all(),db.prepare('SELECT employee_id,manager_id FROM management_reports').all(),db.prepare('SELECT actor_email,action,detail_json,created_at FROM management_audit ORDER BY created_at DESC LIMIT 50').all()]);return json({employees:employees.results,grants:grants.results,reports:reports.results,events:events.results})}
   if(request.method!=='PUT')throw fail('Method not allowed.',405);
   if(request.headers.get('origin')!==url.origin)throw fail('Refresh this page before saving.',403);
   const raw=await request.text();if(raw.length>50000)throw fail('Access request is too large.',413);
   const body=JSON.parse(raw),{employeeId,role,enabled,version}=body;
   if(!['manager','leadership'].includes(role)||typeof employeeId!=='string'||typeof enabled!=='boolean'||!Number.isInteger(version)||version<0)throw fail('Invalid access request.');
   const owner=await query(db,'SELECT employee_id,active FROM employees WHERE employee_id=?',employeeId).first();if(!owner||enabled&&!Number(owner.active))throw fail('Select an active employee account.');
   const reports=role==='manager'&&enabled?body.reports:[];
   if(!Array.isArray(reports)||reports.length>500||reports.some(id=>typeof id!=='string'||id===employeeId)||new Set(reports).size!==reports.length)throw fail('Choose unique direct reports; a manager cannot report to themselves.');
   for(const id of reports){const target=await query(db,'SELECT e.active,r.manager_id FROM employees e LEFT JOIN management_reports r ON r.employee_id=e.employee_id WHERE e.employee_id=?',id).first();if(!target?.active)throw fail('Direct reports must be active employees.');if(target.manager_id&&target.manager_id!==employeeId)throw fail('A selected employee already has an assigned manager. Remove that assignment first.',409);}
   const old=await query(db,'SELECT version FROM management_grants WHERE employee_id=? AND role=?',employeeId,role).first();if((old?.version||0)!==version)throw fail('Access was changed by another P&C user. Refresh before saving.',409);
   // Version assertion aborts the whole batch on a concurrent write; no partial reporting-line changes.
   const stamp=new Date().toISOString(),statements=[query(db,'INSERT INTO management_grants (employee_id,role,version,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(employee_id,role) DO UPDATE SET version=CASE WHEN management_grants.version=? THEN management_grants.version+1 ELSE NULL END,updated_by=excluded.updated_by,updated_at=excluded.updated_at',employeeId,role,version+1,user.userId,stamp,version)];
   if(role==='manager'){statements.push(query(db,'DELETE FROM management_reports WHERE manager_id=?',employeeId));for(const id of reports)statements.push(query(db,'INSERT INTO management_reports (employee_id,manager_id) VALUES (?,?)',id,employeeId));}
   if(!enabled)statements.push(query(db,'DELETE FROM management_grants WHERE employee_id=? AND role=?',employeeId,role));
   statements.push(audit(db,user,enabled?'access_granted':'access_revoked',{employeeId,role,reports}));
   try{await db.batch(statements)}catch{throw fail('Assignments changed while saving. Refresh and try again.',409)}
   return json({saved:true});
  }
  if(request.method!=='GET')throw fail('Management views are read-only.',403);
  const match=path.match(/^\/api\/management\/(manager|leadership)(?:\/([^/]+))?$/);if(!match)throw fail('Not found.',404);
  const role=match[1],id=match[2]?decodeURIComponent(match[2]):null,access=await managementAccess(env,user,role,isPc);if(!access)throw fail('P&C has not granted this management view to your account.',403);
  const filter=role==='manager'&&!access.hr?' WHERE employee_id IN (SELECT employee_id FROM management_reports WHERE manager_id=?)':'',params=filter?[access.employeeId]:[];
  const employees=await primaryProjection(db,(await query(db,'SELECT employee_id,employee_name,position,department,active FROM employees'+filter+' ORDER BY employee_name',...params).all()).results);
  if(id&&!employees.some(e=>e.employee_id===id))throw fail('This employee is outside your authorised scope.',403);
  // Only select columns/sections required by the view; restricted personal/pay/relations records never enter the response.
  const sections=(await query(db,"SELECT employee_id,section,data_json FROM employee_profile_sections"+ (filter?filter+" AND ":' WHERE ')+"section IN ('overview','employment','learning','skills','qualifications','performance'"+(role==='leadership'?",'talent'":'')+")",...params).all()).results;
  const mpc=(await query(db,'SELECT employee_id,reporting_year,month,kpi_score,values_rating,cpd_rating,social_rating,overall_score,performance_band,check_in_status,cpd_hours'+(role==='manager'?',payload_json':'')+' FROM mpc_submissions'+filter+' ORDER BY reporting_year DESC,month DESC',...params).all()).results;
  const year=Number(businessDate().slice(0,4)),mapped=new Map();for(const r of sections){if(!mapped.has(r.employee_id))mapped.set(r.employee_id,{});mapped.get(r.employee_id)[r.section]=JSON.parse(r.data_json)}const credits=(await query(db,'SELECT * FROM cpd_credits WHERE 1=1'+(filter?' AND employee_id IN (SELECT employee_id FROM management_reports WHERE manager_id=?)':''),...(filter?params:[])).all()).results;for(const c of credits){const s=mapped.get(c.employee_id)||{};s.learning ||= {training:[],cpdTarget:ANNUAL_CPD_TARGET};s.learning.training ||= [];s.learning.training=mergeProfileCredits(s.learning.training,[c]);mapped.set(c.employee_id,s)}
  const rows=employees.map(e=>{const s=mapped.get(e.employee_id)||{},records=mpc.filter(r=>r.employee_id===e.employee_id),latest=records[0];return {...e,status:s.overview?.employmentStatus||(e.active?'Active':'Exited'),cpdHours:cpd(s,year),latestMpc:latest?pick(latest,['reporting_year','month','overall_score','check_in_status']):null,skills:workProfile(s).skills.skills,alerts:role==='manager'?profileAlerts(workProfile(s),records):[],...(role==='leadership'?{talent:pick(s.talent,['previousPositions','careerInterests','mobility','promotionReadiness','successorCandidate','criticalRole','highPotential','retentionRisk','aspirations'])}:{})}});
  if(id){const s=mapped.get(id)||{},e=rows.find(r=>r.employee_id===id);await audit(db,user,'management_profile_viewed',{role,employeeId:id}).run();return json(role==='manager'?{employee:e,sections:workProfile(s),mpc:mpc.filter(r=>r.employee_id===id).map(safeMpc),year,cpdTarget:ANNUAL_CPD_TARGET}:{employee:pick(e,['employee_id','employee_name','department','position','status']),talent:e.talent})}
  const active=rows.filter(e=>e.active),latestScores=active.map(e=>e.latestMpc?.overall_score).filter(v=>v!==null&&v!==undefined),departments=[...new Set(rows.map(e=>e.department||'Unassigned'))].sort().map(name=>({name,total:rows.filter(e=>(e.department||'Unassigned')===name).length,active:active.filter(e=>(e.department||'Unassigned')===name).length}));
  await audit(db,user,'management_dashboard_viewed',{role,employees:rows.length}).run();
  return json({role,hr:access.hr,year,cpdTarget:ANNUAL_CPD_TARGET,employees:role==='leadership'?rows.map(e=>pick(e,['employee_id','employee_name','position','department','status','active','talent'])):rows,summary:{total:rows.length,active:active.length,departments,mpcRecorded:active.filter(e=>e.latestMpc).length,averageLatestMpc:latestScores.length?latestScores.reduce((a,b)=>a+Number(b),0)/latestScores.length:null,cpdCompleted:active.filter(e=>e.cpdHours>=ANNUAL_CPD_TARGET).length,cpdRecorded:active.filter(e=>e.cpdHours>0).length},refreshedAt:new Date().toISOString()});
 }catch(error){if(error.status)return json({error:error.message},error.status);if(error instanceof SyntaxError)return json({error:'Invalid request data.'},400);console.error('Management request failed',error.name);return json({error:'Management data is temporarily unavailable.'},503)}
}
