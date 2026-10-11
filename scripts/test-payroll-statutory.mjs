import assert from 'node:assert/strict';import fs from 'node:fs';
import {epf,socso,eis,pcb,tp1Reliefs,annualTax} from '../worker/payroll-statutory.js';
import {SOCSO_TABLE,EIS_TABLE} from '../worker/payroll-schedules.js';
const p={birthDate:'1990-01-01',contractType:'service',nationality:'citizen',firstSocsoAge:20,firstEisAge:28,eisPriorContributions:true};let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++};
const reference=JSON.parse(fs.readFileSync('scripts/payroll-epf-reference.json','utf8'));
for(const r of reference){const profile={...p,birthDate:r.part==='A'?'1990-01-01':'1960-01-01',nationality:r.part==='C'?'pr':'citizen'};for(const wages of [r.lower,r.upper]){const v=epf(wages,profile,'2026-10');same([v.employer,v.employee],[r.employer,r.employee]);}}
same([epf(325000,p,'2026-10').employer,epf(325000,p,'2026-10').employee],[42400,35900]);
same([epf(671080,p,'2026-10').employer,epf(671080,p,'2026-10').employee],[81600,74800]);
same(epf(1000,p,'2026-10').employee,0);same(epf(1001,p,'2026-10').employee,300);
const bonus=epf(600000,p,'2026-10',{normalWages:400000,bonus:200000});same(bonus.employer,78000);
const foreign={...p,nationality:'foreign',workPassExpiry:'2027-12-31',workPassReference:'pass verified'};const f=epf(175100,foreign,'2026-10');same([f.employer,f.employee],[3600,3600]);same(f.exceptions[0].severity,'critical');
assert.throws(()=>epf(175100,{...foreign,workPassExpiry:null},'2026-10'),/work pass/);checks++;
for(const r of SOCSO_TABLE){const v=socso(r.upperSen,p,'2026-10');same([v.employer,v.employee,v.lindung],[r.employer,r.employee,r.lindung]);}
for(const r of EIS_TABLE){const v=eis(r.upperSen,p,'2026-10');same([v.employer,v.employee],[r.employer,r.employee]);}
same(socso(9999999,p,'2026-10').employee,2975);same(socso(9999999,p,'2026-10').lindung,4465);same(socso(600000,p,'2026-05').lindung,0);
same(socso(600000,{...p,lindungOptOutDate:'2026-07-13',lindungReference:'PERKESO notice'},'2026-10').lindung,0);same(socso(600000,{...p,birthDate:'1960-01-01'},'2026-10').employee,0);same(socso(600000,{...p,birthDate:'1960-01-01'},'2026-10').employer,7440);
same(eis(600000,foreign,'2026-10').employee,0);same(eis(600000,{...p,birthDate:'1968-01-01',firstEisAge:57,eisPriorContributions:false},'2026-10').employee,0);
const tax={verified:true,reference:'TP1 and residency verified',residency:'resident',category:3,children:Array.from({length:3},()=>({kind:'under18',share:1}))};
// Official 2026 specification Exhibit 5 worked examples (labelled 2025 in the agency PDF).
same(pcb({month:'2026-01',tax,normal:550000,normalEpf:60500}).amount,11000);
same(pcb({month:'2026-02',tax,normal:550000,normalEpf:60500,prior:{taxable:550000,epf:60500,pcb:11000}}).amount,11000);
same(pcb({month:'2026-03',tax,normal:550000,normalEpf:60500,prior:{taxable:1100000,epf:121000,pcb:22000},reliefs:30000}).amount,10820);
const april=pcb({month:'2026-04',tax,normal:550000,additional:825000,normalEpf:60500,additionalEpf:90800,prior:{taxable:1650000,epf:181500,pcb:32820},reliefs:60000});same(april.normalBeforeZakat,10620);same(april.chargeable,5465000);same(april.additionalTax,72750);same(april.amount,83370);
same(pcb({month:'2026-10',tax:{...tax,residency:'nonresident'},normal:1000000}).amount,300000);
same(annualTax(3500000,1,'rep'),485000);same(annualTax(3500000,2,'rep'),445000);same(annualTax(3500000,2,'c_suite'),525000);
const item=(code,amountSen)=>({code,amountSen,reference:'receipt + TP1',verified:true,declarationDate:'2026-10-01'});
same(tp1Reliefs([item('sport',150000),item('lifestyle',300000)]).total,350000);same(tp1Reliefs([item('medical_serious',990000),item('medical_examination',50000)]).total,1000000);
assert.throws(()=>tp1Reliefs([item('first_home',600000)]),/first-home/);checks++;
assert.throws(()=>pcb({month:'2027-01',tax,normal:500000}),/specification/);checks++;
console.log(JSON.stringify({stage:2,checks,passed:true,epfOfficialBands:reference.length,socsoOfficialBands:SOCSO_TABLE.length,eisOfficialBands:EIS_TABLE.length,pcbOfficialWorkedExamples:4,unresolvedAgencyQuestions:['EPF percentage rounding with cents']}));
