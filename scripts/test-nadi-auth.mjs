import assert from 'node:assert/strict';
import {fixture} from './test-profiles.mjs';
import worker from '../dist/server/index.js';
import {authRoute,resolveAuth,authGate,passwordHash,passwordMatches,AUTH_COOKIE,institutionalEmail,safeReturn} from '../worker/nadi-auth.js';
import {managementAccess} from '../worker/management-api.js';
import {profileRoute} from '../worker/profile-api.js';
import {cachedCalendar,saveCalendarMonth} from '../worker/calendar-cache.js';
const {sqlite,env}=fixture();env.NADI_AUTH_SECRET='test-only-random-pepper-not-for-production-012345678901234567890';env.PC_EMAILS='owner@example.test,h.r@innovative.edu.my';
sqlite.prepare("UPDATE employees SET email='employee@innovative.edu.my' WHERE employee_id='TEST-001'").run();
sqlite.prepare("UPDATE employees SET email='manager@innovative.edu.my' WHERE employee_id='TEST-002'").run();
const owner={userId:'original-owner',email:'owner@example.test',authMethod:'chatgpt'},origin='https://nadi.test';let checks=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
function req(path,method='GET',data,cookie='',platform=null,extra={}){return new Request(origin+path,{method,headers:{...(data?{'content-type':'application/json',origin}:{}),...(cookie?{cookie}:{}),...(platform?{'oai-authenticated-user-id':platform.userId,'oai-authenticated-user-email':platform.email}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});}
async function route(path,method='GET',data,cookie='',platform=null,extra={}){const request=req(path,method,path==='/api/auth/admin/issue'?{delivery:'manual',...data}:data,cookie,platform,extra),auth=await resolveAuth(request,env),response=await authRoute(request,env,auth);return {response,data:await response.clone().json()};}
const cookieFrom=r=>r.headers.get('set-cookie').split(';')[0];
const snapshot=()=>['employee_profile_sections','mpc_submissions','management_grants','management_reports','profile_documents','document_assets','employment_records','positions','people'].map(name=>[name,sqlite.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]);
// Historical MPC identity is unchanged; new credentials use the established account link.
sqlite.prepare("INSERT INTO mpc_submissions (id,authenticated_user_id,authenticated_email,employee_id,employee_name,employee_email,position,department,appraiser,reporting_year,month,performance_band,check_in_status,employee_acknowledgment,appraiser_confirmation,missing_components,number_missing,payload_json) VALUES ('old-mpc','employee-1','employee@innovative.edu.my','TEST-001','Example Employee','employee@innovative.edu.my','Executive','Finance','Example Manager',2026,9,'Average','Completed','Acknowledged','Confirmed','',0,'{}')").run();
sqlite.prepare("INSERT INTO management_grants (employee_id,role,updated_by,updated_at) VALUES ('TEST-002','manager','original-owner','2026-10-01')").run();sqlite.prepare("INSERT INTO management_reports (employee_id,manager_id) VALUES ('TEST-001','TEST-002')").run();
const preserved=snapshot(),employeeLinks=sqlite.prepare('SELECT employee_id,account_user_id FROM employees ORDER BY employee_id').all();
check(institutionalEmail('person@innovative.edu.my'),true);check(institutionalEmail('person@gmail.com'),false);check(institutionalEmail('x@innovative.edu.my.attacker.test'),false);
for(const value of ['https://evil.test','//evil.test','/\\evil.test','/login','/api/auth/login','/x\nLocation:x'])check(safeReturn(value),'/');check(safeReturn('/employee?tab=2'),'/employee?tab=2');
const hash=await passwordHash(env,'A longer test passphrase for IUC');check(hash.includes('A longer'),false);check(await passwordMatches(env,'A longer test passphrase for IUC',hash),true);check(await passwordMatches(env,'wrong',hash),false);check(await passwordMatches({...env,NADI_AUTH_SECRET:'a-different-test-only-pepper-012345678901234567890'},'A longer test passphrase for IUC',hash),false);
await assert.rejects(passwordHash(env,'short'));checks++;
let r=await route('/api/auth/admin/status');check(r.response.status,401);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001'},'',{userId:'employee-1',email:'employee@innovative.edu.my'});check(r.response.status,403);
r=await route('/api/auth/admin/issue','POST',{email:'random@innovative.edu.my'},'',owner);check(r.response.status,403);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001',role:'hr'},'',owner);check(r.response.status,400);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001'},'',owner,{origin:'https://evil.test'});check(r.response.status,403);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001'},'',owner);check(r.response.status,201);const issued=r.data;check(issued.email,'employee@innovative.edu.my');
check(sqlite.prepare('SELECT canonical_user_id FROM nadi_auth_accounts WHERE employee_id=?').get('TEST-001').canonical_user_id,'employee-1');check(snapshot(),preserved);check(sqlite.prepare('SELECT employee_id,account_user_id FROM employees ORDER BY employee_id').all(),employeeLinks);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001'},'',owner);check(r.response.status,409);
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:issued.temporaryPassword,returnTo:'/employee'});check(r.response.status,200);check(r.data.redirect.startsWith('/account/security?first=1'),true);let employeeCookie=cookieFrom(r.response);check(r.response.headers.get('set-cookie').includes('HttpOnly; Secure; SameSite=Lax'),true);
let auth=await resolveAuth(req('/api/submissions','GET',undefined,employeeCookie),env);check(auth.user.userId,'employee-1');check(auth.user.mustChange,true);
check(authGate(req('/api/submissions'),auth).status,403);check(authGate(req('/employee'),auth).status,302);
r=await route('/api/auth/admin/status','GET',undefined,employeeCookie);check(r.response.status,403);
r=await route('/api/auth/password','POST',{currentPassword:'incorrect',newPassword:'A private employee passphrase'},employeeCookie);check(r.response.status,400);
r=await route('/api/auth/password','POST',{currentPassword:issued.temporaryPassword,newPassword:'A private employee passphrase',returnTo:'/employee'},employeeCookie);check(r.response.status,200);const oldEmployeeCookie=employeeCookie;employeeCookie=cookieFrom(r.response);check((await resolveAuth(req('/api/me','GET',undefined,oldEmployeeCookie,owner),env)).user,null);
auth=await resolveAuth(req('/api/me','GET',undefined,employeeCookie),env);check(auth.user.mustChange,false);check(auth.user.userId,'employee-1');
check(sqlite.prepare('SELECT id FROM mpc_submissions WHERE authenticated_user_id=?').all(auth.user.userId).map(r=>r.id),['old-mpc']);
check(await managementAccess(env,auth.user,'manager',()=>false),null);
let p=await profileRoute(req('/api/profiles/TEST-002'),env,{user:auth.user,isPc:()=>false});check(p.status,403);
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:'A private employee passphrase',role:'hr'});check(r.response.status,400);
// Manager and leadership access still comes exclusively from existing explicit grants.
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-002'},'',owner);const managerTemporary=r.data.temporaryPassword;
r=await route('/api/auth/login','POST',{email:'manager@innovative.edu.my',password:managerTemporary});let managerCookie=cookieFrom(r.response);
r=await route('/api/auth/password','POST',{currentPassword:managerTemporary,newPassword:'A private manager passphrase'},managerCookie);managerCookie=cookieFrom(r.response);const manager=(await resolveAuth(req('/api/me','GET',undefined,managerCookie),env)).user;check((await managementAccess(env,manager,'manager',()=>false)).employeeId,'TEST-002');check(await managementAccess(env,manager,'leadership',()=>false),null);
sqlite.prepare("INSERT INTO management_grants (employee_id,role,updated_by,updated_at) VALUES ('TEST-002','leadership','original-owner','2026-10-01')").run();check((await managementAccess(env,manager,'leadership',()=>false)).employeeId,'TEST-002');sqlite.prepare("DELETE FROM management_grants WHERE employee_id='TEST-002' AND role='leadership'").run();
// Offboarding blocks sessions immediately without deleting employee records/history.
sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run();check((await resolveAuth(req('/api/me','GET',undefined,employeeCookie),env)).user,null);
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:'A private employee passphrase'});check(r.response.status,401);check(sqlite.prepare("SELECT count(*) n FROM mpc_submissions WHERE id='old-mpc'").get().n,1);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001',reset:true,version:2},'',owner);check(r.response.status,403);
sqlite.prepare("UPDATE employees SET active=1 WHERE employee_id='TEST-001'").run();sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001','overview','{\"employmentStatus\":\"Exited\"}',1,'2026-10-01','owner')").run();
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:'A private employee passphrase'});check(r.response.status,401);sqlite.prepare("DELETE FROM employee_profile_sections WHERE employee_id='TEST-001' AND section='overview'").run();
// Account reset, expired session, idle timeout and email re-link invalidate old sessions.
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001',reset:true,version:1},'',owner);check(r.response.status,409);
r=await route('/api/auth/admin/issue','POST',{employeeId:'TEST-001',reset:true,version:2},'',owner);check(r.response.status,201);const resetTemporary=r.data.temporaryPassword;
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:resetTemporary});employeeCookie=cookieFrom(r.response);
sqlite.prepare('UPDATE nadi_auth_sessions SET seen_ms=0').run();check((await resolveAuth(req('/api/me','GET',undefined,employeeCookie,owner),env)).user,null);
r=await route('/api/auth/login','POST',{email:'employee@innovative.edu.my',password:resetTemporary});employeeCookie=cookieFrom(r.response);sqlite.prepare("UPDATE employees SET email='changed@innovative.edu.my',account_user_id=NULL WHERE employee_id='TEST-001'").run();check((await resolveAuth(req('/api/me','GET',undefined,employeeCookie),env)).user,null);sqlite.prepare("UPDATE employees SET email='employee@innovative.edu.my',account_user_id='employee-1' WHERE employee_id='TEST-001'").run();
r=await route('/api/auth/admin/activate','POST',{confirm:'USE_IUC_EMAIL_PASSWORD'},'',owner);check(r.response.status,409);
// Separate P&C access only for the already-authorised institutional administrator.
r=await route('/api/auth/admin/issue','POST',{email:'h.r@innovative.edu.my'},'',owner);check(r.response.status,201);const hrTemp=r.data.temporaryPassword;
r=await route('/api/auth/login','POST',{email:'h.r@innovative.edu.my',password:hrTemp});let hrCookie=cookieFrom(r.response);
r=await route('/api/auth/password','POST',{currentPassword:hrTemp,newPassword:'A private PNC owner passphrase'},hrCookie);hrCookie=cookieFrom(r.response);
r=await route('/api/auth/admin/status','GET',undefined,hrCookie);check(r.response.status,200);check(r.data.administratorReady,true);check(r.data.missingAccounts,0);
r=await route('/api/auth/admin/activate','POST',{confirm:'USE_IUC_EMAIL_PASSWORD'},'',owner);check(r.response.status,200);
check((await resolveAuth(req('/employee','GET',undefined,'',{userId:'employee-1',email:'employee@innovative.edu.my'}),env)).user,null);
check((await resolveAuth(req('/admin','GET',undefined,'',owner),env)).user,null);
check((await resolveAuth(req('/admin/sign-in-accounts?recovery=1','GET',undefined,'',owner),env)).user.userId,owner.userId);
check((await resolveAuth(req('/api/auth/admin/status','GET',undefined,'',owner,{'x-nadi-recovery':'1'}),env)).user.userId,owner.userId);
// Whole application entry-point: private records, workspaces and provider scripts require a session, even on a public Site.
for(const path of ['/','/employee','/admin','/admin/profiles','/manager','/top-management','/people','/policies','/policies/files/handbook','/api/me','/api/submissions','/api/profiles','/api/profiles/TEST-001','/api/people-hub/photos/TEST-001','/api/people-culture','/api/business-cards','/api/positions/roles','/api/attendance/admin','/api/cpd/activities','/api/calendar','/api/workforce','/api/management','/api/people-culture/sync','/admin/sync/runner.gs']){const response=await worker.fetch(req(path),env,{});check(response.status,path.startsWith('/api/')?401:302);check((await response.text()).includes('Example Employee'),false);}
for(const path of ['/api/people-culture/sync/runner','/api/business-cards/public-directory','/api/business-cards/public/'+'a'.repeat(64),'/api/migration/employee','/api/migration/profile-enrichment','/api/policies/upload/handbook']){const response=await worker.fetch(req(path,path.includes('public')?'GET':path.includes('policies')?'PUT':'POST',path.includes('public')?undefined:{}),env,{});check([401,403,405].includes(response.status),true);}
const loginPage=await worker.fetch(req('/login'),env,{});check(loginPage.status,200);const loginHtml=await loginPage.text();check(loginHtml.includes('@innovative.edu.my'),true);check(loginHtml.includes('Example Employee'),false);
// Login rate limiting is durable and generic; credential fields never appear in an error.
for(let i=0;i<9;i++){r=await route('/api/auth/login','POST',{email:'nobody@innovative.edu.my',password:'Incorrect passphrase'});check(r.response.status,i===8?429:401);check(JSON.stringify(r.data).includes('Incorrect passphrase'),false);}
const auditRows=sqlite.prepare('SELECT * FROM nadi_auth_audit').all();check(JSON.stringify(auditRows).includes(resetTemporary),false);check(JSON.stringify(auditRows).includes('A private'),false);check(sqlite.prepare('SELECT token_hash FROM nadi_auth_sessions').all().every(r=>/^[a-f0-9]{64}$/.test(r.token_hash)),true);
// Copied calendar dates remain available independently of sign-in and Google.
await saveCalendarMonth(env.DB,'salary','2026-10',[{id:'pay',category:'salary',title:'Salary payment',date:'2026-10-30',end:'2026-10-30',time:'All day'}]);check((await cachedCalendar(env.DB,'salary','2026-10')).events.length,1);
check((await cachedCalendar(env.DB,'salary','2026-10')).events.length,1);
// Logout ends the issued session; P&C records and history are still present.
r=await route('/api/auth/logout','POST',{},hrCookie);check(r.response.status,200);check((await resolveAuth(req('/api/me','GET',undefined,hrCookie),env)).user,null);check(snapshot(),preserved);check(sqlite.prepare('SELECT employee_id,account_user_id FROM employees ORDER BY employee_id').all(),employeeLinks);check(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
console.log(JSON.stringify({checks,passed:true,areas:['institutional emails','stable employee identity and MPC history','mandatory first-password change','durable hashed sessions','role boundaries','inactive and Exited access','reset and sign-out revocation','CSRF and redirect validation','rate limiting','all-module anonymous gate','service-bridge authentication','protected stored calendar','unchanged HR data and grants']}));
