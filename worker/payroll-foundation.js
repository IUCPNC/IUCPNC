import {ROLES,CATEGORIES,fail,parse,now,today,clean,date,period,sen,q,rows,configuration,reviewRole,requireRole,requireRead,encryptBank,decryptBank,digest,guard,assertRow,audit,commit,json} from './payroll-core.js';
import {approvedAppointments} from './appointment-source.js';
import {payrollReviewNotices} from './payroll-notifications.js';
import {passwordMatches} from './nadi-auth.js';
export const COMPONENT_KINDS=['basic','allowance','deduction','bonus','commission','overtime','claim','arrears','benefit','cp38','zakat','leave_adjustment'];
const choice=(v,list,name)=>{if(!list.includes(v))throw fail('Choose a valid '+name+'.');return v};
export function classification(b,kind){
 const c=b.classification;if(!c||!['normal','additional','exempt','noncash'].includes(c.tax)||!['epf','socso','eis'].every(k=>typeof c[k]==='boolean'))throw fail('Specify EPF, SOCSO, EIS and tax treatment for this component.');
 if(kind==='basic'&&(!c.epf||!c.socso||!c.eis||c.tax!=='normal'))throw fail('Basic salary must use the standard wage classifications. Eligibility is applied separately.');
 if(kind==='overtime'&&c.epf)throw fail('Overtime is excluded from EPF wages.');
 if(['deduction','cp38','zakat'].includes(kind)&&(c.epf||c.socso||c.eis||!['exempt'].includes(c.tax)))throw fail('Personal deductions must not reduce the statutory wage bases.');
 if(c.tax==='exempt'&&!clean(c.evidence||''))throw fail('An exemption or reimbursement needs its supporting reference.');
 if(kind==='benefit'&&c.tax!=='noncash')throw fail('Benefits in kind need the non-cash tax classification.');
 const eaField=c.eaField||({basic:'B1a',overtime:'B1a',bonus:'B1b',commission:'B1b',arrears:'B2',benefit:'B3',allowance:'B1c',claim:c.tax==='exempt'?'exclude':'B1c'}[kind]||'exclude');if(!['B1a','B1b','B1c','B1d','B1e','B1f','B2','B3','B4','B5','B6','C1','C2','F','exclude'].includes(eaField))throw fail('Choose an EA section classification.');
 if(kind==='basic'&&eaField!=='B1a'||kind==='benefit'&&!['B3','B4'].includes(eaField)||c.tax!=='exempt'&&['F','exclude'].includes(eaField))throw fail('The EA section must match this remuneration treatment.');
 return {epf:c.epf,socso:c.socso,eis:c.eis,tax:c.tax,evidence:clean(c.evidence||''),exemptionLimitSen:sen(c.exemptionLimit||'0'),eaField};
}
export const scopedAssert=(db,user,role,entity)=>assertRow(db,'SELECT 1 FROM payroll_grants WHERE email=? AND role=? AND entity=? AND (expires IS NULL OR expires>=?)',user.email.toLowerCase(),role,entity,today());
export async function challenge(request,env,user,b,t){
 if(user.authMethod!=='password')throw fail('Sign in with your IUC password to confirm this sensitive action.',403);
 const a=await q(env.DB,'SELECT * FROM nadi_auth_accounts WHERE id=? AND canonical_user_id=? AND email=? AND enabled=1 AND must_change=0',user.accountId||'',user.userId,user.email.toLowerCase()).first();
 if(!a)throw fail('Complete password setup and sign in again.',403);
 const bucket='payroll-stepup:'+await digest(a.id),window=Math.floor(Date.now()/900000)*900000;
 await q(env.DB,'INSERT INTO nadi_auth_limits(bucket,window_ms,attempts,expires_ms) VALUES (?,?,1,?) ON CONFLICT(bucket,window_ms) DO UPDATE SET attempts=attempts+1',bucket,window,window+900000).run();
 if((await q(env.DB,'SELECT attempts FROM nadi_auth_limits WHERE bucket=? AND window_ms=?',bucket,window).first()).attempts>8)throw fail('Too many confirmation attempts. Try again in 15 minutes.',429);
 if(!await passwordMatches(env,b.password,a.password_hash))throw fail('Password confirmation failed.',403);
 const action=clean(b.action,150),resource=clean(b.resource,150),id=crypto.randomUUID(),expires=Date.now()+300000;
 if(!action.startsWith('/api/payroll/')||action==='/api/payroll/step-up')throw fail('Invalid action to confirm.');
 return commit(env.DB,t,[assertRow(env.DB,'SELECT 1 FROM nadi_auth_accounts WHERE id=? AND version=? AND enabled=1 AND must_change=0',a.id,a.version),q(env.DB,'INSERT INTO payroll_challenges(id,actor_email,account_id,account_version,action,resource,expires_ms) VALUES (?,?,?,?,?,?,?)',id,user.email,a.id,a.version,action,resource,expires),audit(env.DB,user,'sensitive_action_confirmed',resource,{action})],{challenge:id,expiresAt:new Date(expires).toISOString()});
}
export async function verifyChallenge(db,user,b,path,resource){const id=clean(b.challenge||'',100);if(!id||!await q(db,'SELECT 1 FROM payroll_challenges c JOIN nadi_auth_accounts a ON a.id=c.account_id AND a.version=c.account_version WHERE c.id=? AND c.actor_email=? AND c.action=? AND c.resource=? AND c.used=0 AND c.expires_ms>? AND a.canonical_user_id=? AND a.enabled=1 AND a.must_change=0',id,user.email,path,String(resource),Date.now(),user.userId).first())throw fail('Confirm this sensitive action again with your password.',403);}
export function consumeChallenge(db,user,b,path,resource){
 const id=clean(b.challenge||'',100);if(!id)throw fail('Confirm this sensitive action with your password.',403);
 return [assertRow(db,'SELECT 1 FROM payroll_challenges c JOIN nadi_auth_accounts a ON a.id=c.account_id AND a.version=c.account_version WHERE c.id=? AND c.actor_email=? AND c.action=? AND c.resource=? AND c.used=0 AND c.expires_ms>? AND a.canonical_user_id=? AND a.enabled=1 AND a.must_change=0',id,user.email,path,String(resource),Date.now(),user.userId),q(db,'UPDATE payroll_challenges SET used=1 WHERE id=? AND used=0',id)];
}
export async function employeeMaster(env,id,appointmentPeriod=null){
 const e=await q(env.DB,'SELECT employee_id,employee_name,email,department,position,active,employment_id FROM employees WHERE employee_id=?',id).first();if(!e)throw fail('Employee not found.',404);
 const sections=await rows(env.DB,"SELECT section,data_json,version,updated_at FROM employee_profile_sections WHERE employee_id=? AND section IN ('personal','overview','employment','exit')",id),s=Object.fromEntries(sections.map(r=>[r.section,parse(r.data_json)]));
 const employment=e.employment_id?await q(env.DB,'SELECT start_date,end_date,employment_status,updated_at FROM employment_records WHERE employment_id=?',e.employment_id).first():null;
 const appointments=await approvedAppointments(env.DB,[id],appointmentPeriod);
 return {...e,birthDate:s.personal?.dateOfBirth||s.personal?.dob||'',nationality:s.personal?.nationality||'',startDate:employment?.start_date||s.overview?.dateJoined||s.employment?.appointmentDate||'',endDate:employment?.end_date||s.exit?.lastWorkingDay||'',workLocation:s.overview?.workLocation||'',employmentCategory:s.overview?.employmentType||'',appointments,sourceVersions:sections.map(r=>({section:r.section,version:r.version,updatedAt:r.updated_at})),employmentUpdatedAt:employment?.updated_at||null};
}
export const safeProfile=r=>r?{employeeId:r.employee_id,version:r.version,updatedAt:r.updated_at,updatedBy:r.updated_by,...Object.fromEntries(Object.entries(parse(r.data_json)).filter(([k])=>!['approvedBankCipher'].includes(k))),bankOnFile:!!r.bank_cipher}:null;
export async function foundationRead(env,user,a,url){
 const db=env.DB,c=await configuration(db),path=url.pathname;
 if(path==='/api/payroll/context')return json({access:a,configuration:{...c.data,parallelCycles:undefined},configVersion:c.version,roles:ROLES,categories:CATEGORIES,kinds:['basic','allowance','deduction','benefit','cp38','zakat']});
 if(path==='/api/payroll/grants'){if(!a.roleAdmin)throw fail('P&C access is required to administer payroll grants.',403);return json({grants:await rows(db,'SELECT id,email,role,entity,expires,created_by,created_at,version FROM payroll_grants ORDER BY email,role')});}
 if(path==='/api/payroll/employees'){requireRead(a,c.data.entity);return json({employees:await rows(db,'SELECT employee_id,employee_name,email,department,position,active FROM employees ORDER BY employee_name LIMIT 1000')});}
 if(path==='/api/payroll/profile'){
  const id=clean(url.searchParams.get('employeeId')||a.employeeId||'');if(id!==a.employeeId)requireRead(a,c.data.entity);
  const master=await employeeMaster(env,id),r=await q(db,'SELECT * FROM payroll_profiles WHERE employee_id=?',id).first(),history=await rows(db,'SELECT * FROM payroll_remuneration WHERE employee_id=? ORDER BY effective_from DESC,created_at DESC',id);
  if(id===a.employeeId&&!a.grants.some(g=>g.entity===c.data.entity&&['prepare','hr_approve','audit'].includes(g.role)))return json({master,profile:r?{version:r.version,approved:parse(r.data_json).approved,bankOnFile:!!parse(r.data_json).approvedBankCipher}:null,history:history.filter(h=>h.status==='approved').map(h=>({...h,data:parse(h.data_json),data_json:undefined}))});
  return json({master,profile:safeProfile(r),history:history.map(h=>({...h,data:parse(h.data_json),data_json:undefined}))});
 }
 return null;
}
export async function foundationWrite(env,user,a,path,b,t){
 const db=env.DB,c=await configuration(db),entity=c.data.entity;
 if(path==='/api/payroll/grants'){
  if(!a.roleAdmin)throw fail('P&C access is required to administer payroll grants.',403);
  const email=clean(b.email,254).toLowerCase(),role=choice(b.role,ROLES,'payroll role');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Enter a valid account email.');if(!await q(db,'SELECT 1 FROM nadi_auth_accounts WHERE email=? AND enabled=1',email).first())throw fail('Choose an enabled NADI account.');
  const expires=b.expires?date(b.expires):null,id=await digest(email+'|'+role+'|'+entity),ss=consumeChallenge(db,user,b,path,email);
  if(b.revoke)ss.push(assertRow(db,'SELECT 1 FROM payroll_grants WHERE id=? AND version=?',id,b.version),q(db,'DELETE FROM payroll_grants WHERE id=? AND version=?',id,b.version));
  else ss.push(q(db,'INSERT INTO payroll_grants(id,email,role,entity,expires,created_by,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email,role,entity) DO UPDATE SET expires=excluded.expires,created_by=excluded.created_by,created_at=excluded.created_at,version=payroll_grants.version+1',id,email,role,entity,expires,user.email,now()));
  ss.push(audit(db,user,b.revoke?'payroll_grant_revoked':'payroll_grant_assigned',email,{role,entity,expires}));return commit(db,t,ss,{ok:true});
 }
 if(path==='/api/payroll/profile'){
  requireRole(a,'prepare',entity);const id=clean(b.employeeId),m=await employeeMaster(env,id),old=await q(db,'SELECT * FROM payroll_profiles WHERE employee_id=?',id).first(),p=b.profile||{};
  const proposed={category:choice(p.category,CATEGORIES,'employment category'),contractType:choice(p.contractType,['service','for_service'],'contract relationship'),entity,costCentre:clean(p.costCentre||m.department),birthDate:date(p.birthDate||m.birthDate),nationality:choice(p.nationality,['citizen','pr','foreign'],'nationality'),epfMember:clean(p.epfMember||''),socsoMember:clean(p.socsoMember||''),taxNumber:clean(p.taxNumber||''),epfPre1998:!!p.epfPre1998,firstSocsoAge:Number(p.firstSocsoAge),firstEisAge:Number(p.firstEisAge),eisPriorContributions:!!p.eisPriorContributions,lindungOptOutDate:p.lindungOptOutDate?date(p.lindungOptOutDate):null,otherEmployerLindung:!!p.otherEmployerLindung,lindungReference:clean(p.lindungReference||''),workPassExpiry:p.workPassExpiry?date(p.workPassExpiry):null,workPassReference:clean(p.workPassReference||''),workRegion:choice(p.workRegion,['Peninsular Malaysia','Labuan','Sabah','Sarawak'],'work region'),evidence:clean(p.evidence||''),tax:p.tax||{},tp3:p.tp3||{},otEligible:!!p.otEligible,normalHours:Number(p.normalHours||8),deductionLimitPercent:Number(p.deductionLimitPercent||50)};
  if(!Number.isInteger(proposed.firstSocsoAge)||proposed.firstSocsoAge<14||proposed.firstSocsoAge>100||!Number.isInteger(proposed.firstEisAge)||proposed.firstEisAge<14||proposed.firstEisAge>100)throw fail('Record the verified first contribution ages.');
  if(!proposed.evidence||!Number.isFinite(proposed.normalHours)||proposed.normalHours<1||proposed.normalHours>12||proposed.deductionLimitPercent!==50)throw fail('A verification reference and valid working hours are required. Deductions above the standard limit need a separately reviewed legal arrangement.');
  const bank=b.bank?{name:clean(b.bank.name,120),holder:clean(b.bank.holder,150),account:clean(b.bank.account,34)}:null;if(bank&&(!bank.name||!bank.holder||!/^[A-Za-z0-9 -]{5,34}$/.test(bank.account)))throw fail('Complete valid bank details.');
  const bankCipher=bank?await encryptBank(env,id,bank):old?.bank_cipher||null,data={...parse(old?.data_json),proposed,status:'pending',initiator:user.email};
  const ss=[...await payrollReviewNotices(db,user,entity,'profile:'+id+':'+(old?.version||0),'A payroll profile change is awaiting your review.','/admin/payroll?tab=remuneration&employeeId='+encodeURIComponent(id)),...consumeChallenge(db,user,b,path,id),scopedAssert(db,user,'prepare',entity),audit(db,user,'payroll_profile_proposed',id,{category:proposed.category,bankChanged:!!bank})];
  if(old)ss.push(assertRow(db,'SELECT 1 FROM payroll_profiles WHERE employee_id=?',id),guard(db,'payroll_profiles',id,b.version,{data_json:JSON.stringify(data),bank_cipher:bankCipher,updated_by:user.email,updated_at:now()},'employee_id'));
  else ss.push(q(db,'INSERT INTO payroll_profiles(employee_id,data_json,bank_cipher,updated_by,updated_at) VALUES (?,?,?,?,?)',id,JSON.stringify(data),bankCipher,user.email,now()));
  return commit(db,t,ss,{ok:true,status:'pending'});
 }
 if(path==='/api/payroll/profile/approve'){
  const approvalRole=reviewRole(a,entity);const id=clean(b.employeeId),r=await q(db,'SELECT * FROM payroll_profiles WHERE employee_id=?',id).first(),d=parse(r?.data_json);if(!r||d.status!=='pending')throw fail('No pending payroll profile.',409);if(d.initiator===user.email||id===a.employeeId)throw fail('A different authorised reviewer must review this profile.',403);
  const data={...d,approved:b.reject?d.approved:d.proposed,approvedBankCipher:b.reject?d.approvedBankCipher:r.bank_cipher,status:b.reject?'rejected':'approved',approver:user.email,approvedAt:now(),decisionNote:clean(b.note||'')};
  return commit(db,t,[...consumeChallenge(db,user,b,path,id),scopedAssert(db,user,approvalRole,entity),assertRow(db,'SELECT 1 FROM payroll_profiles WHERE employee_id=?',id),guard(db,'payroll_profiles',id,b.version,{data_json:JSON.stringify(data),bank_cipher:b.reject?d.approvedBankCipher||null:r.bank_cipher,updated_by:user.email,updated_at:now()},'employee_id'),audit(db,user,b.reject?'payroll_profile_rejected':'payroll_profile_approved',id,{initiator:d.initiator})],{ok:true,status:data.status});
 }
 if(path==='/api/payroll/remuneration'){
  requireRole(a,'prepare',entity);const id=crypto.randomUUID(),employeeId=clean(b.employeeId),m=await employeeMaster(env,employeeId),kind=choice(b.kind,['basic','allowance','deduction','benefit','cp38','zakat'],'recurring remuneration kind'),amount=sen(b.amount),from=date(b.effectiveFrom),to=b.effectiveTo?date(b.effectiveTo):null,code=clean(b.code,50);if(!/^[A-Z0-9_-]{2,50}$/.test(code)||to&&to<from)throw fail('Use a valid component code and effective dates.');
  const cl=classification(b,kind),appointment=b.appointmentId?clean(b.appointmentId):null;if(appointment&&!(await approvedAppointments(db,[employeeId],{from,to:to||'9999-12-31'})).some(x=>x.id===appointment))throw fail('Choose an existing active appointment for this employee.');if(kind==='basic'&&appointment)throw fail('Basic salary belongs to the employment record. Appointment allowances are separate.');
  if(kind==='basic'&&b.prorate===false)throw fail('Basic salary uses eligible calendar days for incomplete months.');const data={classification:cl,prorate:b.prorate!==false,replaceId:b.replaceId?clean(b.replaceId):null,reason:clean(b.reason||''),evidence:clean(b.evidence||'')};if(!data.reason||!data.evidence)throw fail('A reason and supporting reference are required.');
  return commit(db,t,[...await payrollReviewNotices(db,user,entity,'remuneration:'+id,'A remuneration change is awaiting your review.','/admin/payroll?tab=remuneration&employeeId='+encodeURIComponent(employeeId)),...consumeChallenge(db,user,b,path,employeeId),scopedAssert(db,user,'prepare',entity),q(db,'INSERT INTO payroll_remuneration(id,employee_id,code,kind,amount_sen,effective_from,effective_to,appointment_id,status,data_json,initiator,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,employeeId,code,kind,amount,from,to,appointment,'pending',JSON.stringify(data),user.email,now()),audit(db,user,'remuneration_proposed',id,{employeeId,kind,effectiveFrom:from})],{id,status:'pending'},201);
 }
 if(path==='/api/payroll/remuneration/approve'){
  const approvalRole=reviewRole(a,entity);const r=await q(db,'SELECT * FROM payroll_remuneration WHERE id=?',clean(b.id)).first();if(!r||r.status!=='pending')throw fail('This proposal is no longer pending.',409);if(r.initiator===user.email||r.employee_id===a.employeeId)throw fail('A different authorised reviewer must review this remuneration.',403);
  const ss=[...consumeChallenge(db,user,b,path,r.id),scopedAssert(db,user,approvalRole,entity)],d=parse(r.data_json),status=b.reject?'rejected':'approved';
  if(!b.reject){
   if(d.replaceId){const prior=await q(db,'SELECT * FROM payroll_remuneration WHERE id=? AND employee_id=? AND code=? AND kind=? AND status=?',d.replaceId,r.employee_id,r.code,r.kind,'approved').first();if(!prior||r.effective_from<=prior.effective_from)throw fail('A replacement must start after its approved predecessor.');const end=new Date(Date.parse(r.effective_from)-86400000).toISOString().slice(0,10);ss.push(assertRow(db,'SELECT 1 FROM payroll_remuneration WHERE id=? AND version=? AND status=?',prior.id,prior.version,'approved'),guard(db,'payroll_remuneration',prior.id,prior.version,{effective_to:prior.effective_to&&prior.effective_to<end?prior.effective_to:end}));}
   ss.push(q(db,"INSERT INTO payroll_checks(id,ok) SELECT ?,CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_remuneration WHERE employee_id=? AND status='approved' AND (code=? OR (kind='basic' AND ?='basic')) AND id<>? AND effective_from<=? AND COALESCE(effective_to,'9999-12-31')>=?) THEN 1 ELSE 0 END",crypto.randomUUID(),r.employee_id,r.code,r.kind,d.replaceId||'',r.effective_to||'9999-12-31',r.effective_from));
  }
  ss.push(assertRow(db,'SELECT 1 FROM payroll_remuneration WHERE id=?',r.id),guard(db,'payroll_remuneration',r.id,b.version,{status,approver:user.email,approved_at:now(),data_json:JSON.stringify({...d,decisionNote:clean(b.note||'')})}),audit(db,user,'remuneration_'+status,r.id,{employeeId:r.employee_id,initiator:r.initiator}));return commit(db,t,ss,{ok:true,status});
 }
 return null;
}
