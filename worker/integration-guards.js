// Read-only assertions inside a D1 batch. A stale snapshot raises a SQL error,
// rolling back every projection, canonical record and audit/event in that batch.
const allowed=new Set(['employees','employment_records','employee_profile_sections','position_employee_sync','position_library','position_assignments','position_entities']);
export function snapshotGuard(db,table,expected,key=null,value=null){
 if(!allowed.has(table)||key&&!['employee_id'].includes(key))throw Error('Invalid integration guard');
 const json=JSON.stringify(expected),columns=Object.keys(expected[0]||{});if(columns.some(c=>!/^\w+$/.test(c)))throw Error('Invalid snapshot column');
 const scope=key?' WHERE '+key+'=?':'',difference=columns.length?columns.map(c=>'actual.'+c+' IS NOT json_extract(snapshot.value,\'$.'+c+'\')').join(' OR '):'0';
 const sql='SELECT CASE WHEN (SELECT count(*) FROM '+table+scope+')=? AND NOT EXISTS(SELECT 1 FROM '+table+' actual'+(key?' WHERE actual.'+key+'=? AND ':' WHERE ')+'NOT EXISTS(SELECT 1 FROM json_each(?) snapshot WHERE NOT ('+difference+'))) THEN 1 ELSE json(\'integration_conflict\') END AS integration_guard';
 return db.prepare(sql).bind(...(key?[value,expected.length,value,json]:[expected.length,json]));
}
