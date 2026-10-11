import assert from 'node:assert/strict';
import {fixture} from './payroll-fixture.mjs';
import {payrollAccess,configuration,q} from '../worker/payroll-core.js';
import {foundationWrite,foundationRead,classification} from '../worker/payroll-foundation.js';
const {sqlite,env,hr,user}=fixture();let checks=0;
function grant(u,role){sqlite.prepare('INSERT INTO payroll_grants(id,email,role,entity,created_by,created_at) VALUES (?,?,?,?,?,?)').run(crypto.randomUUID(),u.email,role,'IUC','setup','2026-10-09');}
grant(hr,'prepare');const approver={userId:'approve-1',email:'approve@example.test',accountId:'approve-1',authMethod:'password'};grant(approver,'hr_approve');
for(const u of [hr,approver]){u.accountId=u.userId;sqlite.prepare('INSERT INTO nadi_auth_accounts(id,email,canonical_user_id,password_hash,enabled,must_change,version,created_at,updated_at) VALUES (?,?,?,?,1,0,1,?,?)').run(u.accountId,u.email,u.userId,'test','2026-10-09','2026-10-09');}
async function write(u,path,b){const id=crypto.randomUUID(),resource=path.endsWith('/approve')?b.id||b.employeeId:b.employeeId;sqlite.prepare('INSERT INTO payroll_challenges(id,actor_email,account_id,account_version,action,resource,expires_ms) VALUES (?,?,?,1,?,?,?)').run(id,u.email,u.accountId,path,resource,Date.now()+60000);return foundationWrite(env,u,await payrollAccess(env,u),path,{...b,challenge:id},{module:'test',key:crypto.randomUUID(),hash:crypto.randomUUID()});}
const cl={epf:true,socso:true,eis:true,tax:'normal'};
const b={employeeId:'TEST-001',kind:'basic',code:'BASIC',amount:'3100.00',effectiveFrom:'2026-10-01',classification:cl,evidence:'approved offer reference',reason:'Appointment salary'};
const response=await write(hr,'/api/payroll/remuneration',b),proposal=await response.json();assert.equal(proposal.status,'pending');checks++;
await assert.rejects(write(hr,'/api/payroll/remuneration/approve',{id:proposal.id,version:1}),/grant/);checks++;
grant(hr,'hr_approve');await assert.rejects(write(hr,'/api/payroll/remuneration/approve',{id:proposal.id,version:1}),/different/);checks++;
await write(approver,'/api/payroll/remuneration/approve',{id:proposal.id,version:1});assert.equal(sqlite.prepare('SELECT status FROM payroll_remuneration WHERE id=?').get(proposal.id).status,'approved');checks++;
const duplicate=await (await write(hr,'/api/payroll/remuneration',{...b,code:'OTHER_BASIC'})).json();await assert.rejects(write(approver,'/api/payroll/remuneration/approve',{id:duplicate.id,version:1}),/changed/);checks++;
const replacement=await (await write(hr,'/api/payroll/remuneration',{...b,amount:'3500',replaceId:proposal.id,effectiveFrom:'2026-10-15'})).json();await write(approver,'/api/payroll/remuneration/approve',{id:replacement.id,version:1});assert.equal(sqlite.prepare('SELECT effective_to FROM payroll_remuneration WHERE id=?').get(proposal.id).effective_to,'2026-10-14');checks++;
await assert.rejects(write(hr,'/api/payroll/remuneration',{...b,appointmentId:'invented'}),/existing/);checks++;
assert.throws(()=>classification({classification:{...cl,tax:'exempt'}},'claim'),/supporting/);checks++;assert.throws(()=>classification({classification:cl},'overtime'),/excluded/);checks++;
const self=await (await foundationRead(env,user,await payrollAccess(env,user),new URL('https://nadi.test/api/payroll/profile'))).json();assert.equal(self.history.length,2);checks++;assert.equal(self.master.employee_id,'TEST-001');checks++;
await assert.rejects(foundationRead(env,user,await payrollAccess(env,user),new URL('https://nadi.test/api/payroll/profile?employeeId=someone')),/Authorised/);checks++;
console.log(JSON.stringify({stage:1,area:'remuneration approvals',checks,passed:true}));
