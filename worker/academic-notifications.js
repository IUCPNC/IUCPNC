import {q,rows,notices,today} from './academic-core.js';
// Reuse the existing notification collection/mail runner. One source key per reminder.
export async function academicReminderStatements(env){
 const db=env.DB,ss=[],sessions=await rows(db,"SELECT id,employee_id,programme_id,date,start_time,status FROM academic_sessions WHERE publication='Published' AND status='Scheduled' AND datetime(date||'T'||start_time||':00+08:00')>=datetime('now') AND datetime(date||'T'||start_time||':00+08:00')<=datetime('now','+1 day') ORDER BY date,start_time LIMIT 100");
 for(const s of sessions)ss.push(...await notices(db,[s.employee_id],s.id+':upcoming:'+s.date+':'+s.start_time,'Your published timetable has an upcoming class.'));
 const awaiting=await rows(db,"SELECT id,programme_id,version FROM academic_sessions WHERE status='Lecturer Submitted' OR revision_json IS NOT NULL ORDER BY updated_at LIMIT 50");
 for(const s of awaiting){const gg=await rows(db,"SELECT DISTINCT employee_id FROM academic_grants WHERE role='approver' AND (scope='*' OR scope=?) AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)",s.programme_id,today(),today());ss.push(...await notices(db,gg.map(g=>g.employee_id),s.id+':review:'+s.version,'An academic teaching record or timetable revision needs review.'));}
 return ss;
}
