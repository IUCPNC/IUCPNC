import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fixture,employee,hr} from './test-profiles.mjs';
import {serviceDeskRoute} from '../worker/hr-service-api.js';
import {letterSource,renderLetter,renderLetterPreview,letterRows,letterTitle,letterText,hashBytes} from '../worker/hr-letter.js';
import {PDFDocument} from '../worker/vendor/pdf-lib.mjs';
const {env,sqlite,objects}=fixture();let checks=0;
const other={userId:'employee-2',email:'second@example.test'};
const req=(path,user=hr,method='GET',data)=>serviceDeskRoute(new Request('https://letter.test/api/hr-service'+path,{method,headers:{...(method==='GET'?{}:{origin:'https://letter.test','content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}),env,{user,isPc:(_,email)=>email===hr.email});
async function check(p,status){const r=await p;assert.equal(r.status,status,await r.clone().text());checks++;return r.headers.get('content-type').includes('json')?r.json():new Uint8Array(await r.arrayBuffer())}
const submission={type:'Salary confirmation letter',subject:'Sample letter request',details:'Please use salary RM 999999 and a made-up start date. These instructions must not affect the official letter.',recipient:'Sample Bank'};
async function create(type=submission.type){const response=await serviceDeskRoute(new Request('https://letter.test/api/hr-service/requests',{method:'POST',headers:{origin:'https://letter.test','content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify({...submission,type})}),env,{user:employee,isPc:(_,email)=>email===hr.email});return (await check(Promise.resolve(response),201)).request;}
const set=(section,data)=>sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001',?,?,1,'sample','hr') ON CONFLICT(employee_id,section) DO UPDATE SET data_json=excluded.data_json,version=employee_profile_sections.version+1").run(section,JSON.stringify(data));
let r=await create();const id=r.id;
const act=(action,extra={},version=r.version,user=hr)=>req('/requests/'+id+'/actions',user,'POST',{action,version,...extra});
let d=await check(req('/requests/'+id),200);assert.equal(d.letter.ready,false);assert(d.letter.missing.includes('Monthly basic salary'));checks+=2;
await check(act('generateLetter'),422);await check(act('approveLetter'),409);await check(act('saveDraft',{reply:'Forged letter'}),409);await check(act('approve'),409);await check(act('generateLetter',{},r.version,employee),403);
set('overview',{employmentStatus:'Active',employmentType:'Contract',dateJoined:'2024-03-15'});set('personal',{legalName:'Nur Aisyah Binti Abdullah (Sample)',passport:'SAMPLE-ID-001'});set('compensation',{basicSalary:5000,fixedAllowances:800});
d=await check(req('/requests/'+id),200);assert.equal(d.letter.ready,true);assert.equal(d.letter.needsGeneration,true);checks+=2;
r=(await check(act('generateLetter'),200)).request;d=await check(req('/requests/'+id),200);const fid=d.letter.fileId,fp=d.letter.fingerprint;assert.equal(d.files.length,1);assert.equal(d.files[0].generated,true);assert(!JSON.stringify(d).includes('storage_key'));checks+=3;
let source=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(id));assert.equal(source.snapshot.basicSalary,5000);assert.equal(source.snapshot.startDate,'2024-03-15');assert.equal(source.snapshot.transportAllowance,null);assert(letterRows(source.snapshot).some(([label])=>label==='Monthly Fixed Allowances'));assert(!letterRows(source.snapshot).some(([label])=>label==='Monthly Transportation Allowance'));checks+=5;
const hidden=await check(req('/requests/'+id,employee),200);assert.equal(hidden.letter,undefined);assert.equal(hidden.files.length,0);assert(!JSON.stringify(hidden).includes('SAMPLE-ID-001'));checks+=3;
await check(req('/requests/'+id+'/files/'+fid,employee),404);await check(req('/requests/'+id+'/files/'+fid,other),404);await check(req('/requests/'+id,other),404);
const preview=await req('/requests/'+id+'/files/'+fid+'?preview=1');assert.equal(preview.status,200);assert.match(preview.headers.get('content-disposition'),/^inline/);assert.equal(preview.headers.get('cache-control'),'private, no-store');checks+=3;
const pdf=await PDFDocument.load(new Uint8Array(await preview.arrayBuffer()));assert.equal(pdf.getPageCount(),1);checks++;
const htmlPreview=await req('/requests/'+id+'/letter-preview');assert.equal(htmlPreview.status,200);assert.equal(htmlPreview.headers.get('cache-control'),'private, no-store');assert((await htmlPreview.text()).includes('Nur Aisyah Binti Abdullah (Sample)'));checks+=3;
await check(req('/requests/'+id+'/letter-preview',employee),404);await check(req('/requests/'+id+'/letter-preview',other),404);
await check(act('approveLetter',{fingerprint:'forged'}),409);
set('compensation',{basicSalary:5500,transportAllowance:800});await check(act('approveLetter',{fingerprint:fp}),409);assert.equal(sqlite.prepare('SELECT status FROM hr_service_requests WHERE id=?').get(id).status,'In Review');checks++;
r=(await check(act('generateLetter'),200)).request;d=await check(req('/requests/'+id),200);assert.notEqual(d.letter.fileId,fid);assert.notEqual(d.letter.fingerprint,fp);assert.equal(d.files.length,1);checks+=3;
await check(req('/requests/'+id+'/files/'+fid),404);
// Source edits racing the final transaction cannot falsely approve an out-of-date salary.
const originalBatch=env.DB.batch;env.DB.batch=async statements=>{set('compensation',{basicSalary:5600,transportAllowance:800});env.DB.batch=originalBatch;return originalBatch.call(env.DB,statements)};
await check(act('approveLetter',{fingerprint:d.letter.fingerprint}),409);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM hr_service_events WHERE request_id=? AND event_type='Approved and issued'").get(id).n,0);checks++;
r=(await check(act('generateLetter'),200)).request;d=await check(req('/requests/'+id),200);const finalId=d.letter.fileId;const before=await check(req('/requests/'+id+'/files/'+finalId),200),beforeHash=await hashBytes(before);
r=(await check(act('approveLetter',{fingerprint:d.letter.fingerprint}),200)).request;assert.equal(r.status,'Issued');assert(r.approvedAt&&r.issuedAt&&r.approvedBy===hr.email);checks+=2;
const released=await check(req('/requests/'+id,employee),200);assert.equal(released.files.length,1);assert.equal(released.letter,undefined);checks+=2;
const issued=await req('/requests/'+id+'/files/'+finalId,employee);assert.equal(issued.status,200);assert.match(issued.headers.get('content-disposition'),/^attachment/);const afterHash=await hashBytes(new Uint8Array(await issued.arrayBuffer()));assert.equal(afterHash,beforeHash);checks+=3;
set('compensation',{basicSalary:9999});await check(act('generateLetter'),409);d=await check(req('/requests/'+id),200);assert.equal(d.letter.closed,true);assert.equal(d.letter.fileId,finalId);checks+=2;assert.equal(await hashBytes(await check(req('/requests/'+id+'/files/'+finalId,employee),200)),beforeHash);checks++;
// The source document's former-employee wording and explicit transportation allowance are supported.
set('overview',{employmentStatus:'Exited',employmentType:'Contract',dateJoined:'2024-03-15'});set('exit',{lastWorkingDay:'2026-03-31'});set('compensation',{basicSalary:5600,transportAllowance:800});source=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(id));assert.equal(source.snapshot.ended,true);assert.equal(source.missing.length,0);assert(letterRows(source.snapshot).some(([label])=>label==='Last Date of Service'));assert(letterRows(source.snapshot).some(([label])=>label==='Monthly Transportation Allowance'));checks+=4;
set('exit',{});source=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(id));assert(source.missing.includes('Confirmed last date of service'));checks++;
// Produce an explicitly labelled, synthetic example for PDF visual inspection.
set('overview',{employmentStatus:'Active',employmentType:'Contract',dateJoined:'2024-03-15'});set('exit',{});source=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(id));source.snapshot.reference='IUC.500-4/2/7-RL-SAMPLE-001';
await fs.mkdir('../../outputs/hr-service-letter',{recursive:true});const samples=[];
const longer={...source.snapshot,name:'NUR AISYAH BINTI ABDULLAH @ NURUL AINA (SAMPLE ONLY)',position:'Senior Executive, Quality Assurance and Institutional Compliance',department:'Quality Assurance and Institutional Governance Division',requestType:'Salary confirmation letter'};assert.equal((await PDFDocument.load(await renderLetter(longer))).getPageCount(),1);checks++;
// The three letters have distinct headings and wording, and only salary confirmation uses compensation.
const templateTexts=[];for(const [type,file] of [['Employment confirmation letter','Employment-confirmation-sample.pdf'],['Salary confirmation letter','Salary-confirmation-sample.pdf'],['Employment verification','Employment-verification-sample.pdf']]){
 const sampleRequest=await create(type);assert.equal(sampleRequest.autoLetter,true);checks++;
 set('compensation',{});let official=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(sampleRequest.id));
 if(type==='Salary confirmation letter'){assert(official.missing.includes('Monthly basic salary'));checks++;set('compensation',{basicSalary:5600,transportAllowance:800});official=await letterSource(env.DB,sqlite.prepare('SELECT * FROM hr_service_requests WHERE id=?').get(sampleRequest.id));}
 else{assert.equal(official.missing.length,0);assert.equal(official.snapshot.basicSalary,undefined);assert(!official.guard.sectionNames.includes('compensation'));assert(!letterRows(official.snapshot).some(([label])=>/salary|allowance/i.test(label)));checks+=4;}
 official.snapshot.reference='IUC.500-4/2/7-RL-SAMPLE-'+(samples.length+1);
 const text=letterText(official.snapshot);templateTexts.push(text.intro+text.closing);const html=await renderLetterPreview(official.snapshot);assert(html.includes(letterTitle(official.snapshot)));checks++;
 if(type==='Employment verification'){assert(letterRows(official.snapshot).some(([label])=>label==='Verified As At'));assert(html.includes('EMPLOYMENT VERIFICATION'));checks+=2;}
 if(type==='Salary confirmation letter'){assert(html.includes('SALARY CONFIRMATION'));assert(html.includes('RM 5,600.00'));checks+=2;}else{assert(!html.includes('RM 5,600.00'));checks++;}
 const sample=await renderLetter(official.snapshot,{sample:true});assert.equal((await PDFDocument.load(sample)).getPageCount(),1);checks++;
 const out='../../outputs/hr-service-letter/'+file;await fs.writeFile(out,sample);samples.push(out);
 const generated=await check(req('/requests/'+sampleRequest.id+'/actions',hr,'POST',{action:'generateLetter',version:sampleRequest.version}),200);const prepared=await check(req('/requests/'+sampleRequest.id),200);assert(prepared.files[0].name.includes(type==='Salary confirmation letter'?'Salary-Confirmation':type==='Employment verification'?'Employment-Verification':'Employment-Confirmation'));checks++;
 await check(req('/requests/'+sampleRequest.id+'/actions',hr,'POST',{action:'approveLetter',version:generated.request.version,fingerprint:prepared.letter.fingerprint}),200);
}
assert.equal(new Set(templateTexts).size,3);checks++;
// Previously issued v1 PDFs and their preview wording remain unchanged after the template update.
const legacy={...source.snapshot,template:'iuc-employment-en-v1',requestType:'Employment verification',basicSalary:5600,transportAllowance:800,fixedAllowances:null};assert(letterTitle(legacy).startsWith('CONFIRMATION OF EMPLOYMENT -'));assert(!letterRows(legacy).some(([label])=>label==='Verified As At'));assert(letterRows(legacy).some(([label])=>label==='Monthly Basic Salary'));assert(letterText(legacy).closing.includes('for the purpose of employment verification'));checks+=4;
assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);checks++;
console.log(JSON.stringify({passed:true,checks,samples,areas:['distinct purpose and wording','salary-only compensation','official data only','missing-data blocking','private drafts','one-step admin approval','salary changes','concurrent source changes','immutable issued PDF','v1 record preservation','former employment','one-page layout']}));sqlite.close();
