import {notificationMailClaim,notificationMailAck} from './nadi-notifications.js';
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const bytes=s=>new TextEncoder().encode(s);
const pack=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unpack=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const INVITATION_SENDER='h.r@innovative.edu.my';
export const LOGIN_URL='https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site/login';
export const RESET_URL='https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site/account/set-password';
export const tokenDigest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(token))),b=>b.toString(16).padStart(2,'0')).join('');
const randomToken=()=>pack(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function key(env){if(!env.NADI_AUTH_SECRET||env.NADI_AUTH_SECRET.length<43)throw fail('Invitation security is not configured.',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',bytes('nadi-invitation-encryption-v1\0'+env.NADI_AUTH_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
const aad=j=>bytes([j.id,j.account_id,j.account_version,j.email].join('\0'));
async function encryptToken(env,j,token){const iv=crypto.getRandomValues(new Uint8Array(12));return pack(iv)+'.'+pack(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(j)},await key(env),bytes(token)));}
async function decryptToken(env,j){const [iv,data]=j.payload.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unpack(iv),additionalData:aad(j)},await key(env),unpack(data)));}
export async function invitationStatement(env,{accountId,version,email,passwordHash,expiresAt,auditId}){
 const j={id:crypto.randomUUID(),account_id:accountId,account_version:version,email},token=randomToken();
 const expiry=Math.min(expiresAt,Date.now()+86400000);
 return q(env.DB,"INSERT INTO nadi_auth_invitations (id,account_id,account_version,email,payload,status,expires_ms,created_at,token_hash,audit_id,format) SELECT ?,?,?,?,?, 'queued',?,?,?,?,'link' WHERE EXISTS (SELECT 1 FROM nadi_auth_accounts WHERE id=? AND version=? AND email=? AND enabled=1 AND must_change=1 AND password_hash=?)",j.id,accountId,version,email,await encryptToken(env,j,token),expiry,new Date().toISOString(),await tokenDigest(token),auditId,accountId,version,email,passwordHash);
}
export function hrMailStatement(env,{auditId,accountId,version,passwordHash}){
 return q(env.DB,"INSERT INTO nadi_auth_hr_mail (id,audit_id,account_id,account_version,status,created_at) SELECT ?,?,?,?,'queued',? WHERE EXISTS (SELECT 1 FROM nadi_auth_accounts WHERE id=? AND version=? AND password_hash=?)",crypto.randomUUID(),auditId,accountId,version,new Date().toISOString(),accountId,version,passwordHash);
}
export const deliveryState=status=>status==='sent'?'accepted':status;
export async function invitationStatus(env){
 const r=await q(env.DB,"SELECT value,updated_at FROM nadi_auth_settings WHERE key='invitation_runner'").first();
 const jobs=(await q(env.DB,'SELECT id,account_id,account_version,status,created_at,sent_at,audit_id,expires_ms,consumed_ms FROM nadi_auth_invitations ORDER BY created_at DESC LIMIT 300').all()).results.map(j=>({...j,status:deliveryState(j.status)}));
 const hrJobs=(await q(env.DB,'SELECT audit_id,account_id,account_version,status,created_at,sent_at FROM nadi_auth_hr_mail ORDER BY created_at DESC LIMIT 300').all()).results.map(j=>({...j,status:deliveryState(j.status)}));
 return {sender:INVITATION_SENDER,hrRecipient:INVITATION_SENDER,configured:r?.value===INVITATION_SENDER,ready:r?.value===INVITATION_SENDER&&Date.now()-Date.parse(r.updated_at)<300000,lastSeen:r?.updated_at||null,jobs,hrJobs};
}
async function hrClaim(env,afterEmployee=false){
 const jobs=(await q(env.DB,"SELECT h.*,a.actor_email,a.employee_id,a.action,a.detail_json,a.created_at action_created_at,(SELECT i.email FROM nadi_auth_invitations i WHERE i.audit_id=h.audit_id ORDER BY i.created_at DESC LIMIT 1) issued_email FROM nadi_auth_hr_mail h JOIN nadi_auth_audit a ON a.id=h.audit_id WHERE h.status='queued'"+(afterEmployee?" AND EXISTS (SELECT 1 FROM nadi_auth_invitations i WHERE i.audit_id=h.audit_id AND i.status IN ('sent','needs_review','cancelled','expired'))":'')+" ORDER BY h.created_at LIMIT 20").all()).results;
 for(const j of jobs){const lease=crypto.randomUUID();if(!(await q(env.DB,"UPDATE nadi_auth_hr_mail SET status='sending',lease=?,lease_until=? WHERE id=? AND status='queued'",lease,Date.now()+300000,j.id).run()).meta?.changes)continue;
  const detail=JSON.parse(j.detail_json),employee=await q(env.DB,'SELECT email FROM nadi_auth_accounts WHERE id=?',j.account_id).first();
  return {status:'invitation',job:{id:'hr:'+j.id,lease,to:INVITATION_SENDER,subject:'IUC Nadi account audit · '+(j.employee_id||'P&C account'),body:['An IUC Nadi account action was recorded.','Action: '+j.action.replaceAll('_',' '),'Employee ID: '+(j.employee_id||'P&C account'),'Employee email: '+(detail.employeeEmail||j.issued_email||employee?.email||'See protected account audit'),'Actor: '+j.actor_email,'Authentication: '+(detail.authMethod||'Not recorded for historical action'),'Action time: '+j.action_created_at,'Audit reference: '+j.audit_id,'','Review employee and HR email status in the protected account audit:','https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site/admin/sign-in-accounts#account-audit','','This notification contains no password or employee access link. Email acceptance does not confirm inbox delivery.'].join('\n')}};
 }
 return null;
}
export async function invitationRunner(env,body,eligible){
 if(body.sender!==INVITATION_SENDER)throw fail('Run invitation delivery as h.r@innovative.edu.my.',403);
 if(!['ready','claim','ack'].includes(body.mailAction))throw fail('Unknown invitation operation.');
 await q(env.DB,"INSERT INTO nadi_auth_settings (key,value,updated_by,updated_at) VALUES ('invitation_runner',?,'google-mail-runner',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",INVITATION_SENDER,new Date().toISOString()).run();
 if(body.mailAction==='ready')return {status:'invitation_sender_ready',sender:INVITATION_SENDER};
 if(body.mailAction==='ack'){
  if(typeof body.jobId!=='string'||typeof body.lease!=='string'||!['sent','uncertain'].includes(body.outcome))throw fail('Invalid delivery acknowledgement.');
  if(await notificationMailAck(env,body))return {status:'acknowledged'};
  const status=body.outcome==='sent'?'sent':'needs_review',time=status==='sent'?new Date().toISOString():null;
  if(body.jobId.startsWith('hr:'))await q(env.DB,"UPDATE nadi_auth_hr_mail SET status=?,sent_at=?,lease=NULL WHERE id=? AND lease=? AND status='sending'",status,time,body.jobId.slice(3),body.lease).run();
  else await q(env.DB,"UPDATE nadi_auth_invitations SET status=?,payload=NULL,sent_at=?,lease=NULL WHERE id=? AND lease=? AND status='sending'",status,time,body.jobId,body.lease).run();
  return {status:'acknowledged'};
 }
 await env.DB.batch([
  q(env.DB,"UPDATE nadi_auth_invitations SET status='needs_review',payload=NULL,lease=NULL WHERE status='sending' AND lease_until<?",Date.now()),
  q(env.DB,"UPDATE nadi_auth_hr_mail SET status='needs_review',lease=NULL WHERE status='sending' AND lease_until<?",Date.now()),
  q(env.DB,"UPDATE nadi_auth_invitations SET status='expired',payload=NULL WHERE status='queued' AND expires_ms<=?",Date.now())
 ]);
 const pairedHr=await hrClaim(env,true);if(pairedHr)return pairedHr;
 const jobs=(await q(env.DB,"SELECT * FROM nadi_auth_invitations WHERE status='queued' ORDER BY created_at LIMIT 20").all()).results;
 for(let job of jobs){
  const a=await q(env.DB,'SELECT * FROM nadi_auth_accounts WHERE id=?',job.account_id).first();
  if(!a||a.version!==job.account_version||a.email!==job.email||!a.must_change||a.temporary_expires<=Date.now()||!await eligible(env,a)){
   await q(env.DB,"UPDATE nadi_auth_invitations SET status='cancelled',payload=NULL WHERE id=? AND status='queued'",job.id).run();continue;
  }
  // Upgrade pending legacy jobs without decrypting or emailing their old password.
  if(job.format!=='link'){
   const token=randomToken(),expiry=Math.min(a.temporary_expires,Date.now()+86400000);
   const audit=await q(env.DB,"SELECT id FROM nadi_auth_audit WHERE account_id=? AND action IN ('account_issued','password_reset_issued') ORDER BY created_at DESC LIMIT 1",a.id).first();
   const updated=await q(env.DB,"UPDATE nadi_auth_invitations SET format='link',payload=?,token_hash=?,expires_ms=?,audit_id=? WHERE id=? AND status='queued' AND format='legacy'",await encryptToken(env,job,token),await tokenDigest(token),expiry,audit?.id||null,job.id).run();
   if(!updated.meta?.changes)continue;
   if(audit)await q(env.DB,"INSERT INTO nadi_auth_hr_mail (id,audit_id,account_id,account_version,status,created_at) VALUES (?,?,?,?,'queued',?) ON CONFLICT(audit_id) DO NOTHING",crypto.randomUUID(),audit.id,a.id,a.version,new Date().toISOString()).run();
   job=await q(env.DB,'SELECT * FROM nadi_auth_invitations WHERE id=?',job.id).first();
  }
  const lease=crypto.randomUUID();
  if(!(await q(env.DB,"UPDATE nadi_auth_invitations SET status='sending',lease=?,lease_until=? WHERE id=? AND status='queued'",lease,Date.now()+300000,job.id).run()).meta?.changes)continue;
  try{
   const token=await decryptToken(env,job);
   if(await tokenDigest(token)!==job.token_hash)throw Error('Invalid invitation');
   return {status:'invitation',job:{id:job.id,lease,to:job.email,subject:'Choose your IUC Nadi password',body:['Welcome to IUC Nadi,','','People & Culture has issued access for your IUC email. Use this single-use link to choose your own password:','',RESET_URL+'#token='+token,'','IUC email: '+job.email,'This link expires on '+new Date(job.expires_ms).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur'})+' (Malaysia time).','Opening the link does not change your password. Only submitting your chosen password uses the link.','Do not forward this email. If you did not expect it, contact '+INVITATION_SENDER+'.','','People & Culture | Innovative University College'].join('\n')}};
  }catch{await q(env.DB,"UPDATE nadi_auth_invitations SET status='needs_review',payload=NULL,lease=NULL WHERE id=?",job.id).run();throw fail('An invitation needs P&C review. Issue a new secure link.',503);}
 }
 return await hrClaim(env)||notificationMailClaim(env);
}
