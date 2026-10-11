export const LEAVE_TYPES=['Annual Leave','Medical Leave','Hospitalisation Leave','Emergency Leave','Compassionate Leave','Maternity Leave','Paternity Leave','Marriage Leave','Unpaid Leave','Replacement Leave','Study/Examination Leave','Special Leave'];
export const LEGAL_SOURCE='https://jtksm.mohr.gov.my/ms/soalan-lazim/akta-kerja-1955-pindaan-2022';
export const UAT_CHECKS=['Employee application and documents','Manager routing and delegation','HR allocation and cancellation','Kakitangan balances reconciled','Historical and future leave reconciled','Attendance and half-day reconciliation','Mobile experience','Access and medical privacy'];
export const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const today=()=>new Date(Date.now()+28800000).toISOString().slice(0,10);
export const parse=x=>{try{return JSON.parse(x||'{}')}catch{return {}}};
export const clean=(x,max=1000)=>String(x??'').trim().slice(0,max);
export function date(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)throw fail('Choose a valid calendar date.');return x}
export function dates(from,to,max=366){date(from);date(to);if(to<from||(Date.parse(to)-Date.parse(from))/86400000>=max)throw fail('Choose a period of up to '+max+' days.');const out=[];for(let d=from;d<=to;d=add(d,1))out.push(d);return out}
export function add(d,n){return new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)}
export function units(n){n=Number(n);if(!Number.isFinite(n)||Math.abs(n)>10000||!Number.isInteger(n*2))throw fail('Use whole or half days.');return n*2}
export const available=a=>a.accrued+a.carried+a.adjustment-a.expired-a.used-a.reserved;
export function policyInput(b){
 const p={name:clean(b.name,100),type:b.type,kind:b.kind,effective:date(b.effective),end:b.end?date(b.end):null,data:b.data||{}};
 if(!p.name||!LEAVE_TYPES.includes(p.type)||!['Statutory','Institutional'].includes(p.kind)||p.end&&p.end<p.effective)throw fail('Complete the policy title, category and effective period.');
 const d=p.data;if(!['Annual allocation','Monthly accrual','Per event','No deduction'].includes(d.method)||!['Working days','Calendar days'].includes(d.chargeBasis))throw fail('Choose allocation and charge rules.');
 units(d.days||0);if(Number(d.days)<0)throw fail('Entitlement cannot be negative.');for(const band of d.serviceBands||[]){if(!Number.isInteger(band.months)||band.months<0||units(band.days)<0)throw fail('Check the service bands.');}
 if((d.serviceBands||[]).length&&(d.serviceBands[0].months!==0||new Set(d.serviceBands.map(b=>b.months)).size!==d.serviceBands.length))throw fail('Service bands must start at joining, with distinct service thresholds.');
 if(d.serviceBasis&&!['Leave-year start','Service anniversary'].includes(d.serviceBasis))throw fail('Choose when a service band changes.');
 if(d.employmentScope&&!['All assigned employees','Full-time','Part-time'].includes(d.employmentScope))throw fail('Choose the employment scope.');
 if(d.accrualBasis&&!['Annual entitlement divided by 12','Document monthly rates'].includes(d.accrualBasis))throw fail('Choose an approved monthly accrual rule.');
 if(d.benefitsPreset==='iuc-full-annual'&&d.method==='Monthly accrual'&&!d.accrualBasis)throw fail('Choose the approved accrual rule before publishing.');
 if(d.accrualBasis==='Document monthly rates'&&(!Array.isArray(d.monthlyRates)||!d.monthlyRates.length||d.monthlyRates[0].months!==0||new Set(d.monthlyRates.map(b=>b.months)).size!==d.monthlyRates.length||d.monthlyRates.some(b=>!Number.isInteger(b.months)||b.months<0||!Number.isFinite(Number(b.days))||Number(b.days)<0||Number(b.days)>31)))throw fail('Check the documented monthly rates.');
 for(const key of ['eligibilityDelayDays','noticeDays','monthlyGuidelineDays'])if(d[key]!==undefined&&(!Number.isInteger(d[key])||d[key]<0||d[key]>365||p.type!=='Annual Leave'&&d[key]>0))throw fail('Annual waiting and planning rules apply only to annual leave.');
 if(d.medicalNoticeHours!==undefined&&(!Number.isInteger(d.medicalNoticeHours)||d.medicalNoticeHours<0||d.medicalNoticeHours>168))throw fail('Choose the medical notification period.');
 if(d.consecutiveDays!==undefined&&(!Number.isInteger(d.consecutiveDays)||d.consecutiveDays<0||d.consecutiveDays>366||d.consecutiveDays>0&&(p.type!=='Maternity Leave'||d.chargeBasis!=='Calendar days'||d.halfDay===true)))throw fail('Consecutive maternity leave requires full calendar days.');
 if(!['None','Calendar days','Completed months'].includes(d.proration||'None'))throw fail('Choose a proration rule.');
 if(!Number.isInteger(d.carryMonths||0)||d.carryMonths<0||d.carryMonths>12||units(d.carryLimit||0)<0)throw fail('Check the carry-forward rules.');
 if(!clean(d.reference,500)||d.approved!==true||p.kind==='Statutory'&&d.complianceVerified!==true)throw fail('An approved policy reference and statutory eligibility review are required.');
 if((d.categories||[]).some(x=>typeof x!=='string')||(d.employmentTypes||[]).some(x=>typeof x!=='string'))throw fail('Check policy eligibility.');
 for(const n of Object.values(d.contractDays||{}))if(units(n)<0)throw fail('Contract entitlements must be non-negative whole or half days.');
 d.paid=d.paid!==false;d.halfDay=d.halfDay===true;d.documentRequired=d.documentRequired===true;d.managerMedicalAccess=d.managerMedicalAccess===true;return p;
}
export function applicable(p,profile,d){const x=parse(p.data_json),type=String(profile.overview?.employmentType||'').toLowerCase().replace(/[^a-z]/g,''),scope=x.employmentScope,scopeAllowed=!scope||scope==='All assigned employees'||scope==='Part-time'&&type==='parttime'||scope==='Full-time'&&['permanent','contract','fulltime','temporary'].includes(type);return scopeAllowed&&p.status==='Published'&&p.effective_from<=d&&(!p.effective_to||p.effective_to>=d)&&(!(x.categories||[]).length||x.categories.includes(profile.employment?.category))&&(!(x.employmentTypes||[]).length||x.employmentTypes.includes(profile.overview?.employmentType));}
export function serviceMonths(joined,asOf){date(joined);date(asOf);return Math.max(0,(Number(asOf.slice(0,4))-Number(joined.slice(0,4)))*12+Number(asOf.slice(5,7))-Number(joined.slice(5,7))-(Number(asOf.slice(8))<Number(joined.slice(8))?1:0));}
function rateAt(bands,fallback,joined,when){let rate=Number(fallback)||0;for(const band of [...(bands||[])].sort((a,b)=>a.months-b.months))if((joined?serviceMonths(joined,when):0)>=band.months)rate=Number(band.days);return rate;}
export function entitlement(p,profile,year,asOf=today()){
 const d=parse(p.data_json),joined=profile.overview?.dateJoined||profile.employment?.appointmentDate,end=profile.exit?.lastWorkingDay;let days=Number(d.days)||0;
 const serviceDate=d.serviceBasis==='Service anniversary'?asOf<year+'-01-01'?year+'-01-01':asOf>year+'-12-31'?year+'-12-31':asOf:year+'-01-01';
 if((d.serviceBands||[]).length){if(!joined)throw fail('Date joined is required for service-based entitlement.');days=rateAt(d.serviceBands,days,joined,serviceDate);}
 if(d.contractDays&&Object.hasOwn(d.contractDays,profile.overview?.employmentType))days=Number(d.contractDays[profile.overview.employmentType]);
 const from=Math.max(Date.parse(year+'-01-01'),joined?Date.parse(date(joined)):0,p.effective_from.startsWith(String(year))?Date.parse(p.effective_from):0),to=Math.min(Date.parse(year+'-12-31'),end?Date.parse(date(end)):Infinity,p.effective_to?Date.parse(p.effective_to):Infinity);
 let fraction=1;if(to<from)fraction=0;else if(d.proration==='Calendar days')fraction=(to-from+86400000)/(Date.parse((year+1)+'-01-01')-Date.parse(year+'-01-01'));else if(d.proration==='Completed months'){const start=new Date(from),finish=new Date(to),first=start.getUTCMonth()+(start.getUTCDate()>1?1:0),last=finish.getUTCMonth()+(finish.getUTCDate()===new Date(Date.UTC(year,finish.getUTCMonth()+1,0)).getUTCDate()?1:0);fraction=Math.max(0,last-first)/12;}
 const allocated=Math.floor(units(days)*fraction),schedule=[];
 let cumulative=0;
 if(d.method==='Monthly accrual')for(let month=1;month<=12;month++){
   const monthStart=Date.UTC(year,month-1,1),monthEnd=Date.UTC(year,month,1)-86400000;
   if(monthStart>=from&&monthEnd<=to){const monthDate=new Date(monthEnd).toISOString().slice(0,10),when=d.serviceBasis==='Service anniversary'?monthDate:serviceDate,annualRate=rateAt(d.serviceBands,days,joined,when),monthly=d.accrualBasis==='Document monthly rates'?rateAt(d.monthlyRates,Number(d.monthlyRates?.[0]?.days),joined,when):annualRate/12;cumulative+=monthly*2;schedule.push({date:add(monthDate,1),units:Math.min(allocated,Math.floor(cumulative+1e-9))});}
 }
 let accrued=d.method==='Per event'?0:d.method==='Monthly accrual'?(schedule.filter(s=>s.date<=asOf).at(-1)?.units||0):allocated;
 const monthlyRate=d.accrualBasis==='Document monthly rates'?rateAt(d.monthlyRates,Number(d.monthlyRates?.[0]?.days),joined,serviceDate):days/12,rateDifference=d.method==='Monthly accrual'&&d.accrualBasis==='Document monthly rates'?Math.round((monthlyRate*12-days)*100)/100:0;
 return {allocated,accrued,schedule,annualRate:days,monthlyRate,rateDifference,serviceDate};
}
export function selectionBalance(account,policy,days,year){
 const requested=policy.method==='No deduction'?0:days.filter(d=>Number(d.date.slice(0,4))===year).reduce((n,d)=>n+d.units,0);
 if(policy.method==='Per event')return {units:requested,carryUnits:0,credit:requested,available:units(policy.days||0)/2,remaining:(units(policy.days||0)-days.reduce((n,d)=>n+d.units,0))/2};
 const total=account?available(account):0,freeCarry=account?Math.max(0,account.carried-account.expired_carry-account.used_carry-account.reserved_carry):0;
 const eligible=days.filter(d=>Number(d.date.slice(0,4))===year&&(!account?.carry_expiry||d.date<=account.carry_expiry)).reduce((n,d)=>n+d.units,0),carryUnits=Math.min(freeCarry,eligible,requested);
 if(requested-carryUnits>total-freeCarry||requested>total)throw fail('Insufficient available balance for '+year+'.',409);
 const afterExpiry=account?.carry_expiry&&days.at(-1).date>account.carry_expiry,usable=total-(afterExpiry?freeCarry-carryUnits:eligible?0:freeCarry);return {units:requested,carryUnits,credit:0,available:usable/2,remaining:(usable-requested)/2};
}
export function calendarQuote(selection,assignment,holidays,policy,overlaps=[]){
 const d=parse(policy.data_json),calendar=assignment.schedule;if(!calendar?.approved||!Array.isArray(calendar.workingDays)||!calendar.workingDays.length)throw fail('P&C must confirm your working calendar first.',409);
 const chosen=selection.dates||dates(selection.from,selection.to);if(!Array.isArray(chosen)||!chosen.length||chosen.length>366||new Set(chosen).size!==chosen.length)throw fail('Select distinct leave dates, up to 366 days.');
 const list=[...chosen].map(date).sort(),years=[...new Set(list.map(x=>Number(x.slice(0,4))))];if(years.some(y=>!(assignment.holidayYears||[]).includes(y)))throw fail('P&C must verify the applicable holidays for '+years.join(', ')+'.',409);
 const duration=selection.duration||'Full day';if(!['Full day','Morning','Afternoon'].includes(duration)||duration!=='Full day'&&!d.halfDay)throw fail('This category does not permit half-day leave.');
 if(d.consecutiveDays&&(duration!=='Full day'||list.length<d.consecutiveDays||list.some((x,i)=>i&&x!==add(list[i-1],1))))throw fail('This policy requires at least '+d.consecutiveDays+' consecutive calendar days.');
 const days=list.map(day=>{const holiday=holidays.find(h=>h.date===day&&(h.location==='All'||h.location===calendar.location)),working=calendar.workingDays.includes(new Date(day+'T00:00:00Z').getUTCDay())&&!holiday,charged=d.chargeBasis==='Calendar days'||working,slots=duration==='Full day'?['AM','PM']:duration==='Morning'?['AM']:['PM'];return {date:day,working,holiday:holiday?.title||null,reason:holiday?.title||(!working?'Non-working day':'Working day'),slots:charged?slots:[],units:charged?slots.length:0,conflict:overlaps.some(s=>s.date===day&&slots.includes(s.slot))}});
 if(days.some(d=>d.conflict))throw fail('These dates overlap an existing pending or approved application.',409);
 const charge=days.reduce((n,d)=>n+d.units,0);if(!charge)throw fail('Select at least one chargeable leave day.');
 return {days,units:charge,start:list[0],end:list.at(-1),years,duration,totalDays:dates(list[0],list.at(-1)).length};
}
export function optimise(from,to,maxDays,assignment,holidays,policy,balance,overlaps){
 const all=dates(from,to,92),budget=units(maxDays),out=[],d=parse(policy.data_json);
 for(let i=0;i<all.length;i++)for(let j=i;j<all.length&&j<i+31;j++){try{if(all[i]<policy.effective_from||policy.effective_to&&all[j]>policy.effective_to)continue;const q=calendarQuote({from:all[i],to:all[j]},assignment,holidays,policy,overlaps);const b=typeof balance==='number'?{remaining:(balance-q.units)/2}:selectionBalance(balance,d,q.days,Number(q.start.slice(0,4)));if(q.units<=budget&&b.remaining>=0&&q.totalDays>q.units/2)out.push({...q,remaining:b.remaining})}catch(e){if(e.status!==409&&e.message!=='Select at least one chargeable leave day.')throw e}}
 out.sort((a,b)=>b.totalDays-a.totalDays||a.units-b.units||a.start.localeCompare(b.start));const unique=[];for(const p of out)if(!unique.some(u=>p.start>=u.start&&p.end<=u.end))unique.push(p);return unique.slice(0,5);
}
