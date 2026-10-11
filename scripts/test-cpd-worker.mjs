import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture,hr,employee} from './test-profiles.mjs';
import worker from '../dist/server/index.js';
const {sqlite,env}=fixture();env.PC_EMAILS=hr.email;let checks=0;
const call=(path,user=employee,method='GET',body)=>worker.fetch(new Request('https://test.local'+path,{method,headers:{'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email,...(method==='GET'?{}:{origin:'https://test.local','content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{});
for(const [path,user,status] of [['/admin/cpd',hr,200],['/admin/cpd',employee,403],['/employee/cpd',employee,200],['/api/cpd/overview',hr,200],['/api/cpd/overview',employee,200],['/cpd.js',employee,200],['/cpd-qr-vendor.js',employee,200]]){const r=await call(path,user);assert.equal(r.status,status,await r.clone().text());checks++}
for(const file of ['worker/cpd.js','public/mpc/app.js','worker/qr-generator.js']){new vm.Script(fs.readFileSync(file,'utf8'));checks++}
const html=fs.readFileSync('worker/cpd.html','utf8'),js=fs.readFileSync('worker/cpd.js','utf8');
for(const match of js.matchAll(/\$\('#([\w-]+)'\)/g)){assert(html.includes(`id="${match[1]}"`),`Missing control ${match[1]}`);checks++}
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('worker/qr-generator.js','utf8'),context);const qr=context.qrcode(0,'M');qr.addData('https://test.local/cpd/attend/'+crypto.randomUUID());qr.make();assert(qr.createSvgTag(6,4).startsWith('<svg'));checks++;
const date=new Date().toISOString(),year=new Date().getFullYear(),month=new Date().getMonth();
sqlite.prepare("INSERT INTO cpd_credits (id,employee_id,source_type,source_id,title,provider,attended_at,hours,category,created_by,created_email,created_at) VALUES ('credit-test','TEST-001','request','request-test','Training','IUC',?,2,'Structured CPD',?,?,?)").run(date,hr.userId,hr.email,date);
const state={employee:{year},selectedMonth:month,months:Array.from({length:12},()=>({cpd:[],cpdManaged:[{creditId:'forged',structuredHours:400}],values:{},kpis:[],social:[],ack:{}}))};
const saved=await call('/api/submissions',employee,'POST',state);assert.equal(saved.status,201,await saved.clone().text());checks++;
const row=sqlite.prepare('SELECT * FROM mpc_submissions').get();assert.equal(row.cpd_hours,2);assert.equal(row.cpd_rating,1);checks+=2;
const read=await(await call('/api/submissions')).json();assert.equal(read.verifiedCpd.length,1);assert.equal(read.verifiedCpd[0].creditId,'credit-test');checks+=2;
console.log(`Packaged Site / MPC checks passed: ${checks}`);
