import {notificationRoute} from './nadi-notifications.js';
import {academicRoute} from './academic-api.js';
import {homePrioritiesRoute} from './home-priorities.js';
import {academicAccess} from './academic-core.js';
import {ACADEMIC_HTML,ACADEMIC_CSS,ACADEMIC_JS,ACADEMIC_BRIDGE_JS} from './academic-assets.js';
import {payrollRoute} from './payroll-api.js';
import {payrollAccess} from './payroll-core.js';
import {PAYROLL_HTML,PAYROLL_CSS,PAYROLL_JS} from './payroll-assets.js';
import {leaveRoute} from './leave-api.js';
import {LEAVE_HTML,LEAVE_CSS,LEAVE_JS,LEAVE_FILES} from './leave-assets.js';
import {NOTIFICATION_CSS,NOTIFICATION_JS} from './notification-assets.js';
import {resolveAuth,authRoute,authGate,servicePath} from './nadi-auth.js';
import {authPage} from './nadi-auth-page.js';
import {passwordSetupPage} from './nadi-reset-page.js';
import {AUTH_CSS,AUTH_JS,SESSION_JS} from './nadi-auth-assets.js';
import {syncMasterEmployee} from './employee-master.js';
import {reconcilePositions,ensurePositionsCurrent} from './position-sync.js';
import {calendarRoute} from './calendar-api.js';
import {positionRoute} from './position-api.js';
import {CARD_PROFESSIONAL_JS} from './business-professional-assets.js';
import {POSITIONS_HTML,POSITIONS_CSS,POSITIONS_JS} from './position-assets.js';
import {CALENDAR_CSS,CALENDAR_JS} from './calendar-assets.js';
import {workforceRoute} from './workforce-api.js';
import {WORKFORCE_HTML,WORKFORCE_CSS,WORKFORCE_JS} from './workforce-assets.js';
import {serviceDeskRoute,serviceEmployee} from './hr-service-api.js';
import {connectRoute} from './connect-api.js';
import {access as connectAccess} from './connect-core.js';
import {CONNECT_HTML,CONNECT_CSS,CONNECT_JS} from './connect-assets.js';
import {SERVICE_HTML,SERVICE_CSS,SERVICE_JS} from './hr-service-assets.js';
import {attendanceRoute,recordNadiWork} from './attendance-api.js';
import {ATTENDANCE_HTML,ATTENDANCE_CSS,ATTENDANCE_JS} from './attendance-assets.js';
import {verifiedCpd,mergeCpd} from './cpd-mpc.js';
import {businessCardRoute} from './business-card-api.js';
import {CARD_HTML,CARD_CSS,CARD_JS} from './business-card-assets.js';
import {policyPage,policyFile,policyUpload,policySearchData,POLICY_CSS,POLICY_JS} from './policy-library.js';
import {screeningRoute} from './document-screening-api.js';
import {SCREENING_HTML,SCREENING_CSS,SCREENING_JS} from './document-screening-assets.js';
import {CULTURE_HTML,CULTURE_CSS} from './culture-assets.js';
import {announcementRoute} from './home-announcements.js';
import {homePage} from './home-page.js';
import {HOME_CSS,HOME_JS} from './home-assets.js';
import {portalShell} from './portal-navigation.js';
import {migrationRoute} from './migration.js';
import {enrichmentRoute} from './profile-enrichment.js';
import {syncRoute} from './sheets-sync.js';
import {SYNC_HTML,SYNC_CSS,SYNC_APP,SYNC_RUNNER,SYNC_MANIFEST} from './sheets-sync-assets.js';
import { profileRoute } from "./profile-api.js";
import { cpdRoute } from "./cpd-api.js";
import { hubRoute, hubAccess } from "./people-hub-api.js";
import { HUB_HTML, HUB_CSS, HUB_APP } from "./people-hub-assets.js";
import { managementRoute, managementAccess } from "./management-api.js";
import { MANAGEMENT_HTML, MANAGEMENT_CSS, MANAGEMENT_APP } from "./management-assets.js";
import { PROFILE_HTML, PROFILE_CSS, PROFILE_APP, PROFILE_SCHEMA } from "./profile-assets.js";
import { CPD_HTML, CPD_CSS, CPD_APP, CPD_QR } from "./cpd-assets.js";
import { EMPLOYEE_HTML, EMPLOYEE_CSS, EMPLOYEE_APP, IUC_LOGO_BASE64 } from "./generated-assets.js";
import { PC_HTML, PC_CSS, PC_APP } from "./pc-assets.js";
import { MASTER_HTML, MASTER_CSS, MASTER_APP } from "./master-assets.js";
import { EMPLOYEE_SEED } from "./employee-seed.js";

