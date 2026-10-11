import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {profileRoute} from '../worker/profile-api.js';
import {validateSection,profileAlerts,lifecycleStatus} from '../worker/profile-schema.js';
export function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const name of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(`drizzle/${name}`,'utf8'));
 const db={prepare(sql){let params=[];return {bind(...args){params=args;return this},async first(){return sqlite.prepare(sql).get(...params)||null},async all(){return {results:sqlite.prepare(sql).all(...params)}},async run(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}}}}},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 for(const [id,name,email,account]of [['TEST-001','Example Employee','employee@example.test','employee-1'],['TEST-002','Second Example','second@example.test','employee-2']])sqlite.prepare('INSERT INTO employees (employee_id,employee_name,email,account_user_id,position,department,appraiser,active) VALUES (?,?,?,?,?,?,?,1)').run(id,name,email,account,'Executive','Finance','Example Manager');
 sqlite.prepare("INSERT INTO people (person_id,legal_name,primary_email) VALUES ('person-test','Example Employee','employee@example.test')").run();sqlite.prepare("INSERT INTO employment_records (employment_id,employee_id,person_id,employment_status) VALUES ('employment-test','TEST-001','person-test','active')").run();sqlite.prepare("UPDATE employees SET person_id='person-test',employment_id='employment-test' WHERE employee_id='TEST-001'").run();
 const objects=new Map(),r2={async put(k,b){objects.set(k,b)},async get(k){return objects.has(k)?{body:objects.get(k)}:null},async delete(k){objects.delete(k)}};
 return {sqlite,env:{DB:db,PROFILE_FILES:r2},objects};
}
export const employee={userId:'employee-1',email:'employee@example.test'},hr={userId:'hr-1',email:'hr@example.test'};
if(process.argv[1]?.endsWith('test-profiles.mjs')){
 const {sqlite,env,objects}=fixture();let checks=0;
 const request=async(path,user=hr,method='GET',body,headers={})=>profileRoute(new Request(`https://profile.test${path}`,{method,headers:{...(method==='GET'?{}:{origin:'https://profile.test','content-type':'application/json'}),...headers},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),env,{user,isPc:(_,email)=>email===hr.email});
 const status=async(promise,expected)=>{const r=await promise;assert.equal(r.status,expected,await r.clone().text());checks++;return r};
 env.PROFILE_TALENT_EMAILS='senior@example.test';const senior={userId:'senior-1',email:'senior@example.test'};
 await status(request('/api/profiles?scope=talent',employee),403);await status(request('/api/profiles?scope=talent',senior),200);await status(request('/api/profiles/TEST-001',senior),403);
 const talent=await(await status(request('/api/profiles/TEST-001?scope=talent',senior),200)).json();assert.deepEqual(Object.keys(talent.sections),['talent']);assert.equal(talent.employee.email,undefined);checks+=2;
 await status(request('/api/profiles/TEST-001/sections/talent?scope=talent',senior,'PUT',{data:{},version:0}),403);
 await status(request('/api/profiles',null),401);await status(request('/api/profiles',employee),403);await status(request('/api/profiles/TEST-002',employee),403);await status(request('/api/profiles/TEST-001/sections/personal',employee,'PUT',{data:{},version:0}),403);await status(request('/api/profiles/TEST-001/sections/personal',hr,'PUT',{data:{},version:0},{origin:'https://evil.test'}),403);
 await status(request('/api/profiles/TEST-001/sections/personal',hr,'PUT',{data:{nric:'900101-10-1234',passport:'SECRET1234',personalEmail:'employee@example.test',passportExpiry:'2026-10-15'},version:0}),200);
 await status(request('/api/profiles/TEST-001/sections/compensation',hr,'PUT',{data:{basicSalary:5000,bankAccount:'123456789',tax:'tax-private'},version:0}),200);
 for(const key of ['talent','relations'])await status(request(`/api/profiles/TEST-001/sections/${key}`,hr,'PUT',{data:key==='talent'?{retentionRisk:'CONFIDENTIAL'}:{cases:[{type:'Warning',details:'CONFIDENTIAL'}]},version:0}),200);
 const self=await(await status(request('/api/profiles/me',employee),200)).json();assert.equal(self.sections.personal.nric,'****--1234');assert.equal(self.sections.compensation.bankAccount,'****--6789');assert.equal(self.sections.compensation.tax,undefined);assert.equal(self.sections.talent,undefined);assert.equal(self.sections.relations,undefined);assert.equal(JSON.stringify(self).includes('CONFIDENTIAL'),false);checks+=6;
 const full=await(await status(request('/api/profiles/TEST-001'),200)).json();assert.equal(full.sections.personal.nric,'900101-10-1234');checks++;
 await status(request('/api/profiles/TEST-001/sections/personal',hr,'PUT',{data:{nric:'lost update'},version:0}),409);assert.equal(sqlite.prepare("SELECT count(*) n FROM profile_revisions WHERE section='personal'").get().n,1);checks++;
 await status(request('/api/profiles/TEST-001/sections/overview',hr,'PUT',{data:{employmentStatus:'Probation',dateJoined:'2026-03-15'},version:0}),200);assert.equal(sqlite.prepare("SELECT employment_status FROM employment_records WHERE employee_id='TEST-001'").get().employment_status,'active');checks++;
 await status(request('/api/profiles/TEST-001/sections/attendance',hr,'PUT',{data:{workingDays:10,daysPresent:15},version:0}),400);
 assert.throws(()=>validateSection('personal',{dateOfBirth:'2025-02-30'}));checks++;
 const two=[{reporting_year:2026,month:8,overall_score:2.99,check_in_status:'Completed'},{reporting_year:2026,month:7,overall_score:2.5,check_in_status:'Completed'}];assert(profileAlerts({},two,'2026-09-29').some(x=>x.text.includes('≤2.99')));two[1].month=6;assert(!profileAlerts({},two,'2026-09-29').some(x=>x.text.includes('≤2.99')));checks+=2;
 assert.equal(lifecycleStatus({overview:{employmentStatus:'Active'},exit:{autoLifecycle:'Enabled',resignationDate:'2026-09-01',lastWorkingDay:'2026-09-30'}},'2026-09-29'),'Notice Period');checks++;
 const upload=async(category,visibility)=>{const form=new FormData();form.set('file',new File(['%PDF-1.7\nTest document'], 'test.pdf',{type:'application/pdf'}));form.set('category',category);form.set('visibility',visibility);return profileRoute(new Request('https://profile.test/api/profiles/TEST-001/documents',{method:'POST',headers:{origin:'https://profile.test'},body:form}),env,{user:hr,isPc:()=>true})};
 await status(upload('Personal','employee'),400);const doc=await(await status(upload('Employment Contract','employee'),201)).json();assert.equal(objects.size,1);checks++;
 await status(request(`/api/profiles/TEST-001/documents/${doc.documentId}`,employee),200);await status(request(`/api/profiles/TEST-002/documents/${doc.documentId}`,employee),403);
 const restricted=await(await status(upload('Disciplinary','hr'),201)).json();await status(request(`/api/profiles/TEST-001/documents/${restricted.documentId}`,employee),404);
 const visible=await(await request('/api/profiles/me',employee)).json();assert.equal(visible.documents.length,1);assert(!JSON.stringify(visible.documents).includes('storage_key'));checks+=2;
 await status(request(`/api/profiles/TEST-001/documents/${doc.documentId}`,hr,'DELETE'),200);await status(request(`/api/profiles/TEST-001/documents/${doc.documentId}`,employee),404);
 await status(request('/api/profiles/TEST-001/sections/exit',hr,'PUT',{data:{autoLifecycle:'Enabled',resignationDate:'2020-01-01',lastWorkingDay:'2020-02-01',alumniApproved:'No'},version:0}),200);await status(request('/api/profiles/me',employee),403);assert.equal(sqlite.prepare("SELECT active FROM employees WHERE employee_id='TEST-001'").get().active,0);checks++;
 assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);checks++;
 console.log(JSON.stringify({checks,passed:true,foreignKeyIssues:0,areas:['identity isolation','P&C writes','identifier masking','restricted sections','origin checks','concurrent edits','revision audit','MPC threshold','uploads/downloads','document visibility','lifecycle access removal']}));
}
