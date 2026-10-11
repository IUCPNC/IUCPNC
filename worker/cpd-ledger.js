// Ledger writes and attendance are committed together. Repeated scans never add hours.
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
export function creditRow(c){return {recordId:c.id,sourceType:c.source_type,sourceId:c.source_id,title:c.title,provider:c.provider,date:String(c.attended_at).slice(0,10),hours:Number(c.hours),cpdHours:c.voided_at?0:Number(c.hours),verificationStatus:c.voided_at?'Rejected':'Approved',category:c.category,notes:'Managed in CPD & Training.'}}
export function mergeProfileCredits(training,credits){
 const rows=Array.isArray(training)?training:[],ids=new Set(credits.map(c=>c.id)),sources=new Set(credits.map(c=>`${c.source_type}:${c.source_id}`));
 return [...rows.filter(r=>!ids.has(r.recordId)&&!sources.has(`${r.sourceType}:${r.sourceId}`)),...credits.map(c=>({...rows.find(r=>r.recordId===c.id||r.sourceType===c.source_type&&r.sourceId===c.source_id),...creditRow(c)}))];
}
export async function saveAttendance(db,user,activity,employeeId,{scan=false}={}){
 const stamp=new Date().toISOString(),attendanceId=crypto.randomUUID(),creditId=crypto.randomUUID();
 const condition=scan?"AND a.qr_token=? AND a.qr_active=1 AND a.status IN ('Open','Ongoing') AND a.starts_at<=? AND a.ends_at>=? AND (a.max_participants IS NULL OR (SELECT COUNT(*) FROM cpd_attendance ca WHERE ca.activity_id=a.id AND ca.voided_at IS NULL)<a.max_participants)":"";
 const write=q(db,`INSERT INTO cpd_attendance (id,activity_id,employee_id,attended_at,credited_hours,source,created_by,created_email)
 SELECT ?,a.id,?,?,a.cpd_hours,?,?,? FROM cpd_activities a WHERE a.id=? ${condition}
 ON CONFLICT(activity_id,employee_id) DO UPDATE SET attended_at=excluded.attended_at,credited_hours=excluded.credited_hours,source=excluded.source,created_by=excluded.created_by,created_email=excluded.created_email,voided_at=NULL,voided_by=NULL WHERE cpd_attendance.voided_at IS NOT NULL`,attendanceId,employeeId,stamp,scan?'QR':'P&C adjustment',user.userId,user.email,activity.id,...(scan?[activity.qr_token,stamp,stamp]:[]));
 // This runs in the same transaction, including when repairing a repeated request.
 const credit=q(db,`INSERT INTO cpd_credits (id,employee_id,source_type,source_id,title,provider,attended_at,hours,category,created_by,created_email,created_at)
 SELECT ?,c.employee_id,'activity',a.id,a.title,a.provider,a.starts_at,c.credited_hours,a.category,?,?,? FROM cpd_attendance c JOIN cpd_activities a ON a.id=c.activity_id
 WHERE c.activity_id=? AND c.employee_id=? AND c.voided_at IS NULL
 ON CONFLICT(employee_id,source_type,source_id) DO UPDATE SET voided_at=NULL,voided_by=NULL,hours=excluded.hours WHERE cpd_credits.voided_at IS NOT NULL`,creditId,user.userId,user.email,stamp,activity.id,employeeId);
 const complete=q(db,`UPDATE cpd_requests SET status='Completed',completed_at=?,updated_at=? WHERE activity_id=? AND employee_id=? AND status='Approved' AND EXISTS(SELECT 1 FROM cpd_attendance WHERE activity_id=? AND employee_id=? AND voided_at IS NULL)`,stamp,stamp,activity.id,employeeId,activity.id,employeeId);
 const log=q(db,`INSERT INTO cpd_audit (id,actor_id,actor_email,action,activity_id,employee_id,detail_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cpd_attendance WHERE activity_id=? AND employee_id=? AND attended_at=?)`,crypto.randomUUID(),user.userId,user.email,scan?'qr_attendance_recorded':'attendance_added',activity.id,employeeId,'{}',stamp,activity.id,employeeId,stamp);
 const result=await db.batch([write,credit,complete,log]);
 const row=await q(db,"SELECT * FROM cpd_credits WHERE employee_id=? AND source_type='activity' AND source_id=? AND voided_at IS NULL",employeeId,activity.id).first();
 return {changed:!!result[0].meta?.changes,credit:row};
}
export async function completeRequest(db,user,req,hours,at,note){
 const stamp=new Date().toISOString(),sourceType=req.activity_id?'activity':'request',sourceId=req.activity_id||req.id;
 const result=await db.batch([
  q(db,"UPDATE cpd_requests SET status='Completed',completed_at=?,updated_at=?,decision_note=? WHERE id=? AND status='Approved'",at,stamp,note,req.id),
  q(db,`INSERT INTO cpd_credits (id,employee_id,source_type,source_id,title,provider,attended_at,hours,category,created_by,created_email,created_at)
  SELECT ?,r.employee_id,?,?,r.title,r.provider,?,?,r.category,?,?,? FROM cpd_requests r WHERE r.id=? AND r.status='Completed'
  ON CONFLICT(employee_id,source_type,source_id) DO NOTHING`,crypto.randomUUID(),sourceType,sourceId,at,hours,user.userId,user.email,stamp,req.id),
  q(db,`INSERT INTO cpd_audit (id,actor_id,actor_email,action,request_id,employee_id,detail_json,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cpd_requests WHERE id=? AND status='Completed' AND updated_at=?)`,crypto.randomUUID(),user.userId,user.email,'training_completed',req.id,req.employee_id,JSON.stringify({hours}),stamp,req.id,stamp)
 ]);
 return {changed:!!result[0].meta?.changes,credit:await q(db,'SELECT * FROM cpd_credits WHERE employee_id=? AND source_type=? AND source_id=? AND voided_at IS NULL',req.employee_id,sourceType,sourceId).first()};
}
