import assert from 'node:assert/strict';
import {fixture} from './test-profiles.mjs';
import {authRoute,resolveAuth,eligible,passwordMatches,authGate,authReadiness} from '../worker/nadi-auth.js';
import {invitationRunner,invitationStatus} from '../worker/nadi-invitations.js';
import {syncRoute} from '../worker/sheets-sync.js';
import worker from '../dist/server/index.js';
import fs from 'node:fs';
import vm from 'node:vm';
const {sqlite,env}=fixture();env.NADI_AUTH_SECRET='invitation-test-only-secret-012345678901234567890123456';env.PC_EMAILS='h.r@innovative.edu.my,owner@example.test';env.SHEETS_SYNC_RUNNER_KEY='runner-test-only-secret-01234567890123456789';
sqlite.prepare("UPDATE employees SET email='employee@innovative.edu.my' WHERE employee_id='TEST-001'").run();
let count=0;const check=(a,b)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));count++};
const owner={userId:'owner',email:'h.r@innovative.edu.my'},origin='https://nadi.test';
async function call(path,body,headers={}){const req=new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':owner.userId,'oai-authenticated-user-email':owner.email,...headers},body:JSON.stringify(body)});const r=await authRoute(req,env,await resolveAuth(req,env));return {status:r.status,data:await r.json(),response:r};}
const issue=b=>call('/api/auth/admin/issue',b);
async function runner(body,key=env.SHEETS_SYNC_RUNNER_KEY){const r=await syncRoute(new Request(origin+'/api/people-culture/sync/runner',{method:'POST',headers:{'x-sync-runner-key':key},body:JSON.stringify({sender:owner.email,...body})}),env,{});return {status:r.status,data:await r.json()};}
check((await runner({mailAction:'claim'},'wrong')).status,401);
check((await runner({mailAction:'ready',sender:'other@innovative.edu.my'})).status,403);
check((await issue({employeeId:'TEST-001',expectedActor:'different@innovative.edu.my'})).status,409);
// A disconnected sender queues truthfully, without returning a credential.
let r=await issue({employeeId:'TEST-001'});check(r.status,201);check(r.data.delivery,'email');check('temporaryPassword' in r.data,false);check(r.data.hrEmailStatus,'queued');check(Date.parse(r.data.expiresAt)<=Date.now()+86400000,true);
check(sqlite.prepare('SELECT COUNT(*) n FROM nadi_auth_audit').get().n,1);
check(sqlite.prepare('SELECT COUNT(*) n FROM nadi_auth_hr_mail').get().n,1);
check((await invitationStatus(env)).ready,false);
let job=sqlite.prepare('SELECT * FROM nadi_auth_invitations').get();check(job.format,'link');check(job.status,'queued');
let claim=(await runner({mailAction:'claim'})).data;check(claim.job.to,'employee@innovative.edu.my');check(claim.job.body.includes('Temporary password:'),false);
const tokenFrom=c=>c.job.body.match(/#token=([A-Za-z0-9_-]{43})/)[1];
let token=tokenFrom(claim);check(job.payload.includes(token),false);check(job.token_hash.includes(token),false);
check(JSON.stringify(await invitationStatus(env)).includes(token),false);
check(JSON.stringify(sqlite.prepare('SELECT * FROM nadi_auth_audit').all()).includes(token),false);
check((await invitationStatus(env)).ready,true);
async function employeeClaim(){for(let n=0;n<30;n++){const c=(await runner({mailAction:'claim'})).data;if(!c.job?.id.startsWith('hr:'))return c;await runner({mailAction:'ack',jobId:c.job.id,lease:c.job.lease,outcome:'sent'});}throw Error('Employee invitation starved');}
const ack=c=>runner({mailAction:'ack',jobId:c.job.id,lease:c.job.lease,outcome:'sent'});
await runner({mailAction:'ack',jobId:job.id,lease:'wrong',outcome:'sent'});check(sqlite.prepare('SELECT status FROM nadi_auth_invitations').get().status,'sending');
await ack(claim);check(sqlite.prepare('SELECT status,payload FROM nadi_auth_invitations').get(),{status:'sent',payload:null});
check((await invitationStatus(env)).jobs[0].status,'accepted');await ack(claim);
const hr=(await runner({mailAction:'claim'})).data;check(hr.job.to,owner.email);check(hr.job.id.startsWith('hr:'),true);check(hr.job.body.includes(token),false);check(hr.job.body.includes('/account/set-password'),false);check(hr.job.body.includes('Actor: '+owner.email),true);check(hr.job.body.includes('Action time: '+sqlite.prepare('SELECT created_at FROM nadi_auth_audit WHERE id=?').get(job.audit_id).created_at),true);check(hr.job.body.includes('Employee email: employee@innovative.edu.my'),true);
await ack(hr);check((await invitationStatus(env)).hrJobs[0].status,'accepted');check((await runner({mailAction:'claim'})).data.status,'empty');
// The GET route is public but never consumes the invitation, including scanner visits.
check(authGate(new Request(origin+'/account/set-password'),{user:null}),null);
check((await worker.fetch(new Request(origin+'/account/set-password'),env)).status,200);check(sqlite.prepare('SELECT consumed_ms FROM nadi_auth_invitations').get().consumed_ms,null);
check((await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'},{origin:'https://evil.test'})).status,403);
check((await call('/api/auth/set-password',{token,newPassword:'short'})).status,400);
r=await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'});check(r.status,200);
const account=sqlite.prepare('SELECT * FROM nadi_auth_accounts').get();check(account.must_change,0);check(await passwordMatches(env,'A private chosen test passphrase',account.password_hash),true);
check((await call('/api/auth/set-password',{token,newPassword:'Another private test passphrase'})).status,400);
check(sqlite.prepare('SELECT action FROM nadi_auth_audit ORDER BY created_at DESC LIMIT 1').get().action,'password_set_from_link');
async function reset(){const a=sqlite.prepare('SELECT * FROM nadi_auth_accounts').get();const r=await issue({employeeId:'TEST-001',version:a.version,reset:true,delivery:'email'});check(r.status,201);return sqlite.prepare('SELECT * FROM nadi_auth_invitations ORDER BY account_version DESC LIMIT 1').get();}
job=await reset();claim=await employeeClaim();token=tokenFrom(claim);
sqlite.prepare('UPDATE nadi_auth_invitations SET expires_ms=0 WHERE id=?').run(job.id);check((await authReadiness(env,owner)).staff.find(e=>e.employee_id==='TEST-001').accountReady,false);check((await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'})).status,400);
job=await reset();claim=await employeeClaim();token=tokenFrom(claim);
sqlite.prepare("UPDATE employees SET email='changed@innovative.edu.my' WHERE employee_id='TEST-001'").run();check((await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'})).status,400);
sqlite.prepare("UPDATE employees SET email='employee@innovative.edu.my' WHERE employee_id='TEST-001'").run();
job=await reset();claim=await employeeClaim();token=tokenFrom(claim);sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run();check((await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'})).status,400);sqlite.prepare("UPDATE employees SET active=1 WHERE employee_id='TEST-001'").run();
job=await reset();claim=await employeeClaim();token=tokenFrom(claim);await reset();check((await call('/api/auth/set-password',{token,newPassword:'A private chosen test passphrase'})).status,400);
claim=await employeeClaim();token=tokenFrom(claim);
const race=await Promise.all([call('/api/auth/set-password',{token,newPassword:'First chosen test passphrase'}),call('/api/auth/set-password',{token,newPassword:'Second chosen test passphrase'})]);check(race.filter(x=>x.status===200).length,1);check(race.filter(x=>[400,409].includes(x.status)).length,1);
job=await reset();claim=await employeeClaim();
sqlite.prepare("UPDATE nadi_auth_invitations SET lease_until=0 WHERE id=?").run(job.id);await runner({mailAction:'claim'});check(sqlite.prepare('SELECT status,payload FROM nadi_auth_invitations WHERE id=?').get(job.id),{status:'needs_review',payload:null});
// A legacy encrypted-password queue becomes a link without decrypting its contents.
job=await reset();sqlite.prepare("UPDATE nadi_auth_invitations SET format='legacy',payload='never-decrypt-this-password',token_hash=NULL,audit_id=NULL WHERE id=?").run(job.id);claim=await employeeClaim();check(claim.job.id,job.id);check(claim.job.body.includes('never-decrypt'),false);check(!!tokenFrom(claim),true);await ack(claim);
// Failure to insert the audit rolls the credential and both mail jobs back.
const before=sqlite.prepare('SELECT * FROM nadi_auth_accounts').get(),mailBefore=sqlite.prepare('SELECT COUNT(*) n FROM nadi_auth_hr_mail').get().n;
sqlite.exec("CREATE TEMP TRIGGER fail_issue_audit BEFORE INSERT ON nadi_auth_audit BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
r=await issue({employeeId:'TEST-001',version:before.version,reset:true});check(r.status,503);check(sqlite.prepare('SELECT * FROM nadi_auth_accounts').get(),before);check(sqlite.prepare('SELECT COUNT(*) n FROM nadi_auth_hr_mail').get().n,mailBefore);sqlite.exec('DROP TRIGGER fail_issue_audit');
// Actual HR password session takes precedence over a different ChatGPT account.
r=await issue({email:owner.email,delivery:'manual'});check(r.status,201);
const login=await call('/api/auth/login',{email:owner.email,password:r.data.temporaryPassword}),cookie=login.response.headers.get('set-cookie').split(';')[0];
r=await call('/api/auth/password',{currentPassword:r.data.temporaryPassword,newPassword:'HR private permanent test passphrase'},{cookie});check(r.status,200);
const hrCookie=r.response.headers.get('set-cookie').split(';')[0],req=new Request(origin+'/api/auth/admin/status',{headers:{cookie:hrCookie,'oai-authenticated-user-id':'personal-owner','oai-authenticated-user-email':'owner@example.test'}});
const auth=await resolveAuth(req,env);check(auth.user.email,owner.email);check(auth.user.authMethod,'password');
const expired=new Request(origin+'/api/auth/admin/status',{headers:{cookie:'__Host-nadi_session='+'a'.repeat(43),'oai-authenticated-user-id':'personal-owner','oai-authenticated-user-email':'owner@example.test'}});check((await resolveAuth(expired,env)).user,null);
// Runner recovers an acknowledgement without sending the message twice.
const properties=new Map([['SYNC_RUNNER_KEY',env.SHEETS_SYNC_RUNNER_KEY],['SITES_SERVICE_TOKEN','test-service-token']]);let sent=0,acks=0,claims=0;
const context=vm.createContext({Session:{getEffectiveUser:()=>({getEmail:()=>owner.email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>10,sendEmail(m){check(m.to,'employee@innovative.edu.my');sent++;}},UrlFetchApp:{fetch(url,options){const b=JSON.parse(options.payload);let response={status:'empty'};if(b.mailAction==='claim'&&claims++===0)response={status:'invitation',job:{id:'job',lease:'lease',to:'employee@innovative.edu.my',subject:'Invitation',body:'private test access link'}};if(b.mailAction==='ack'&&acks++===0)throw Error('network interrupted');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(response)};}}});
vm.runInContext(fs.readFileSync('integrations/google-sheets/Code.gs','utf8'),context);assert.throws(()=>vm.runInContext('runIucInvitations()',context));count++;check(sent,1);check(properties.get('IUC_INVITATION_RECEIPT').includes('private test access link'),false);vm.runInContext('runIucInvitations()',context);check(sent,1);check(properties.has('IUC_INVITATION_RECEIPT'),false);
check(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
console.log(JSON.stringify({passed:true,checks:count,areas:['atomic reset and audit','separate employee and HR email','single-use expiry and replay','concurrent redemption','email and employee binding','legacy conversion','credential privacy','actor precedence','Google acceptance status','runner recovery']}));
