import {hubAccess} from './people-hub-api.js';
import {ACTIVE} from './connect-core.js';
import {businessDate} from './profile-schema.js';
import {HOLIDAYS,HOLIDAY_YEAR} from './calendar-holidays.js';
import {cachedCalendar} from './calendar-cache.js';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function localDate(value){if(typeof value!=='string')return null;if(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/.test(value))return validDate(value.slice(0,10))?value.slice(0,10):null;const d=new Date(value);if(Number.isNaN(+d))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
// Normalize copied event data without retaining private descriptions or attendee details.
export function cleanCalendarEvent(e,category,month){if(e.status==='cancelled'||e.visibility==='private')return null;const start=localDate(typeof e.start==='object'?e.start.date||e.start.dateTime:e.start),endRaw=typeof e.end==='object'?e.end.date||e.end.dateTime:e.end,allDay=typeof e.start==='object'?!!e.start.date:/^\d{4}-\d{2}-\d{2}(T00:00:00)?$/.test(e.start||'');let end=localDate(endRaw)||start;if(allDay&&end>start){end=new Date(Date.parse(end)-86400000).toISOString().slice(0,10)}if(!start||end<month+'-01'||start.slice(0,7)>month)return null;let time='All day';if(!allDay&&Number.isFinite(Date.parse(typeof e.start==='object'?e.start.dateTime:e.start)))time=new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit'}).format(new Date(typeof e.start==='object'?e.start.dateTime:e.start));const rawStart=typeof e.start==='object'?e.start.dateTime:e.start;if(!allDay&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(rawStart||''))time=rawStart.slice(11,16)+' MYT';return {id:String(e.id||start).slice(0,200),category,title:String(e.summary||'Untitled event').slice(0,200),date:start,end,time};}
export async function calendarRoute(request,env,{user,isPc}){
 const url=new URL(request.url),retiredRefresh=url.pathname==='/api/calendar/cache/refresh';
 if(url.pathname!=='/api/calendar'&&!retiredRefresh)return null;
 if(!user)return json({error:'Sign in is required.'},401);
 if(!env.DB||!await hubAccess(env,user,isPc))return json({error:'Active staff access is required.'},403);
 if(retiredRefresh){if(!isPc(env,user.email))return json({error:'P&C calendar administration is required.'},403);return json({status:'local_calendar',message:'Calendar dates are stored in Nadi. Google Calendar synchronisation is disabled.'},410);}
 if(request.method!=='POST')return json({error:'Use the calendar controls to load dates.'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Refresh Nadi before loading the calendar.'},403);
 let body;try{const raw=await request.text();if(raw.length>2000)throw Error();body=JSON.parse(raw)}catch{return json({error:'Invalid calendar request.'},400)}
 if(!body||Object.keys(body).some(k=>!['month','source'].includes(k))||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month)||!['local','salary','events'].includes(body.source))return json({error:'Choose a valid calendar month and source.'},400);
 const {month,source}=body;
 if(source==='local'){
  const staff=(await env.DB.prepare("SELECT e.employee_name,substr(json_extract(s.data_json,'$.dateOfBirth'),6,5) birthday FROM employees e JOIN employee_profile_sections s ON s.employee_id=e.employee_id AND s.section='personal' WHERE "+ACTIVE).all()).results;
  const birthdays=staff.flatMap((e,i)=>{const date=month.slice(0,4)+'-'+e.birthday;return date.startsWith(month)&&validDate(date)?[{id:'birthday-'+i,category:'birthday',title:e.employee_name+'’s birthday',date,end:date,time:'All day'}]:[]});
  return json({status:'success',source,month,today:businessDate(),events:[...birthdays,...HOLIDAYS.filter(e=>e.date.startsWith(month)).map(e=>({...e,id:e.date+e.title,category:'holiday',end:e.date,time:'All day'}))],holidayCoverage:+month.slice(0,4)===HOLIDAY_YEAR,holidayReviewed:'2026-10-06',updatedAt:new Date().toISOString(),storedInNadi:true});
 }
 // Use the January-December copies already in the existing database. Reading or
 // reloading the calendar never connects to Google or overwrites these dates.
 const saved=await cachedCalendar(env.DB,source,month);
 if(saved)return json({...saved,storedInNadi:true});
 return json({status:'success',source,month,events:[],updatedAt:null,storedInNadi:true,hasStoredMonth:false});
}
