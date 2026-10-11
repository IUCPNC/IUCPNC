import {payrollDeadlineNotices} from './payroll-notifications.js';
import {academicReminderStatements} from './academic-notifications.js';
import {ACTIVE} from './connect-core.js';
import {leaveMaintenance} from './leave-api.js';
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const rows=async(db,sql,...args)=>(await q(db,sql,...args).all()).results;
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
const base='https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site';
const isHr=(env,email)=>(env.PC_EMAILS||'').split(',').some(x=>x.trim().toLowerCase()===email.toLowerCase());
const safeLink=link=>typeof link==='string'&&/^\/(?!\/)/.test(link)&&!/[\\\r\n]/.test(link)?link:'/?open=notifications';
async function eligible(env,n){
 if(await q(env.DB,'SELECT id FROM nadi_auth_accounts WHERE email=? AND enabled=0',n.email).first())return false;
 if(n.source_key?.startsWith('payroll:')&&n.link?.startsWith('/admin/')&&!await q(env.DB,"SELECT 1 FROM payroll_grants WHERE email=? AND (expires IS NULL OR expires>=?)",n.email,new Date(Date.now()+28800000).toISOString().slice(0,10)).first())return false;
 if(n.employee_id)return !!await q(env.DB,'SELECT e.employee_id FROM employees e WHERE e.employee_id=? AND lower(e.email)=? AND '+ACTIVE,n.employee_id,n.email).first();
 if(n.source_key?.startsWith('payroll:'))return !!await q(env.DB,"SELECT 1 FROM payroll_grants WHERE email=? AND (expires IS NULL OR expires>=?)",n.email,new Date(Date.now()+28800000).toISOString().slice(0,10)).first();return isHr(env,n.email);
}
// One outbox per source event and recipient; only new events after activation are emailed.
export async function collectNotifications(env){
 await leaveMaintenance(env);
 const db=env.DB,cutover=(await q(db,"SELECT value FROM nadi_auth_settings WHERE key='notifications_started'").first())?.value;
 if(!cutover)return;
 const sources=[
  ['connect','Community','connect_notifications',"CASE WHEN n.link LIKE '/connect%' THEN '/#community' ELSE n.link END", "AND NOT EXISTS (SELECT 1 FROM connect_preferences p WHERE p.employee_id=e.employee_id AND p.notifications=0)"],
  ['attendance','Attendance','attendance_notifications',"'/employee/attendance'",''],
  ['position','Appointments','position_notifications',"'/employee/appointments'",''],
 ];
 const statements=[...await payrollDeadlineNotices(env),...sources.map(([prefix,kind,table,link,extra])=>q(db,`INSERT OR IGNORE INTO nadi_notifications (id,source_key,employee_id,email,kind,message,link,created_at,read_at) SELECT 'notice:'||lower(hex(randomblob(16))),?||n.id,e.employee_id,lower(e.email),?,n.message,${link},n.created_at,n.read_at FROM ${table} n JOIN employees e ON e.employee_id=n.employee_id WHERE n.created_at>=? AND ${ACTIVE} ${extra}`,prefix+':',kind,cutover))];
 statements.push(...await academicReminderStatements(env));
 statements.push(q(db,`INSERT OR IGNORE INTO nadi_notifications (id,source_key,employee_id,email,kind,message,link,created_at) SELECT 'notice:'||lower(hex(randomblob(16))),'announcement:'||n.id,e.employee_id,lower(e.email),'University update','A new university update is available.','/#announcements',n.published_at FROM nadi_announcements n CROSS JOIN employees e WHERE n.published_at>=? AND n.archived_at IS NULL AND ${ACTIVE}`,cutover));
 statements.push(q(db,`INSERT OR IGNORE INTO nadi_notifications (id,source_key,employee_id,email,kind,message,link,created_at) SELECT 'notice:'||lower(hex(randomblob(16))),'request:'||n.id,e.employee_id,lower(e.email),'HR Service Desk','Your HR request has an update. Sign in to view it.','/employee/requests',n.created_at FROM hr_service_events n JOIN hr_service_requests r ON r.id=n.request_id JOIN employees e ON e.employee_id=r.employee_id WHERE n.created_at>=? AND n.actor_role='admin' AND n.event_type IN ('In Review','Information requested','Rejected','Issued','Approved and issued') AND ${ACTIVE}`,cutover));
 for(const email of [...new Set((env.PC_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))])statements.push(q(db,`INSERT OR IGNORE INTO nadi_notifications (id,source_key,email,kind,message,link,created_at) SELECT 'notice:'||lower(hex(randomblob(16))),'request-admin:'||n.id,?,'HR Service Desk','An employee request needs P&C attention.','/admin/requests',n.created_at FROM hr_service_events n WHERE n.created_at>=? AND n.actor_role='employee' AND n.event_type IN ('Submitted','Information provided','Cancelled')`,email,cutover));
 await db.batch(statements);
}
export async function notificationRoute(request,env,user){
 const url=new URL(request.url);if(url.pathname!=='/api/notifications')return null;
 if(!user)return json({error:'Sign in is required.'},401);
 const employee=await q(env.DB,'SELECT e.employee_id,e.account_user_id FROM employees e WHERE lower(e.email)=? AND '+ACTIVE,user.email.toLowerCase()).first();
 if(!isHr(env,user.email)&&(!employee||employee.account_user_id&&employee.account_user_id!==user.userId))return json({error:'Current staff access is required.'},403);
 if(request.method==='GET'){
  await collectNotifications(env);
  const all=await rows(env.DB,'SELECT id,employee_id,email,kind,message,link,created_at,read_at,mail_status FROM nadi_notifications WHERE email=? ORDER BY created_at DESC,id DESC LIMIT 100',user.email.toLowerCase());
  const allowed=[];for(const n of all)if(await eligible(env,n))allowed.push({id:n.id,kind:n.kind,message:n.message,link:safeLink(n.link),created_at:n.created_at,read_at:n.read_at,mail_status:n.mail_status});
  const heartbeat=await q(env.DB,"SELECT value,updated_at FROM nadi_auth_settings WHERE key='invitation_runner'").first();
  return json({notifications:allowed,unread:allowed.filter(n=>!n.read_at).length,emailReady:heartbeat?.value==='h.r@innovative.edu.my'&&Date.now()-Date.parse(heartbeat.updated_at)<300000});
 }
 if(request.method==='PATCH'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Refresh Nadi before saving.'},403);
  let b;try{b=await request.json()}catch{return json({error:'Invalid request.'},400)}
  if(!b||!Array.isArray(b.ids)||b.ids.length>100||b.ids.some(x=>typeof x!=='string'||x.length>100))return json({error:'Choose notifications to mark as read.'},400);
  if(b.ids.length)await q(env.DB,'UPDATE nadi_notifications SET read_at=COALESCE(read_at,?) WHERE email=? AND id IN ('+b.ids.map(()=>'?').join(',')+')',new Date().toISOString(),user.email.toLowerCase(),...b.ids).run();
  return json({status:'read'});
 }
 return json({error:'Method not allowed.'},405);
}
export async function notificationMailAck(env,b){
 if(!b.jobId.startsWith('notice:'))return false;
 const status=b.outcome==='sent'?'sent':'needs_review';
 await q(env.DB,"UPDATE nadi_notifications SET mail_status=?,sent_at=?,lease=NULL WHERE id=? AND lease=? AND mail_status='sending'",status,status==='sent'?new Date().toISOString():null,b.jobId,b.lease).run();return true;
}
export async function notificationMailClaim(env){
 await collectNotifications(env);
 await q(env.DB,"UPDATE nadi_notifications SET mail_status='needs_review',lease=NULL WHERE mail_status='sending' AND lease_until<?",Date.now()).run();
 const pending=await rows(env.DB,"SELECT * FROM nadi_notifications WHERE mail_status='queued' ORDER BY created_at LIMIT 30");
 for(const n of pending){
  const optionalDisabled=n.source_key.startsWith('connect:')&&await q(env.DB,'SELECT employee_id FROM connect_preferences WHERE employee_id=? AND notifications=0',n.employee_id).first();
  const withdrawn=n.source_key.startsWith('announcement:')&&!await q(env.DB,'SELECT id FROM nadi_announcements WHERE id=? AND archived_at IS NULL',n.source_key.slice(13)).first();
  const expired=Date.now()-Date.parse(n.created_at)>7*86400000;
  if(!await eligible(env,n)||optionalDisabled||withdrawn||expired||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@innovative\.edu\.my$/i.test(n.email)){
   await q(env.DB,"UPDATE nadi_notifications SET mail_status='cancelled' WHERE id=? AND mail_status='queued'",n.id).run();continue;
  }
  const lease=crypto.randomUUID();if(!(await q(env.DB,"UPDATE nadi_notifications SET mail_status='sending',lease=?,lease_until=? WHERE id=? AND mail_status='queued'",lease,Date.now()+300000,n.id).run()).meta?.changes)continue;
  // Wire format is compatible with the existing authorised Google email runner.
  return {status:'invitation',job:{id:n.id,lease,to:n.email,subject:'IUC Nadi | '+n.kind,body:['You have a new '+n.kind.toLowerCase()+' notification in IUC Nadi.','','Open Nadi: '+base+safeLink(n.link),'','Sign in with your IUC email to view the update. Private HR details and documents are available only within your authorised Nadi account.','','People & Culture | Innovative University College','h.r@innovative.edu.my'].join('\n')}};
 }
 return {status:'empty'};
}
