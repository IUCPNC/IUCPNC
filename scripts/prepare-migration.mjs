import fs from 'node:fs';
import {sheetRecords} from '../worker/sheets-model.js';
import {validateSection} from '../worker/profile-schema.js';
const [input,output]=process.argv.slice(2);
const tables=new Map(Object.entries(JSON.parse(fs.readFileSync(input,'utf8'))));
const records=sheetRecords(tables),employees=new Map(),issues=[],counts={};
for(const r of records.values()){
 counts[r.ds.id]=(counts[r.ds.id]||0)+1;
 if(!employees.has(r.employeeId))employees.set(r.employeeId,{employeeId:r.employeeId,sections:{},mpc:[],documents:[]});
 const e=employees.get(r.employeeId);
 if(r.ds.id==='directory')e.employee={employeeId:r.employeeId,employeeName:r.value.employee_name,email:r.value.email,position:r.value.position,department:r.value.department,appraiser:r.value.appraiser};
 else if(r.ds.id==='directory_state')e.active=r.value.active;
 else if(r.ds.id==='mpc')e.mpc.push({id:r.id,...r.value});
 else if(r.ds.id==='documents')e.documents.push({id:r.id,...r.value});
 else if(r.ds.section){const s=e.sections[r.ds.section]??={};if(r.ds.collection)(s[r.ds.collection]??=[]).push({...r.value,recordId:r.id});else Object.assign(s,r.value);}
}
const ready=[];
for(const e of employees.values()){
 if(!e.employee){issues.push({employeeId:e.employeeId,reason:'No Employee Master row; retained for review'});continue;}
 const missing=Object.entries(e.employee).filter(([,v])=>!v).map(([k])=>k);if(missing.length){issues.push({employeeId:e.employeeId,reason:'Missing required directory fields: '+missing.join(', ')});continue;}
 const sections={};for(const [key,value]of Object.entries(e.sections)){try{sections[key]=validateSection(key,value)}catch(error){issues.push({employeeId:e.employeeId,section:key,reason:error.message});}}
 ready.push({...e,sections});
}
fs.writeFileSync(output,JSON.stringify({source:'Authorised IUC People Master Database export',preparedAt:new Date().toISOString(),employees:ready,issues,counts}));
console.log(JSON.stringify({employees:ready.length,issues,counts}));