const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const html=(body,status=200)=>new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"same-origin","content-security-policy":"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'"}});
async function portalAccess(env,user){
 const hr=isPc(env,user.email);let employee=false,manager=hr,leadership=hr,employeeId='';
 if(env.DB){const row=await env.DB.prepare('SELECT employee_id,account_user_id,active FROM employees WHERE lower(email)=lower(?)').bind(user.email).first();employee=!!row&&Number(row.active)===1&&(!row.account_user_id||row.account_user_id===user.userId);
 if(employee){const current=await serviceEmployee(env,user);employee=!!current;if(current)employeeId=current.employee_id;}
 if(employee&&!hr){const grants=await env.DB.prepare('SELECT role FROM management_grants WHERE employee_id=?').bind(row.employee_id).all();manager=grants.results.some(g=>g.role==='manager');leadership=grants.results.some(g=>g.role==='leadership')}}
 const payroll=env.DB?await payrollAccess(env,user):{grants:[]};
 const academic=env.DB?await academicAccess(env,user,isPc):{grants:[]};
 return {hr,employee,manager,leadership,employeeId,academic:academic.grants.length>0||hr,payroll:payroll.grants.some(g=>g.role!=='summary'),payrollSummary:payroll.grants.some(g=>g.role==='summary'),screeningReady:!!env.OPENAI_API_KEY&&!!env.PROFILE_FILES};
}
async function appHtml(source,request,env,user){return html(portalShell(source,{...await portalAccess(env,user),authMethod:user.authMethod},new URL(request.url)));
}
const text=(body,type)=>new Response(body,{headers:{"content-type":`${type}; charset=utf-8`,"cache-control":"public, max-age=300","x-content-type-options":"nosniff"}});
const signIn=(request,returnTo)=>Response.redirect(new URL(`/login?return_to=${encodeURIComponent(returnTo)}`,request.url),302);
const isPc=(env,email)=>(env.PC_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
const dbOf=(env)=>{if(!env.DB)throw new Error("The MPC database is unavailable.");return env.DB};
const clean=value=>String(value??"").trim();
const emailOk=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const stableId=(prefix,value)=>`${prefix}:${Array.from(new TextEncoder().encode(clean(value).toLowerCase()),byte=>byte.toString(16).padStart(2,"0")).join("")}`;
const publicEmployee=row=>({employee_id:String(row.employee_id),email:String(row.email),employee_name:String(row.employee_name),position:String(row.position||""),department:String(row.department||""),appraiser:String(row.appraiser||""),active:Number(row.active),account_linked:Boolean(row.account_user_id),created_at:row.created_at,updated_at:row.updated_at});
async function directoryEmployee(db,employeeId){return db.prepare("SELECT employee_id,account_user_id,email,employee_name,position,department,appraiser,active,created_at,updated_at FROM employees WHERE employee_id=?").bind(employeeId).first()}
async function directoryAudit(db,user,eventType,before,after){const employeeId=String(after?.employee_id||before?.employee_id);await db.prepare("INSERT INTO employee_directory_events (id,employee_id,actor_user_id,actor_email,event_type,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),employeeId,user.userId,user.email,eventType,before?JSON.stringify(publicEmployee(before)):null,after?JSON.stringify(publicEmployee(after)):null,new Date().toISOString()).run()}
async function ensureMasterDirectory(db,user){
  const missing=(await db.prepare("SELECT employee_id,account_user_id,email,employee_name,position,department,appraiser,active,created_at,updated_at FROM employees WHERE person_id IS NULL OR employment_id IS NULL ORDER BY employee_id LIMIT 250").all()).results;
  for(const row of missing)await syncMasterEmployee(db,row,user,"imported");
}
function employeeInput(body,requireManager=true){const data={employeeId:clean(body.employeeId),employeeName:clean(body.employeeName),email:clean(body.email).toLowerCase(),position:clean(body.position),department:clean(body.department),appraiser:clean(body.appraiser)};if(!data.employeeId||!data.employeeName||!data.email||!data.position||!data.department||(requireManager&&!data.appraiser))throw Object.assign(new Error("Complete all employee fields before saving."),{status:400});if(!emailOk(data.email))throw Object.assign(new Error("Enter a valid employee email address."),{status:400});return data}
let directoryReady;
async function ensureDirectory(env){
  if(directoryReady)return directoryReady;
  directoryReady=(async()=>{const db=dbOf(env),count=await db.prepare("SELECT COUNT(*) AS count FROM employees").first();if(Number(count?.count)>=EMPLOYEE_SEED.length)return;await db.batch(EMPLOYEE_SEED.map(e=>db.prepare(`INSERT INTO employees (employee_id,email,employee_name,position,department,appraiser,active,updated_at) VALUES (?,?,?,?,?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(employee_id) DO NOTHING`).bind(e.employeeId,e.email,e.employeeName,e.position,e.department,e.appraiser)))} )().catch(error=>{directoryReady=null;throw error});
  return directoryReady;
}
async function employeeFor(env,user){await ensureDirectory(env);const db=dbOf(env),row=await db.prepare("SELECT employee_id,account_user_id,email,employee_name,position,department,appraiser,active FROM employees WHERE lower(email)=lower(?)").bind(user.email).first();if(!row||!Number(row.active))return null;if(row.account_user_id&&row.account_user_id!==user.userId)throw new Error("This employee record is already linked to another account. Contact People & Culture.");if(!row.account_user_id)await db.prepare("UPDATE employees SET account_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=? AND account_user_id IS NULL").bind(user.userId,row.employee_id).run();return{employeeId:String(row.employee_id),employeeName:String(row.employee_name),email:String(row.email),position:String(row.position||""),department:String(row.department||""),appraiser:String(row.appraiser||"")}}
const n=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0},round=value=>Math.round(value*100)/100;
function calculate(payload,identity){
  const selectedMonth=Math.min(11,Math.max(0,n(payload?.selectedMonth))),month=payload?.months?.[selectedMonth]||{},employee=payload?.employee||{},kpis=Array.isArray(month.kpis)?month.kpis:[],rated=kpis.filter(k=>n(k?.rating)>0&&n(k?.weight)>0),weight=kpis.reduce((s,k)=>s+n(k?.weight),0),kpi=rated.length&&Math.abs(weight-100)<.01?rated.reduce((s,k)=>s+n(k.rating)*n(k.weight)/100,0):null;
  const vals=Object.values(month.values||{}).map(x=>n(x?.rating)).filter(x=>x>0),values=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,cpd=[...(Array.isArray(month.cpd)?month.cpd:[]),...(Array.isArray(month.cpdManaged)?month.cpdManaged:[])],sh=cpd.reduce((s,x)=>s+n(x?.structuredHours),0),nh=cpd.reduce((s,x)=>s+n(x?.nonStructuredHours),0),cpdHours=sh+nh,cpdRating=!cpdHours?null:sh>=10&&nh>=10?5:sh>=9&&nh>=9?4:sh>=8&&nh>=8?3:cpdHours>=12?2:1,socialLinks=(Array.isArray(month.social)?month.social:[]).filter(x=>String(x?.link||"").trim()).length,socialRating=!socialLinks?null:socialLinks>=20?5:socialLinks>=17?4:socialLinks>=15?3:socialLinks>=10?2:1;
  const missing=[];if(kpi===null)missing.push("KPI Score");if(values===null)missing.push("Values Rating");if(cpdRating===null)missing.push("CPD Rating");if(socialRating===null)missing.push("Social Media Rating");const complete=!missing.length,overall=complete?round(kpi*.5+values*.2+cpdRating*.15+socialRating*.15):null,band=overall===null?"Not Available":overall>=4.5?"Excellent":overall>=3.75?"Commendable":overall>=3?"Average":overall>=2?"Below Average":"Unsatisfactory",ack=String(month?.ack?.employee||"Not Yet Acknowledged"),confirm=String(month?.ack?.appraiser||"Pending"),acknowledged=ack==="Acknowledged",status=complete&&acknowledged&&confirm==="Confirmed"?"Completed":rated.length||values||cpdRating||socialRating||acknowledged?"Pending":"Not Started",reportingYear=Math.trunc(n(employee.year));if(reportingYear<2020||reportingYear>2100)throw new Error("A valid reporting year is required.");
  const canonical={...payload,employee:{...employee,id:identity.employeeId,email:identity.email,name:identity.employeeName,position:identity.position,department:identity.department,appraiser:identity.appraiser}};
  return{employeeId:identity.employeeId,employeeEmail:identity.email,employeeName:identity.employeeName,position:identity.position,department:identity.department,appraiser:identity.appraiser,reportingYear,month:selectedMonth+1,monthName:MONTHS[selectedMonth],kpiScore:kpi===null?null:round(kpi),valuesRating:values===null?null:round(values),cpdRating,socialRating,overallScore:overall,performanceBand:band,checkInStatus:status,cpdHours:round(cpdHours),socialLinks,employeeAcknowledgment:ack,appraiserConfirmation:confirm,missingComponents:missing.join(", "),numberMissing:missing.length,scoreBelow299:overall!==null&&overall<=2.99,socialLinksCompliant:socialLinks>=15,employeeAcknowledged:acknowledged,ruleVersion:"2026.1",payloadJson:JSON.stringify(canonical)};
}
async function saveSubmission(env,record,user){const db=dbOf(env),existing=await db.prepare("SELECT id FROM mpc_submissions WHERE employee_id=? AND reporting_year=? AND month=?").bind(record.employeeId,record.reportingYear,record.month).first(),id=existing?.id||crypto.randomUUID(),now=new Date().toISOString(),v=[id,user.userId,user.email,record.employeeId,record.employeeName,record.employeeEmail,record.position,record.department,record.appraiser,record.reportingYear,record.month,record.kpiScore,record.valuesRating,record.cpdRating,record.socialRating,record.overallScore,record.performanceBand,record.checkInStatus,record.cpdHours,record.socialLinks,record.employeeAcknowledgment,record.appraiserConfirmation,record.missingComponents,record.numberMissing,record.scoreBelow299?1:0,record.socialLinksCompliant?1:0,record.employeeAcknowledged?1:0,record.ruleVersion,record.payloadJson,now,now];await db.batch([db.prepare(`INSERT INTO mpc_submissions (id,authenticated_user_id,authenticated_email,employee_id,employee_name,employee_email,position,department,appraiser,reporting_year,month,kpi_score,values_rating,cpd_rating,social_rating,overall_score,performance_band,check_in_status,cpd_hours,social_links,employee_acknowledgment,appraiser_confirmation,missing_components,number_missing,score_below_299,social_links_compliant,employee_acknowledged,rule_version,payload_json,updated_at,submitted_at) VALUES (${v.map(()=>"?").join(",")}) ON CONFLICT(employee_id,reporting_year,month) DO UPDATE SET authenticated_user_id=excluded.authenticated_user_id,authenticated_email=excluded.authenticated_email,employee_name=excluded.employee_name,employee_email=excluded.employee_email,position=excluded.position,department=excluded.department,appraiser=excluded.appraiser,kpi_score=excluded.kpi_score,values_rating=excluded.values_rating,cpd_rating=excluded.cpd_rating,social_rating=excluded.social_rating,overall_score=excluded.overall_score,performance_band=excluded.performance_band,check_in_status=excluded.check_in_status,cpd_hours=excluded.cpd_hours,social_links=excluded.social_links,employee_acknowledgment=excluded.employee_acknowledgment,appraiser_confirmation=excluded.appraiser_confirmation,missing_components=excluded.missing_components,number_missing=excluded.number_missing,score_below_299=excluded.score_below_299,social_links_compliant=excluded.social_links_compliant,employee_acknowledged=excluded.employee_acknowledged,rule_version=excluded.rule_version,payload_json=excluded.payload_json,updated_at=excluded.updated_at,submitted_at=excluded.submitted_at`).bind(...v),db.prepare("INSERT INTO mpc_submission_events (id,submission_id,actor_user_id,actor_email,event_type,snapshot_json,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,user.userId,user.email,existing?"updated":"created",JSON.stringify({...record,payloadJson:undefined}),now)]);return{id,updated:Boolean(existing),submittedAt:now,summary:{...record,payloadJson:undefined}}}
function denied(message,status=403){return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MPC access</title><style>body{margin:0;background:#f6f1f6;color:#2e1b33;font:16px/1.5 Arial;display:grid;min-height:100vh;place-items:center}.card{max-width:560px;margin:24px;padding:32px;border-radius:20px;background:#fff;box-shadow:0 18px 55px #34114320;border-top:5px solid #5b1f70}h1{font-family:Georgia,serif}a{color:#6f2576}</style></head><body><main class="card"><h1>Access unavailable</h1><p>${message}</p><p><a href="/logout">Sign out</a></p></main></body></html>`,status)}

async function dispatch(request,env,trustedUser=null){
  try{const url=new URL(request.url),path=url.pathname;
    if(path==='/notification-ui.css')return text(NOTIFICATION_CSS,'text/css');if(path==='/notification-ui.js')return text(NOTIFICATION_JS,'application/javascript');
    if(path==='/nadi-auth.css')return text(AUTH_CSS,'text/css');if(path==='/nadi-auth.js')return text(AUTH_JS,'application/javascript');if(path==='/nadi-session.js')return text(SESSION_JS,'application/javascript');
    const auth=trustedUser?{user:trustedUser,mode:'compatibility'}:await resolveAuth(request,env),user=auth.user;
    const authResponse=await authRoute(request,env,auth);if(authResponse)return authResponse;
    if(path==='/account/set-password'){const response=html(passwordSetupPage());response.headers.set('referrer-policy','no-referrer');return response;}
    if(path==='/login'||path==='/logout')return html(authPage(path==='/login'?'login':'logout',user));
    const gate=authGate(request,auth,!!trustedUser);if(gate)return gate;
    if(user&&!trustedUser&&path.startsWith('/api/')&&!servicePath(path)&&['POST','PUT','PATCH','DELETE'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'Refresh Nadi before saving this change.'},403);
    if(path==='/academic.css')return text(ACADEMIC_CSS,'text/css');if(path==='/academic.js')return text(ACADEMIC_JS,'application/javascript');if(path==='/academic-bridge.js')return text(ACADEMIC_BRIDGE_JS,'application/javascript');
    if(path==='/academic'){if(!user)return signIn(request,path);const a=await academicAccess(env,user,isPc);if(!a.employeeId&&!a.pc&&!a.grants.length)return denied('An active employee or authorised academic appointment is required.');return appHtml(ACADEMIC_HTML,request,env,user);}
    const priorityResponse=await homePrioritiesRoute(request,env,{user,isPc});if(priorityResponse)return priorityResponse;
    const academicResponse=await academicRoute(request,env,{user,isPc});if(academicResponse)return academicResponse;
    if(path==='/payroll.css')return text(PAYROLL_CSS,'text/css');if(path==='/payroll.js')return text(PAYROLL_JS,'application/javascript');
    if(['/admin/payroll','/employee/salary','/top-management/payroll'].includes(path)){if(!user)return signIn(request,path+url.search);const a=await payrollAccess(env,user);if(path==='/employee/salary'&&!a.employeeId||path==='/admin/payroll'&&!a.roleAdmin&&!a.grants.some(g=>g.role!=='summary')||path==='/top-management/payroll'&&!a.grants.some(g=>g.role==='summary'))return denied('Your account has not been granted this payroll workspace.');return appHtml(path==='/admin/payroll'?PAYROLL_HTML.replace('</body>','<script src="/academic-bridge.js" defer></script></body>'):PAYROLL_HTML,request,env,user);}
    const payrollResponse=await payrollRoute(request,env,{user});if(payrollResponse)return payrollResponse;
    if(path==='/account/security'){if(!user||user.authMethod!=='password')return signIn(request,path);return appHtml(authPage('security',user),request,env,user);}
    if(path==='/admin/sign-in-accounts'){if(!user||!isPc(env,user.email))return denied('P&C access is required to manage sign-in accounts.');return appHtml(authPage('admin',user),request,env,user);}
    if(path==='/positions.css')return text(POSITIONS_CSS,'text/css');if(path==='/positions.js')return text(POSITIONS_JS,'application/javascript');
    if(path==='/business-card-professional.js')return text(CARD_PROFESSIONAL_JS,'application/javascript');
    if(['/admin/positions','/employee/appointments','/manager/appointments','/top-management/appointments'].includes(path)){if(!user)return signIn(request,path+url.search);const access=await hubAccess(env,user,isPc);if(!access||path==='/admin/positions'&&access.role!=='hr'||path==='/manager/appointments'&&!['hr','manager'].includes(access.role)||path==='/top-management/appointments'&&!['hr','leadership'].includes(access.role))return denied('Your account does not have access to this appointment view.');return appHtml(POSITIONS_HTML,request,env,user);}
    if(user&&path.startsWith('/api/'))await ensurePositionsCurrent(env);
    const positionResponse=await positionRoute(request,env,{user,isPc});if(positionResponse)return positionResponse;
    if(path==='/people-culture'||path.startsWith('/people-culture/')){const target=new URL(request.url);target.pathname='/admin'+path.slice('/people-culture'.length);return Response.redirect(target,307);}
    if(path==='/hr-service.css')return text(SERVICE_CSS,'text/css');if(path==='/hr-service.js')return text(SERVICE_JS,'application/javascript');
    if(path==='/employee/requests'||path==='/admin/requests'){if(!user)return signIn(request,path);if(path.startsWith('/admin')?!isPc(env,user.email):!await serviceEmployee(env,user))return denied('Your account does not have access to this HR Service Desk view.');return appHtml(SERVICE_HTML,request,env,user)}
    if(path==='/connect.css')return text(CONNECT_CSS,'text/css');if(path==='/connect.js')return text(CONNECT_JS,'application/javascript');
    if(['/connect','/admin/connect','/manager/connect','/top-management/connect'].includes(path)){if(!user)return signIn(request,path);let a;try{a=await connectAccess(env,{user,isPc})}catch(e){return denied(e.message,e.status||403)}if(path==='/admin/connect'&&!a.admin||path==='/manager/connect'&&!a.manager||path==='/top-management/connect'&&!a.leadership)return denied('This Connect view is not available for your role.');if(path==='/connect')return Response.redirect(new URL('/'+url.search+'#community',url).href,302);return appHtml(CONNECT_HTML,request,env,user)}
    const connectResponse=await connectRoute(request,env,{user,isPc});if(connectResponse)return connectResponse;
    const serviceResponse=await serviceDeskRoute(request,env,{user,isPc});if(serviceResponse)return serviceResponse;
    const enrichmentResponse=await enrichmentRoute(request,env);if(enrichmentResponse)return enrichmentResponse;
    const migrationResponse=await migrationRoute(request,env,dispatch);if(migrationResponse)return migrationResponse;
    if(path==='/sheets-sync.css')return text(SYNC_CSS,'text/css');if(path==='/sheets-sync.js')return text(SYNC_APP,'application/javascript');
    if(path==='/admin/sync'||path.startsWith('/admin/sync/')){if(!user)return signIn(request,path);if(!isPc(env,user.email))return denied('P&C access is required.');if(path.endsWith('/runner.gs'))return new Response(SYNC_RUNNER,{headers:{'content-type':'text/plain','cache-control':'no-store'}});if(path.endsWith('/appsscript.json'))return new Response(SYNC_MANIFEST,{headers:{'content-type':'application/json','cache-control':'no-store'}});return appHtml(SYNC_HTML,request,env,user);}
    if(path==='/leave.css')return text(LEAVE_CSS,'text/css');if(path==='/leave.js')return text(LEAVE_JS,'application/javascript');if(path==='/leave-files.js')return text(LEAVE_FILES,'application/javascript');
    if(['/employee/leave','/admin/leave','/manager/leave','/top-management/leave'].includes(path)){if(!user)return signIn(request,path);const access=await hubAccess(env,user,isPc);if(!access||path==='/admin/leave'&&access.role!=='hr'||path==='/manager/leave'&&!await managementAccess(env,user,'manager',isPc)||path==='/top-management/leave'&&!['hr','leadership'].includes(access.role)||path==='/employee/leave'&&!await employeeFor(env,user))return denied('Your role does not have access to this leave workspace.');return appHtml(LEAVE_HTML,request,env,user);}
    const leaveResponse=await leaveRoute(request,env,{user,isPc});if(leaveResponse)return leaveResponse;
    const notificationResponse=await notificationRoute(request,env,user);if(notificationResponse)return notificationResponse;
    const syncResponse=await syncRoute(request,env,{user,isPc,applyDirectory:(req,actor)=>dispatch(req,{...env,PC_EMAILS:(env.PC_EMAILS||'')+','+actor.email},actor)});if(syncResponse)return syncResponse;
    if(path==='/calendar.css')return text(CALENDAR_CSS,'text/css');if(path==='/calendar.js')return text(CALENDAR_JS,'application/javascript');
    const calendarResponse=await calendarRoute(request,env,{user,isPc});if(calendarResponse)return calendarResponse;
    if(path==='/workforce.css')return text(WORKFORCE_CSS,'text/css');if(path==='/workforce.js')return text(WORKFORCE_JS,'application/javascript');
    if(path==='/workforce'){if(!user)return signIn(request,path);if(!await hubAccess(env,user,isPc))return denied('Active employee or P&C access is required.');return appHtml(WORKFORCE_HTML,request,env,user)}
    const workforceResponse=await workforceRoute(request,env,{user,isPc});if(workforceResponse)return workforceResponse;
    if(path==='/people'){if(!user)return signIn(request,path);if(!await hubAccess(env,user,isPc))return denied('Employee or P&C access is required.');return appHtml(HUB_HTML,request,env,user)}
    if(path==='/business-cards'){if(!user)return signIn(request,path+url.search);if(!await hubAccess(env,user,isPc))return denied('Active employee or P&C access is required.');return appHtml(CARD_HTML,request,env,user)}
    if(path==='/business-card.css')return text(CARD_CSS,'text/css');if(path==='/business-card.js')return text(CARD_JS,'application/javascript');if(path==='/business-card-qr.js')return text(CPD_QR,'application/javascript');
    if(path==='/attendance.css')return text(ATTENDANCE_CSS,'text/css');if(path==='/attendance.js')return text(ATTENDANCE_JS,'application/javascript');
    if(['/employee/attendance','/admin/attendance','/manager/attendance','/top-management/attendance','/attendance/privacy'].includes(path)){if(!user)return signIn(request,path);const access=await hubAccess(env,user,isPc);if(!access)return denied('An active IUC workspace is required.');if(path==='/admin/attendance'&&access.role!=='hr'||path==='/manager/attendance'&&!await managementAccess(env,user,'manager',isPc)||path==='/top-management/attendance'&&!['hr','leadership'].includes(access.role)||path==='/employee/attendance'&&!await employeeFor(env,user))return denied('Your role does not have access to this attendance view.');return appHtml(ATTENDANCE_HTML,request,env,user)}
    const attendanceResponse=await attendanceRoute(request,env,{user,isPc});if(attendanceResponse)return attendanceResponse;
    const cardResponse=await businessCardRoute(request,env,{user,isPc});if(cardResponse)return cardResponse;
    if(path==='/people-hub.css')return text(HUB_CSS,'text/css');if(path==='/people-hub.js')return text(HUB_APP,'application/javascript');
    if(path==='/cpd.css')return text(CPD_CSS,'text/css');if(path==='/cpd.js')return text(CPD_APP,'application/javascript');if(path==='/cpd-qr-vendor.js')return text(CPD_QR,'application/javascript');
    if(path==='/admin/cpd'){if(!user)return signIn(request,path);if(!isPc(env,user.email))return denied('P&C access is required to manage CPD activities and QR attendance.');return appHtml(CPD_HTML.replace('</head>','<script src="/cpd-qr-vendor.js" defer></script></head>'),request,env,user)}
    if(path==='/employee/cpd'){if(!user)return signIn(request,path);if(!await employeeFor(env,user))return denied('An active employee profile is required.');return appHtml(CPD_HTML,request,env,user)}
    const attendanceScan=path.match(/^\/cpd\/attend\/([a-f0-9-]{30,100})$/i);if(attendanceScan){if(!user)return signIn(request,path);if(!await employeeFor(env,user))return denied('An active employee profile is required to record attendance.');return appHtml(CPD_HTML.replace('<body>','<body data-scan-token="'+attendanceScan[1].toLowerCase()+'">'),request,env,user)}
    const cpdResponse=await cpdRoute(request,env,{user,isPc});if(cpdResponse){if(cpdResponse.ok&&request.method==='POST'&&/^\/api\/cpd\/(requests|attend)(\/|$)/.test(path))await recordNadiWork(env,user,'CPD work submitted in Nadi');return cpdResponse;}
    if(path==='/admin/document-screening'){if(!user)return signIn(request,path);if(!isPc(env,user.email))return denied('P&C access is required.');if(!env.OPENAI_API_KEY)return denied('Document screening is awaiting production API configuration.',503);return appHtml(SCREENING_HTML,request,env,user);}
    if(path==='/document-screening.css')return text(SCREENING_CSS,'text/css');if(path==='/document-screening.js')return text(SCREENING_JS,'application/javascript');
    const screeningResponse=await screeningRoute(request,env,{user,isPc});if(screeningResponse)return screeningResponse;
    const hubResponse=await hubRoute(request,env,{user,isPc});if(hubResponse)return hubResponse;
    if(path==='/management.css')return text(MANAGEMENT_CSS,'text/css');if(path==='/management.js')return text(MANAGEMENT_APP,'application/javascript');
    if(['/manager','/top-management','/admin/management-access'].includes(path)){if(!user)return signIn(request,path);const allowed=path==='/admin/management-access'?isPc(env,user.email):env.DB&&await managementAccess(env,user,path==='/manager'?'manager':'leadership',isPc);if(!allowed)return denied('P&C has not granted this management view to your account.');return appHtml(MANAGEMENT_HTML,request,env,user)}
    const managementResponse=await managementRoute(request,env,{user,isPc});if(managementResponse)return managementResponse;
    const announcementResponse=await announcementRoute(request,env,user,isPc);if(announcementResponse)return announcementResponse;
    const policyUploadResponse=await policyUpload(request,env);if(policyUploadResponse)return policyUploadResponse;
    if(path==='/policies.css')return text(POLICY_CSS,'text/css');if(path==='/policies.js')return text(POLICY_JS,'application/javascript');
    if(path==='/policies'||path.startsWith('/policies/')){if(!user)return signIn(request,path);if(!await hubAccess(env,user,isPc))return denied('Active employee or P&C access is required.');if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);if(path==='/policies')return appHtml(policyPage(),request,env,user);if(path==='/policies/catalog')return json(policySearchData());if(path.startsWith('/policies/files/'))return policyFile(request,env,path.slice('/policies/files/'.length));return json({error:'Policy not found'},404);}
    if(path==='/culture.css')return text(CULTURE_CSS,'text/css');
    if(path==='/culture'){if(!user)return signIn(request,path);await ensureDirectory(env);if(!await hubAccess(env,user,isPc))return denied('Your account has not been granted an active IUC workspace. Contact People & Culture.');const response=await appHtml(CULTURE_HTML,request,env,user);response.headers.set('content-security-policy',response.headers.get('content-security-policy')+"; frame-src https://www.youtube-nocookie.com");return response;}
    if(path==='/home.css')return text(HOME_CSS,'text/css');if(path==='/home.js')return text(HOME_JS,'application/javascript');
    if(path==='/'||path==='/home'){if(!user)return signIn(request,'/');await ensureDirectory(env);if(!await hubAccess(env,user,isPc))return denied('Your account has not been granted an active IUC workspace. Contact People & Culture.');const access=await portalAccess(env,user);return html(portalShell(await homePage(env,user,access),access,url));}
    if(path==="/admin/talent"){if(!user)return signIn(request,path);if(!isPc(env,user.email)&&!(env.PROFILE_TALENT_EMAILS||" ").split(",").map(x=>x.trim().toLowerCase()).includes(user.email))return denied("Senior management talent access has not been granted.");return appHtml(PROFILE_HTML,request,env,user)}
    if(path==="/employee/profile"||path==="/admin/profiles"){if(!user)return signIn(request,path);if(path.startsWith("/admin")&&!isPc(env,user.email))return denied("P&C access is required.");if(path.startsWith("/employee")&&!await employeeFor(env,user))return denied("Your account has no active employee profile.");return appHtml(PROFILE_HTML,request,env,user)}
    if(path==="/profile.css")return text(PROFILE_CSS,"text/css");if(path==="/profile.js")return text(PROFILE_APP,"application/javascript");if(path==="/profile-schema.js")return text(PROFILE_SCHEMA,"application/javascript");
    const profileResponse=await profileRoute(request,env,{user,isPc});if(profileResponse)return profileResponse;
    if(path==="/employee"||path==="/employee/"){if(!user)return signIn(request,"/employee");const employee=await employeeFor(env,user);if(!employee)return denied("Your signed-in email is not in the authorised IUC employee directory. Please contact People & Culture.");return appHtml(EMPLOYEE_HTML.replaceAll('href="styles.css"','href="/mpc/styles.css"').replaceAll('src="app.js"','src="/mpc/app.js"').replaceAll('src="assets/iuc-logo.png"','src="/mpc/iuc-logo.png"').replace('</body>','<script src="/academic-bridge.js" defer></script></body>'),request,env,user)}
    if(path==="/admin"||path==="/admin/"){if(!user)return signIn(request,"/admin");if(!isPc(env,user.email))return denied("This account has not been granted People & Culture dashboard access.");return appHtml(PC_HTML,request,env,user)}
    if(path==="/admin/master-database"||path==="/admin/master-database/"){if(!user)return signIn(request,"/admin/master-database");if(!isPc(env,user.email))return denied("This account has not been granted People & Culture master-database access.");return appHtml(MASTER_HTML,request,env,user)}
    if(path==="/mpc/styles.css")return text(EMPLOYEE_CSS,"text/css");if(path==="/mpc/app.js")return text(EMPLOYEE_APP,"application/javascript");if(path==="/mpc/iuc-logo.png")return new Response(Uint8Array.from(atob(IUC_LOGO_BASE64),c=>c.charCodeAt(0)),{headers:{"content-type":"image/png","cache-control":"public,max-age=86400"}});if(path==="/pc.css")return text(PC_CSS,"text/css");if(path==="/pc.js")return text(PC_APP,"application/javascript");if(path==="/master.css")return text(MASTER_CSS,"text/css");if(path==="/master.js")return text(MASTER_APP,"application/javascript");if(path==="/iuc-logo.png")return new Response(Uint8Array.from(atob(IUC_LOGO_BASE64),c=>c.charCodeAt(0)),{headers:{"content-type":"image/png","cache-control":"public,max-age=86400"}});
    if(path==="/api/me"&&request.method==="GET"){if(!user)return json({error:"Sign in is required."},401);const employee=await employeeFor(env,user);return employee?json({user:{email:user.email},employee}):json({error:"Your email is not in the authorised employee directory. Contact People & Culture."},403)}
    if(path==="/api/submissions"&&request.method==="GET"){if(!user)return json({error:"Sign in is required."},401);const employee=await employeeFor(env,user);if(!employee)return json({error:"Your email is not in the authorised employee directory. Contact People & Culture."},403);const rows=(await dbOf(env).prepare("SELECT id,employee_id,employee_name,reporting_year,month,overall_score,performance_band,check_in_status,payload_json,updated_at,submitted_at FROM mpc_submissions WHERE authenticated_user_id=? ORDER BY reporting_year DESC,month DESC").bind(user.userId).all()).results;return json({employee,submissions:rows,verifiedCpd:await verifiedCpd(dbOf(env),employee.employeeId),attendanceReports:(await dbOf(env).prepare('SELECT period,metrics_json,approved_at FROM attendance_reports WHERE employee_id=? ORDER BY period DESC LIMIT 24').bind(employee.employeeId).all()).results.map(r=>({period:r.period,metrics:JSON.parse(r.metrics_json),approvedAt:r.approved_at}))})}
    if(path==="/api/submissions"&&request.method==="POST"){if(!user)return json({error:"Sign in is required."},401);const employee=await employeeFor(env,user);if(!employee)return json({error:"Your email is not in the authorised employee directory. Contact People & Culture."},403);const payload=mergeCpd(await request.json(),await verifiedCpd(dbOf(env),employee.employeeId)),record=calculate(payload,employee),saved=await saveSubmission(env,record,user);await recordNadiWork(env,user,'MPC work submitted in Nadi');return json({submission:saved},saved.updated?200:201)}
    if(path==="/api/people-culture/employees"&&request.method==="POST"){
      if(!user)return json({error:"Sign in is required."},401);if(!isPc(env,user.email))return json({error:"People & Culture access has not been granted to this account."},403);await ensureDirectory(env);const db=dbOf(env),data=employeeInput(await request.json());
      const duplicate=await db.prepare("SELECT employee_id,email FROM employees WHERE employee_id=? OR lower(email)=lower(?) LIMIT 1").bind(data.employeeId,data.email).first();if(duplicate)return json({error:duplicate.employee_id===data.employeeId?"That employee ID already exists.":"That email address already belongs to another employee."},409);
      await db.prepare("INSERT INTO employees (employee_id,email,employee_name,position,department,appraiser,active,updated_at) VALUES (?,?,?,?,?,?,1,CURRENT_TIMESTAMP)").bind(data.employeeId,data.email,data.employeeName,data.position,data.department,data.appraiser).run();const created=await directoryEmployee(db,data.employeeId);await syncMasterEmployee(db,created,user,"created");await directoryAudit(db,user,"created",null,created);return json({employee:publicEmployee(created)},201);
    }
    const employeeMatch=path.match(/^\/api\/people-culture\/employees\/([^/]+)$/);
    if(employeeMatch&&request.method==="PATCH"){
      if(!user)return json({error:"Sign in is required."},401);if(!isPc(env,user.email))return json({error:"People & Culture access has not been granted to this account."},403);await ensureDirectory(env);const db=dbOf(env),employeeId=decodeURIComponent(employeeMatch[1]),before=await directoryEmployee(db,employeeId);if(!before)return json({error:"Employee record not found."},404);const body=await request.json(),action=clean(body.action||"update");
      if(action==="update"){const data=employeeInput({...body,employeeId},false);const duplicate=await db.prepare("SELECT employee_id FROM employees WHERE lower(email)=lower(?) AND employee_id<>? LIMIT 1").bind(data.email,employeeId).first();if(duplicate)return json({error:"That email address already belongs to another employee."},409);const expected=body.syncExpected;const clause=expected?' AND email=? AND employee_name=? AND position=? AND department=? AND appraiser=? AND updated_at=?':'';const params=[data.email,data.email,data.employeeName,data.position,data.department,data.appraiser,employeeId];if(expected)params.push(expected.email,expected.employee_name,expected.position,expected.department,expected.appraiser,expected.updated_at);const changed=await db.prepare("UPDATE employees SET account_user_id=CASE WHEN lower(email)<>lower(?) THEN NULL ELSE account_user_id END,email=?,employee_name=?,position=?,department=?,appraiser=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?"+clause).bind(...params).run();if(!changed.meta?.changes)return json({error:"Another user changed this employee. Retry after refreshing."},409)}
      else if(action==="deactivate"){
        const expected=body.syncExpected,params=[employeeId],clause=expected?' AND email=? AND employee_name=? AND position=? AND department=? AND appraiser=? AND active=? AND updated_at=?':'';
        if(expected)params.push(expected.email,expected.employee_name,expected.position,expected.department,expected.appraiser,expected.active,expected.updated_at);
        const changed=await db.prepare("UPDATE employees SET active=0,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?"+clause).bind(...params).run();
        if(!changed.meta?.changes)return json({error:"Another user changed this employee. Retry after refreshing."},409);
      }
      else if(action==="reactivate")await db.prepare("UPDATE employees SET active=1,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?").bind(employeeId).run();
      else if(action==="reset_link")await db.prepare("UPDATE employees SET account_user_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?").bind(employeeId).run();
      else return json({error:"Unknown employee management action."},400);
      if(action==="update")await reconcilePositions(env);const after=await directoryEmployee(db,employeeId);if(action!=="reset_link")await syncMasterEmployee(db,after,user,action);await directoryAudit(db,user,action,before,after);return json({employee:publicEmployee(after)});
    }
    if(path==="/api/people-culture"&&request.method==="GET"){
      if(!user)return json({error:"Sign in is required."},401);
      if(!isPc(env,user.email))return json({error:"People & Culture access has not been granted to this account."},403);
      await ensureDirectory(env);
      const db=dbOf(env),currentYear=new Date().getFullYear(),[employees,submissions,events,directoryEvents]=await Promise.all([
        db.prepare("SELECT employee_id,account_user_id,email,employee_name,position,department,appraiser,active,created_at,updated_at FROM employees ORDER BY active DESC,employee_name ASC").all(),
        db.prepare("SELECT id,employee_id,employee_name,employee_email,position,department,appraiser,reporting_year,month,kpi_score,values_rating,cpd_rating,social_rating,overall_score,performance_band,check_in_status,cpd_hours,social_links,employee_acknowledgment,appraiser_confirmation,missing_components,number_missing,score_below_299,social_links_compliant,employee_acknowledged,rule_version,updated_at,submitted_at FROM mpc_submissions ORDER BY reporting_year DESC,month DESC,employee_name ASC LIMIT 5000").all(),
        db.prepare("SELECT e.id,e.submission_id,e.actor_email,e.event_type,e.created_at,s.employee_id,s.employee_name,s.reporting_year,s.month FROM mpc_submission_events e JOIN mpc_submissions s ON s.id=e.submission_id ORDER BY e.created_at DESC LIMIT 250").all(),
        db.prepare("SELECT id,employee_id,actor_email,event_type,before_json,after_json,created_at FROM employee_directory_events ORDER BY created_at DESC LIMIT 250").all()
      ]);
      const actual=new Map(submissions.results.map(row=>[`${row.employee_id}:${row.reporting_year}:${row.month}`,row])),records=[];
      for(const employee of employees.results.filter(row=>Number(row.active)))for(let month=1;month<=12;month++){
        const key=`${employee.employee_id}:${currentYear}:${month}`,saved=actual.get(key);
        if(saved){records.push(saved);actual.delete(key);continue}
        records.push({id:`directory-${employee.employee_id}-${currentYear}-${month}`,employee_id:employee.employee_id,employee_name:employee.employee_name,employee_email:employee.email,position:employee.position,department:employee.department,appraiser:employee.appraiser,reporting_year:currentYear,month,kpi_score:null,values_rating:null,cpd_rating:null,social_rating:null,overall_score:null,performance_band:"Not Available",check_in_status:"Not Started",cpd_hours:0,social_links:0,employee_acknowledgment:"Not Yet Acknowledged",appraiser_confirmation:"Pending",missing_components:"KPI Score, Values Rating, CPD Rating, Social Media Rating",number_missing:4,score_below_299:0,social_links_compliant:0,employee_acknowledged:0,rule_version:"2026.1",updated_at:null,submitted_at:null});
      }
      records.push(...actual.values());
      return json({records,events:events.results,employees:employees.results.map(publicEmployee),directoryEvents:directoryEvents.results,refreshedAt:new Date().toISOString(),ruleVersion:"2026.1",directoryCount:employees.results.filter(row=>Number(row.active)).length,currentYear});
    }
    if(path==="/api/people-culture/master"&&request.method==="GET"){
      if(!user)return json({error:"Sign in is required."},401);if(!isPc(env,user.email))return json({error:"People & Culture access has not been granted to this account."},403);
      await ensureDirectory(env);const db=dbOf(env);await ensureMasterDirectory(db,user);
      const [people,counts,events]=await Promise.all([
        db.prepare("SELECT p.person_id,p.legal_name,p.primary_email,p.lifecycle_status,e.employee_id,e.employment_status,d.department_name,pos.position_title FROM people p LEFT JOIN employment_records e ON e.person_id=p.person_id LEFT JOIN departments d ON d.department_id=e.department_id LEFT JOIN positions pos ON pos.position_id=e.position_id ORDER BY p.legal_name LIMIT 1000").all(),
        db.prepare("SELECT (SELECT COUNT(*) FROM people) people,(SELECT COUNT(*) FROM employment_records WHERE employment_status='active') active_employees,(SELECT COUNT(*) FROM departments WHERE active=1) departments,(SELECT COUNT(*) FROM document_assets WHERE deleted_at IS NULL) documents").first(),
        db.prepare("SELECT event_id,event_type,aggregate_type,aggregate_id,source_module,occurred_at FROM integration_events ORDER BY occurred_at DESC LIMIT 12").all()
      ]);
      return json({people:people.results,counts:{people:Number(counts?.people||0),activeEmployees:Number(counts?.active_employees||0),departments:Number(counts?.departments||0),documents:Number(counts?.documents||0)},events:events.results,refreshedAt:new Date().toISOString()});
    }
    return json({error:"Not found"},404);
  }catch(error){if(error?.status!==400)console.error("MPC request failed",error);return json({error:error instanceof Error?error.message:"The MPC service is temporarily unavailable."},error?.status===400?400:500)}}
export default {fetch(request,env){return dispatch(request,env);}};
