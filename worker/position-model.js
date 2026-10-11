// Shared appointment rules for profiles, cards, reports and Sheet exports.
export const roleTitle=r=>r?.data?.displayTitle||r?.title||'';
export const concreteDepartment=(value,fallback='')=>!value||/^(Relevant |All |Various |As applicable)/i.test(value)?fallback:value;
export const normalise=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
export const libraryRoles=data=>data.roles.filter(r=>!r.data?.entityAssignment);
export function resolvedRole(role,data){
 if(!role?.data?.entityAssignment)return role;
 const entity=data.entities.find(e=>e.id===role.data.entityId);if(!entity)return {...role,status:'Inactive'};
 return {...role,title:entity.name+' — '+role.data.capacity,department:entity.kind,status:entity.status,data:{...role.data,displayTitle:entity.name+' — '+role.data.capacity,effectiveDate:entity.data.effectiveDate||null,expiryDate:entity.data.expiryDate||null,publicEligible:entity.data.publicEligible??role.data.publicEligible??false}};
}
export function appointmentState(a,data,today){
 const role=resolvedRole(data.roles.find(r=>r.id===a.role_id),data),entityId=a.data?.entityId||role?.data?.entityId||role?.data?.committeeId||role?.data?.projectId,entity=entityId?data.entities.find(e=>e.id===entityId):null;
 const startDate=[a.start_date,role?.data?.effectiveDate,entity?.data?.effectiveDate].filter(Boolean).sort().at(-1)||a.start_date;
 const endDate=[a.end_date,role?.data?.expiryDate,entity?.data?.expiryDate].filter(Boolean).sort()[0]||null;
 let period='Current',reason='';
 if(a.status!=='Assigned'){period='Historical';reason='Appointment ended';}
 else if(endDate&&endDate<today){period='Historical';reason='Appointment or role expired';}
 else if(!role||['Inactive','Archived'].includes(role.status)||entityId&&(!entity||['Inactive','Archived'].includes(entity.status))){period='Historical';reason='Role or institutional entity inactive';}
 else if(startDate>today||role.status!=='Active'||entity&&entity.status!=='Active'){period='Upcoming';reason='Awaiting effective date or activation';}
 return {role,entity,startDate,endDate,period,reason,current:period==='Current'};
}
export const appointmentOrder=(a,b)=>Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary))||String(a.employeeName||a.employee_id).localeCompare(String(b.employeeName||b.employee_id))||String(a.title||roleTitle(a.role)).localeCompare(String(b.title||roleTitle(b.role)))||String(b.start_date).localeCompare(String(a.start_date))||a.id.localeCompare(b.id);
export function appointmentWork(a,data,employees,today){
 const s=appointmentState(a,data,today),employee=employees.find(e=>e.employee_id===a.employee_id);
 let manager=employees.find(e=>e.employee_id===a.data?.reportingEmployeeId);
 if(!manager&&s.role?.data?.reportingPositionId){const parents=data.assignments.filter(p=>p.is_primary&&p.role_id===s.role.data.reportingPositionId&&p.employee_id!==a.employee_id&&appointmentState(p,data,today).current);if(parents.length===1)manager=employees.find(e=>e.employee_id===parents[0].employee_id);}
 return {...s,title:roleTitle(s.role),department:concreteDepartment(a.data?.department||s.role?.department,employee?.department),reportingManager:manager?.employee_name||employee?.appraiser||s.role?.data?.reportsTo||'',primary:Boolean(a.is_primary)};
}
export function documentState(d,data,today){
 if(d.status!=='Published')return d.status;
 if(d.expiry_date&&d.expiry_date<today)return 'Expired';
 if(d.effective_date>today)return 'Upcoming';
 const current=data.documents.filter(x=>x.role_id===d.role_id&&x.kind===d.kind&&x.status==='Published'&&x.effective_date<=today&&(!x.expiry_date||x.expiry_date>=today)).sort((a,b)=>b.version-a.version)[0];
 return current?.id===d.id?'Current':'Superseded';
}
