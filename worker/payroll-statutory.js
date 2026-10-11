import {fail,date,period,ratio,sen,clean} from './payroll-core.js';
import {EPF_TABLE,SOCSO_TABLE,EIS_TABLE} from './payroll-schedules.js';
export const RULES={
 epf:{id:'EPF-2025-10',from:'2025-10',source:'https://www.kwsp.gov.my/documents/d/guest/third_schedule_from_-1-october-2025',verifiedOn:'2026-10-09'},
 socso:{id:'ACT4-2024-10+SKBBK-2026-06',from:'2024-10',source:'https://www.perkeso.gov.my/images/lindung/lindung-24-jam/NewContributionRateIncludingSKBBK.pdf',verifiedOn:'2026-10-09'},
 lindung:{id:'SKBBK-FAQ-2026-07-13',from:'2026-06',source:'https://www.perkeso.gov.my/images/lindung/lindung-24-jam/130726-FAQ_LINDUNG_24_JAM.pdf',verifiedOn:'2026-10-09'},
 eis:{id:'ACT800-2024-10',from:'2024-10',source:'https://www.perkeso.gov.my/images/dokumen/151124-Rate%20Contribution%20ACT%20800.pdf',verifiedOn:'2026-10-09'},
 pcb:{id:'LHDN-PCB-2026',from:'2026-01',to:'2026-12',source:'https://www.hasil.gov.my/wp-content/uploads/spesifikasi-kaedah-pengiraan-berkomputer-pcb-2026.pdf',tests:'https://www.hasil.gov.my/wp-content/uploads/mtd-testing-question-2026.pdf',verifiedOn:'2026-10-09'}
};
export const RULE_ISSUES=[{code:'epf_percentage_rounding',severity:'critical',message:'KWSP general contribution examples round the combined percentage contribution; the foreign-worker FAQ rounds each share. Obtain written confirmation of the treatment before finalising percentage-based amounts with cents.',sources:['https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution','https://www.kwsp.gov.my/en/employer/responsibilities/non-malaysian-citizen-employees']}];
const nonnegative=v=>{if(!Number.isSafeInteger(v)||v<0||v>100000000000)throw fail('Invalid statutory amount.');return v};
const ceilRM=v=>Math.ceil(v/100)*100;
export function ageAt(dob,at){date(dob);date(at);let n=Number(at.slice(0,4))-Number(dob.slice(0,4));if(at.slice(5)<dob.slice(5))n--;if(n<0||n>110)throw fail('Invalid verified date of birth.');return n;}
export function epf(wages,p,month,{normalWages=wages,bonus=0}={}){
 nonnegative(wages);period(month);if(month<RULES.epf.from)throw fail('Load and verify the EPF schedule for this historical month.');
 const age=ageAt(p.birthDate,month+'-01');if(p.contractType==='for_service'||age>=75)return {employee:0,employer:0,part:'excluded',rule:RULES.epf.id,exceptions:[]};
 if(age<14)throw fail('EPF age eligibility needs review.');
 const part=p.nationality==='foreign'&&!p.epfPre1998?'F':age<60?'A':p.nationality==='citizen'?'E':'C';
 if(part==='F'&&( !p.workPassExpiry||p.workPassExpiry<month+'-01'||!p.workPassReference))throw fail('Verify the foreign employee work pass before calculating EPF.');
 let employee,employer,exceptions=[],basis='Third Schedule wage band';
 if(part==='F'||wages>2000000){
  const ee=part==='F'?2:part==='E'?0:part==='C'?5.5:11,er=part==='F'?2:part==='E'?4:part==='C'?6:12;
  employee=ratio(wages,Math.round(ee*10),1000);employer=ratio(wages,Math.round(er*10),1000);const precise=BigInt(wages)*BigInt(Math.round(ee*10))%1000n!==0n||BigInt(wages)*BigInt(Math.round(er*10))%1000n!==0n;
  if(employee%100||employer%100||precise)exceptions.push({...RULE_ISSUES[0]});employee=ceilRM(employee);employer=ceilRM(employer);basis='Percentage estimate; separate shares rounded upwards, confirmation required for cents';
 }else{const r=EPF_TABLE.find(r=>r.part===part&&wages>=r.lower&&wages<=r.upper);if(!r&&wages!==0)throw fail('EPF schedule band is missing.');employee=r?.employee||0;employer=r?.employer||0;}
 if(bonus>0&&normalWages<=500000&&wages>500000&&['A','C'].includes(part)){employer=ceilRM(ratio(wages,part==='A'?13:65,part==='A'?100:1000,'ceil'));basis+='; normal wages at or below RM5,000 with bonus employer exception';}
 return {employee,employer,part,rule:RULES.epf.id,basis,wages,exceptions};
}
export function socso(wages,p,month){
 nonnegative(wages);period(month);if(month<RULES.socso.from||month>'2026-12')throw fail('Verify the SOCSO and LINDUNG schedules for this period.');
 if(p.contractType==='for_service'||!wages)return {employee:0,employer:0,lindung:0,category:'excluded',rule:RULES.socso.id};
 const age=ageAt(p.birthDate,month+'-01'),second=age>=60||p.firstSocsoAge>=55,row=SOCSO_TABLE.find(r=>wages<=r.upperSen)||SOCSO_TABLE.at(-1);if(!Number.isInteger(p.firstSocsoAge))throw fail('Verify the first SOCSO contribution age.');
 let lindung=0;if(month>='2026-06'){
  // June was mandatory. From 8 July local opt-out is recorded by PERKESO; no declaration defaults to participation.
  const covered=p.nationality==='foreign'||month==='2026-06'||!p.lindungOptOutDate||p.lindungOptOutDate>month+'-01';
  if(p.lindungOptOutDate&&(!p.lindungReference||p.lindungOptOutDate<'2026-07-08'))throw fail('A valid PERKESO opt-out acknowledgement is required.');
  if(p.otherEmployerLindung&&!p.lindungReference)throw fail('Verify the selected LINDUNG contribution employer.');
  if(covered&&!p.otherEmployerLindung)lindung=row.lindung;
  if(month==='2026-07'&&p.lindungOptOutDate)throw fail('The July transition month requires a verified PERKESO assessment.');
 }
 return {employee:second?0:row.employee,employer:second?row.secondEmployer:row.employer,lindung,category:second?'Second':'First',ceiling:600000,wages,rule:RULES.socso.id,lindungRule:month>='2026-06'?RULES.lindung.id:null};
}
export function eis(wages,p,month){
 nonnegative(wages);period(month);if(month<RULES.eis.from)throw fail('Verify the EIS schedule for this period.');const age=ageAt(p.birthDate,month+'-01');
 const eligible=p.contractType==='service'&&['citizen','pr'].includes(p.nationality)&&age>=18&&age<60&&(p.firstEisAge<57||p.eisPriorContributions);
 if(!Number.isInteger(p.firstEisAge))throw fail('Verify the first EIS contribution age.');const row=wages?EIS_TABLE.find(r=>wages<=r.upperSen)||EIS_TABLE.at(-1):null;return {employee:eligible?row?.employee||0:0,employer:eligible?row?.employer||0:0,eligible,wages,ceiling:600000,rule:RULES.eis.id};
}
export const TP1_CAPS={parents:800000,parents_examination:100000,disabled_equipment:600000,education:700000,education_upskill:200000,tourist_admission:100000,medical_serious:1000000,medical_examination:100000,medical_vaccine:100000,medical_learning:1000000,medical_dental:100000,sspn:800000,alimony:400000,life:300000,prs:300000,medical_insurance:400000,socso:35000,lifestyle:250000,breastfeeding:100000,childcare:300000,sport:100000,ev_compost_cctv:250000,first_home:700000};
export function tp1Reliefs(items=[],prior={},tax={}){
 if(!Array.isArray(items)||items.length>100)throw fail('Invalid TP1 claim list.');const totals={...prior},accepted=[];
 for(const i of items){if(!Object.hasOwn(TP1_CAPS,i.code)||!i.reference||!i.verified||!i.declarationDate)throw fail('Each TP1 item needs a supported category, declaration and employer verification.');date(i.declarationDate);const amount=nonnegative(i.amountSen);totals[i.code]=(totals[i.code]||0)+amount;accepted.push({...i,reference:clean(i.reference)});}
 const value=k=>Math.min(nonnegative(totals[k]||0),TP1_CAPS[k]),medical=Math.min(1000000,value('medical_serious')+value('medical_examination')+value('medical_vaccine')+value('medical_learning')+value('medical_dental')),parents=Math.min(800000,value('parents')+value('parents_examination')),education=Math.min(700000,value('education')+value('education_upskill'));
 let home=0;if(totals.first_home){const h=tax.firstHome;if(!h||!h.firstHome||h.rental||!h.agreementDate||h.agreementDate<'2025-01-01'||h.agreementDate>'2027-12-31'||!Number.isInteger(h.firstInterestYear)||h.firstInterestYear<2025||h.firstInterestYear>2026||2026-h.firstInterestYear>2||!Number.isSafeInteger(h.priceSen)||h.priceSen<=0||h.priceSen>75000000)throw fail('Verify all first-home interest eligibility conditions.');home=Math.min(totals.first_home,h.priceSen<=50000000?700000:500000);}
 if(totals.alimony&&tax.category===2)throw fail('Spouse relief and alimony cannot both be claimed.');
 const flat=['sspn','alimony','disabled_equipment','tourist_admission','life','prs','medical_insurance','socso','lifestyle','breastfeeding','childcare','sport','ev_compost_cctv'].reduce((s,k)=>s+value(k),0);
 return {total:parents+medical+education+home+flat,totals,accepted};
}
const roundFive=v=>Math.ceil(Math.max(0,v)/5)*5;
export function annualTax(p,category,scheme='standard'){
 p=Math.max(0,p);if(['rep','knowledge','c_suite'].includes(scheme))return Math.max(0,ratio(p,15,100,'floor')-(scheme!=='c_suite'&&p<=3500000?(category===2?80000:40000):0));
 const bands=[[500000,0,0,0],[2000000,500000,1,category===2?-80000:-40000],[3500000,2000000,3,category===2?-65000:-25000],[5000000,3500000,6,60000],[7000000,5000000,11,150000],[10000000,7000000,19,370000],[40000000,10000000,25,940000],[60000000,40000000,26,8440000],[200000000,60000000,28,13640000],[Infinity,200000000,30,52840000]];
 const b=bands.find(b=>p<=b[0]);return Math.max(0,ratio(p-b[1],b[2],100,'floor')+b[3]);
}
export function pcb(input){
 const {month,tax,normal,additional=0,normalEpf=0,additionalEpf=0,prior={},reliefs=0,zakat=0}=input;period(month);if(month<'2026-01'||month>'2026-12')throw fail('The verified PCB specification supports assessment year 2026. Load the relevant specification for another year.');
 [normal,additional,normalEpf,additionalEpf,reliefs,zakat].forEach(nonnegative);if(!tax?.verified||!tax.reference||!['resident','nonresident'].includes(tax.residency))throw fail('Verify tax residency and supporting tax information.');
 if(tax.residency==='nonresident')return {amount:roundFive(ratio(normal+additional,30,100,'floor')),normalTax:ratio(normal,30,100,'floor'),additionalTax:ratio(additional,30,100,'floor'),rule:RULES.pcb.id,chargeable:normal+additional,basis:'Nonresident remuneration: 30%, no personal relief'};
 if(![1,2,3].includes(tax.category))throw fail('Choose a verified tax family category.');
 const scheme=tax.scheme||'standard';if(!['standard','rep','knowledge','c_suite'].includes(scheme))throw fail('Unsupported tax scheme.');if(scheme!=='standard'&&(!tax.schemeApproval||!tax.schemeFrom||!tax.schemeTo||month<tax.schemeFrom||month>tax.schemeTo))throw fail('Verify the approved concession and its effective period.');
 const children=tax.children||[];if(!Array.isArray(children)||children.length>30)throw fail('Invalid qualifying child declarations.');const child=children.reduce((s,x)=>{if(!['under18','study','higher','disabled','disabled_higher'].includes(x.kind)||![1,.5].includes(x.share))throw fail('Verify child relief type and share.');return s+({under18:200000,study:200000,higher:800000,disabled:800000,disabled_higher:1600000}[x.kind]*x.share)},0);
 const D=900000+(tax.category===2?400000:0)+(tax.disabled?700000:0)+(tax.disabledSpouse?600000:0)+child+reliefs,remaining=12-Number(month.slice(5)),Y=nonnegative(prior.taxable||0),K=Math.min(400000,nonnegative(prior.epf||0)),X=nonnegative(prior.pcb||0),Z=nonnegative(prior.zakat||0),K1=Math.min(normalEpf,400000-K);
 function charge(add,contrib){const Kt=Math.min(contrib,Math.max(0,400000-K-K1)),K2=remaining?Math.min(K1,Math.floor(Math.max(0,400000-K-K1-Kt)/remaining)):0;return {P:Math.max(0,(Y-K)+(normal-K1)+(normal-K2)*remaining+(add-Kt)-D),K1,K2,Kt};}
 const n=charge(0,0),annualNormal=annualTax(n.P,tax.category,scheme),raw=Math.max(0,Math.floor((annualNormal-Z-X)/(remaining+1))),C=raw<1000?0:raw;
 const a=charge(additional,additionalEpf),annualAdditional=annualTax(a.P,tax.category,scheme),annualMTD=X+C*(remaining+1),addTax=additional?Math.max(0,annualAdditional-annualMTD-Z):0,amount=roundFive(C-zakat+addTax);
 return {amount,normalTax:roundFive(Math.max(0,C-zakat)),additionalTax:addTax,normalBeforeZakat:C,chargeable:a.P,normalChargeable:n.P,annualTax:annualAdditional,annualNormalTax:annualNormal,K1:a.K1,K2:a.K2,Kt:a.Kt,prior:{Y,K,X,Z},deductions:D,remaining,scheme,rule:RULES.pcb.id,basis:'2026 computerised MTD specification; truncation to sen then upward rounding to five sen'};
}
