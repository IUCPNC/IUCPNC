import assert from 'node:assert/strict';
import {fixture} from './payroll-fixture.mjs';
import {currentEmployee} from '../worker/employee-eligibility.js';
import {serviceEmployee} from '../worker/hr-service-api.js';
import {payrollAccess,today} from '../worker/payroll-core.js';
import {payrollRoute} from '../worker/payroll-api.js';
import {academicAccess} from '../worker/academic-core.js';
const {env,sqlite,user,hr}=fixture();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const stamp=today(),yesterday=new Date(Date.parse(stamp)-86400000).toISOString().slice(0,10),tomorrow=new Date(Date.parse(stamp)+86400000).toISOString().slice(0,10);
const section=(key,data)=>sqlite.prepare('INSERT INTO employee_profile_sections(employee_id,section,data_json,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(employee_id,section) DO UPDATE SET data_json=excluded.data_json').run('TEST-001',key,JSON.stringify(data),hr.userId,stamp);
sqlite.prepare('INSERT INTO payroll_grants(id,email,role,entity,created_by,created_at) VALUES(?,?,?,?,?,?)').run('prepare',user.email,'prepare','IUC',hr.email,stamp);
async function allowed(){eq((await currentEmployee(env,user)).employee_id,'TEST-001');eq((await serviceEmployee(env,user)).employee_id,'TEST-001');eq((await payrollAccess(env,user)).active,true);eq((await academicAccess(env,user)).employeeId,'TEST-001');}
async function denied(){eq(await currentEmployee(env,user),null);eq(await serviceEmployee(env,user),null);await assert.rejects(()=>payrollAccess(env,user),e=>e.status===403);checks++;eq((await academicAccess(env,user)).employeeId,null);for(const path of ['context','my-salary','profile?employeeId=TEST-001','payslip?id=private','document?id=private','readiness']){const r=await payrollRoute(new Request('https://nadi.test/api/payroll/'+path),env,{user});eq(r.status,403);eq(r.headers.get('cache-control'),'private, no-store');}}
await allowed();section('overview',{employmentStatus:'Notice Period'});section('exit',{autoLifecycle:'Enabled',resignationDate:yesterday,lastWorkingDay:tomorrow});await allowed();section('exit',{autoLifecycle:'Enabled',lastWorkingDay:stamp});await allowed();section('exit',{autoLifecycle:'Disabled',lastWorkingDay:yesterday});await allowed();
section('exit',{autoLifecycle:'Enabled',lastWorkingDay:yesterday});await denied();
// Even a successful historical idempotency response is denied after exit.
sqlite.prepare('INSERT INTO idempotency_keys(module_code,idempotency_key,request_hash,response_status,response_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run('payroll:'+user.userId,'previous-request-0001','old',200,'{"private":"retained"}',stamp,tomorrow);
eq((await payrollRoute(new Request('https://nadi.test/api/payroll/periods',{method:'POST',headers:{origin:'https://nadi.test','content-type':'application/json','idempotency-key':'previous-request-0001'},body:'{}'}),env,{user})).status,403);
section('exit',{});for(const employmentStatus of ['Exited','Resigned','Alumni']){section('overview',{employmentStatus});await denied();}
section('overview',{employmentStatus:'Active'});sqlite.prepare('UPDATE employees SET active=0').run();await denied();sqlite.prepare('UPDATE employees SET active=1').run();
eq(await serviceEmployee(env,{...user,userId:'wrong'}),null);await assert.rejects(()=>payrollAccess(env,{...user,userId:'wrong'}),e=>e.status===403);checks++;
eq((await currentEmployee(env,{...user,email:user.email.toUpperCase()})).employee_id,'TEST-001');
sqlite.prepare('UPDATE employees SET account_user_id=NULL').run();await allowed();eq(sqlite.prepare('SELECT account_user_id FROM employees').get().account_user_id,null);
sqlite.prepare('INSERT INTO employees(employee_id,email,employee_name,active) VALUES(?,?,?,1)').run('TEST-002',user.email.toUpperCase(),'Conflicting identity');eq(await serviceEmployee(env,user),null);await assert.rejects(()=>payrollAccess(env,user),e=>e.status===403);checks++;
// Existing explicitly granted non-employee Finance identities remain supported.
sqlite.prepare('INSERT INTO payroll_grants(id,email,role,entity,created_by,created_at) VALUES(?,?,?,?,?,?)').run('finance',hr.email,'finance_approve','IUC',hr.email,stamp);const finance=await payrollAccess(env,hr);eq(finance.employeeId,null);eq(finance.grants[0].role,'finance_approve');eq(finance.roleAdmin,true);
eq(sqlite.prepare('SELECT COUNT(*) n FROM payroll_grants').get().n,2);eq(sqlite.prepare('SELECT COUNT(*) n FROM idempotency_keys').get().n,1);eq(sqlite.prepare('SELECT COUNT(*) n FROM audit_events').get().n,0);eq(sqlite.prepare('SELECT active FROM employees WHERE employee_id=?').get('TEST-001').active,1);
sqlite.close();console.log(JSON.stringify({passed:true,checks,coverage:'Cross-service exit eligibility, Malaysia dates, immediate payroll read/write denial, retained grants/history, identity binding and duplicate-email denial'}));
