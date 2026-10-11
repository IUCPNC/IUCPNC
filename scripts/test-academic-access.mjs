import assert from 'node:assert/strict';
import {academicFixture,lecturer,admin,verifier,pc} from './academic-fixture.mjs';
import {academicAccess,today,lecturerActorAssert,publicationAssertions} from '../worker/academic-core.js';
import {hubRoute} from '../worker/people-hub-api.js';
import {profileRoute} from '../worker/profile-api.js';
import {payrollRoute} from '../worker/payroll-api.js';
import {contributorRoute} from '../worker/academic-contributors.js';
import {navigationGroups} from '../worker/portal-navigation.js';
import worker from '../dist/server/index.js';
const f=await academicFixture(),{env,sqlite,ids}=f;let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},ok=v=>{assert.ok(v);checks++;};
const call=async(p,b,u=admin,status=200)=>{const r=await f.call(p,b,u,status);checks++;return r;};
const shift=n=>new Date(Date.parse(today())+n*86400000).toISOString().slice(0,10);
const platform=async(path,u)=>worker.fetch(new Request('https://academic.test'+path,{headers:{'oai-authenticated-user-id':u.userId,'oai-authenticated-user-email':u.email}}),env);
const ordinary={email:'ordinary@example.test',userId:'ordinary'},external={email:'external@example.test',userId:'external-approved'},secondExternal={email:'second-external@example.test',userId:'external-second'};
sqlite.prepare("INSERT INTO employees(employee_id,employee_name,email,account_user_id,position,active) VALUES('ORDINARY','Synthetic non-teaching manager',?,?,'Director',1)").run(ordinary.email,ordinary.userId);
for(const role of ['administrator','approver','leadership','quality'])sqlite.prepare('INSERT INTO academic_grants(id,employee_id,role,scope,effective_from,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)').run('ordinary-'+role,'ORDINARY',role,'*',today(),pc.email,today());
await call('overview',undefined,ordinary,403);eq((await academicAccess(env,ordinary)).hubEligible,false);eq((await platform('/academic',ordinary)).status,403);ok(!(await (await platform('/',ordinary)).text()).includes('href="/academic"'));
// An approved teaching role admits management staff; the title does not confer access.
await call('grants',{employeeId:'ORDINARY',role:'lecturer',scope:ids.programmeId,effective:today()},pc,403);
await call('grants',{employeeId:'ORDINARY',role:'lecturer',scope:ids.programmeId,effective:today(),teachingSource:'Synthetic approved management teaching appointment',approvalAuthority:'Synthetic appointing authority',approvedBy:'independent@example.test'},pc,201);
eq((await call('overview',undefined,ordinary)).mode,'lecturer');eq((await platform('/academic',ordinary)).status,200);
sqlite.prepare("UPDATE academic_grants SET effective_to=? WHERE employee_id='ORDINARY' AND role='lecturer'").run(shift(-1));await call('overview',undefined,ordinary,403);
// A non-teaching P&C account receives no automatic Hub access.
sqlite.prepare("UPDATE academic_grants SET effective_to=? WHERE employee_id='TEST-PC'").run(shift(-1));await call('overview',undefined,pc,403);const teachingProfile=async(user,body,status=200,origin='https://academic.test')=>{const r=await profileRoute(new Request('https://academic.test/api/profiles/ORDINARY/teaching-access',{method:body?'POST':'GET',headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{user,isPc:(_,email)=>email===pc.email});eq(r.status,status);return r.json();};
const approvedTeaching={scope:ids.programmeId,effective:today(),teachingSource:'Synthetic independently approved teaching appointment and eligibility review',approvalAuthority:'Synthetic appointing authority',approvedBy:'independent@example.test',version:1};
await teachingProfile(lecturer,undefined,403);await teachingProfile(pc,approvedTeaching,403,'https://evil.test');
// P&C can maintain teaching appointments in employee administration without entering the Hub.
await teachingProfile(pc,{...approvedTeaching,role:'administrator'});eq((await call('overview',undefined,ordinary)).mode,'lecturer');
const maintained=(await teachingProfile(pc)).grants;eq(maintained.length,1);eq(maintained[0].role,'lecturer');
await teachingProfile(pc,{action:'Revoke',id:maintained[0].id,version:maintained[0].version});await call('overview',undefined,ordinary,403);
sqlite.prepare("UPDATE academic_grants SET effective_to=NULL WHERE employee_id='TEST-PC'").run();
// Canonical external identity registration never creates employment or an employee role.
const employeeCount=sqlite.prepare('SELECT count(*) n FROM employees').get().n,employmentCount=sqlite.prepare('SELECT count(*) n FROM employment_records').get().n;
const identity=await call('contributors/identities',{programmeId:ids.programmeId,legalName:'Synthetic External Reviewer',email:external.email,sourceReference:'Synthetic verified identity'},admin,201);
eq(sqlite.prepare('SELECT count(*) n FROM employees').get().n,employeeCount);eq(sqlite.prepare('SELECT count(*) n FROM employment_records').get().n,employmentCount);
eq((await call('contributors/identities',{programmeId:ids.programmeId,legalName:'Synthetic External Reviewer',email:external.email,sourceReference:'Synthetic source'})).personId,identity.personId);
await call('contributors/identities',{programmeId:ids.programmeId,legalName:'Different identity',email:external.email,sourceReference:'Source'},admin,409);
await call('overview',undefined,external,403);
const input=(category='external-academic-examiner',overrides={})=>({category,personId:identity.personId,accountUserId:external.userId,effective:today(),expires:shift(30),affiliation:'Synthetic external university',appointmentReference:'Synthetic appointment letter',approvalAuthority:'Synthetic authorised appointment committee',qualificationEvidence:'Synthetic verified relevant qualifications',expertiseEvidence:'Synthetic matching programme expertise',standardSource:'Synthetic applicable MQA programme standard and MOHE policy source',eligibilityReview:'Synthetic human eligibility review',duties:'Review assigned assessment standards',workScope:'Synthetic assessment package Q1 only',conflictDeclaration:'Synthetic signed declaration: no conflict',conflictStatus:'Cleared',independenceReviewed:true,...overrides});
const create=async(data,code='EXTERNAL-1',employeeId='')=>(await call('records',{kind:'participant',code,title:'Synthetic academic appointment',programmeId:ids.programmeId,employeeId,data},admin,201)).id;
await call('records',{kind:'participant',code:'INVALID',title:'Invalid',programmeId:ids.programmeId,data:input('external-academic-examiner',{independenceReviewed:false})},admin,400);
await call('records',{kind:'participant',code:'INVALID-2',title:'Invalid',programmeId:ids.programmeId,data:input('external-academic-examiner',{conflictStatus:'Managed',managementPlan:'Source'})},admin,400);
await call('records',{kind:'participant',code:'INVALID-3',title:'Invalid',programmeId:ids.programmeId,data:input('external-academic-advisor',{qualificationEvidence:''})},admin,400);
const appointment=await create(input());await call('overview',undefined,external,403);
await call('records/'+appointment,{action:'Submit',version:1});await call('records/'+appointment,{action:'Approve',version:2},admin,403);await call('records/'+appointment,{action:'Approve',version:2,comment:'Synthetic independent review'},verifier);await call('overview',undefined,external,403);await call('records/'+appointment,{action:'Publish',version:3});
let overview=await call('overview',undefined,external);eq(overview.mode,'contributor');eq(overview.appointments.length,1);for(const field of ['sessions','staff','allocations','payments','cpd','grants','config'])eq(Object.hasOwn(overview,field),false);
eq((await platform('/academic',external)).status,200);eq((await platform('/employee/profile',external)).status,403);eq((await platform('/employee',external)).status,403);
for(const path of ['report','export?format=csv','mpc-evidence','payroll-evidence','qualifications?employeeId=TEST-001','contributors','history/'+appointment,'sessions/unknown'])await call(path,undefined,external,403);
await call('records',{kind:'activity'},external,403);await call('grants',{employeeId:'TEST-001'},external,403);await call('overview',undefined,{...external,userId:'wrong'},403);await call('overview',undefined,secondExternal,403);
const report=await call('contributions',{appointmentId:appointment,title:'Synthetic examiner report',sourceReference:'Synthetic authorised assessment package Q1',findings:'Synthetic examiner findings',recommendations:'Synthetic standards recommendation'},external,201);
eq((await call('overview',undefined,external)).submissions.length,1);await call('contributions',{appointmentId:appointment,title:'Outside',sourceReference:'x',findings:'x',recommendations:'x'},secondExternal,403);
eq((await call('overview',undefined,lecturer)).contributors.submissions.length,0);ok(!(await call('overview',undefined,lecturer)).records.some(r=>['participant','contributor-output'].includes(r.kind)));
eq((await call('contributors')).submissions.length,1);await call('contributions/'+report.id+'/review',{decision:'Accepted',comment:'Synthetic review',version:1},lecturer,403);await call('contributions/'+report.id+'/review',{decision:'Accepted',comment:'Synthetic reviewer action',version:1},verifier);eq((await call('overview',undefined,external)).submissions[0].status,'Accepted');await call('records/'+report.id,{action:'Save',version:2},admin,403);
// Distinct advisor categories use the same scoped workflow, with conflict management evidence.
for(const category of ['external-industry-advisor','external-academic-advisor']){
 const id=await create(input(category,{conflictStatus:'Managed',managementPlan:'Synthetic approved mitigation'}),category);
 await call('records/'+id,{action:'Submit',version:1});await call('records/'+id,{action:'Approve',version:2},verifier);await call('records/'+id,{action:'Publish',version:3});
 ok((await call('overview',undefined,external)).appointments.some(r=>r.data.category===category));
 await call('records/'+id,{action:'Withdraw',version:4,comment:'Synthetic term concluded'},verifier);
 ok(!(await call('overview',undefined,external)).appointments.some(r=>r.id===id));
}
// Expiry, withdrawal, changed canonical email and identity archive all end access.
sqlite.prepare("UPDATE academic_records SET data_json=json_set(data_json,'$.expires',?) WHERE id=?").run(shift(-1),appointment);await call('overview',undefined,external,403);sqlite.prepare("UPDATE academic_records SET data_json=json_set(data_json,'$.expires',?) WHERE id=?").run(shift(30),appointment);
sqlite.prepare('UPDATE people SET primary_email=? WHERE person_id=?').run('changed@example.test',identity.personId);await call('overview',undefined,external,403);sqlite.prepare('UPDATE people SET primary_email=? WHERE person_id=?').run(external.email,identity.personId);
sqlite.prepare('UPDATE people SET archived_at=? WHERE person_id=?').run(today(),identity.personId);await call('overview',undefined,external,403);sqlite.prepare('UPDATE people SET archived_at=NULL WHERE person_id=?').run(identity.personId);
// Confidential appointment evidence is absent from public work cards and employee records.
const directory=await hubRoute(new Request('https://academic.test/api/people-hub'),env,{user:lecturer,isPc:()=>false});eq(directory.status,200);const directoryData=await directory.json();eq(directoryData.academicContributors.length,1);ok(directoryData.academicContributors[0].relationship.includes('not an IUC employee'));eq(directoryData.employees.length,employeeCount);ok(!JSON.stringify(directoryData).includes('Synthetic examiner findings'));ok(!JSON.stringify(directoryData).includes('qualificationEvidence'));
// Part-time lecturers and supervisors are employees with separate employment working-time fields.
const lecturerPerson=sqlite.prepare("SELECT person_id FROM employees WHERE employee_id='TEST-001'").get().person_id;
if(!lecturerPerson)throw Error('Fixture must have canonical employee identity');
sqlite.prepare("INSERT OR REPLACE INTO employee_profile_sections(employee_id,section,data_json,version,updated_by,updated_at) VALUES('TEST-001','employment',?,1,?,?)").run(JSON.stringify({workingTime:'Part-time',academicFunction:'Lecturer and student supervisor'}),pc.userId,today());
const supervisorInput=input('part-time-supervisor',{personId:lecturerPerson,accountUserId:lecturer.userId,affiliation:'IUC',supervisionPolicy:'Synthetic reviewed programme qualifications, capacity, supervisor training and ethics'}),supervisor=await create(supervisorInput,'PART-TIME-SUPERVISOR','TEST-001');
await call('records/'+supervisor,{action:'Submit',version:1});await call('records/'+supervisor,{action:'Approve',version:2,comment:'Synthetic approval'},verifier);await call('records/'+supervisor,{action:'Publish',version:3});
eq((await call('overview',undefined,lecturer)).mode,'lecturer');eq((await call('overview',undefined,lecturer)).myContributions.appointments.length,1);
const p=await profileRoute(new Request('https://academic.test/api/profiles/me'),env,{user:lecturer,isPc:()=>false});eq(p.status,200);const profile=await p.json();eq(profile.employee.relationship,'IUC employee');eq(profile.employee.workingTime,'Part-time');
const partDirectory=await(await hubRoute(new Request('https://academic.test/api/people-hub'),env,{user:lecturer,isPc:()=>false})).json();eq(partDirectory.employees.find(e=>e.employee_id==='TEST-001').workingTime,'Part-time');eq(partDirectory.employees.find(e=>e.employee_id==='TEST-001').academicAppointments[0].category,'part-time-supervisor');eq(partDirectory.academicContributors.length,1);
// Full-time classification is independent from permanent/contract employment type.
sqlite.prepare("UPDATE employee_profile_sections SET data_json=json_set(data_json,'$.workingTime','Full-time') WHERE employee_id='TEST-001' AND section='employment'").run();
const fullProfile=await(await profileRoute(new Request('https://academic.test/api/profiles/me'),env,{user:lecturer,isPc:()=>false})).json();eq(fullProfile.employee.workingTime,'Full-time');
const fullSupervisor=await create({...supervisorInput,category:'student-supervisor'},'FULL-TIME-SUPERVISOR','TEST-001');
await call('records/'+fullSupervisor,{action:'Submit',version:1});await call('records/'+fullSupervisor,{action:'Approve',version:2},verifier);await call('records/'+fullSupervisor,{action:'Publish',version:3});
eq((await call('overview',undefined,lecturer)).myContributions.appointments[0].data.category,'student-supervisor');
await call('records/'+fullSupervisor,{action:'Withdraw',version:4,comment:'Synthetic appointment concluded'},verifier);
sqlite.prepare("UPDATE employee_profile_sections SET data_json=json_set(data_json,'$.workingTime','Part-time') WHERE employee_id='TEST-001' AND section='employment'").run();
// Removing teaching access leaves only the separately approved supervisor workspace.
sqlite.prepare("UPDATE academic_grants SET effective_to=? WHERE employee_id='TEST-001' AND role='lecturer'").run(shift(-1));eq((await call('overview',undefined,lecturer)).mode,'contributor');await call('mpc-evidence',undefined,lecturer,403);
sqlite.prepare("UPDATE employee_profile_sections SET data_json=json_set(data_json,'$.workingTime','Full-time') WHERE employee_id='TEST-001' AND section='employment'").run();await call('overview',undefined,lecturer,403);sqlite.prepare("UPDATE academic_grants SET effective_to=NULL WHERE employee_id='TEST-001'").run();
// Finance handoff is separately authorised under Payroll, without access to Academic Hub.
sqlite.prepare("INSERT INTO payroll_grants(id,email,role,entity,created_at,created_by) VALUES('ordinary-finance',?,'prepare','IUC',?,?)").run(ordinary.email,today(),pc.email);const payroll=await payrollRoute(new Request('https://academic.test/api/payroll/academic-evidence'),env,{user:ordinary});eq(payroll.status,200);await call('overview',undefined,ordinary,403);
// Revoke after authorisation, before batch: no contributor report or teaching write may commit.
const snapshot=await academicAccess(env,external),originalBatch=env.DB.batch.bind(env.DB),count=sqlite.prepare("SELECT count(*) n FROM academic_records WHERE kind='contributor-output'").get().n;
const raceDB={prepare:env.DB.prepare.bind(env.DB),batch:ss=>{sqlite.prepare("UPDATE academic_records SET status='Withdrawn' WHERE id=?").run(appointment);return originalBatch(ss);}};
const race=await contributorRoute(new Request('https://academic.test/api/academic/contributions',{method:'POST',body:JSON.stringify({appointmentId:appointment,title:'Race',sourceReference:'x',findings:'x',recommendations:'x'})}),raceDB,snapshot,external,'contributions').catch(e=>e);eq(race.status,409);eq(sqlite.prepare("SELECT count(*) n FROM academic_records WHERE kind='contributor-output'").get().n,count);
const actor=await academicAccess(env,admin),atomic=lecturerActorAssert(env.DB,actor,admin);sqlite.prepare("UPDATE academic_grants SET effective_to=? WHERE employee_id='TEST-002' AND role='lecturer'").run(shift(-1));await assert.rejects(env.DB.batch(atomic));checks++;
eq(sqlite.prepare('SELECT count(*) n FROM academic_atomic_checks').get().n,0);eq(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);eq(navigationGroups({academic:true,contributorOnly:true}).flatMap(g=>g.items).map(i=>i[1]),['/academic']);
sqlite.close();console.log(JSON.stringify({passed:true,checks,coverage:'Lecturer appointment admission; dual-role management; scoped external contributor access; independent review; canonical directory/profile distinctions; part-time employees; expiry, withdrawal, archive, identity mismatch and atomic revocation; Payroll isolation',productionDataUsed:false}));
