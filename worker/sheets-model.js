import {positionData} from './position-core.js';
import {managedPositionFields} from './position-sync.js';
import {SCALAR_MAP} from './sheets-field-map.js';
import {PROFILE_SECTIONS} from './profile-schema.js';
import {recordIds} from './profile-record-ids.js';
export const SHEET_ID='1MjFoy_Uo95w7t6rJ04CC5rQT2wd3o6jmVjxyQCD5gQg';
export const SITE_ORIGIN='https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site';
export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function merge(base,site,sheet){
 if(equal(site,sheet))return {action:'equal',value:site};
 if(base&&site&&!sheet)return equal(base,site)?{action:'delete',value:null}:{action:'conflict',reason:'The Sheet row was deleted while the Site record changed'};
 if(!site||!sheet)return {action:!base&&site&&!sheet?'push':'conflict',reason:!site?'New Sheet record needs P&C review':'A previously synchronised row is missing'};
 if(!base)return {action:'conflict',reason:'Initial values differ; choose the correct source'};
 const out={},conflicts=[];
 for(const key of Object.keys(site)){
  const a=site[key],b=sheet[key],old=base[key];
  if(equal(a,b)||equal(b,old))out[key]=a;
  else if(equal(a,old))out[key]=b;
  else conflicts.push(key);
 }
 if(conflicts.length)return {action:'conflict',reason:'Both sides changed: '+conflicts.join(', ')};
 return {action:equal(out,site)?'push':equal(out,sheet)?'pull':'both',value:out};
}
// Preserve independent edits; resolve collisions deterministically without a review queue.
export function mergeAutomatic(base,site,sheet,{readOnly=false,priority='sheet',lockedKeys=[]}={}){
 if(equal(site,sheet))return {action:'equal',value:site};
 if(readOnly)return site?{action:'push',value:site}:{action:'conflict',reason:'This Site-owned record has no source. Remove the extra Sheet row or create it in its owning workflow.'};
 if(!site&&sheet)return {action:'pull',value:sheet};
 if(site&&!sheet)return base?{action:'delete',value:null}:{action:'push',value:site};
 const out={};for(const key of new Set([...Object.keys(site||{}),...Object.keys(sheet||{})])){
  const a=site?.[key],b=sheet?.[key],old=base?.[key];
  if(lockedKeys.includes(key)||equal(a,b)||base&&equal(b,old))out[key]=a;
  else if(base&&equal(a,old))out[key]=b;
  else if(!base&&(b===''||b===null||b===undefined)&&(a!==''&&a!==null&&a!==undefined))out[key]=a;
  else if(!base&&(a===''||a===null||a===undefined))out[key]=b;
  else out[key]=priority==='site'?a:b;
 }
 return {action:equal(out,site)?'push':equal(out,sheet)?'pull':'both',value:out};
}
export function normal(value,type='text'){
 if(value===null||value===undefined||value==='')return '';
 if(type==='number'){const n=Number(value);if(!Number.isFinite(n))throw new Error('Invalid numeric cell');return n;}
 if(type==='date'&&typeof value==='number')return new Date(Date.UTC(1899,11,30)+Math.round(value)*86400000).toISOString().slice(0,10);
 return String(value).trim();
}
const col=(key,col,type='text')=>({key,col,type});
const collection=(section,name,table,idCol,employeeCol,fields,kind,kindCol)=>({id:section+'.'+name,section,collection:name,table,idCol,employeeCol,fields:fields.map(([k,c])=>col(k,c,PROFILE_SECTIONS.find(s=>s.key===section).collections.find(x=>x.key===name).fields.find(f=>f.key===k).type)),kind,kindCol});
export const DATASETS=[
 {id:'directory',table:'PeopleCoreRecords',idCol:0,employeeCol:0,fields:[col('employee_name',1),col('email',3),col('position',4),col('department',5),col('appraiser',6)]},
 {id:'directory_state',table:'PeopleCoreRecords',idCol:0,employeeCol:0,readOnly:true,fields:[col('active',26),col('photoUrl',27),col('profileUrl',28),col('updated_at',29)]},
 ...Object.entries(SCALAR_MAP).map(([section,m])=>({id:section,section,table:m.table,idCol:0,employeeCol:0,fields:Object.entries(m.fields).map(([key,f])=>({key,...f}))})),
 collection('compensation','payrollPayments','NetPayHistoryIntegrated',0,1,[['period',3],['netPay',4],['notes',5]]),
 collection('compensation','salaryHistory','SalaryRevisionHistoryIntegrated',0,1,[['effectiveDate',3],['basicSalary',4],['reason',5]]),
 collection('attendance','otherLeave','AdditionalLeave',0,1,[['category',3],['entitlement',4],['taken',5],['balance',6]]),
 collection('performance','reviews','PerformanceHistory',17,0,[['date',5],['period',6],['rating',12],['comments',13]],'Previous review',2),
 collection('learning','training','DevelopmentPortfolio',9,0,[['title',3],['provider',5],['date',6],['cpdHours',7],['verificationStatus',8],['reportedHours',10],['hours',11],['category',12],['cost',13],['certification',14],['certificateDocumentId',15],['skills',16],['notes',17]],'Training',2),
 collection('qualifications','academic','DevelopmentPortfolio',9,0,[['qualification',3],['level',4],['institution',5],['certificateDocumentId',15],['field',18],['country',19],['year',20],['transcriptDocumentId',22]],'Academic qualification',2),
 collection('qualifications','professional','DevelopmentPortfolio',9,0,[['qualification',3],['body',5],['date',6],['certificateDocumentId',15],['expiry',21]],'Professional qualification',2),
 collection('skills','skills','DevelopmentPortfolio',9,0,[['skill',3],['level',4],['years',23],['evidence',24]],'Skill',2),
 collection('employment','employmentHistory','EmploymentJourney',0,1,[['date',3],['event',4],['position',5],['department',6],['notes',7]],'employment',8),
 collection('timeline','journey','EmploymentJourney',0,1,[['date',3],['event',4],['details',7]],'timeline',8),
 collection('relations','cases','RelationsCases',0,1,[['date',3],['type',4],['status',5],['details',6],['outcome',7],['documentId',8]]),
 {id:'mpc',table:'PerformanceHistory',idCol:17,employeeCol:0,kind:'Monthly MPC',kindCol:2,readOnly:true,fields:[col('reporting_year',3,'number'),col('month',4,'number'),col('kpi_score',7,'number'),col('values_rating',8,'number'),col('cpd_rating',9,'number'),col('social_rating',10,'number'),col('overall_score',11,'number'),col('performance_band',12),col('check_in_status',14),col('employee_acknowledgment',15),col('appraiser_confirmation',16),col('updated_at',19)]},
 {id:'documents',table:'Documents',idCol:0,employeeCol:1,readOnly:true,fields:[col('employee_name',2),col('category',3),col('visibility',4),col('bytes',5,'number'),col('url',6)]},
];
export const keyFor=(dataset,employee,id)=>JSON.stringify([dataset,employee,id]);
export const project=(ds,data)=>Object.fromEntries(ds.fields.map(f=>[f.key,normal(data?.[f.key],f.type)]));
export async function siteRecords(db){
 const [employees,sections,mpc,documents]=await Promise.all([
  db.prepare('SELECT * FROM employees').all(),db.prepare('SELECT * FROM employee_profile_sections').all(),
  db.prepare('SELECT * FROM mpc_submissions').all(),
  db.prepare('SELECT p.*,d.deleted_at FROM profile_documents p JOIN document_assets d ON d.document_id=p.document_id WHERE d.deleted_at IS NULL').all(),
 ]);
 const positions=await positionData(db);
 const byEmployee=new Map(employees.results.map(e=>[e.employee_id,{employee:e,sections:{},versions:{}}]));
 for(const s of sections.results){const e=byEmployee.get(s.employee_id);if(e){e.sections[s.section]=await recordIds(s.employee_id,s.section,JSON.parse(s.data_json));e.versions[s.section]=s.version;}}
 for(const e of byEmployee.values())e.positionManagedFields=managedPositionFields(e.employee,positions);
 const records=new Map();
 const add=(ds,e,id,data)=>{const key=keyFor(ds.id,e.employee.employee_id,id);records.set(key,{key,ds,employeeId:e.employee.employee_id,id,value:project(ds,data),context:e});};
 for(const ds of DATASETS)for(const e of byEmployee.values()){
  if(ds.id==='directory')add(ds,e,e.employee.employee_id,e.employee);
  else if(ds.id==='directory_state')add(ds,e,e.employee.employee_id,{active:e.employee.active?'Yes':'No',photoUrl:documents.results.some(d=>d.employee_id===e.employee.employee_id&&d.category==='Profile Photo')?SITE_ORIGIN+'/api/people-hub/photos/'+encodeURIComponent(e.employee.employee_id):'',profileUrl:SITE_ORIGIN+'/admin/profiles?employeeId='+encodeURIComponent(e.employee.employee_id),updated_at:e.employee.updated_at});
  else if(ds.id==='mpc'){for(const r of mpc.results.filter(r=>r.employee_id===e.employee.employee_id))add(ds,e,r.id,r);}
  else if(ds.id==='documents'){for(const r of documents.results.filter(r=>r.employee_id===e.employee.employee_id))add(ds,e,r.document_id,{...r,employee_name:e.employee.employee_name,url:SITE_ORIGIN+'/api/profiles/'+encodeURIComponent(r.employee_id)+'/documents/'+encodeURIComponent(r.document_id)});}
  else if(ds.collection){for(const r of e.sections[ds.section]?.[ds.collection]||[])add(ds,e,r.recordId,r);}
  else{
   const data={...e.sections[ds.section]};
   if(ds.id==='overview'){data.employmentStatus||=e.employee.active?'Active':'Exited';data.businessUnit||=e.sections.employment?.faculty||'';}
   if(ds.id==='employment')data.noticePeriod||=e.sections.exit?.noticePeriod||'';
   add(ds,e,e.employee.employee_id,data);
  }
 }
 return {records,byEmployee};
}
export function sheetRecords(tables){
 const records=new Map();
 for(const ds of DATASETS){
  const table=tables.get(ds.table);if(!table)throw new Error('Required workbook table is missing: '+ds.table);
  for(const [index,values] of table.rows.entries()){
   const employeeId=normal(values[ds.employeeCol]),id=normal(values[ds.idCol]);
   if(!employeeId&&!id){if(ds.fields.some(f=>normal(values[f.col],f.type)!==''))throw new Error('Employee ID or stable record ID missing in '+ds.table+' row '+(table.start+index+2));continue;}
   if(ds.kind&&normal(values[ds.kindCol])!==ds.kind)continue;
   if(!employeeId||!id)throw new Error('Employee ID or stable record ID missing in '+ds.table+' row '+(table.start+index+2));
   const key=keyFor(ds.id,employeeId,id);if(records.has(key))throw new Error('Duplicate record ID in '+ds.table);
   const value=Object.fromEntries(ds.fields.map(f=>[f.key,normal(values[f.col],f.type)]));
   records.set(key,{key,ds,employeeId,id,value,row:table.start+index+1,table});
  }
 }
 return records;
}
