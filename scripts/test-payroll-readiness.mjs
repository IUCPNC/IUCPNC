import assert from 'node:assert/strict';
import {fixture} from './payroll-fixture.mjs';
import {activationEvidence,activationReady} from '../worker/payroll-processing.js';
import {governanceRead} from '../worker/payroll-governance.js';
import {payrollAccess,defaults} from '../worker/payroll-core.js';
import {RULES} from '../worker/payroll-statutory.js';
const {env,sqlite,hr,user}=fixture();let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
function insert(table,values){const row={};for(const c of sqlite.prepare('PRAGMA table_info('+table+')').all())if(c.notnull&&c.dflt_value===null)row[c.name]=/INT|REAL/.test(c.type)?0:'';Object.assign(row,values);sqlite.prepare('INSERT INTO '+table+'('+Object.keys(row).join(',')+') VALUES('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row));}
const config={...defaults(),verifiedRuleVersions:Object.values(RULES).map(r=>({id:r.id,reference:'Synthetic verification',hrEmail:'hr@example.test',financeEmail:'finance@example.test'}))};
insert('payroll_config',{id:'main',data_json:JSON.stringify(config),updated_by:hr.email});
let d=await activationEvidence(env.DB,config);eq(d.ready,false);eq(d.acceptedMonths,[]);eq(d.requiredMonths,2);eq(d.ruleChecks.every(x=>x.verified),true);
function cycle(id,month,entity='IUC',kind='regular'){const period=sqlite.prepare('SELECT id FROM payroll_periods WHERE entity=? AND period=?').get(entity,month);if(!period)insert('payroll_periods',{id:'period-'+id,entity,period:month});insert('payroll_runs',{id,period_id:period?.id||'period-'+id,cycle:kind,status:'finalised',mode:'parallel',data_json:JSON.stringify({comparison:{reconciled:true,revision:id}})});for(const step of ['hr_approve','finance_approve'])insert('payroll_decisions',{id:id+step,run_id:id,step,decision:'comparison_approve',actor_email:step+'@example.test',data_json:JSON.stringify({revision:id})});}
cycle('one','2026-08');d=await activationEvidence(env.DB,config);eq(d.ready,false);eq(d.acceptedMonths,['2026-08']);
cycle('supplement','2026-09','IUC','supplementary');cycle('foreign','2026-09','OTHER');d=await activationEvidence(env.DB,config);eq(d.acceptedMonths,['2026-08']);
cycle('two','2026-09');d=await activationEvidence(env.DB,config);eq(d.ready,true);eq(d.acceptedMonths,['2026-08','2026-09']);eq(await activationReady(env.DB,config),d.ready);
sqlite.prepare("UPDATE payroll_decisions SET actor_email='hr_approve@example.test' WHERE run_id='two'").run();eq((await activationEvidence(env.DB,config)).ready,false);
sqlite.prepare("UPDATE payroll_decisions SET actor_email='finance_approve@example.test' WHERE run_id='two' AND step='finance_approve'").run();eq((await activationEvidence(env.DB,config)).ready,true);
sqlite.prepare("UPDATE payroll_runs SET data_json=? WHERE id='two'").run(JSON.stringify({comparison:{reconciled:true,revision:'changed'}}));eq((await activationEvidence(env.DB,config)).ready,false);
sqlite.prepare("UPDATE payroll_runs SET data_json=? WHERE id='two'").run(JSON.stringify({comparison:{reconciled:true,revision:'two'}}));
cycle('third','2026-09','IUC','regular-extra');sqlite.prepare("UPDATE payroll_runs SET status='draft' WHERE id='third'").run();eq((await activationEvidence(env.DB,config)).acceptedMonths,['2026-08']);
sqlite.prepare("UPDATE payroll_runs SET status='finalised' WHERE id='third'").run();eq((await activationEvidence(env.DB,config)).ready,true);
const incomplete={...config,verifiedRuleVersions:config.verifiedRuleVersions.slice(1)};d=await activationEvidence(env.DB,incomplete);eq(d.ready,false);eq(d.ruleChecks.filter(x=>!x.verified).map(x=>x.id),[Object.values(RULES)[0].id]);
const samePerson={...config,verifiedRuleVersions:config.verifiedRuleVersions.map(r=>({...r,financeEmail:r.hrEmail}))};eq((await activationEvidence(env.DB,samePerson)).ready,false);
const before=sqlite.prepare('SELECT data_json,version FROM payroll_config').get();const response=await governanceRead(env,hr,await payrollAccess(env,hr),new URL('https://nadi.test/api/payroll/readiness'));eq(response.status,200);eq(response.headers.get('cache-control'),'private, no-store');d=await response.json();eq(d.acceptedMonths,['2026-08','2026-09']);eq(d.ready,true);eq(JSON.stringify(d).includes('gross'),false);eq(sqlite.prepare('SELECT data_json,version FROM payroll_config').get(),before);
const employeeAccess=await payrollAccess(env,user);await assert.rejects(()=>governanceRead(env,user,employeeAccess,new URL('https://nadi.test/api/payroll/readiness')),e=>e.status===403);checks++;
sqlite.close();console.log(JSON.stringify({passed:true,checks,coverage:'Actual activation evidence, distinct months/approvers, revision invalidation, additional cycles, entity scope, rule verification and read-only confidentiality'}));
