import assert from 'node:assert/strict';
import {fixture,employee,hr} from './test-profiles.mjs';
import {collectNotifications,notificationRoute,notificationMailClaim,notificationMailAck} from '../worker/nadi-notifications.js';
import {invitationRunner} from '../worker/nadi-invitations.js';
import {homePage} from '../worker/home-page.js';
import {navigationGroups} from '../worker/portal-navigation.js';
const {sqlite,env}=fixture();env.PC_EMAILS='h.r@innovative.edu.my';let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const at=new Date().toISOString(),old=new Date(Date.now()-86400000).toISOString();
sqlite.prepare("UPDATE nadi_auth_settings SET value=? WHERE key='notifications_started'").run(new Date(Date.now()-1000).toISOString());
sqlite.exec("UPDATE employees SET email='employee@innovative.edu.my' WHERE employee_id='TEST-001'; UPDATE employees SET email='second@innovative.edu.my' WHERE employee_id='TEST-002'");
const emp={...employee,email:'employee@innovative.edu.my'},other={userId:'employee-2',email:'second@innovative.edu.my'},pc={...hr,email:env.PC_EMAILS};
const add=(id,e='TEST-001',stamp=at)=>sqlite.prepare('INSERT INTO attendance_notifications (id,employee_id,message,created_at) VALUES (?,?,?,?)').run(id,e,'Your work arrangement has an update.',stamp);
add('old','TEST-001',old);add('new');add('second','TEST-002');
sqlite.prepare("INSERT INTO connect_notifications (id,employee_id,kind,message,link,created_at) VALUES ('thanks','TEST-001','recognition','Someone appreciated you.','/connect?view=impact',?)").run(at);
sqlite.prepare("INSERT INTO nadi_announcements (id,title,body,category,published_at,published_by) VALUES ('announcement','University update','Test content','Reminder',?,'admin')").run(at);
sqlite.prepare("INSERT INTO hr_service_requests (id,reference,employee_id,created_by,request_type,subject,details,status,last_operation,submission_key,submission_hash,created_at,updated_at) VALUES ('request','REQ-1','TEST-001','employee-1','HR query','Private subject','Private details','Submitted','op','key','hash',?,?)").run(at,at);
for(const [id,role,type] of [['submitted','employee','Submitted'],['draft','admin','Draft prepared'],['issued','admin','Issued']])sqlite.prepare('INSERT INTO hr_service_events (id,request_id,actor_id,actor_email,actor_role,event_type,message,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id,'request','actor','actor@example.test',role,type,'Private event content',at);
await collectNotifications(env);eq(sqlite.prepare('SELECT COUNT(*) n FROM nadi_notifications').get().n,7);await collectNotifications(env);eq(sqlite.prepare('SELECT COUNT(*) n FROM nadi_notifications').get().n,7);
eq(sqlite.prepare("SELECT COUNT(*) n FROM nadi_notifications WHERE source_key='attendance:old'").get().n,0);eq(sqlite.prepare("SELECT COUNT(*) n FROM nadi_notifications WHERE source_key='request:draft'").get().n,0);
const call=async(user,method='GET',b,origin='https://nadi.test')=>{const r=await notificationRoute(new Request('https://nadi.test/api/notifications',{method,headers:{origin,'content-type':'application/json'},...(b?{body:JSON.stringify(b)}:{})}),env,user);return {status:r.status,data:await r.json()}};
eq((await call(null)).status,401);eq((await call({...emp,userId:'wrong'})).status,403);eq((await call({email:'stranger@example.test',userId:'stranger'})).status,403);
let r=await call(emp);eq(r.data.notifications.length,4);eq(r.data.unread,4);eq(r.data.emailReady,false);eq(r.data.notifications.some(n=>n.link==='/#community'),true);eq(JSON.stringify(r.data).includes('Private event content'),false);eq(JSON.stringify(r.data).includes('Private details'),false);
const foreign=(await call(other)).data.notifications[0].id;eq((await call(emp,'PATCH',{ids:[foreign]})).status,200);eq(sqlite.prepare('SELECT read_at FROM nadi_notifications WHERE id=?').get(foreign).read_at,null);
const id=r.data.notifications[0].id;eq((await call(emp,'PATCH',{ids:[id]},'https://attacker.test')).status,403);eq((await call(emp,'PATCH',{ids:[id]})).status,200);eq((await call(emp)).data.unread,3);eq((await call(emp,'PATCH',{ids:[...Array(101)].map(()=>id)})).status,400);
let job=await invitationRunner(env,{sender:env.PC_EMAILS,mailAction:'claim'},()=>true);eq(job.status,'invitation');eq(job.job.id.startsWith('notice:'),true);eq(job.job.to.endsWith('@innovative.edu.my'),true);eq(job.job.body.includes('Private'),true);eq(job.job.body.includes('Private details'),false);eq(job.job.body.includes('Private event content'),false);eq(job.job.body.includes('Temporary password'),false);eq((await call(emp)).data.emailReady,true);
const leased=job.job;await notificationMailAck(env,{jobId:leased.id,lease:'wrong',outcome:'sent'});eq(sqlite.prepare('SELECT mail_status FROM nadi_notifications WHERE id=?').get(leased.id).mail_status,'sending');
await notificationMailAck(env,{jobId:leased.id,lease:leased.lease,outcome:'sent'});eq(sqlite.prepare('SELECT mail_status FROM nadi_notifications WHERE id=?').get(leased.id).mail_status,'sent');await notificationMailAck(env,{jobId:leased.id,lease:leased.lease,outcome:'sent'});eq(sqlite.prepare('SELECT mail_status FROM nadi_notifications WHERE id=?').get(leased.id).mail_status,'sent');
job=await notificationMailClaim(env);eq(job.job.id!==leased.id,true);await notificationMailAck(env,{jobId:job.job.id,lease:job.job.lease,outcome:'uncertain'});eq(sqlite.prepare('SELECT mail_status FROM nadi_notifications WHERE id=?').get(job.job.id).mail_status,'needs_review');
sqlite.exec("UPDATE employees SET active=0 WHERE employee_id='TEST-002'");eq((await call(other)).status,403);
sqlite.exec("INSERT INTO connect_preferences (employee_id,notifications) VALUES ('TEST-001',0)");
const delivered=[];for(let i=0;i<12;i++){const j=await notificationMailClaim(env);if(j.status==='empty')break;delivered.push(j.job);await notificationMailAck(env,{jobId:j.job.id,lease:j.job.lease,outcome:'sent'})}
eq(delivered.some(j=>j.to==='second@innovative.edu.my'),false);eq(delivered.some(j=>j.subject.endsWith('Community')),false);eq((await notificationMailClaim(env)).status,'empty');
// A changed email cannot receive an outbox entry addressed to the previous identity.
add('identity-change');await collectNotifications(env);sqlite.exec("UPDATE employees SET email='changed@innovative.edu.my' WHERE employee_id='TEST-001'");eq((await notificationMailClaim(env)).status,'empty');
eq(sqlite.prepare("SELECT mail_status FROM nadi_notifications WHERE source_key='attendance:identity-change'").get().mail_status,'cancelled');
// Shared labels and source links are used directly by homepage and dropdowns.
const access={employee:true,employeeId:'TEST-001',hr:false,manager:false,leadership:false};const page=await homePage(env,emp,access);for(const group of navigationGroups(access))if(['My workspace','People','Life at IUC','Performance & Development','Academic Hub'].includes(group.label)){eq(page.includes('<h3>'+(group.navLabel||group.label).replaceAll('&','&amp;')+'</h3>'),true);for(const [label] of group.items)eq(page.includes('>'+label.replaceAll('&','&amp;')+'<'),true)}
eq(page.indexOf('id="help"')<page.indexOf('id="iuc-systems"'),true);eq(page.indexOf('id="staff-resources"')<page.indexOf('id="nadi-calendar"'),true);eq(page.indexOf('id="community"')<page.indexOf('id="staff-resources"'),true);
sqlite.close();console.log(JSON.stringify({passed:true,checks,coverage:'new-event activation, no duplicate sends, scoped inbox, inactive and changed identities, optional Connect preference, HR drafts withheld, private email bodies, delivery leases, shared homepage taxonomy and section order'}));
