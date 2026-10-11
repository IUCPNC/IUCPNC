import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
// Policy source PDFs are stored privately in R2; only their catalogue and UI ship with the Worker.

const root = process.cwd();
const dist = path.resolve(root, "dist");
if (path.dirname(dist) !== root || path.basename(dist) !== "dist") throw new Error("Refusing to build outside the Site checkout.");
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, "server"), { recursive: true });
await fs.mkdir(path.join(dist, ".openai"), { recursive: true });
await fs.copyFile(path.join(root,'worker','home-priorities.js'),path.join(dist,'server','home-priorities.js'));
await fs.copyFile(path.join(root,'worker','employee-eligibility.js'),path.join(dist,'server','employee-eligibility.js'));
for(const file of ['appointment-source.js','integration-guards.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
for(const file of ['leave-api.js','leave-core.js','leave-export.js','leave-benefits.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
const leaveFiles=await Promise.all(['leave.html','leave.css','leave.js','leave-files.js'].map(f=>fs.readFile(path.join(root,'worker',f),'utf8')));
for(let i=1;i<4;i++)leaveFiles[0]=leaveFiles[0].replace('/'+['leave.html','leave.css','leave.js','leave-files.js'][i],'/'+['leave.html','leave.css','leave.js','leave-files.js'][i]+'?v='+createHash('sha256').update(leaveFiles[i]).digest('hex').slice(0,12));
await fs.writeFile(path.join(dist,'server','leave-assets.js'),['HTML','CSS','JS','FILES'].map((n,i)=>'export const LEAVE_'+n+'='+JSON.stringify(leaveFiles[i])+';').join('\n'));
const read = (file, encoding = "utf8") => fs.readFile(path.join(root, file), encoding);
for(const file of ['academic-api.js','academic-core.js','academic-foundation.js','academic-sessions.js','academic-evidence.js','academic-payroll-adapter.js','academic-notifications.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
const academicAssets=await Promise.all(['academic.html','academic.css','academic.js','academic-bridge.js'].map(f=>read('worker/'+f)));
for(const [i,extension] of [[1,'css'],[2,'js']])academicAssets[0]=academicAssets[0].replace('/academic.'+extension,'/academic.'+extension+'?v='+createHash('sha256').update(academicAssets[i]).digest('hex').slice(0,12));
await fs.writeFile(path.join(dist,'server','academic-assets.js'),['HTML','CSS','JS','BRIDGE_JS'].map((name,i)=>'export const ACADEMIC_'+name+'='+JSON.stringify(academicAssets[i])+';').join('\n'));
for(const file of ['payroll-api','payroll-core','payroll-foundation','payroll-statutory','payroll-schedules','payroll-integration','payroll-calculation','payroll-processing','payroll-governance','payroll-documents','payroll-selfservice','payroll-reports','payroll-notifications'])await fs.copyFile(path.join(root,'worker',file+'.js'),path.join(dist,'server',file+'.js'));
const payrollAssets=await Promise.all(['html','css','js'].map(ext=>read('worker/payroll.'+ext)));
for(const [index,ext] of [[1,'css'],[2,'js']])payrollAssets[0]=payrollAssets[0].replace('/payroll.'+ext,'/payroll.'+ext+'?v='+createHash('sha256').update(payrollAssets[index]).digest('hex').slice(0,12));
await fs.writeFile(path.join(dist,'server','payroll-assets.js'),['HTML','CSS','JS'].map((name,i)=>'export const PAYROLL_'+name+'='+JSON.stringify(payrollAssets[i])+';').join('\n'));
for(const file of ['nadi-invitations.js','nadi-auth.js','nadi-auth-page.js','nadi-reset-page.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.mkdir(path.join(dist,'server','vendor'),{recursive:true});
for(const file of ['bcryptjs.mjs','bcryptjs.LICENSE'])await fs.copyFile(path.join(root,'worker','vendor',file),path.join(dist,'server','vendor',file));
await fs.writeFile(path.join(dist,'server','nadi-auth-assets.js'),'export const AUTH_CSS='+JSON.stringify(await read('worker/nadi-auth.css'))+';\nexport const AUTH_JS='+JSON.stringify(await read('worker/nadi-auth-ui.js'))+';\nexport const SESSION_JS='+JSON.stringify(await read('worker/nadi-session.js'))+';\n');
for(const file of ['position-api.js','position-core.js','position-model.js','position-sources.js','position-sync.js','position-sheets.js','employee-master.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.writeFile(path.join(dist,'server','business-professional-assets.js'),'export const CARD_PROFESSIONAL_JS='+JSON.stringify(await read('worker/business-card-professional.js'))+';');
const positionAssets=await Promise.all(['html','css','js'].map(ext=>read('worker/positions.'+ext)));
for(const [index,ext] of [[1,'css'],[2,'js']])positionAssets[0]=positionAssets[0].replace('/positions.'+ext,'/positions.'+ext+'?v='+createHash('sha256').update(positionAssets[index]).digest('hex').slice(0,12));
await fs.writeFile(path.join(dist,'server','position-assets.js'),['HTML','CSS','JS'].map((name,i)=>'export const POSITIONS_'+name+'='+JSON.stringify(positionAssets[i])+';').join('\n'));
for(const file of ['connect-api.js','connect-core.js','connect-admin.js','connect-feeling.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.writeFile(path.join(dist,'server','connect-assets.js'),'export const CONNECT_HTML='+JSON.stringify(await read('worker/connect.html'))+';\nexport const CONNECT_CSS='+JSON.stringify(await read('worker/connect.css'))+';\nexport const CONNECT_JS='+JSON.stringify(await read('worker/connect.js'))+';\n');
await fs.copyFile(path.join(root,'worker','hr-service-api.js'),path.join(dist,'server','hr-service-api.js'));
for(const file of ['hr-letter.js','hr-letterhead.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.mkdir(path.join(dist,'server','vendor'),{recursive:true});
for(const file of ['pdf-lib.mjs','pdf-lib.LICENSE.md'])await fs.copyFile(path.join(root,'worker','vendor',file),path.join(dist,'server','vendor',file));
await fs.writeFile(path.join(dist,'server','hr-service-assets.js'),'export const SERVICE_HTML='+JSON.stringify(await read('worker/hr-service.html'))+';\nexport const SERVICE_CSS='+JSON.stringify(await read('worker/hr-service.css'))+';\nexport const SERVICE_JS='+JSON.stringify(await read('worker/hr-service.js'))+';\n');
await fs.copyFile(path.join(root,'worker','policy-library.js'),path.join(dist,'server','policy-library.js'));
await fs.writeFile(path.join(dist,'server','policy-assets.js'),'export const POLICIES='+await read('worker/policy-catalog.json')+';\nexport const POLICY_CSS='+JSON.stringify(await read('worker/policies.css'))+';\nexport const POLICY_JS='+JSON.stringify(await read('worker/policies-ui.js'))+';\n');
const [employeeHtml, employeeCss, employeeApp, logo, pcHtml, pcCss, directoryCss, utilitiesCss, pcApp, masterHtml, masterCss, masterApp, worker, employeeSeed, hosting] = await Promise.all([
  read("public/mpc/index.html"), read("public/mpc/styles.css"), read("public/mpc/app.js"), read("public/mpc/assets/iuc-logo.png", null),
  read("worker/pc.html"), read("worker/pc.css"), read("worker/directory.css"), read("worker/utilities.css"), read("worker/pc.js"),
  read("worker/master.html"), read("worker/master.css"), read("worker/master.js"), read("worker/index.js"), read("worker/employee-seed.js"), read(".openai/hosting.json"),
]);
await Promise.all([
  fs.writeFile(path.join(dist, "server", "index.js"), worker),
  fs.writeFile(path.join(dist, "server", "employee-seed.js"), employeeSeed),
  fs.writeFile(path.join(dist, "server", "generated-assets.js"), `export const EMPLOYEE_HTML=${JSON.stringify(employeeHtml)};\nexport const EMPLOYEE_CSS=${JSON.stringify(employeeCss)};\nexport const EMPLOYEE_APP=${JSON.stringify(employeeApp)};\nexport const IUC_LOGO_BASE64=${JSON.stringify(Buffer.from(logo).toString("base64"))};\n`),
  fs.writeFile(path.join(dist, "server", "pc-assets.js"), `export const PC_HTML=${JSON.stringify(pcHtml)};\nexport const PC_CSS=${JSON.stringify(pcCss+"\n"+directoryCss+"\n"+utilitiesCss)};\nexport const PC_APP=${JSON.stringify(pcApp)};\n`),
  fs.writeFile(path.join(dist, "server", "master-assets.js"), `export const MASTER_HTML=${JSON.stringify(masterHtml)};\nexport const MASTER_CSS=${JSON.stringify(masterCss)};\nexport const MASTER_APP=${JSON.stringify(masterApp)};\n`),
  fs.writeFile(path.join(dist, "server", "wrangler.json"), JSON.stringify({ name: "iuc-mpc-local", main: "index.js", compatibility_date: "2026-09-10", compatibility_flags: ["nodejs_compat"], vars: { PC_EMAILS: "owner@example.test" }, d1_databases: [{ binding: "DB", database_name: "iuc-mpc-local", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: "../.openai/drizzle" }] }, null, 2)),
  fs.writeFile(path.join(dist, ".openai", "hosting.json"), hosting),
  fs.cp(path.join(root, "drizzle"), path.join(dist, ".openai", "drizzle"), { recursive: true }),
]);
console.log(JSON.stringify({ worker: "dist/server/index.js", employees: 0, d1: true }));

const profileAssets=await Promise.all(['html','css','js'].map(ext=>read('worker/profile.'+ext)));
await fs.writeFile(path.join(dist,'server','profile-assets.js'),'export const PROFILE_HTML='+JSON.stringify(profileAssets[0])+';\nexport const PROFILE_CSS='+JSON.stringify(profileAssets[1])+';\nexport const PROFILE_APP='+JSON.stringify(profileAssets[2])+';\nexport const PROFILE_SCHEMA='+JSON.stringify(await read('worker/profile-schema.js'))+';\n');
for(const file of ['profile-api.js','profile-schema.js','profile-enrichment.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
const managementAssets=await Promise.all(['html','css','js'].map(ext=>read('worker/management.'+ext)));
await fs.writeFile(path.join(dist,'server','management-assets.js'),'export const MANAGEMENT_HTML='+JSON.stringify(managementAssets[0])+';\nexport const MANAGEMENT_CSS='+JSON.stringify(managementAssets[1])+';\nexport const MANAGEMENT_APP='+JSON.stringify(managementAssets[2])+';\n');
await fs.copyFile(path.join(root,'worker','management-api.js'),path.join(dist,'server','management-api.js'));
const hubAssets=await Promise.all(['html','css','js'].map(ext=>read('worker/people-hub.'+ext)));
await fs.writeFile(path.join(dist,'server','people-hub-assets.js'),'export const HUB_HTML='+JSON.stringify(hubAssets[0])+';\nexport const HUB_CSS='+JSON.stringify(hubAssets[1])+';\nexport const HUB_APP='+JSON.stringify(hubAssets[2])+';\n');
await fs.copyFile(path.join(root,'worker','people-hub-api.js'),path.join(dist,'server','people-hub-api.js'));

const cpdAssets=await Promise.all(['worker/cpd.html','worker/cpd.css','worker/cpd.js','worker/qr-generator.js'].map(f=>read(f)));
await fs.writeFile(path.join(dist,'server','cpd-assets.js'),['CPD_HTML','CPD_CSS','CPD_APP','CPD_QR'].map((name,i)=>'export const '+name+'='+JSON.stringify(cpdAssets[i])+';').join('\n'));
for(const file of ['cpd-api.js','cpd-ledger.js','cpd-mpc.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));

const syncAssets=await Promise.all(['worker/sheets-sync.html','worker/sheets-sync.css','worker/sheets-sync-ui.js','integrations/google-sheets/Code.gs','integrations/google-sheets/appsscript.json'].map(f=>read(f)));
await fs.writeFile(path.join(dist,'server','sheets-sync-assets.js'),['SYNC_HTML','SYNC_CSS','SYNC_APP','SYNC_RUNNER','SYNC_MANIFEST'].map((name,i)=>'export const '+name+'='+JSON.stringify(syncAssets[i])+';').join('\n'));
for(const file of ['sheets-sync.js','sheets-client.js','sheets-model.js','sheets-field-map.js','sheets-headers.js','profile-record-ids.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));

await fs.copyFile(path.join(root,'worker','migration.js'),path.join(dist,'server','migration.js'));

await fs.copyFile(path.join(root,'worker','directory-organisation.js'),path.join(dist,'server','directory-organisation.js'));

await fs.copyFile(path.join(root,'worker','portal-navigation.js'),path.join(dist,'server','portal-navigation.js'));

await fs.copyFile(path.join(root,'worker','home-page.js'),path.join(dist,'server','home-page.js'));
await fs.copyFile(path.join(root,'worker','portal-navigation.js'),path.join(dist,'server','portal-navigation.js'));
await fs.writeFile(path.join(dist,'server','home-assets.js'),'export const HOME_CSS='+JSON.stringify(await read('worker/home.css')+'\n@scope (.home-connect){'+(await read('worker/connect.css')).replaceAll(':root',':scope').replace(/\bbody\s*\{/g,':scope{')+'}\n'+await read('worker/home-community.css')+'\n'+await read('worker/home-refinement.css'))+';\nexport const HOME_JS='+JSON.stringify(await read('worker/home.js'))+';\n');

await fs.copyFile(path.join(root,'worker','home-announcements.js'),path.join(dist,'server','home-announcements.js'));

await fs.writeFile(path.join(dist,'server','culture-assets.js'),'export const CULTURE_HTML='+JSON.stringify(await read('worker/culture.html'))+';\nexport const CULTURE_CSS='+JSON.stringify(await read('worker/culture.css'))+';\n');
await fs.writeFile(path.join(dist,'server','document-screening-assets.js'),'export const SCREENING_HTML='+JSON.stringify(await read('worker/document-screening.html'))+';\nexport const SCREENING_CSS='+JSON.stringify(await read('worker/document-screening.css'))+';\nexport const SCREENING_JS='+JSON.stringify(await read('worker/document-screening-ui.js'))+';\n');
for(const file of ['document-screening-api.js','document-screening-core.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.copyFile(path.join(root,'worker','business-card-api.js'),path.join(dist,'server','business-card-api.js'));
const cardCss=await read('worker/business-card.css'),cardJs=(await read('worker/business-card.js')).replace('/business-card-professional.js','/business-card-professional.js?v='+createHash('sha256').update(await read('worker/business-card-professional.js')).digest('hex').slice(0,12));
const cardHtml=(await read('worker/business-card.html')).replace('/business-card.css','/business-card.css?v='+createHash('sha256').update(cardCss).digest('hex').slice(0,12)).replace('/business-card.js','/business-card.js?v='+createHash('sha256').update(cardJs).digest('hex').slice(0,12));
await fs.writeFile(path.join(dist,'server','business-card-assets.js'),'export const CARD_HTML='+JSON.stringify(cardHtml)+';\nexport const CARD_CSS='+JSON.stringify(cardCss)+';\nexport const CARD_JS='+JSON.stringify(cardJs)+';\n');

for(const file of ['attendance-api.js','attendance-core.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.writeFile(path.join(dist,'server','attendance-assets.js'),'export const ATTENDANCE_HTML='+JSON.stringify(await read('worker/attendance.html'))+';\nexport const ATTENDANCE_CSS='+JSON.stringify(await read('worker/attendance.css'))+';\nexport const ATTENDANCE_JS='+JSON.stringify(await read('worker/attendance.js'))+';\n');

await fs.copyFile(path.join(root,'worker','workforce-api.js'),path.join(dist,'server','workforce-api.js'));
await fs.writeFile(path.join(dist,'server','workforce-assets.js'),(await Promise.all(['html','css','js'].map(async ext=>'export const WORKFORCE_'+ext.toUpperCase()+'='+JSON.stringify(await read('worker/workforce.'+ext))+';'))).join('\n'));

for(const file of ['calendar-api.js','calendar-cache.js','calendar-section.js','calendar-holidays.js'])await fs.copyFile(path.join(root,'worker',file),path.join(dist,'server',file));
await fs.writeFile(path.join(dist,'server','calendar-assets.js'),(await Promise.all(['css','js'].map(async ext=>'export const CALENDAR_'+ext.toUpperCase()+'='+JSON.stringify(await read('worker/calendar.'+ext)+(ext==='css'?'\n'+await read('worker/calendar-compact.css'):''))+';'))).join('\n'));

await fs.copyFile(path.join(root,'worker','nadi-notifications.js'),path.join(dist,'server','nadi-notifications.js'));
await fs.writeFile(path.join(dist,'server','notification-assets.js'),'export const NOTIFICATION_CSS='+JSON.stringify(await read('worker/notification-ui.css'))+';\nexport const NOTIFICATION_JS='+JSON.stringify(await read('worker/notification-ui.js'))+';\n');
