import {payrollAccess,fail,json,requestToken} from './payroll-core.js';
import {foundationRead,foundationWrite,challenge} from './payroll-foundation.js';
import {integrationWrite} from './payroll-integration.js';
import {processingRead,processingWrite} from './payroll-processing.js';
import {governanceRead,governanceWrite} from './payroll-governance.js';
import {selfserviceRead,selfserviceWrite} from './payroll-selfservice.js';
import {reportsRead,reportsWrite} from './payroll-reports.js';
import {runRecord,runLines} from './payroll-processing.js';
import {configuration,requireRead} from './payroll-core.js';
import {payslipPdf,eaPdf,pdfResponse} from './payroll-documents.js';
async function requestBody(request){if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw fail('Use a JSON payroll request.',415);const reader=request.body?.getReader();if(!reader)throw fail('Invalid payroll request.');const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();throw fail('The payroll request is too large.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);}
export async function payrollRoute(request,env,{user}){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/payroll/'))return null;
 try{
  if(!env.DB)throw fail('Payroll storage is unavailable.',503);const a=await payrollAccess(env,user);
  if(request.method==='GET'){
   if(path==='/api/payroll/payslip-preview'){const c=await configuration(env.DB);requireRead(a,c.data.entity);const r=await runRecord(env.DB,url.searchParams.get('run')||'',c.data.entity),l=(await runLines(env.DB,r.id)).find(l=>l.employee_id===url.searchParams.get('employeeId'));if(!l)throw fail('Payslip preview not found.',404);return pdfResponse(await payslipPdf(l.snapshot,{reference:r.id,preview:r.mode!=='authoritative'||!l.published_at}),'NADI-Payslip-Preview.pdf');}
   if(path==='/api/payroll/annual-preview'){const c=await configuration(env.DB);requireRead(a,c.data.entity);const r=await env.DB.prepare('SELECT data_json,status FROM payroll_annual_statements WHERE id=?').bind(url.searchParams.get('id')||'').first();if(!r)throw fail('Annual statement not found.',404);return pdfResponse(await eaPdf(JSON.parse(r.data_json),{draft:r.status!=='issued'}),'NADI-EA-Draft.pdf');}
   for(const read of [foundationRead,processingRead,governanceRead,selfserviceRead,reportsRead]){const result=await read(env,user,a,url);if(result)return result;}
  }else if(request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)throw fail('Refresh NADI before saving this action.',403);const raw=await requestBody(request);let b;try{b=JSON.parse(raw)}catch{throw fail('Invalid payroll request.');}if(!b||typeof b!=='object'||Array.isArray(b))throw fail('Invalid payroll request.');const fingerprintRaw=path==='/api/payroll/step-up'?JSON.stringify({...b,password:undefined}):raw,t=await requestToken(request,fingerprintRaw,user,env.DB);if(t.replay)return json(t.replay,t.status);
   if(path==='/api/payroll/step-up')return await challenge(request,env,user,b,t);
   for(const write of [foundationWrite,integrationWrite,processingWrite,governanceWrite,selfserviceWrite,reportsWrite]){const result=await write(env,user,a,path,b,t);if(result)return result;}
  }else return json({error:'Method not allowed.'},405);
  return json({error:'Payroll endpoint not found.'},404);
 }catch(e){if(!e.status)console.error('Payroll request failed',e.name);return json({error:e.status?e.message:'Payroll could not complete this request. Contact the authorised payroll team.'},e.status||503);}
}
