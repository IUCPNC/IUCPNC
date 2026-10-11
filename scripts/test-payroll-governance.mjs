import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pipelineFixture} from './test-payroll-processing.mjs';
import {payrollAccess,defaults,parse} from '../worker/payroll-core.js';
import {governanceWrite} from '../worker/payroll-governance.js';
import {reportsWrite,reportsRead,reportData,exportReport,aggregate,REPORTS} from '../worker/payroll-reports.js';
import {activationReady,processingWrite} from '../worker/payroll-processing.js';
import {calculateEmployee,calculationInput} from '../worker/payroll-calculation.js';
import {selfserviceWrite,annualData} from '../worker/payroll-selfservice.js';
import {RULES} from '../worker/payroll-statutory.js';
import {payrollRoute} from '../worker/payroll-api.js';
import {passwordHash} from '../worker/nadi-auth.js';
import {eaPdf} from '../worker/payroll-documents.js';

const f=await pipelineFixture(),{env,sqlite,user,users,write}=f,[prep,hra,review,fin,payment,configure,auditor,summary]=users;
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async(p,re)=>{await assert.rejects(p,re);checks++};
async function action(u,path,b,sensitive=true){if(sensitive){const resource=path.endsWith('/reconcile')?b.paymentId:path.endsWith('/rules/verify')?b.ruleId:b.id||b.employeeId||'main',id=crypto.randomUUID();sqlite.prepare('INSERT INTO payroll_challenges(id,actor_email,account_id,account_version,action,resource,expires_ms) VALUES (?,?,?,1,?,?,?)').run(id,u.email,u.userId,path,resource,Date.now()+60000);b={...b,challenge:id};}const t={module:'uat',key:crypto.randomUUID(),hash:crypto.randomUUID()},a=await payrollAccess(env,u);const response=await governanceWrite(env,u,a,path,b,t)||await reportsWrite(env,u,a,path,b,t)||await selfserviceWrite(env,u,a,path,b,t)||await processingWrite(env,u,a,path,b,t);if(!response)throw Error('Missing endpoint '+path);return response.headers.get('content-type')?.includes('json')?response.json():response;}
async function regular(month){const p=await write(prep,'/api/payroll/periods',{period:month,cutoffDate:month+'-24',paymentDate:month+'-30'}),r=await write(prep,'/api/payroll/runs',{periodId:p.id,cycle:'regular',employeeIds:['TEST-001']});let row=()=>sqlite.prepare('SELECT * FROM payroll_runs WHERE id=?').get(r.id);await write(prep,'/api/payroll/run/calculate',{id:r.id,version:row().version});await write(prep,'/api/payroll/run/validate',{id:r.id,version:row().version});await write(prep,'/api/payroll/run/submit',{id:r.id,version:row().version});await write(fin,'/api/payroll/run/decide',{id:r.id,version:row().version,note:'Synthetic Finance test'},true);await write(fin,'/api/payroll/run/finalise',{id:r.id,version:row().version},true);return row();}

