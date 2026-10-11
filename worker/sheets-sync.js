import {invitationRunner} from './nadi-invitations.js';
import {eligible} from './nadi-auth.js';
import {positionSheetRegisters} from './position-sheets.js';
import {positionData} from './position-core.js';
import {reconcilePositions} from './position-sync.js';
import {DATASETS,siteRecords,sheetRecords,merge,mergeAutomatic,equal,keyFor,SITE_ORIGIN,SHEET_ID} from './sheets-model.js';
import {SheetsClient} from './sheets-client.js';
import {profileRoute} from './profile-api.js';
import {EMPLOYMENT_STATUSES} from './profile-schema.js';
const stamp=()=>new Date().toISOString();
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const parse=s=>s?JSON.parse(s):null;
const fail=(s,status=400)=>Object.assign(new Error(s),{status});
async function state(db){await db.prepare("INSERT OR IGNORE INTO sheet_sync_state (id) VALUES ('main')").run();return db.prepare("SELECT * FROM sheet_sync_state WHERE id='main'").first();}
function recordStatement(db,key,base,site,sheet,issue=null,resolution=null,actor=null){return q(db,`INSERT INTO sheet_sync_records (key,base_json,site_json,sheet_json,issue,resolution,resolved_by,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET base_json=excluded.base_json,site_json=excluded.site_json,sheet_json=excluded.sheet_json,issue=excluded.issue,resolution=excluded.resolution,resolved_by=excluded.resolved_by,updated_at=excluded.updated_at`,key,base===null?null:JSON.stringify(base),site===null?null:JSON.stringify(site),sheet===null?null:JSON.stringify(sheet),issue,resolution,actor,stamp());}
async function writeRecord(...args){await recordStatement(...args).run();}
function audit(db,actor,action,key,detail){return q(db,'INSERT INTO audit_events (audit_id,occurred_at,actor_email,module_code,action,resource_type,resource_id,purpose,after_json) VALUES (?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),stamp(),actor.email,'sheets-sync',action,'sheet_sync',key,'employee_master_synchronisation',JSON.stringify(detail));}
function guarded(ds,site,sheet){
 if(ds.readOnly)return 'This information is maintained by the Site workflow';
 if(ds.id==='directory'&&(!site||site.email!==sheet?.email))return 'New employee or sign-in email change requires P&C approval';
 if(ds.id==='overview'&&site?.employmentStatus!==sheet?.employmentStatus)return 'Employment status change requires P&C approval';
 if(ds.id==='exit'&&['autoLifecycle','alumniApproved'].some(k=>site?.[k]!==sheet?.[k]))return 'Lifecycle access change requires P&C approval';
 return null;
}
async function importRecord(env,record,value,context,actor){
 const ds=record.ds,employee=context.byEmployee.get(record.employeeId);
 if(ds.readOnly)throw fail('Use the MPC or document workflow for this record');
 if(ds.id==='directory'){
  // The directory's own API handles unique identities, canonical employment data and its audit trail.
  const body={employeeId:record.employeeId,employeeName:value.employee_name,email:value.email,position:value.position,department:value.department,appraiser:value.appraiser,...(employee?{action:'update',syncExpected:employee.employee}: {})};
  const request=new Request(SITE_ORIGIN+'/api/people-culture/employees'+(employee?'/'+encodeURIComponent(record.employeeId):''),{method:employee?'PATCH':'POST',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await env.applyDirectory(request,actor);if(!response.ok)throw fail((await response.json()).error||'Employee update was rejected');return;
 }
 if(!employee)throw fail('Approve or create the employee in Employee Master first');
 const data=structuredClone(employee.sections[ds.section]||{});
 if(ds.collection){const rows=data[ds.collection]||[],i=rows.findIndex(r=>r.recordId===record.id),row={...value,recordId:record.id};if(value===null)data[ds.collection]=rows.filter(r=>r.recordId!==record.id);else{if(i<0)rows.push(row);else rows[i]=row;data[ds.collection]=rows;}}
 else Object.assign(data,value);
 const response=await profileRoute(new Request(SITE_ORIGIN+'/api/profiles/'+encodeURIComponent(record.employeeId)+'/sections/'+ds.section,{method:'PUT',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({data,version:employee.versions[ds.section]||0})}),env,{user:actor,isPc:()=>true});
 if(!response.ok)throw fail((await response.json()).error||'Profile validation rejected this update');
 // Consolidated columns share the same meaning in the profile. Keep their existing aliases in step.
 const aliases=ds.id==='overview'?[['employment','faculty',value.businessUnit]]:ds.id==='employment'?[['exit','noticePeriod',value.noticePeriod]]:[];
 for(const [section,key,v] of aliases){const refreshed=await siteRecords(env.DB),e=refreshed.byEmployee.get(record.employeeId),alias={...e.sections[section],[key]:v};if((e.sections[section]?.[key]||'')===(v||''))continue;const result=await profileRoute(new Request(SITE_ORIGIN+'/api/profiles/'+encodeURIComponent(record.employeeId)+'/sections/'+section,{method:'PUT',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({data:alias,version:e.versions[section]||0})}),env,{user:actor,isPc:()=>true});if(!result.ok)throw fail('Shared profile field changed concurrently; retry required');}
}
export async function runSync(env,client,actor,{probe=false,limit=25,automatic=true,priority='sheet'}={}){
 const db=env.DB,s=await state(db),time=Date.now(),lease=crypto.randomUUID(),runId=crypto.randomUUID();
 if(!s.enabled)probe=true;
 if(s.next_attempt>time&&!probe)return {status:'retry_wait',nextAttempt:s.next_attempt};
 const lock=await q(db,"UPDATE sheet_sync_state SET lease_id=?,lease_until=?,last_attempt=?,runner_seen=? WHERE id='main' AND lease_until<?",lease,time+180000,stamp(),stamp(),time).run();
 if(!lock.meta?.changes)return {status:'busy'};
 const counts={positionRegisters:0,toSheet:0,toSite:0,matched:0,conflicts:0,deferred:0};
 await q(db,'INSERT INTO sheet_sync_runs (id,started_at,status,actor) VALUES (?,?,?,?)',runId,stamp(),'running',actor.email).run();
 try{
  let tables=await client.read();
  if(probe){await q(db,"UPDATE sheet_sync_state SET last_error=NULL,failures=0,next_attempt=0 WHERE id='main' AND lease_id=?",lease).run();await q(db,'UPDATE sheet_sync_runs SET finished_at=?,status=? WHERE id=?',stamp(),'connection_verified',runId).run();return {status:'connection_verified',spreadsheetId:SHEET_ID};}
  await reconcilePositions(env);
  if(client.syncPositions){const positions=await positionData(db),employees=(await db.prepare('SELECT employee_id,employee_name,position,department,appraiser,active FROM employees').all()).results;counts.positionRegisters=await client.syncPositions(positionSheetRegisters(positions,employees));}
  if(client.assignRecordIds&&await client.assignRecordIds())tables=await client.read();
  const sheet=sheetRecords(tables);let context=await siteRecords(db);
  const stored=new Map((await db.prepare('SELECT * FROM sheet_sync_records').all()).results.map(r=>[r.key,r]));
  const keys=new Set([...context.records.keys(),...sheet.keys(),...stored.keys()]);let changes=0;const pending=[];const queue=async(...args)=>{pending.push(recordStatement(...args));if(pending.length>=50)await db.batch(pending.splice(0));};
  for(const key of keys){
   const a=context.records.get(key),b=sheet.get(key),old=stored.get(key),base=parse(old?.base_json),site=a?.value||null,sheetValue=b?.value||null;
   if(!a&&!b){if(old)await q(db,'DELETE FROM sheet_sync_records WHERE key=?',key).run();continue;}
   const record=a||{...b,context:context.byEmployee.get(b.employeeId)},ds=record.ds;
   const directoryKey=keyFor('directory',record.employeeId,record.employeeId),directoryState=stored.get(directoryKey),masterMissing=!sheet.has(directoryKey),archived=directoryState?.resolution==='sheet_archived';let employee=context.byEmployee.get(record.employeeId),restored=false;
   if(automatic&&archived&&!masterMissing&&ds.id==='directory'){
    const overviewKey=keyFor('overview',record.employeeId,record.employeeId),overview=sheet.get(overviewKey)?.value,status=overview?.employmentStatus;
    if(EMPLOYMENT_STATUSES.includes(status)){
     if(changes>=limit||Date.now()-time>45000){counts.deferred++;continue;}
     const fresh=sheetRecords(await client.read());if(!equal(fresh.get(directoryKey)?.value,sheetValue)||!equal(fresh.get(overviewKey)?.value,overview)){counts.deferred++;continue;}
     if(!employee?.employee.active&&EMPLOYMENT_STATUSES.includes(status)&&!['Exited','Alumni','Resigned'].includes(status)){
      const response=await env.applyDirectory(new Request(SITE_ORIGIN+'/api/people-culture/employees/'+encodeURIComponent(record.employeeId),{method:'PATCH',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({action:'reactivate'})}),{...actor,userId:'sheets-sync:'+runId});if(!response.ok)throw fail('Restored employee could not be reactivated');counts.toSite++;changes++;
     }
     context=await siteRecords(db);employee=context.byEmployee.get(record.employeeId);
     if(employee.sections.overview?.employmentStatus!==status){const response=await profileRoute(new Request(SITE_ORIGIN+'/api/profiles/'+encodeURIComponent(record.employeeId)+'/sections/overview',{method:'PUT',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({data:{...employee.sections.overview,employmentStatus:status},version:employee.versions.overview||0})}),env,{user:{...actor,userId:'sheets-sync:'+runId},isPc:()=>true,importSource:{type:'sheet_master_restoration',runId}});if(!response.ok)throw fail('Restored employee status changed concurrently; retry required');context=await siteRecords(db);employee=context.byEmployee.get(record.employeeId);}
     await q(db,'UPDATE sheet_sync_records SET resolution=NULL,issue=NULL,updated_at=? WHERE key=?',stamp(),directoryKey).run();stored.set(directoryKey,{...directoryState,resolution:null,issue:null});restored=true;
    }
   }
   // A removed master row archives the employee as a unit; never clear their retained history.
   if((masterMissing&&directoryState?.base_json||archived)&&ds.id!=='directory'){counts.matched++;continue;}
   if(archived&&!employee?.employee.active&&!restored){
    if(!masterMissing){counts.conflicts++;await queue(db,key,base,site,sheetValue,'Employee is archived. Reactivate through P&C before resuming sync.','sheet_archived');}
    else counts.matched++;
    continue;
   }
   // A retained deletion marker prevents empty summary rows being exported again.
   if(old?.resolution==='sheet_deleted'&&!b&&equal(parse(old.site_json),site)){counts.matched++;continue;}
   let decision=automatic?mergeAutomatic(base,site,sheetValue,{readOnly:ds.readOnly,priority,lockedKeys:employee?.positionManagedFields?.[ds.id]||[]}):merge(base,site,sheetValue),approved=false;
   if(old?.resolution==='sheet_deleted'&&!b&&!equal(parse(old.site_json),site))decision={action:'push',value:site};
   if(archived&&employee?.employee.active&&!restored)decision={action:'push',value:site};
   const canResolve=['site','sheet'].includes(old?.resolution)&&equal(parse(old.site_json),site)&&equal(parse(old.sheet_json),sheetValue);
   if(canResolve&&(!automatic||!ds.readOnly)){
    const selected=old.resolution==='site'?site:sheetValue;
    if(!selected){decision=old.resolution==='sheet'&&base&&site&&!ds.readOnly?{action:'delete',value:null}:{action:'conflict',reason:'Use the owning workflow to remove this record'};approved=decision.action==='delete';}
    else if(ds.readOnly&&old.resolution==='sheet')decision={action:'conflict',reason:'MPC results and document access must be maintained in their own workflow'};
    else{decision={action:old.resolution==='site'?'push':'pull',value:selected};approved=true;}
   }
   if(decision.action==='delete'&&ds.readOnly)decision={action:'conflict',reason:'This deleted row is owned by the MPC or document workflow; use that workflow to archive it'};
   if(decision.action==='equal'){
    counts.matched++;
    if(!equal(base,site)||old?.issue||restored)await queue(db,key,site,site,sheetValue);
    continue;
   }
   const guard=['pull','both'].includes(decision.action)?guarded(ds,site,sheetValue):null;
   if(guard&&!approved&&!automatic)decision={action:'conflict',reason:guard};
   if(ds.readOnly&&base&&sheetValue&&!equal(base,sheetValue)&&!approved&&!automatic)decision={action:'conflict',reason:'The Sheet changed a Site-owned result; review and restore the Site value'};
   if(decision.action==='conflict'){
    counts.conflicts++;
    if(old?.issue!==decision.reason||!equal(parse(old.site_json),site)||!equal(parse(old.sheet_json),sheetValue))await queue(db,key,base,site,sheetValue,decision.reason);
    continue;
   }
   if(changes>=limit||Date.now()-time>45000){counts.deferred++;continue;}
   changes++;
   try{
    // Recheck the database after acquiring the lease and immediately before either side is changed.
    context=await siteRecords(db);const latest=context.records.get(key)?.value||null;
    if(!equal(latest,site))throw fail('The Site changed during synchronisation; retry required');
    if(decision.action==='delete'){
     const fresh=sheetRecords(await client.read());if(fresh.has(key))throw fail('The Sheet row was restored during synchronisation; retry required');
     const deletionActor={...actor,userId:'sheets-sync:'+runId,email:old?.resolved_by||actor.email};
     if(ds.id==='directory'){
      const request=new Request(SITE_ORIGIN+'/api/people-culture/employees/'+encodeURIComponent(record.employeeId),{method:'PATCH',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({action:'deactivate',syncExpected:context.byEmployee.get(record.employeeId).employee})});
      const response=await env.applyDirectory(request,deletionActor);if(!response.ok)throw fail((await response.json()).error||'Employee archive was rejected');
      if(automatic){const refreshed=await siteRecords(db),e=refreshed.byEmployee.get(record.employeeId);const archivedOverview={...e.sections.overview,employmentStatus:'Exited'};const statusResponse=await profileRoute(new Request(SITE_ORIGIN+'/api/profiles/'+encodeURIComponent(record.employeeId)+'/sections/overview',{method:'PUT',headers:{origin:SITE_ORIGIN,'content-type':'application/json'},body:JSON.stringify({data:archivedOverview,version:e.versions.overview||0})}),env,{user:deletionActor,isPc:()=>true,importSource:{type:'sheet_master_deletion',runId}});if(!statusResponse.ok)throw fail('Employee was archived, but the profile status needs a retry');}
     }else await importRecord(env,record,ds.collection?null:Object.fromEntries(ds.fields.map(f=>[f.key,''])),context,deletionActor);
     context=await siteRecords(db);const retained=context.records.get(key)?.value||null,marker=ds.id==='directory'?'sheet_archived':'sheet_deleted';
     const statement=recordStatement(db,key,retained,retained,null,null,marker,deletionActor.email);
     await db.batch([statement,audit(db,deletionActor,ds.id==='directory'?'archived_from_sheet':'deleted_from_sheet',key,{runId,fields:ds.fields.map(f=>f.key),historyRetained:true})]);
     stored.set(key,{key,base_json:JSON.stringify(retained),site_json:JSON.stringify(retained),sheet_json:null,resolution:marker});
     counts.toSite++;continue;
    }
    const value=decision.value||site;
    if(['pull','both'].includes(decision.action)){
     // Also re-read Google before importing to avoid accepting a stale snapshot.
     const fresh=sheetRecords(await client.read()).get(key)?.value||null;if(!equal(fresh,sheetValue))throw fail('The Sheet changed during synchronisation; retry required');
     await importRecord(env,record,value,context,{...actor,userId:'sheets-sync:'+runId,email:old?.resolved_by||actor.email});counts.toSite++;
     context=await siteRecords(db);
    }
    if(['push','both'].includes(decision.action)){await client.write({...record,context:context.byEmployee.get(record.employeeId)},value,sheetValue);counts.toSheet++;}
    await db.batch([recordStatement(db,key,value,value,value,null,null,old?.resolved_by||actor.email),audit(db,{email:old?.resolved_by||actor.email},'transferred',key,{direction:decision.action,runId,fields:Object.keys(value)})]);
   }catch(error){
    // Do not advance the baseline after a failed or partial write. Reconciliation is idempotent on retry.
    await writeRecord(db,key,base,context.records.get(key)?.value||site,sheetValue,String(error.message).slice(0,240));counts.conflicts++;
   }
  }
  if(pending.length)await db.batch(pending);
  await q(db,"UPDATE sheet_sync_state SET last_success=?,last_error=NULL,failures=0,next_attempt=0 WHERE id='main' AND lease_id=?",stamp(),lease).run();
  await q(db,'UPDATE sheet_sync_runs SET finished_at=?,status=?,counts_json=? WHERE id=?',stamp(),counts.conflicts?(automatic?'needs_attention':'review_required'):counts.deferred?'in_progress':'succeeded',JSON.stringify(counts),runId).run();
  // Keep run summaries bounded. Profile changes retain the existing permanent HR audit and revision history.
  await db.prepare('DELETE FROM sheet_sync_runs WHERE id NOT IN (SELECT id FROM sheet_sync_runs ORDER BY started_at DESC LIMIT 200)').run();
  return {status:counts.conflicts?(automatic?'needs_attention':'review_required'):counts.deferred?'in_progress':'succeeded',counts};
 }catch(error){
  const message=String(error.message||'Sync failed').slice(0,240),retry=Date.now()+Math.min(900000,60000*2**Math.min(s.failures,4));
  await q(db,"UPDATE sheet_sync_state SET last_error=?,failures=failures+1,next_attempt=? WHERE id='main' AND lease_id=?",message,retry,lease).run();
  await q(db,'UPDATE sheet_sync_runs SET finished_at=?,status=?,error=? WHERE id=?',stamp(),'failed',message,runId).run();
  throw fail(message,502);
 }finally{await q(db,"UPDATE sheet_sync_state SET lease_id=NULL,lease_until=0 WHERE id='main' AND lease_id=?",lease).run();}
}
async function secretMatches(a,b){if(!a||!b||a.length<32)return false;const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([digest(a),digest(b)]);let mismatch=0;for(let i=0;i<x.length;i++)mismatch|=x[i]^y[i];return mismatch===0;}
export async function syncRoute(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/people-culture/sync'))return null;
 try{
  if(!env.DB)throw fail('Sync storage is unavailable',503);
  if(path==='/api/people-culture/sync/runner'){
   if(request.method!=='POST')throw fail('POST required',405);
   if(!await secretMatches(env.SHEETS_SYNC_RUNNER_KEY,request.headers.get('x-sync-runner-key')))throw fail('Runner authentication required',401);
   const raw=await request.text();if(raw.length>16000)throw fail('Request too large',413);const body=JSON.parse(raw);
   if(body.mailAction)return json(await invitationRunner(env,body,eligible));
   if(typeof body.googleAccessToken!=='string'||body.googleAccessToken.length<20||body.googleAccessToken.length>12000)throw fail('Google authorisation is required');
   const client=new SheetsClient(body.googleAccessToken),actor={userId:'sheets-sync',email:'h.r@innovative.edu.my'};
   if(body.probe!==true)await positionMaintenance(env);const result=await runSync({...env,applyDirectory:ctx.applyDirectory},client,actor,{probe:body.probe===true});
   return json(result);
  }
  if(!ctx.user)throw fail('Sign in is required',401);if(!ctx.isPc(env,ctx.user.email))throw fail('P&C access is required',403);
  if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)throw fail('Refresh the page before saving',403);
  const s=await state(env.DB);
  if(path==='/api/people-culture/sync'&&request.method==='GET'){
   const conflicts=(await env.DB.prepare('SELECT key,site_json,sheet_json,issue,resolution,resolved_by,updated_at FROM sheet_sync_records WHERE issue IS NOT NULL ORDER BY updated_at DESC LIMIT 100').all()).results;
   const names=new Map((await env.DB.prepare('SELECT employee_id,employee_name FROM employees').all()).results.map(r=>[r.employee_id,r.employee_name]));for(const r of conflicts)r.employeeName=names.get(JSON.parse(r.key)[1])||'';
   const runs=(await env.DB.prepare('SELECT * FROM sheet_sync_runs ORDER BY started_at DESC LIMIT 15').all()).results;
   return json({state:s,runnerConfigured:!!env.SHEETS_SYNC_RUNNER_KEY,runnerRecent:!!s.runner_seen&&Date.now()-Date.parse(s.runner_seen)<180000,spreadsheetId:SHEET_ID,conflicts,runs,intervalSeconds:60,automatic:true,conflictPriority:'sheet'});
  }
  if(path==='/api/people-culture/sync/settings'&&request.method==='POST'){
   const body=await request.json();if(typeof body.enabled!=='boolean')throw fail('Choose enabled or paused');
   if(body.enabled&&env.MIGRATION_PENDING==='true')throw fail('Complete and verify the initial data migration before enabling two-way sync.');
   if(body.enabled&&(!env.SHEETS_SYNC_RUNNER_KEY||!s.runner_seen||Date.now()-Date.parse(s.runner_seen)>180000||s.last_error))throw fail('Install and authorise the Google runner, then verify its connection before enabling');
   if(s.lease_until>Date.now())throw fail('A sync is running. Try again shortly',409);
   await env.DB.batch([q(env.DB,"UPDATE sheet_sync_state SET enabled=?,updated_by=? WHERE id='main'",body.enabled?1:0,ctx.user.email),audit(env.DB,ctx.user,body.enabled?'enabled':'paused','main',{})]);return json({enabled:body.enabled});
  }
  if(path==='/api/people-culture/sync/resolve'&&request.method==='POST'){
   const body=await request.json();if(!['site','sheet'].includes(body.choice)||typeof body.key!=='string')throw fail('Choose the correct source');
   if(s.lease_until>Date.now())throw fail('A sync is running. Review again shortly',409);
   const row=await q(env.DB,'SELECT * FROM sheet_sync_records WHERE key=?',body.key).first();if(!row?.issue||row.updated_at!==body.updatedAt)throw fail('This conflict changed. Refresh before resolving',409);
   const dataset=DATASETS.find(d=>d.id===JSON.parse(body.key)[0]);if(dataset?.readOnly&&body.choice==='sheet')throw fail('Use the MPC or document workflow for this information');
   if(row.resolution==='sheet_archived')throw fail('Reactivate the employee through P&C before resuming sync');
   if(!(body.choice==='site'?row.site_json:row.sheet_json)&&!(body.choice==='sheet'&&row.base_json&&row.site_json&&!dataset?.readOnly))throw fail('Use the owning workflow to remove this record');
   await env.DB.batch([q(env.DB,'UPDATE sheet_sync_records SET resolution=?,resolved_by=? WHERE key=? AND updated_at=?',body.choice,ctx.user.email,body.key,body.updatedAt),audit(env.DB,ctx.user,'resolution_queued',body.key,{choice:body.choice,snapshotAt:body.updatedAt})]);
   return json({queued:true});
  }
  throw fail('Not found',404);
 }catch(error){return json({error:error.status?error.message:'The sync request could not be completed'},error.status||500);}
}
import {positionMaintenance} from './position-core.js';
