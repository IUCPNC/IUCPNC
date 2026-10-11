import assert from 'node:assert/strict';
import {fixture,hr,employee} from './test-profiles.mjs';
import {calendarRoute,cleanCalendarEvent,localDate} from '../worker/calendar-api.js';
import {saveCalendarMonth} from '../worker/calendar-cache.js';
import {HOLIDAYS} from '../worker/calendar-holidays.js';
import worker from '../dist/server/index.js';
const {sqlite,env}=fixture();env.PC_EMAILS=hr.email;
let checks=0,connectorCalls=0,networkCalls=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++};
const connector={getContext:async()=>{connectorCalls++;throw Error('Calendar connections must not be used');},invoke:async()=>{connectorCalls++;throw Error('Calendar connections must not be used');}};
const request=(body={month:'2026-10',source:'local'},user=employee,origin='https://test',path='/api/calendar')=>calendarRoute(new Request('https://test'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}),env,{user,isPc:(_,e)=>e===hr.email,connectors:connector});
const read=async(body,user=employee)=>{const response=await request(body,user);check(response.status,200);return response.json()};
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('Calendar reads must stay in Nadi');};
try{
 check((await request(undefined,null)).status,401);
 check((await request(undefined,{...employee,userId:'wrong'})).status,403);
 check((await request(undefined,employee,'https://evil.test')).status,403);
 for(const body of [{month:'2026-13',source:'local'},{month:'2026-10',source:'other'},{month:'2026-10',source:'salary',calendar_id:'primary'}])check((await request(body)).status,400);
 const get=await calendarRoute(new Request('https://test/api/calendar'),env,{user:employee,isPc:(_,e)=>e===hr.email});check(get.status,405);
 sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001','personal',?,1,'2026-10-01','test')").run(JSON.stringify({dateOfBirth:'1990-10-15',nric:'SECRET'}));
 sqlite.prepare("INSERT INTO connect_preferences (employee_id,birthday) VALUES ('TEST-001',0)").run();
 let d=await read();check(d.events.filter(e=>e.category==='birthday').length,1);check(JSON.stringify(d).includes('1990'),false);check(JSON.stringify(d).includes('SECRET'),false);check(d.events.some(e=>e.date==='2026-10-26'),true);
 sqlite.prepare("UPDATE employees SET active=0 WHERE employee_id='TEST-001'").run();check((await request()).status,403);check((await read(undefined,hr)).events.filter(e=>e.category==='birthday').length,0);sqlite.prepare("UPDATE employees SET active=1 WHERE employee_id='TEST-001'").run();
 sqlite.prepare("INSERT INTO employee_profile_sections (employee_id,section,data_json,version,updated_at,updated_by) VALUES ('TEST-001','overview',?,1,'2026-10-01','test')").run(JSON.stringify({employmentStatus:'Exited'}));
 check((await read(undefined,hr)).events.filter(e=>e.category==='birthday').length,0);sqlite.prepare("DELETE FROM employee_profile_sections WHERE employee_id='TEST-001' AND section='overview'").run();
 for(let m=1;m<=12;m++)for(const category of ['salary','events']){
  const month='2026-'+String(m).padStart(2,'0'),day=category==='salary'?'28':'15';
  const copied=cleanCalendarEvent({id:category+'-'+m,summary:category==='salary'?'Salary payment':'IUC event',start:month+'-'+day+'T00:00:00',end:month+'-'+String(Number(day)+1)+'T00:00:00',description:'SECRET',attendees:['SECRET']},category,month);
  await saveCalendarMonth(env.DB,category,month,[copied]);
 }
 const before=JSON.stringify(sqlite.prepare('SELECT * FROM nadi_calendar_cache ORDER BY source,month').all());
 for(let m=1;m<=12;m++)for(const source of ['salary','events']){
  const month='2026-'+String(m).padStart(2,'0');
  for(const user of [employee,{...employee,authMethod:'password'},hr]){
   d=await read({month,source},user);check(d.events.length,1);check(d.storedInNadi,true);check(d.month,month);check(JSON.stringify(d).includes('SECRET'),false);
  }
 }
 d=await read({month:'2027-01',source:'salary'});check(d.events,[]);check(d.hasStoredMonth,false);check(d.storedInNadi,true);
 check((await request({month:'2026-10',source:'salary'},employee,'https://test','/api/calendar/cache/refresh')).status,403);
 const retired=await request({month:'2026-10',source:'salary'},hr,'https://test','/api/calendar/cache/refresh');check(retired.status,410);check((await retired.json()).status,'local_calendar');
 check((await read({month:'2027-01',source:'local'})).holidayCoverage,false);
 check(localDate('2026-10-01T18:00:00Z'),'2026-10-02');
 check(cleanCalendarEvent({start:'2026-09-30T00:00:00',end:'2026-10-03T00:00:00'},'events','2026-10').end,'2026-10-02');
 check(cleanCalendarEvent({visibility:'private',start:'2026-10-01'},'events','2026-10'),null);
 check(cleanCalendarEvent({status:'cancelled',start:'2026-10-01'},'events','2026-10'),null);
 check(HOLIDAYS.some(e=>e.date==='2026-02-02'),true);check(HOLIDAYS.some(e=>e.date==='2026-06-02'),true);check(HOLIDAYS.some(e=>e.date==='2026-03-08'),false);
 const routed=await worker.fetch(new Request('https://test/api/calendar',{method:'POST',headers:{origin:'https://test','oai-authenticated-user-id':employee.userId,'oai-authenticated-user-email':employee.email},body:JSON.stringify({month:'2026-10',source:'salary'})}),env,{props:{CONNECTORS:connector}});
 check(routed.status,200);check((await routed.json()).events[0].title,'Salary payment');
 check(connectorCalls,0);check(networkCalls,0);
 check(JSON.stringify(sqlite.prepare('SELECT * FROM nadi_calendar_cache ORDER BY source,month').all()),before);
 check(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}finally{globalThis.fetch=originalFetch;sqlite.close();}
console.log(JSON.stringify({checks,passed:true,areas:['January-December stored salary and event dates','same calendar for password and existing sign-in','no Google or remote calls','saved data unchanged by reads','retired remote refresh','automatic current-employee birthdays without birth years','authenticated staff access','Malaysia timezone','stored observed Selangor holidays']}));
