const normal=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function directoryOrganisation(employees){
 const staff=employees.filter(e=>Number(e.active)===1),issues=[];
 const positions=staff.map(e=>({id:'employee:'+e.employee_id,employeeId:e.employee_id,title:e.position||'Position not recorded',department:e.department||'',code:e.employee_id,grade:'',occupancy:'Filled',parentId:'',directoryManaged:true}));
 const byEmployee=new Map(positions.map(p=>[p.employeeId,p]));
 for(const e of staff){
  const ref=normal(e.appraiser);if(!ref)continue;
  let matches=staff.filter(m=>[m.employee_id,m.email,m.employee_name].some(v=>normal(v)===ref));
  // A position title is only resolved when the directory explicitly names that title as the reporting manager.
  if(!matches.length)matches=staff.filter(m=>normal(m.position)===ref);
  if(matches.length!==1){issues.push({employeeId:e.employee_id,reason:matches.length?'Reporting manager is ambiguous':'Reporting manager is not in the active directory'});continue;}
  if(matches[0].employee_id===e.employee_id){issues.push({employeeId:e.employee_id,reason:'Employee cannot report to themselves'});continue;}
  byEmployee.get(e.employee_id).parentId=byEmployee.get(matches[0].employee_id).id;
 }
 const byId=new Map(positions.map(p=>[p.id,p]));
 for(const p of positions){const seen=new Set([p.id]);let parent=p.parentId;while(parent){if(seen.has(parent)){issues.push({employeeId:p.employeeId,reason:'Circular reporting line requires P&C review'});p.parentId='';break;}seen.add(parent);parent=byId.get(parent)?.parentId;}}
 return {positions,issues};
}
