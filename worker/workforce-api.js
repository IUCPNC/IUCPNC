import {hubAccess} from './people-hub-api.js';
import {businessDate,lifecycleStatus,ANNUAL_CPD_TARGET} from './profile-schema.js';
import {mergeProfileCredits} from './cpd-ledger.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const parse=v=>{try{return JSON.parse(v||'{}')}catch{return {}}};
const label=v=>String(v||'').trim()||'Not recorded';
const distribution=values=>Object.entries(values.reduce((a,v)=>(a[label(v)]=(a[label(v)]||0)+1,a),{})).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
// Suppress the entire distribution to prevent deriving a small category by subtraction.
export function privateDistribution(values){const rows=distribution(values);return {suppressed:rows.some(r=>r.count<5)||!rows.length,rows:rows.length&&rows.every(r=>r.count>=5)?rows:[]};}
const ageBand=(dob,today)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(dob||'')||Number.isNaN(Date.parse(dob))||dob>today)return 'Not recorded';const age=+today.slice(0,4)-+dob.slice(0,4)-(today.slice(5)<dob.slice(5)?1:0);return age<18||age>100?'Not recorded':age<30?'Under 30':age<40?'30–39':age<50?'40–49':age<60?'50–59':'60 and above'};
const tenure=(date,today)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||date>today)return 'Not recorded';const years=(Date.parse(today)-Date.parse(date))/31557600000;return !Number.isFinite(years)?'Not recorded':years<1?'Under 1 year':years<3?'1–2 years':years<5?'3–4 years':years<10?'5–9 years':'10+ years'};
export async function workforceRoute(request,env,{user,isPc}){
 const url=new URL(request.url);if(url.pathname!=='/api/workforce')return null;
 if(!user)return json({error:'Sign in is required.'},401);
 if(!env.DB)return json({error:'Workforce data is temporarily unavailable.'},503);
 const access=await hubAccess(env,user,isPc);if(!access)return json({error:'Active employee or P&C access is required.'},403);
 if(request.method!=='GET')return json({error:'This dashboard is read-only.'},405);
 const advanced=access.role!=='employee',today=businessDate(),currentMonth=today.slice(0,7),month=url.searchParams.get('month')||currentMonth;
 if([...url.searchParams.keys()].some(k=>!['month','department','type','summary'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length>1))return json({error:'Unsupported filter.'},400);
 if(!advanced&&['month','department','type'].some(k=>url.searchParams.has(k)))return json({error:'Employee summaries use organisation-wide data only.'},403);
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||month>currentMonth)return json({error:'Choose a valid reporting month up to the current month.'},400);
 const department=url.searchParams.get('department')||'',type=url.searchParams.get('type')||'',summary=url.searchParams.get('summary')==='1';
 if(department.length>200||type.length>100)return json({error:'Invalid filter.'},400);
 const manager=access.role==='manager',scope=manager?' AND employee_id IN (SELECT employee_id FROM management_reports WHERE manager_id=?)':'',args=manager?[access.employeeId]:[],db=env.DB;
 const all=async(sql,...values)=>(await db.prepare(sql).bind(...values).all()).results;
 const employees=await all('SELECT employee_id,employee_name,position,department FROM employees WHERE active=1'+scope,...args);
 const sections=await all("SELECT employee_id,section,data_json FROM employee_profile_sections WHERE section IN ('overview','exit'"+(advanced?",'employment','learning'":'')+") AND employee_id IN (SELECT employee_id FROM employees WHERE active=1"+scope+')',...args);
 const profiles=new Map();for(const row of sections){if(!profiles.has(row.employee_id))profiles.set(row.employee_id,{});profiles.get(row.employee_id)[row.section]=parse(row.data_json)}
 const current=employees.filter(e=>!['exited','resigned','alumni'].includes(String(lifecycleStatus(profiles.get(e.employee_id)||{},today)).toLowerCase()));
 const selected=current.filter(e=>(!department||label(e.department)===department)&&(!type||label(profiles.get(e.employee_id)?.overview?.employmentType)===type));
 const ids=new Set(selected.map(e=>e.employee_id)),count=selected.length;
 const result={role:access.role,scope:manager?'Assigned direct reports':'IUC organisation',asOf:today,month,headcount:count,departmentCount:new Set(selected.map(e=>label(e.department))).size,departments:distribution(selected.map(e=>e.department)),employmentTypes:distribution(selected.map(e=>profiles.get(e.employee_id)?.overview?.employmentType)),definitions:'Current employees have an active account and are not Exited, Resigned or Alumni. Headcount is a current snapshot, not historical headcount.'};
 if(summary)return json(result);
 if(!manager){
  // Only the three aggregate inputs are read; identifiers, contact details and pay are never queried.
  const demographics=await all("SELECT employee_id,json_extract(data_json,'$.gender') gender,json_extract(data_json,'$.dateOfBirth') dob,json_extract(data_json,'$.nationality') nationality FROM employee_profile_sections WHERE section='personal' AND employee_id IN (SELECT employee_id FROM employees WHERE active=1)");
  const byId=new Map(demographics.map(e=>[e.employee_id,e]));
  result.demographics={gender:privateDistribution(selected.map(e=>{const g=byId.get(e.employee_id)?.gender;return ['Female','Male','Non-binary','Prefer not to say'].includes(g)?g:'Not recorded'})),age:privateDistribution(selected.map(e=>ageBand(byId.get(e.employee_id)?.dob,today))),nationality:privateDistribution(selected.map(e=>{const n=byId.get(e.employee_id)?.nationality;return !n?'Not recorded':String(n).trim().toLowerCase()==='malaysian'?'Malaysian':'International'}))};
 }
 if(!advanced)return json(result);
 result.filters={departments:distribution(current.map(e=>e.department)).map(r=>r.label),types:distribution(current.map(e=>profiles.get(e.employee_id)?.overview?.employmentType)).map(r=>r.label)};
 result.statuses=distribution(selected.map(e=>lifecycleStatus(profiles.get(e.employee_id)||{},today)));
 result.arrangements=distribution(selected.map(e=>profiles.get(e.employee_id)?.overview?.workArrangement||profiles.get(e.employee_id)?.employment?.workArrangement));
 result.tenure=distribution(selected.map(e=>tenure(profiles.get(e.employee_id)?.overview?.dateJoined||profiles.get(e.employee_id)?.employment?.appointmentDate,today)));
 const end=new Date(month+'-01T00:00:00Z'),start=new Date(end);start.setUTCMonth(start.getUTCMonth()-5);const first=start.toISOString().slice(0,7);
 const mpc=await all('SELECT employee_id,reporting_year,month,overall_score,check_in_status,updated_at FROM mpc_submissions WHERE (reporting_year*100+month) BETWEEN ? AND ? AND employee_id IN (SELECT employee_id FROM employees WHERE active=1'+scope+') ORDER BY updated_at DESC',+first.replace('-',''),+month.replace('-',''),...args);
 const latest=new Map();for(const r of mpc){const key=r.employee_id+':'+r.reporting_year+'-'+String(r.month).padStart(2,'0');if(ids.has(r.employee_id)&&!latest.has(key))latest.set(key,r)}
 const metric=period=>{const rows=selected.map(e=>latest.get(e.employee_id+':'+period)).filter(Boolean),completed=rows.filter(r=>r.check_in_status==='Completed'),scored=completed.filter(r=>r.overall_score!==null&&Number.isFinite(+r.overall_score)&&+r.overall_score>=0&&+r.overall_score<=5);return {period,completed:completed.length,eligible:count,average:scored.length?Math.round(scored.reduce((n,r)=>n+Number(r.overall_score),0)/scored.length*100)/100:null,scored:scored.length}};
 result.mpc=metric(month);result.trend=[];for(let i=0;i<6;i++){const d=new Date(start);d.setUTCMonth(start.getUTCMonth()+i);result.trend.push(metric(d.toISOString().slice(0,7)))}
 const credits=await all('SELECT id,employee_id,source_type,source_id,attended_at,hours,voided_at FROM cpd_credits WHERE employee_id IN (SELECT employee_id FROM employees WHERE active=1'+scope+')',...args);
 const creditMap=new Map();for(const c of credits){if(!creditMap.has(c.employee_id))creditMap.set(c.employee_id,[]);creditMap.get(c.employee_id).push(c)}
 const hours=new Map(selected.map(e=>[e.employee_id,mergeProfileCredits(profiles.get(e.employee_id)?.learning?.training,creditMap.get(e.employee_id)||[]).filter(r=>r.verificationStatus==='Approved'&&String(r.date).startsWith(month.slice(0,4))&&String(r.date).slice(0,10)<=today).reduce((n,r)=>n+Math.max(0,Number(r.cpdHours)||0),0)]));
 const total=[...hours.values()].reduce((a,b)=>a+b,0);result.cpd={year:+month.slice(0,4),target:ANNUAL_CPD_TARGET,totalHours:Math.round(total*100)/100,averageHours:count?Math.round(total/count*100)/100:0,targetMet:[...hours.values()].filter(h=>h>=ANNUAL_CPD_TARGET).length};
 if(access.role==='hr'||manager)result.people=selected.map(e=>{const r=latest.get(e.employee_id+':'+month);return {id:e.employee_id,name:e.employee_name,position:e.position,department:label(e.department),status:lifecycleStatus(profiles.get(e.employee_id)||{},today),mpcStatus:r?.check_in_status||'Not started',mpcScore:r?.check_in_status==='Completed'&&r.overall_score!==null?r.overall_score:null,cpdHours:Math.round(hours.get(e.employee_id)*100)/100}});
 result.notes=['MPC uses completed check-ins; missing scores are not treated as zero. The six-month trend follows the current filtered workforce, not historical headcount.','CPD includes approved recorded hours in the selected year up to today, with ledger duplicates removed. Annual target: 192 hours.','Only current employees are counted. Missing profile values appear as Not recorded.'];
 return json(result);
}
