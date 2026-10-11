export async function verifiedCpd(db,employeeId){
 const rows=(await db.prepare('SELECT id,title,attended_at,hours,category,source_type,source_id FROM cpd_credits WHERE employee_id=? AND voided_at IS NULL ORDER BY attended_at').bind(employeeId).all()).results;
 return rows.map(c=>({creditId:c.id,title:c.title,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.attended_at)),structuredHours:c.category==='Structured CPD'?Number(c.hours):0,nonStructuredHours:c.category==='Non-structured CPD'?Number(c.hours):0,sourceType:c.source_type,sourceId:c.source_id}));
}
export function mergeCpd(payload,credits){
 const year=String(payload?.employee?.year);
 return {...payload,months:(payload.months||[]).map((m,i)=>({...m,cpdManaged:credits.filter(c=>c.date.startsWith(`${year}-${String(i+1).padStart(2,'0')}`)),cpd:(m.cpd||[]).filter(c=>!c.creditId&&!c.sourceId)}))};
}
