import {isLetter,letterDefinition,letterSource,renderLetter,renderLetterPreview,hashBytes} from './hr-letter.js';
import {currentEmployee,ACTIVE} from './employee-eligibility.js';
import {businessDate} from './profile-schema.js';
import {serviceOperations,serviceEventView,OPEN_REQUEST_SQL,FOLLOW_UP_EVENT,FOLLOW_UP_ACK_EVENT,FOLLOW_UP_VERSION_SQL,FOLLOW_UP_ACK_SQL,REQUESTED_DATE_SQL} from './hr-service-operations.js';
export const REQUEST_TYPES=['Employment confirmation letter','Salary confirmation letter','Employment verification','General letter request','Document / certified copy request','HR query','Benefits / payroll query','Other HR request'];
export const REQUEST_STATUSES=['Submitted','In Review','Needs Information','Approved','Issued','Rejected','Cancelled'];
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(m,status=400)=>Object.assign(Error(m),{status});
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const stamp=()=>new Date().toISOString();
const rows=async(db,sql,...args)=>(await q(db,sql,...args).all()).results;
const trim=(v,max,name,required=false)=>{if(v!=null&&typeof v!=='string')throw fail('Enter a valid '+name+'.');const s=(v||'').trim();if(s.length>max||required&&!s)throw fail(name+' '+(required?'is required and ':'')+'must be within '+max+' characters.');return s;};
async function bounded(request,limit){const reader=request.body?.getReader();if(!reader)throw fail('Request content is required.');const chunks=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>limit){await reader.cancel();throw fail('The upload or request is too large.',413)}chunks.push(r.value)}const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}return new Request(request.url,{method:request.method,headers:request.headers,body:bytes})}
async function body(request){try{return await(await bounded(request,32000)).json()}catch(e){if(e.status)throw e;throw fail('Enter valid request details.')}}
export async function serviceEmployee(env,user){
 return currentEmployee(env,user);
}
const select="SELECT r.*,e.employee_name,e.email AS employee_email,e.department,e.position,"+FOLLOW_UP_VERSION_SQL+" AS follow_up_version,"+FOLLOW_UP_ACK_SQL+" AS follow_up_ack_version FROM hr_service_requests r JOIN employees e ON e.employee_id=r.employee_id";
async function getRequest(db,id){return q(db,select+' WHERE r.id=?',id).first()}
const view=(r,admin=false)=>({id:r.id,reference:r.reference,employeeId:r.employee_id,employeeName:r.employee_name,department:r.department,type:r.request_type,autoLetter:isLetter(r),subject:r.subject,details:r.details,recipient:r.recipient,neededBy:r.needed_by,status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,approvedAt:r.approved_at,issuedAt:r.issued_at,operations:serviceOperations(r),...(admin?{employeeEmail:r.employee_email,draftReply:r.draft_reply,internalNotes:r.internal_notes,approvedBy:r.approved_by,issuedBy:r.issued_by}:r.status==='Issued'?{reply:r.draft_reply}:{})});
const fileView=f=>({id:f.id,name:f.original_filename,mimeType:f.mime_type,bytes:f.bytes,createdAt:f.created_at,generated:!!f.generated});
function event(db,ctx,rid,operation,type,message,time){return q(db,"INSERT INTO hr_service_events (id,request_id,actor_id,actor_email,actor_role,event_type,message,created_at) SELECT ?,id,?,?,?,?,?,? FROM hr_service_requests WHERE id=? AND last_operation=?",crypto.randomUUID(),ctx.user.userId,ctx.user.email,ctx.admin?'admin':'employee',type,message,time,rid,operation)}
async function change(db,ctx,r,sets,values,type,message,more=[],guard=null){const operation=crypto.randomUUID(),time=stamp();const update=q(db,'UPDATE hr_service_requests SET '+sets+',version=version+1,last_operation=?,updated_at=? WHERE id=? AND version=?'+(guard?.sql||''),...values,operation,time,r.id,r.version,...(guard?.args||[]));const extras=typeof more==='function'?more(operation,time):more;const result=await db.batch([update,...extras,event(db,ctx,r.id,operation,type,message,time)]);if(!result[0].meta?.changes)throw fail('This request or employee record changed while you were reviewing it. Refresh before trying again.',409);return getRequest(db,r.id)}
function sourceGuard(r,source){return {sql:" AND EXISTS (SELECT 1 FROM employees WHERE employee_id=? AND employee_name IS ? AND position IS ? AND department IS ? AND active IS ? AND updated_at IS ?) AND (SELECT json_group_array(json_array(section,version,data_json)) FROM (SELECT section,version,data_json FROM employee_profile_sections WHERE employee_id=? AND section IN ("+source.guard.sectionNames.map(()=>'?').join(',')+") ORDER BY section))=?",args:[r.employee_id,...source.guard.employee,r.employee_id,...source.guard.sectionNames,JSON.stringify(source.guard.sections)]};}
const letterRecord=r=>r.letter_json?JSON.parse(r.letter_json):null;
async function letterState(db,r,storageReady){if(!isLetter(r))return null;const saved=letterRecord(r);if(['Issued','Rejected','Cancelled'].includes(r.status))return {closed:true,fileId:saved?.fileId,fingerprint:saved?.fingerprint};const current=await letterSource(db,r),definition=letterDefinition(r.request_type);const missing=[...current.missing,...(!storageReady?['Private document storage']:[])];return {templateName:definition.title,purpose:definition.purpose,ready:!missing.length,missing,needsGeneration:!missing.length&&(!saved||saved.fingerprint!==current.fingerprint),fileId:saved?.fileId,fingerprint:saved?.fingerprint,generatedAt:saved?.generatedAt,reference:saved?.snapshot.reference};}
function validateVersion(v,r){if(!Number.isInteger(v)||v!==r.version)throw fail('This request changed. Refresh before trying again.',409)}
function editable(r){if(['Issued','Rejected','Cancelled'].includes(r.status))throw fail('This request is closed; its history is retained.',409)}
function approvedReset(){return "status='In Review',approved_by=NULL,approved_at=NULL"}
export async function serviceDeskRoute(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;if(!/^\/api\/hr-service(?:\/|$)/.test(path))return null;
 if(!ctx.user)return json({error:'Sign in is required.'},401);
 if(!env.DB)return json({error:'The HR Service Desk is temporarily unavailable.'},503);
 try{
  const admin=ctx.isPc(env,ctx.user.email),employee=await serviceEmployee(env,ctx.user);ctx={...ctx,admin,employee};if(!admin&&!employee)throw fail('An active employee account is required.',403);
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)throw fail('Refresh Nadi before saving this request.',403);
  const db=env.DB;
  if(path==='/api/hr-service/me'&&request.method==='GET')return json({admin,employee,types:REQUEST_TYPES,statuses:REQUEST_STATUSES,storageReady:!!env.PROFILE_FILES});
  if(path==='/api/hr-service/requests'&&request.method==='GET'){
   const adminScope=url.searchParams.get('scope')==='admin';if(adminScope&&!admin)throw fail('P&C admin access is required.',403);if(!adminScope&&!employee)throw fail('An active employee account is required.',403);
   const statuses=REQUEST_STATUSES.map(s=>"SUM(CASE WHEN r.status='"+s+"' THEN 1 ELSE 0 END) AS '"+s+"'").join(',');
   const where=adminScope?'':' WHERE r.employee_id=?',params=adminScope?[]:[employee.employee_id];
   const day=businessDate(),order=adminScope?"CASE WHEN status IN "+OPEN_REQUEST_SQL+" AND follow_up_version>follow_up_ack_version THEN 0 WHEN status IN "+OPEN_REQUEST_SQL+" AND date(needed_by)=needed_by AND needed_by<? THEN 1 ELSE 2 END,created_at DESC":"created_at DESC";
   const list=await rows(db,'SELECT * FROM ('+select+where+') queue ORDER BY '+order+' LIMIT 500',...params,...(adminScope?[day]:[]));
   const counts=await q(db,'SELECT COUNT(*) AS total,'+statuses+' FROM hr_service_requests r'+where,...params).first();
   const operations=await q(db,'SELECT COALESCE(SUM(CASE WHEN '+REQUESTED_DATE_SQL+' AND r.needed_by<? THEN 1 ELSE 0 END),0) AS pastRequestedDate,COALESCE(SUM(CASE WHEN '+REQUESTED_DATE_SQL+' AND r.needed_by=? THEN 1 ELSE 0 END),0) AS dueToday,COALESCE(SUM(CASE WHEN r.status IN '+OPEN_REQUEST_SQL+' AND r.follow_up_version>r.follow_up_ack_version THEN 1 ELSE 0 END),0) AS followUpPending FROM ('+select+where+') r',day,day,...params).first();
   return json({requests:list.map(r=>view(r,false)),counts,operations,businessDate:day,limit:500,refreshedAt:stamp()});
  }
  if(path==='/api/hr-service/requests'&&request.method==='POST'){
   if(!employee)throw fail('An active employee profile is required to submit a request.',403);const b=await body(request);
   if(!REQUEST_TYPES.includes(b.type))throw fail('Choose a request type.');
   const subject=trim(b.subject,140,'Subject',true),details=trim(b.details,5000,'Request details',true),recipient=trim(b.recipient,200,'Recipient'),neededBy=b.neededBy||null;
   if(neededBy&&(!/^\d{4}-\d{2}-\d{2}$/.test(neededBy)||!Number.isFinite(Date.parse(neededBy))||new Date(neededBy).toISOString().slice(0,10)!==neededBy))throw fail('Choose a valid needed-by date.');
   const key=request.headers.get('idempotency-key');if(!key||!/^[-a-zA-Z0-9]{16,100}$/.test(key))throw fail('Refresh this form before submitting.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([b.type,subject,details,recipient,neededBy])))),b=>b.toString(16).padStart(2,'0')).join('');
   const old=await q(db,'SELECT * FROM hr_service_requests WHERE employee_id=? AND submission_key=?',employee.employee_id,key).first();if(old){if(old.submission_hash!==hash)throw fail('This form was already submitted with different details. Start a new request.',409);return json({request:view(await getRequest(db,old.id)),replayed:true},200)}
   const id=crypto.randomUUID(),time=stamp(),ref='HR-'+time.slice(0,4)+'-'+id.replaceAll('-','').slice(0,12).toUpperCase();
   const insert=q(db,'INSERT INTO hr_service_requests (id,reference,employee_id,created_by,request_type,subject,details,recipient,needed_by,status,last_operation,submission_key,submission_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,ref,employee.employee_id,ctx.user.userId,b.type,subject,details,recipient,neededBy,'Submitted',id,key,hash,time,time);
   try{await db.batch([insert,event(db,ctx,id,id,'Submitted','Request submitted to P&C.',time)])}catch(e){const retry=await q(db,'SELECT * FROM hr_service_requests WHERE employee_id=? AND submission_key=?',employee.employee_id,key).first();if(retry&&retry.submission_hash===hash)return json({request:view(await getRequest(db,retry.id)),replayed:true},200);throw e}
   return json({request:view(await getRequest(db,id))},201);
  }
  const match=path.match(/^\/api\/hr-service\/requests\/([a-f0-9-]{36})(?:\/(actions|files|letter-preview)(?:\/([a-f0-9-]{36}))?)?$/);if(!match)throw fail('Request not found.',404);
  const [_,id,action,fileId]=match,r=await getRequest(db,id);if(!r||!admin&&r.employee_id!==employee.employee_id)throw fail('Request not found.',404);
  if(!action&&request.method==='GET'){
   const history=await rows(db,'SELECT event_type,message,actor_role,created_at FROM hr_service_events WHERE request_id=? ORDER BY created_at,id',id);
   const files=admin||r.status==='Issued'?await rows(db,'SELECT * FROM hr_service_files WHERE request_id=? AND removed_at IS NULL ORDER BY created_at',id):[];
   return json({request:view(r,admin),events:history.map(serviceEventView),files:files.map(fileView),...(admin?{letter:await letterState(db,r,!!env.PROFILE_FILES)}:{})});
  }
  if(action==='letter-preview'&&request.method==='GET'&&!fileId){
   if(!admin)throw fail('Letter preview not found.',404);const saved=letterRecord(r);if(!saved)throw fail('Generate this letter before previewing it.',404);
   return new Response(await renderLetterPreview(saved.snapshot,r.status==='Issued'),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; sandbox"}});
  }
  if(action==='files'&&fileId&&request.method==='GET'){
   if(!admin&&r.status!=='Issued')throw fail('This document has not been approved and issued.',404);const f=await q(db,'SELECT * FROM hr_service_files WHERE id=? AND request_id=? AND removed_at IS NULL',fileId,id).first();if(!f)throw fail('Document not found.',404);if(!env.PROFILE_FILES)throw fail('Private document storage is unavailable.',503);const object=await env.PROFILE_FILES.get(f.storage_key);if(!object)throw fail('This document is temporarily unavailable. Contact P&C.',503);
   return new Response(object.body,{headers:{'content-type':f.mime_type,'content-disposition':(admin&&f.generated&&url.searchParams.get('preview')==='1'?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(f.original_filename),'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; frame-ancestors 'self'; sandbox"}});
  }
  if(action==='files'&&request.method==='POST'&&!fileId){
   if(isLetter(r))throw fail('This letter is generated from employee records. Update the employee profile instead of uploading or editing the letter.',409);
   if(!admin)throw fail('P&C admin access is required.',403);editable(r);if(!env.PROFILE_FILES)throw fail('Private storage is unavailable.',503);
   const form=await(await bounded(request,11*1024*1024)).formData();validateVersion(Number(form.get('version')),r);const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||!file.size||file.size>10*1024*1024)throw fail('Choose a PDF, DOCX, PNG or JPEG up to 10 MB.');
   if((await q(db,'SELECT COUNT(*) AS n FROM hr_service_files WHERE request_id=? AND removed_at IS NULL',id).first()).n>=5)throw fail('A request can contain up to five issued documents.');
   const bytes=new Uint8Array(await file.arrayBuffer()),name=file.name.replace(/[\r\n"\\/]/g,'_').slice(0,150),ext=name.split('.').pop().toLowerCase(),text=new TextDecoder().decode(bytes);
   const mime=ext==='pdf'&&text.startsWith('%PDF-')?'application/pdf':ext==='docx'&&bytes[0]===80&&bytes[1]===75&&text.includes('[Content_Types].xml')&&text.includes('word/')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':ext==='png'&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)?'image/png':['jpg','jpeg'].includes(ext)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
   if(!mime)throw fail('The file must be a valid PDF, DOCX, PNG or JPEG.');
   const fid=crypto.randomUUID(),key='hr-service/'+id+'/'+fid,hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');await env.PROFILE_FILES.put(key,bytes,{httpMetadata:{contentType:mime}});
   try{const updated=await change(db,ctx,r,approvedReset(),[],'Document prepared','Admin prepared a document; it is not yet issued.',(operation,time)=>[q(db,'INSERT INTO hr_service_files (id,request_id,original_filename,mime_type,bytes,sha256,storage_key,uploaded_by,created_at) SELECT ?,id,?,?,?,?,?,?,? FROM hr_service_requests WHERE id=? AND last_operation=?',fid,name,mime,bytes.length,hash,key,ctx.user.userId,time,id,operation)]);return json({request:view(updated,true),file:{id:fid,name}},201)}catch(e){await env.PROFILE_FILES.delete(key);throw e}
  }
  if(action==='files'&&fileId&&request.method==='DELETE'){
   if(isLetter(r))throw fail('Generated letters are retained in the review trail. Refresh the letter from the employee records instead.',409);
   if(!admin)throw fail('P&C admin access is required.',403);editable(r);const b=await body(request);validateVersion(b.version,r);const f=await q(db,'SELECT * FROM hr_service_files WHERE id=? AND request_id=? AND removed_at IS NULL',fileId,id).first();if(!f)throw fail('Document not found.',404);
   const updated=await change(db,ctx,r,approvedReset(),[],'Document removed','Admin removed a prepared document.',(operation,time)=>[q(db,'UPDATE hr_service_files SET removed_at=? WHERE id=? AND request_id IN (SELECT id FROM hr_service_requests WHERE id=? AND last_operation=?)',time,fileId,id,operation)]);return json({request:view(updated,true)});
  }
  if(action==='actions'&&request.method==='POST'&&!fileId){
   const b=await body(request);validateVersion(b.version,r);editable(r);const note=trim(b.message,5000,'Message');
   if(!admin||['cancel','information','followUp'].includes(b.action)){
    if(!employee||r.employee_id!==employee.employee_id)throw fail('Only the requesting employee can perform this action.',403);ctx={...ctx,admin:false};
    if(b.action==='cancel'&&['Submitted','In Review','Needs Information'].includes(r.status)){const updated=await change(db,ctx,r,"status='Cancelled'",[],'Cancelled','Employee cancelled this request.');return json({request:view(updated)})}
    if(b.action==='information'&&r.status==='Needs Information'&&note){const updated=await change(db,ctx,r,"status='Submitted'",[],'Information provided',note);return json({request:view(updated)})}
    if(b.action==='followUp'){
     if(!serviceOperations(r).canFollowUp)throw fail('Follow up after your requested date has passed, or wait for P&C to acknowledge the existing follow-up.',409);
     if(!note)throw fail('Explain what you need P&C to follow up.');
     const guard={sql:" AND EXISTS (SELECT 1 FROM employees e WHERE e.employee_id=? AND lower(e.email)=lower(?) AND (e.account_user_id IS NULL OR e.account_user_id='' OR e.account_user_id=?) AND "+ACTIVE+") AND (SELECT COUNT(*) FROM employees e WHERE lower(e.email)=lower(?) AND "+ACTIVE+")=1",args:[r.employee_id,ctx.user.email,ctx.user.userId,ctx.user.email]};
     const updated=await change(db,ctx,r,'status=status',[],FOLLOW_UP_EVENT,JSON.stringify({version:r.version+1,message:note}),[],guard);return json({request:view(updated)});
    }
    throw fail('This action is unavailable for your request.',403);
   }
   let sets,values=[],type,message;
   if(b.action==='acknowledgeFollowUp'){
    if(!serviceOperations(r).followUpPending)throw fail('There is no pending follow-up to acknowledge.',409);
    const updated=await change(db,ctx,r,'status=status',[],FOLLOW_UP_ACK_EVENT,JSON.stringify({version:r.version+1,message:'P&C acknowledged your follow-up. Your original request remains open.'}));return json({request:view(updated,true)});
   }
   if(isLetter(r)&&['saveDraft','approve','issue'].includes(b.action))throw fail('Preview the automatically generated letter, then choose Approve & issue letter.',409);
   if(b.action==='generateLetter'){
    if(!isLetter(r))throw fail('This request does not use the standard employment letter.',400);
    if(r.status==='Needs Information')throw fail('Wait for the requested information before preparing the letter.',409);
    if(!env.PROFILE_FILES)throw fail('Private document storage is unavailable.',503);
    const source=await letterSource(db,r);if(source.missing.length)throw fail('Complete these employee record fields: '+source.missing.join(', ')+'.',422);
    let bytes;try{bytes=await renderLetter(source.snapshot)}catch(e){if(e.status)throw e;throw fail('The employee details contain characters that this English letter template cannot render. Contact P&C to verify the official name and document formatting.',422)}
    const fid=crypto.randomUUID(),key='hr-service/'+id+'/'+fid,hash=await hashBytes(bytes),name='IUC-'+letterDefinition(r.request_type).fileLabel+'-'+r.employee_id.replace(/[^a-zA-Z0-9-]/g,'-')+'-'+r.reference+'.pdf',generatedAt=stamp();
    const saved=JSON.stringify({snapshot:source.snapshot,fingerprint:source.fingerprint,fileId:fid,sha256:hash,generatedAt});
    await env.PROFILE_FILES.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
    try{const updated=await change(db,ctx,r,"letter_json=?,draft_reply='',"+approvedReset(),[saved],'Letter generated','The standard English letter was generated from official employee records; it has not been issued.',(op,time)=>[
     q(db,'UPDATE hr_service_files SET removed_at=? WHERE request_id=? AND removed_at IS NULL AND EXISTS (SELECT 1 FROM hr_service_requests WHERE id=? AND last_operation=?)',time,id,id,op),
     q(db,'INSERT INTO hr_service_files (id,request_id,original_filename,mime_type,bytes,sha256,storage_key,uploaded_by,created_at,generated) SELECT ?,id,?,?,?,?,?,?,?,1 FROM hr_service_requests WHERE id=? AND last_operation=?',fid,name,'application/pdf',bytes.length,hash,key,ctx.user.userId,time,id,op)
    ],sourceGuard(r,source));return json({request:view(updated,true)});}catch(e){await env.PROFILE_FILES.delete(key);throw e}
   }
   if(b.action==='approveLetter'){
    if(!isLetter(r)||!['Submitted','In Review','Approved'].includes(r.status))throw fail('Review the standard letter before approving it.',409);
    const saved=letterRecord(r),source=await letterSource(db,r);
    if(source.missing.length||!saved||saved.fingerprint!==source.fingerprint||b.fingerprint!==saved.fingerprint)throw fail('The employee details changed or the letter is incomplete. Reopen this request to generate and review the current letter before approving.',409);
    const f=await q(db,'SELECT * FROM hr_service_files WHERE id=? AND request_id=? AND generated=1 AND removed_at IS NULL',saved.fileId,id).first();
    if(!f||f.sha256!==saved.sha256||!env.PROFILE_FILES||!await env.PROFILE_FILES.get(f.storage_key))throw fail('The generated letter is unavailable. Regenerate it before approval.',409);
    const now=stamp(),updated=await change(db,ctx,r,"status='Issued',approved_by=?,approved_at=?,issued_by=?,issued_at=?",[ctx.user.email,now,ctx.user.email,now],'Approved and issued','Admin reviewed and approved the generated English letter. It is now available to the requesting employee.',[],sourceGuard(r,source));return json({request:view(updated,true)});
   }
   if(b.action==='saveDraft'){sets='draft_reply=?,internal_notes=?,'+approvedReset();values=[trim(b.reply,8000,'Draft reply'),trim(b.internalNotes,8000,'Internal notes')];type='Draft prepared';message='Admin prepared a reply; it is not yet issued.'}
   else if(b.action==='review'){sets=approvedReset();type='In Review';message='P&C is reviewing this request.'}
   else if(b.action==='needInformation'){if(!note)throw fail('Explain which additional information is needed.');sets="status='Needs Information',approved_by=NULL,approved_at=NULL";type='Information requested';message=note}
   else if(b.action==='reject'){if(!note)throw fail('Give a reason for rejecting this request.');sets="status='Rejected',approved_by=NULL,approved_at=NULL";type='Rejected';message=note}
   else if(b.action==='approve'){
    if(!['Submitted','In Review'].includes(r.status))throw fail('Review this request before approving it.',409);
    const count=await q(db,'SELECT COUNT(*) AS n FROM hr_service_files WHERE request_id=? AND removed_at IS NULL',id).first();if(!r.draft_reply.trim()&&!count.n)throw fail('Prepare a reply or upload the final document before approving.');sets="status='Approved',approved_by=?,approved_at=?";values=[ctx.user.email,stamp()];type='Approved';message='Admin approved the prepared response. It is awaiting issue.';
   }else if(b.action==='issue'){
    if(r.status!=='Approved'||!r.approved_by||!r.approved_at)throw fail('Admin approval is required before issue.',409);sets="status='Issued',issued_by=?,issued_at=?";values=[ctx.user.email,stamp()];type='Issued';message='The approved response and documents are now available to the requesting employee.';
   }else throw fail('Choose a valid admin action.');
   const updated=await change(db,ctx,r,sets,values,type,message);return json({request:view(updated,true)});
  }
  throw fail('Method not allowed.',405);
 }catch(e){if(!e.status)console.error('HR Service Desk operation failed',e.name);return json({error:e.status?e.message:'The HR Service Desk could not complete this operation. Your existing request is retained; refresh and try again.'},e.status||500)}
}
