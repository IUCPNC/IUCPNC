import {reconcilePositions} from './position-sync.js';
import {concreteDepartment,resolvedRole,appointmentState,appointmentWork,appointmentOrder,roleTitle} from './position-model.js';
import {businessDate,lifecycleStatus} from './profile-schema.js';
export const ROLE_TYPES=["Academic Appointment","Acting Appointment","Additional Appointment","Administrative Appointment","Committee Chair","Committee Deputy Chair","Committee Member","Committee Secretary","Ex-officio","External / Advisory / Consultancy","Primary Position","Program Coordinator","Program Manager","Project Manager","Project Member","Secondary Position","Special Appointment","Taskforce","Temporary Appointment","Working Group"];
export const DOC_KINDS=['Job Description','Terms of Reference','Role Description','Appointment Responsibilities','Committee TOR','Project Scope','Delegation of Authority','Functional Responsibilities'];
export const DOC_FIELDS=['Purpose','Responsibilities','Accountabilities','Authority','Internal relationships','External relationships','Performance expectations','KPIs','Academic qualifications','Professional qualifications','Experience','Competencies','Technical skills','Behavioural skills','Other requirements','Working conditions'];
export const DEFAULT_SETTINGS={acknowledgementDays:7,reminderDays:[1,3,7],expiryDays:[60,30,14,7],allowEmployeeDeclaredPublic:false};
export const q=(db,sql,...values)=>db.prepare(sql).bind(...values);
export const parse=r=>r?{...r,data:JSON.parse(r.data_json||'{}')}:null;
export const currentAssignment=(a,today=businessDate())=>a.status==='Assigned'&&a.start_date<=today&&(!a.end_date||a.end_date>=today);
export const currentRole=(r,today=businessDate())=>r?.status==='Active'&&(!r.data.effectiveDate||r.data.effectiveDate<=today)&&(!r.data.expiryDate||r.data.expiryDate>=today);
export function applicableDocuments(docs,today=businessDate()){
 const found=new Map();for(const d of docs.filter(d=>d.status==='Published'&&d.effective_date<=today&&(!d.expiry_date||d.expiry_date>=today)).sort((a,b)=>b.version-a.version))if(!found.has(d.kind))found.set(d.kind,d);
 return [...found.values()];
}
export async function positionData(db){
 const [r,a,d,acks,entities,settings]=await Promise.all(['SELECT * FROM position_library','SELECT * FROM position_assignments','SELECT id,role_id,version,kind,title,status,effective_date,review_date,expiry_date,approved_by,approved_at,filename,mime_type,content_hash,created_at,created_by FROM position_documents','SELECT * FROM position_acknowledgements','SELECT * FROM position_entities',"SELECT * FROM position_settings WHERE id='main'"].map(s=>db.prepare(s).all()));
 const data={roles:r.results.map(parse),assignments:a.results.map(parse),documents:d.results,acks:acks.results,entities:entities.results.map(parse),settings:{...DEFAULT_SETTINGS,...JSON.parse(settings.results[0]?.data_json||'{}')},settingsVersion:settings.results[0]?.version||0};Object.defineProperty(data,'sourceRows',{value:{position_library:r.results,position_assignments:a.results,position_entities:entities.results}});data.roles=data.roles.map(r=>resolvedRole(r,data));return data;
}
export function assignmentView(a,data,today=businessDate(),employees=[]){
 const work=appointmentWork(a,data,employees,today),{role}=work,documents=applicableDocuments(data.documents.filter(d=>d.role_id===a.role_id),today);
 const ended=work.period==='Historical',required=role?.data.acknowledgementRequired!==false&&!ended;
 const rows=documents.map(d=>{const ack=data.acks.find(x=>x.assignment_id===a.id&&x.document_id===d.id),prior=data.acks.some(x=>x.assignment_id===a.id&&data.documents.find(p=>p.id===x.document_id)?.kind===d.kind);const dueDate=new Date(Math.max(Date.parse(a.start_date),Date.parse(d.effective_date),Date.parse(d.approved_at||d.created_at))).getTime()+data.settings.acknowledgementDays*86400000;return {id:d.id,kind:d.kind,title:d.title,version:d.version,hash:d.content_hash,effectiveDate:d.effective_date,reviewDate:d.review_date,expiryDate:d.expiry_date,acknowledgedAt:ack?.acknowledged_at||null,status:ended?'Assignment Ended':!required?'Not Required':ack?'Acknowledged':Date.parse(today)>dueDate?'Overdue':prior?'Reacknowledgement Required':'Pending',dueDate:new Date(dueDate).toISOString().slice(0,10)}});
 const states=rows.map(x=>x.status),status=ended?'Assignment Ended':!required?'Not Required':!documents.length?'Document Required':states.includes('Overdue')?'Overdue':states.includes('Reacknowledgement Required')?'Reacknowledgement Required':states.includes('Pending')?'Pending':'Acknowledged';
 const ackHistory=data.acks.filter(x=>x.assignment_id===a.id).map(x=>{const doc=data.documents.find(d=>d.id===x.document_id);return {documentId:x.document_id,title:doc?.title,kind:doc?.kind,version:doc?.version,acknowledgedAt:x.acknowledged_at,status:ended?'Assignment Ended':rows.some(r=>r.id===x.document_id)?'Acknowledged':'Superseded',hash:x.document_hash};});
 return {...a,role,documents:rows,ackHistory,ackStatus:status,period:work.period,periodReason:work.reason,title:work.title,department:work.department,reportingManager:work.reportingManager,entityName:work.entity?.name||'',effectiveStartDate:work.startDate,effectiveEndDate:work.endDate};
}
export async function primaryProjection(db,employees,data=null,today=businessDate()){
 data ||= await positionData(db);const views=data.assignments.filter(a=>a.is_primary&&!data.roles.find(r=>r.id===a.role_id)?.data.entityAssignment&&appointmentState(a,data,today).current);
 return employees.map(e=>{const a=views.find(a=>a.employee_id===e.employee_id);if(!a)return e;const work=appointmentWork(a,data,employees,today);return {...e,position:work.title,department:work.department,appraiser:work.reportingManager||e.appraiser,positionId:work.role.id,assignmentId:a.id};});
}
export function publicQualifications(sections,today=businessDate(),allowDeclared=false){
 const qual=sections.qualifications||{};return ['academic','professional'].flatMap(kind=>(qual[kind]||[]).filter(r=>r.visibility==='Public'&&r.publishCard==='Yes'&&(r.verificationStatus==='Verified'||allowDeclared&&r.verificationStatus==='Employee Declared')&&(!r.expiry||r.expiry>=today)).map(r=>({kind,qualification:r.qualification||'',field:kind==='academic'?r.field||'':'',institution:kind==='academic'?r.institution||'':r.body||'',level:kind==='academic'?r.level||'':'',year:kind==='academic'?r.year||'':r.date?.slice(0,4)||''}))).filter(r=>r.qualification);
}
export async function professionalContact(db,e,data=null,publicOnly=true,sourceSections=null){
 data ||= await positionData(db);const today=businessDate(),sections=sourceSections||Object.fromEntries((await q(db,"SELECT section,data_json FROM employee_profile_sections WHERE employee_id=? AND section IN ('qualifications','professionalProfile','overview','exit')",e.employee_id).all()).results.map(r=>[r.section,JSON.parse(r.data_json)]));
 if(!e.active||['Exited','Alumni','Resigned'].includes(lifecycleStatus(sections,today)))return null;
 const active=data.assignments.filter(a=>a.employee_id===e.employee_id&&appointmentState(a,data,today).current).map(a=>({...a,role:appointmentState(a,data,today).role})).sort(appointmentOrder);
 const seen=new Set(),allowed=active.filter(a=>{if(publicOnly&&(a.visibility!=='Public'||!a.publish_card||a.role.data.publicEligible!==true))return false;if(seen.has(a.role_id))return false;seen.add(a.role_id);return true;});
 const primary=allowed.find(a=>a.is_primary),hasPrimary=active.some(a=>a.is_primary),p=sections.professionalProfile||{},can=k=>p[k+'Visibility']==='Public',qualifications=publicQualifications(sections,today,data.settings.allowEmployeeDeclaredPublic===true);
 // Existing basic work cards remain available. New optional fields require explicit publication choices.
 return {title:roleTitle(primary?.role)||(hasPrimary&&publicOnly?'':e.position),department:primary?concreteDepartment(primary.data.department||primary.role.department,e.department):(hasPrimary&&publicOnly?'':e.department),faculty:primary?.role.data.faculty||'',staffCategory:primary?.role.data.category||'',roles:allowed.map(a=>({title:roleTitle(a.role),type:a.role.type,primary:Boolean(a.is_primary),department:concreteDepartment(a.data.department||a.role.department,e.department),expiry:appointmentState(a,data,today).endDate||''})),qualifications,academicTitle:can('academicTitle')?p.academicTitle||'':'',professionalTitle:can('professionalTitle')?p.professionalTitle||'':'',biography:can('biography')?p.biography||'':'',expertise:can('expertise')?p.expertise||'':'',officePhone:can('officePhone')?p.officePhone||'':'',website:can('website')&&/^https:\/\//.test(p.website||'')?p.website:'',preferredName:can('preferredName')?p.preferredName||'':'',directoryVisible:p.publicDirectory==='Yes'};
}
export async function positionMaintenance(env,data=null){
 if(!env.DB)return;const db=env.DB,today=businessDate();data ||= await positionData(db);await reconcilePositions(env,data);const ops=[];
 for(const a of data.assignments){const view=assignmentView(a,data,today);if(view.period!=='Current')continue;
  const notify=(key,kind,message,doc=null)=>ops.push(q(db,'INSERT OR IGNORE INTO position_notifications (id,employee_id,assignment_id,document_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)',key,a.employee_id,a.id,doc,kind,message,new Date().toISOString()));
  for(const d of view.documents)if(!['Acknowledged','Not Required'].includes(d.status)){const start=Math.max(Date.parse(a.start_date),Date.parse(data.documents.find(x=>x.id===d.id)?.approved_at||a.created_at)),days=Math.floor((Date.parse(today)-start)/86400000);notify(a.id+':'+d.id+':assigned','Responsibilities','Read and acknowledge '+view.role.title+' · '+d.kind+' v'+d.version,d.id);for(const day of data.settings.reminderDays)if(days>=day)notify(a.id+':'+d.id+':ack-'+day,'Acknowledgement reminder',view.role.title+' · acknowledgement '+(d.status==='Overdue'?'overdue':'pending'),d.id);}
  if(view.effectiveEndDate){const left=Math.ceil((Date.parse(view.effectiveEndDate)-Date.parse(today))/86400000);for(const day of data.settings.expiryDays)if(left<=day)notify(a.id+':'+view.effectiveEndDate+':expiry-'+day,'Appointment expiry',roleTitle(view.role)+' ends '+view.effectiveEndDate+' · renewal review required');}
 }
 for(let i=0;i<ops.length;i+=50)await db.batch(ops.slice(i,i+50));
 await q(db,'DELETE FROM position_document_reads WHERE created_at<?',new Date(Date.now()-86400000).toISOString()).run();
}