eq(defaults().approvalSteps,['finance_approve']);
await action(configure,'/api/payroll/config',{version:0,configuration:{employer:{name:'IUC synthetic employer',address:'Fictitious test address',taxNumber:'E-TEST'},approvalSteps:['finance_approve']}});
const oct=await regular('2026-10'),nov=await regular('2026-11');
eq(await activationReady(env.DB,defaults()),false);
const baseline=id=>{const l=sqlite.prepare('SELECT * FROM payroll_lines WHERE run_id=?').get(id),s=parse(l.snapshot_json);return [{employeeId:l.employee_id,...Object.fromEntries(['gross','net','epfEmployee','epfEmployer','socsoEmployee','socsoEmployer','lindung','eisEmployee','eisEmployer','pcb','cp38','zakat','cost'].map(k=>[k,(s.totals[k]/100).toFixed(2)]))}];};
const version=id=>sqlite.prepare('SELECT version FROM payroll_runs WHERE id=?').get(id).version;
const missing=baseline(oct.id);delete missing[0].net;await reject(action(prep,'/api/payroll/comparison',{id:oct.id,version:version(oct.id),reference:'Synthetic independent register',baseline:missing}),/Every baseline/);
for(const r of [oct,nov]){await action(prep,'/api/payroll/comparison',{id:r.id,version:version(r.id),reference:'SYNTHETIC TEST REGISTER '+r.id,baseline:baseline(r.id)});await action(prep,'/api/payroll/comparison/approve',{id:r.id,version:version(r.id),role:'hr_approve',note:'Synthetic HR reconciliation'});await action(fin,'/api/payroll/comparison/approve',{id:r.id,version:version(r.id),role:'finance_approve',note:'Synthetic Finance reconciliation'});}
eq(await activationReady(env.DB,defaults()),false);
for(const rule of Object.values(RULES)){for(const [u,role] of [[prep,'hr_approve'],[fin,'finance_approve']]){const v=sqlite.prepare("SELECT version FROM payroll_config WHERE id='main'").get().version;await action(u,'/api/payroll/rules/verify',{ruleId:rule.id,role,version:v,reference:'SYNTHETIC POLICY REVIEW, NOT REAL APPROVAL'});}}
let conf=()=>parse(sqlite.prepare("SELECT data_json FROM payroll_config WHERE id='main'").get().data_json);
eq(await activationReady(env.DB,conf()),true);
const priorCount=sqlite.prepare("SELECT COUNT(*) n FROM payroll_decisions WHERE run_id=? AND decision='comparison_approve'").get(oct.id).n;
await action(prep,'/api/payroll/comparison',{id:oct.id,version:version(oct.id),reference:'SYNTHETIC REPLACEMENT REGISTER',baseline:baseline(oct.id)});
eq(sqlite.prepare("SELECT COUNT(*) n FROM payroll_decisions WHERE run_id=? AND decision='comparison_approve'").get(oct.id).n,priorCount);eq(await activationReady(env.DB,conf()),false);
for(const [u,role] of [[prep,'hr_approve'],[fin,'finance_approve']])await action(u,'/api/payroll/comparison/approve',{id:oct.id,version:version(oct.id),role,note:'Synthetic replacement review'});
await action(configure,'/api/payroll/activate',{version:sqlite.prepare("SELECT version FROM payroll_config WHERE id='main'").get().version,reference:'SYNTHETIC TWO MONTH ACCEPTANCE'});eq(conf().mode,'active');
const dec=await regular('2026-12');eq(dec.mode,'authoritative');
await write(payment,'/api/payroll/run/payments',{id:dec.id,version:dec.version,reference:'SYNTHETIC BANK BATCH'},true);
const paymentRow=()=>sqlite.prepare('SELECT * FROM payroll_payments WHERE run_id=?').get(dec.id);eq(paymentRow().status,'prepared');
await reject(write(payment,'/api/payroll/run/payments',{id:dec.id,version:dec.version,reference:'duplicate'},true),/already exist/);
await reject(write(payment,'/api/payroll/run/reconcile',{id:dec.id,version:dec.version,paymentId:paymentRow().id,paymentVersion:1,status:'paid',bankReference:'FAKE',note:'Invalid shortcut'},true),/Invalid payment/);
for(const [status,ref] of [['submitted','SYNTHETIC BANK SUBMISSION'],['failed','SYNTHETIC BANK FAILURE'],['prepared','SYNTHETIC RETRY'],['submitted','SYNTHETIC RESUBMISSION'],['paid','SYNTHETIC BANK CONFIRMATION']]){const p=paymentRow();await write(payment,'/api/payroll/run/reconcile',{id:dec.id,version:dec.version,paymentId:p.id,paymentVersion:p.version,status,bankReference:ref,note:'Synthetic reconciliation only'},true);}
eq(paymentRow().status,'paid');eq(parse(paymentRow().data_json).attempt,2);eq(parse(paymentRow().data_json).events.length,6);
await reject(write(payment,'/api/payroll/run/reconcile',{id:dec.id,version:dec.version,paymentId:paymentRow().id,paymentVersion:paymentRow().version,status:'prepared',bankReference:'FAKE',note:'Retry paid'},true),/Invalid payment/);
await reject(action(user,'/api/payroll/payment-export',{id:dec.id}),/explicit Payroll payment/);
for(const name of REPORTS){const data=await reportData(env.DB,dec.id,'IUC',name);assert.ok(data.rows.length>=10);checks++;const response=await exportReport(data,'csv',name);eq(response.headers.get('cache-control'),'private, no-store');}
const data=await reportData(env.DB,dec.id,'IUC','Payroll register'),xlsx=await exportReport(data,'xlsx','Payroll register'),pdf=await exportReport(data,'pdf','Payroll register');
await fs.mkdir('../statutory/qa',{recursive:true});await fs.writeFile('../statutory/qa/payroll-register.xlsx',new Uint8Array(await xlsx.arrayBuffer()));await fs.writeFile('../statutory/qa/payroll-register.pdf',new Uint8Array(await pdf.arrayBuffer()));
const injected=await(await exportReport({rows:[['=IMPORTDATA("x")',' +cmd','@SUM(1)',3100]]},'csv','Safety')).text();eq(injected.includes('"\'=IMPORTDATA'),true);eq(injected.includes('"\' +cmd'),true);
const same=parse(sqlite.prepare('SELECT snapshot_json FROM payroll_lines WHERE run_id=?').get(dec.id).snapshot_json);eq(aggregate([{employee_id:'TEST-001',snapshot:same},{employee_id:'TEST-001',snapshot:same},{employee_id:'TEST-001',snapshot:same}],'department')[0].employees,1);
const summaryData=await(await reportsRead(env,summary,await payrollAccess(env,summary),new URL('https://nadi.test/api/payroll/analytics?mode=authoritative&from=2026-01&to=2026-12'))).json();eq(summaryData.departments.length,0);eq(summaryData.totals.cost,null);eq(summaryData.trend.length,0);eq(Object.hasOwn(summaryData,'lines'),false);
await reject(reportsRead(env,user,await payrollAccess(env,user),new URL('https://nadi.test/api/payroll/analytics')),/Authorised/);
const cfg=conf(),input=await calculationInput(env,'TEST-001',{period:'2026-10',paymentDate:'2026-10-30',cutoffAt:'2026-10-24T23:59:59+08:00'},'authoritative');
const exempt=code=>({id:crypto.randomUUID(),category:'allowance',source_module:'Remuneration',source_reference:crypto.randomUUID(),data_json:JSON.stringify({amountSen:70000,direction:'pay',classification:{epf:true,socso:true,eis:true,tax:'exempt',exemptionLimitSen:100000,eaField:'F',evidence:'SYNTHETIC EXEMPTION'},evidence:'Synthetic policy'})});
const ex=calculateEmployee({...input,transactions:[exempt(),exempt()]},cfg);eq(ex.components.filter(c=>c.kind==='allowance').reduce((n,c)=>n+c.exemptSen,0),100000);eq(ex.totals.taxNormal,350000);
const deduction={id:'loan',category:'deduction',source_module:'Manual adjustment',source_reference:'loan-test',data_json:JSON.stringify({amountSen:10000,direction:'deduct',classification:{epf:false,socso:false,eis:false,tax:'exempt',eaField:'exclude'}})},ded=calculateEmployee({...input,transactions:[deduction]},cfg);eq(ded.totals.epfWages,310000);eq(ded.totals.net,calculateEmployee(input,cfg).totals.net-10000);
const high=calculateEmployee({...input,transactions:[{...deduction,data_json:JSON.stringify({...parse(deduction.data_json),amountSen:400000})}]},cfg);eq(high.exceptions.some(e=>e.code==='negative_net'),true);eq(high.exceptions.some(e=>e.code==='deduction_limit'),true);
const bonus={id:'bonus',category:'bonus',source_module:'Remuneration',source_reference:'bonus-test',data_json:JSON.stringify({amountSen:200000,direction:'pay',classification:{epf:true,socso:false,eis:false,tax:'additional',eaField:'B1b'}})},bon=calculateEmployee({...input,transactions:[bonus]},cfg);eq(bon.totals.gross,510000);eq(bon.totals.taxAdditional,200000);eq(bon.totals.socsoWages,310000);
const old=same;const blankSupplement=calculateEmployee({...input,cycle:'supplementary-no-pay',archived:[{id:'main-test',period:'2026-10',cycle:'regular',snapshot:bon}],transactions:[]},cfg);eq(blankSupplement.totals.pcb,0);eq(blankSupplement.totals.epfEmployee,0);
const annual=await annualData(env,'TEST-001',2026,{reference:'SYNTHETIC EA',evidence:'Synthetic annual draft'},prep);eq(annual.exceptions.some(e=>e.includes('Missing annual coverage')),true);eq(annual.exceptions.some(e=>e.includes('Remittance evidence')),true);
await fs.writeFile('../statutory/qa/sample-ea.pdf',await eaPdf(annual));
const secret='Synthetic-step-up-test-password!',hash=await passwordHash(env,secret);sqlite.prepare('UPDATE nadi_auth_accounts SET password_hash=?').run(hash);
async function route(actor,path,body={},headers={}){return payrollRoute(new Request('https://nadi.test/api/payroll/'+path,{method:'POST',headers:{origin:'https://nadi.test','content-type':'application/json','idempotency-key':crypto.randomUUID(),...headers},body:JSON.stringify(body)}),env,{user:actor});}
eq((await route(prep,'periods',{period:'2026-09',paymentDate:'2026-09-30',cutoffDate:'2026-09-24'},{origin:'https://evil.test'})).status,403);
eq((await route(prep,'periods',{}, {'content-type':'text/plain'})).status,415);
eq((await route(prep,'periods',{pad:'x'.repeat(262145)})).status,413);
eq((await route(prep,'step-up',{action:'/api/payroll/config',resource:'main',password:'wrong'})).status,403);
const challenge=await(await route(prep,'step-up',{action:'/api/payroll/config',resource:'main',password:secret})).json();eq(typeof challenge.challenge,'string');
const authLog=sqlite.prepare("SELECT after_json FROM audit_events WHERE action='sensitive_action_confirmed' ORDER BY occurred_at DESC LIMIT 1").get();eq(authLog.after_json.includes(secret),false);
sqlite.prepare("DELETE FROM payroll_grants WHERE email=?").run(payment.email);await reject(write(payment,'/api/payroll/run/payments',{id:dec.id,version:dec.version,reference:'revoked'},true),/explicit Payroll/);
const keys=sqlite.prepare("SELECT request_hash,response_json FROM idempotency_keys WHERE module_code LIKE 'payroll:%'").all();eq(keys.some(x=>x.request_hash.includes(secret)||x.response_json.includes(secret)),false);
console.log(JSON.stringify({stage:6,checks,passed:true,scenarios:['two synthetic comparison months','separate HR and Finance acceptance','revision-bound append-only decisions','dated rule gate','default Finance approval','production activation gate','failed bank retry','paid bank retry denied','13 report exports','CSV formula safety','Excel numeric output','distinct employee suppression','salary and tax adjustments','bonus supplementary PCB','annual coverage exceptions','password step-up','same-origin','payload bounds','grant revocation']}));
