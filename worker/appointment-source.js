// SQL form of position-model's approved appointment state. All consumers keep
// the existing Position & Role Library as the source; no permissions are inferred.
const roleStart="CASE WHEN json_extract(l.data_json,'$.entityAssignment')=1 THEN json_extract(x.data_json,'$.effectiveDate') ELSE json_extract(l.data_json,'$.effectiveDate') END";
const roleEnd="CASE WHEN json_extract(l.data_json,'$.entityAssignment')=1 THEN json_extract(x.data_json,'$.expiryDate') ELSE json_extract(l.data_json,'$.expiryDate') END";
export const APPOINTMENT_FROM="position_assignments p JOIN position_library l ON l.id=p.role_id LEFT JOIN position_entities x ON x.id=COALESCE(NULLIF(json_extract(p.data_json,'$.entityId'),''),NULLIF(json_extract(l.data_json,'$.entityId'),''),NULLIF(json_extract(l.data_json,'$.committeeId'),''),NULLIF(json_extract(l.data_json,'$.projectId'),''))";
export const APPOINTMENT_START="max(p.start_date,COALESCE(NULLIF("+roleStart+",''),p.start_date),COALESCE(NULLIF(json_extract(x.data_json,'$.effectiveDate'),''),p.start_date))";
export const APPOINTMENT_END="min(COALESCE(NULLIF(p.end_date,''),'9999-12-31'),COALESCE(NULLIF("+roleEnd+",''),'9999-12-31'),COALESCE(NULLIF(json_extract(x.data_json,'$.expiryDate'),''),'9999-12-31'))";
export const APPROVED_APPOINTMENT="p.status='Assigned' AND (CASE WHEN json_extract(l.data_json,'$.entityAssignment')=1 THEN x.status ELSE l.status END)='Active' AND (COALESCE(NULLIF(json_extract(p.data_json,'$.entityId'),''),NULLIF(json_extract(l.data_json,'$.entityId'),''),NULLIF(json_extract(l.data_json,'$.committeeId'),''),NULLIF(json_extract(l.data_json,'$.projectId'),'')) IS NULL OR x.status='Active')";
export const CURRENT_APPOINTMENT=APPROVED_APPOINTMENT+" AND "+APPOINTMENT_START+"<=date('now','+8 hours') AND "+APPOINTMENT_END+">=date('now','+8 hours')";
export async function approvedAppointments(db,ids,span=null){
 if(!ids.length)return [];
 const day=new Date(Date.now()+28800000).toISOString().slice(0,10),from=span?.from||day,to=span?.to||day;
 const sql="SELECT p.id,p.employee_id,p.role_id,p.is_primary,p.status,p.version,l.version AS role_version,x.version AS entity_version,CASE WHEN json_extract(l.data_json,'$.entityAssignment')=1 THEN x.name||' — '||json_extract(l.data_json,'$.capacity') ELSE COALESCE(NULLIF(json_extract(l.data_json,'$.displayTitle'),''),l.title) END AS title,l.type,"+APPOINTMENT_START+" AS start_date,CASE WHEN "+APPOINTMENT_END+"='9999-12-31' THEN NULL ELSE "+APPOINTMENT_END+" END AS end_date FROM "+APPOINTMENT_FROM+" WHERE p.employee_id IN (SELECT value FROM json_each(?)) AND "+APPROVED_APPOINTMENT+" AND "+APPOINTMENT_START+"<=? AND "+APPOINTMENT_END+">=? ORDER BY p.is_primary DESC,p.start_date,p.id";
 return (await db.prepare(sql).bind(JSON.stringify(ids),to,from).all()).results;
}
