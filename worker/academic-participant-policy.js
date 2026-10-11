import {ACTIVE} from './connect-core.js';
// r is an academic appointment; person is its canonical Person Master identity.
// No external visitor is added to Employee Master or given an employee role.
export const PARTICIPANT_CURRENT=`r.kind='participant' AND r.status='Published' AND person.archived_at IS NULL
 AND json_extract(r.data_json,'$.effective')<=date('now','+8 hours')
 AND json_extract(r.data_json,'$.expires')>=date('now','+8 hours')
 AND json_extract(r.data_json,'$.category') IN ('student-supervisor','part-time-supervisor','external-academic-examiner','external-industry-advisor','external-academic-advisor')
 AND (json_extract(r.data_json,'$.category')<>'part-time-supervisor' OR (r.employee_id IS NOT NULL AND EXISTS(SELECT 1 FROM employee_profile_sections ep WHERE ep.employee_id=r.employee_id AND (ep.section='employment' AND json_extract(ep.data_json,'$.workingTime')='Part-time' OR ep.section='overview' AND json_extract(ep.data_json,'$.employmentType')='Part-Time' AND NOT EXISTS(SELECT 1 FROM employee_profile_sections recorded WHERE recorded.employee_id=r.employee_id AND recorded.section='employment' AND nullif(json_extract(recorded.data_json,'$.workingTime'),'') IS NOT NULL)))))
 AND json_extract(r.data_json,'$.conflictStatus') IN ('Cleared','Managed')
 AND lower(json_extract(r.data_json,'$.identityEmail'))=lower(person.primary_email)
 AND (json_extract(r.data_json,'$.category')<>'external-academic-examiner' OR (json_extract(r.data_json,'$.independenceReviewed')=1 AND json_extract(r.data_json,'$.conflictStatus')='Cleared'))
 AND (r.employee_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM employees e WHERE e.person_id=person.person_id AND ${ACTIVE}))
 AND json_extract(r.data_json,'$.decision.by') IS NOT NULL
 AND lower(json_extract(r.data_json,'$.decision.by'))<>lower(person.primary_email)
 AND (r.employee_id IS NULL OR EXISTS(SELECT 1 FROM employees e WHERE e.employee_id=r.employee_id AND e.person_id=person.person_id AND ${ACTIVE} AND e.account_user_id=json_extract(r.data_json,'$.accountUserId')))
 AND EXISTS(SELECT 1 FROM academic_records programme WHERE programme.id=r.programme_id AND programme.kind='programme' AND programme.status='Published')`;
