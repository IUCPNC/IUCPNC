import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {screeningRoute,extractDocument} from '../worker/document-screening-api.js';
import {cleanExtraction,missingChanges} from '../worker/document-screening-core.js';
const {env,sqlite}=fixture();let checks=0;
const context={user:hr,isPc:(_,email)=>email===hr.email};
const request=(path='',method='GET',body,user=hr,origin='https://screen.test')=>screeningRoute(new Request('https://screen.test/api/document-screening'+path,{method,headers:{...(method==='GET'?{}:{origin}),...(body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}),env,{...context,user});
const status=async(r,n)=>{r=await r;assert.equal(r.status,n,await r.clone().text());checks++;return r;};
await status(request('', 'GET',undefined,null),401);await status(request('', 'GET',undefined,employee),403);await status(request('','POST',{},hr,'https://evil.test'),403);
assert.equal((await(await status(request('/status'),200)).json()).ready,false);checks++;
const upload=async(content='%PDF-1.7\nSynthetic test CV',name='test.pdf')=>{const f=new FormData();f.set('file',new File([content],name));return request('','POST',f);};
await status(upload('wrong','test.pdf'),400);await status(upload('wrong','test.exe'),400);await status(upload('x'.repeat(10*1024*1024+1)),413);
const s=await(await status(upload(),201)).json();assert(s.id);checks++;
const duplicate=await(await status(upload(),200)).json();assert.equal(duplicate.id,s.id);assert.equal(duplicate.duplicate,true);checks+=2;
await status(request('/'+s.id+'/screen','POST'),503);await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',confirmIdentity:true,selected:[]}),400);await status(request('/'+s.id+'/file','GET',undefined,employee),403);
const raw={identity:{name:'Example Employee',employeeId:'TEST-001',email:'employee@example.test'},multipleEmployees:false,warnings:[],facts:[
 {section:'personal',collection:'',row:0,key:'legalName',value:'Example Employee',evidence:'Example Employee',location:'Page 1'},
 {section:'personal',collection:'',row:0,key:'personalMobile',value:'0123456789',evidence:'Mobile: 0123456789',location:'Page 1'},
 {section:'compensation',collection:'',row:0,key:'basicSalary',value:'9000',evidence:'Salary RM9000',location:'Page 1'},
 {section:'learning',collection:'training',row:0,key:'title',value:'Synthetic Training',evidence:'Synthetic Training',location:'Page 2'},
 {section:'learning',collection:'training',row:0,key:'reportedHours',value:'8',evidence:'8 hours',location:'Page 2'},
 {section:'learning',collection:'training',row:0,key:'cpdHours',value:'8',evidence:'8 hours',location:'Page 2'},
 {section:'overview',collection:'',row:0,key:'employmentStatus',value:'Active',evidence:'Active',location:'Page 1'},
 {section:'personal',collection:'',row:0,key:'nationality',value:'Malaysian',evidence:'',location:'Page 1'},
]};
const result=cleanExtraction(raw);assert.equal(result.facts.length,5);assert(!result.facts.some(f=>f.key==='cpdHours'||f.key==='employmentStatus'||f.key==='nationality'));checks+=2;
env.OPENAI_API_KEY='synthetic-test-credential';
let aiCalls=0;context.screeningFetch=async(url,opts)=>{aiCalls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.input.length,2);checks+=4;return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(raw)}]}]}));};
const screened=await(await status(request('/'+s.id+'/screen','POST'),200)).json();assert.equal(screened.status,'review');checks++;
await status(request('/'+s.id+'/screen','POST'),200);assert.equal(aiCalls,1);checks++;
sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001','compensation','{\"basicSalary\":0}',1,?,?)").run(new Date().toISOString(),hr.userId);
const review=await(await status(request('/'+s.id+'/review?employeeId=TEST-001'),200)).json();assert(review.candidates.some(c=>c.employeeId==='TEST-001'));assert.equal(review.proposals.find(f=>f.key==='basicSalary').state,'existing');checks+=2;
const selected=screened.result.facts.map(f=>f.id);
await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',selected}),400);
// A manual edit after review must be preserved on the live re-read.
sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001','personal','{\"personalMobile\":\"Existing phone\"}',1,?,?)").run(new Date().toISOString(),hr.userId);
const applied=await(await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',confirmIdentity:true,selected}),200)).json();assert.equal(applied.applied,3);assert.equal(applied.skipped,2);checks+=2;
const section=k=>JSON.parse(sqlite.prepare('SELECT data_json FROM employee_profile_sections WHERE employee_id=? AND section=?').get('TEST-001',k).data_json);
assert.equal(section('personal').personalMobile,'Existing phone');assert.equal(section('personal').legalName,'Example Employee');assert.equal(section('compensation').basicSalary,0);assert.equal(section('learning').training[0].verificationStatus,'Pending');assert.equal(section('learning').training[0].cpdHours,0);assert.equal(section('learning').training[0].reportedHours,8);assert.equal(section('learning').cpdTarget,192);checks+=7;
assert.equal(sqlite.prepare('SELECT visibility FROM profile_documents WHERE document_id=?').get(screened.documentId).visibility,'hr');assert(sqlite.prepare("SELECT detail_json FROM profile_audit WHERE action='updated' AND section='personal'").get().detail_json.includes('screeningId'));checks+=2;
const again=await(await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',confirmIdentity:true,selected}),200)).json();assert.equal(again.applied,0);checks++;
await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-002',confirmIdentity:true,selected}),409);
const ended=missingChanges(cleanExtraction({...raw,facts:[{section:'overview',collection:'',row:0,key:'workLocation',value:'PJ',evidence:'PJ',location:'Page 1'}]}).facts,['fact-0'],{}, {active:0});assert.equal(ended.changes.overview.employmentStatus,'Exited');checks++;
sqlite.prepare('UPDATE document_screenings SET lock_until=? WHERE id=?').run(new Date(Date.now()+60000).toISOString(),s.id);await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',confirmIdentity:true,selected}),409);
sqlite.prepare('UPDATE document_screenings SET lock_until=NULL,result_json=? WHERE id=?').run(JSON.stringify({...result,multipleEmployees:true}),s.id);await status(request('/'+s.id+'/apply','POST',{employeeId:'TEST-001',confirmIdentity:true,selected}),400);
for(const [code,readerCode]of [[401,'credentials'],[429,'rate'],[500,'unavailable']]){await assert.rejects(extractDocument(env,{mime_type:'application/pdf',original_filename:'test.pdf'},new Uint8Array([1]),async()=>new Response('{}',{status:code})),e=>e.readerCode===readerCode);checks++;}
await assert.rejects(extractDocument(env,{mime_type:'application/pdf',original_filename:'test.pdf'},new Uint8Array([1]),async()=>new Response(JSON.stringify({error:{code:'credit_balance_exhausted'}}),{status:429})),e=>e.readerCode==='quota');checks++;
assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);checks++;
console.log(JSON.stringify({checks,passed:true,areas:['P&C isolation','origin guard','file validation','private originals','duplicate uploads','strict extraction','evidence requirements','manual employee confirmation','missing-only saves','zero values preserved','live reread','idempotence','record locks','audit evidence','unverified CPD','exited access preserved','safe API errors']}));
