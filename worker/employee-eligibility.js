// Read-only eligibility shared by employee services. Approved exit dates take
// effect in Malaysia time without waiting for a directory maintenance write.
export const ACTIVE="e.active=1 AND NOT EXISTS (SELECT 1 FROM employee_profile_sections s WHERE s.employee_id=e.employee_id AND s.section='overview' AND json_extract(s.data_json,'$.employmentStatus') IN ('Exited','Resigned','Alumni')) AND NOT EXISTS (SELECT 1 FROM employee_profile_sections s WHERE s.employee_id=e.employee_id AND s.section='exit' AND json_extract(s.data_json,'$.autoLifecycle')='Enabled' AND json_extract(s.data_json,'$.lastWorkingDay')<date('now','+8 hours'))";

export async function currentEmployee(env,user){
 if(!user||!env.DB)return null;
 const matches=(await env.DB.prepare('SELECT e.employee_id,e.employee_name,e.email,e.department,e.position,e.account_user_id FROM employees e WHERE lower(e.email)=lower(?) AND '+ACTIVE+' LIMIT 2').bind(user.email).all()).results;
 if(matches.length!==1)return null;
 const e=matches[0];if(e.account_user_id&&e.account_user_id!==user.userId)return null;
 const {account_user_id,...employee}=e;return employee;
}
