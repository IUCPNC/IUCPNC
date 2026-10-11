import {add, date, fail, units, today, entitlement, parse} from './leave-core.js';

// Approved quantities come from the supplied benefits document. Templates remain
// unpublished until P&C records the effective date and confirms applicability.
export const BENEFITS_SOURCE = {
  name: 'Leave Benefits.docx',
  sha256: '37834979574660ed4f18dba3b7d5ec48c57a9308b2896f6a57c317a091fd8a29',
  annualClarification: '21 days from five years until the tenth anniversary; 25 days from ten years.',
  accrualNote: 'The document quotes 1.2 / 1.5 / 1.75 / 2 days per month. Choose the approved accrual rule: the first and last rates differ from annual entitlement divided by twelve.',
  planningNote: 'Five days’ advance notice and the three-working-day monthly planning guideline apply to annual leave. Longer leave can be approved. Medical notification is as soon as possible and normally within 48 hours; exceptions require review.',
  statutoryNote: 'Medical, hospitalisation and maternity leave are separate entitlements. The annual waiting period and planning guidelines do not apply to these categories. More favourable approved terms remain valid.',
  publicSource: 'https://jtksm.mohr.gov.my/ms/soalan-lazim/akta-kerja-1955-pindaan-2022'
};

const bands = pairs => pairs.map(([months, days]) => ({months, days}));
const common = {
  chargeBasis: 'Working days', proration: 'None', serviceBasis: 'Service anniversary',
  carryLimit: 0, carryMonths: 0, paid: true, halfDay: false,
  documentRequired: false, managerMedicalAccess: false,
  approved: false, complianceVerified: false, categories: [], employmentTypes: [],
  reference: 'Leave Benefits.docx', sourceSha256: BENEFITS_SOURCE.sha256
};
function preset(id, name, type, kind, scope, data) {
  return {id, name, type, kind, data: {...common, ...data, employmentScope: scope, benefitsPreset: id}};
}
export const BENEFITS_PRESETS = [
  preset('iuc-full-annual', 'IUC full-time annual leave', 'Annual Leave', 'Institutional', 'Full-time', {
    days: 14, method: 'Monthly accrual', halfDay: true, eligibilityDelayDays: 90,
    noticeDays: 5, monthlyGuidelineDays: 3,
    serviceBands: bands([[0,14],[24,18],[60,21],[120,25]]),
    monthlyRates: bands([[0,1.2],[24,1.5],[60,1.75],[120,2]]), accrualBasis: 'Document monthly rates'
  }),
  preset('iuc-full-medical', 'Full-time medical leave', 'Medical Leave', 'Statutory', 'Full-time', {
    days: 14, method: 'Annual allocation', documentRequired: true, medicalNoticeHours: 48,
    serviceBands: bands([[0,14],[24,18],[60,22]])
  }),
  preset('iuc-full-hospital', 'Full-time hospitalisation leave', 'Hospitalisation Leave', 'Statutory', 'Full-time', {
    days: 60, method: 'Annual allocation', documentRequired: true, medicalNoticeHours: 48
  }),
  preset('iuc-maternity', 'Maternity leave', 'Maternity Leave', 'Statutory', 'All assigned employees', {
    days: 98, method: 'Per event', chargeBasis: 'Calendar days', documentRequired: true,
    consecutiveDays: 98
  }),
  preset('iuc-part-annual', 'Part-time annual leave', 'Annual Leave', 'Statutory', 'Part-time', {
    days: 6, method: 'Annual allocation', halfDay: true, noticeDays: 5, monthlyGuidelineDays: 3,
    serviceBands: bands([[0,6],[24,8],[60,11]]),
    reference: 'Leave Benefits.docx; Employment (Part-Time Employees) Regulations 2010'
  }),
  preset('iuc-part-medical', 'Part-time medical leave', 'Medical Leave', 'Statutory', 'Part-time', {
    days: 10, method: 'Annual allocation', documentRequired: true, medicalNoticeHours: 48,
    serviceBands: bands([[0,10],[24,13],[60,15]]),
    reference: 'Leave Benefits.docx; Employment (Part-Time Employees) Regulations 2010'
  })
];

export function benefitWarnings(policy, quote, existing, submittedOn = today()) {
  const d = parse(policy.data_json), out = [];
  if (policy.leave_type === 'Annual Leave') {
    if (d.noticeDays && quote.start < add(submittedOn, d.noticeDays))
      out.push('Less than '+d.noticeDays+' days’ advance notice. The approving officer will review the exception.');
    if (d.monthlyGuidelineDays) {
      const byMonth = {};
      for (const day of quote.days.filter(x => x.units)) byMonth[day.date.slice(0,7)] = (byMonth[day.date.slice(0,7)] || 0) + day.units;
      for (const r of existing.filter(x => x.leave_type === 'Annual Leave' && ['Pending','Information requested','Approved','Cancellation requested'].includes(x.status))) {
        for (const day of (parse(r.data_json).days || []).filter(x => x.units)) {
          const month = day.date.slice(0,7);
          if (month in byMonth) byMonth[month] += day.units;
        }
      }
      for (const [month, amount] of Object.entries(byMonth)) if (amount > units(d.monthlyGuidelineDays))
        out.push(month+': '+amount/2+' working days including this application exceeds the '+d.monthlyGuidelineDays+'-day planning guideline. Longer annual leave can be approved.');
    }
  }
  if (d.medicalNoticeHours && ['Medical Leave','Hospitalisation Leave'].includes(policy.leave_type))
    out.push('Notify your superior as soon as possible and normally within '+d.medicalNoticeHours+' hours. Explain any reasonable impediment to P&C; notification alone does not automatically reject or convert this leave.');
  return out;
}

// Ignore only leading academic titles. Employee IDs and every remaining name
// token must still agree; nicknames and name-only matching are not accepted.
const normalName = s => String(s || '').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/^(?:(?:DR|PROF|PROFESSOR)\s+)+/,'');
export function verifySnapshot(row, employee, asOf = today()) {
  if (row.sourceFormat !== 'Annual_All') return null;
  if (!/^[a-f0-9]{64}$/.test(row.sourceSha256 || '')) throw fail('Retain the source file SHA-256 reference.');
  const snapshotDate = date(row.sourceAsOf);
  if (snapshotDate > asOf || Number(snapshotDate.slice(0,4)) !== Number(row.year)) throw fail('Confirm a snapshot date within the selected year, no later than today.');
  if (!row.employeeName || normalName(row.employeeName) !== normalName(employee.employee_name)) throw fail('Employee ID matched but the source name differs. Verify the name before importing; no employee record has been changed.');
  for (const field of ['allocated','sourceTaken','opening']) if (row[field] === '' || row[field] === null || row[field] === undefined || units(row[field]) < 0) throw fail('Annual exports require non-negative entitlement, total taken and balance.');
  const allocation = units(row.allocated), taken = units(row.sourceTaken), opening = units(row.opening), carried = units(row.carried || 0);
  if (allocation + carried - taken !== opening) throw fail('Source balance discrepancy: entitlement '+allocation/2+' minus taken '+taken/2+' gives '+(allocation+carried-taken)/2+' days, but the workbook reports '+opening/2+'. Correct the source or provide an approved carry/adjustment record.');
  if (!Array.isArray(row.sourceMonthly) || row.sourceMonthly.length !== 12 || row.sourceMonthly.some(x => x === '' || x == null || units(x) < 0)) throw fail('Retain all twelve monthly source columns.');
  const monthly = row.sourceMonthly.map(x => units(x)), distributed = monthly.reduce((n,x) => n+x,0);
  if (distributed && distributed !== taken) throw fail('Monthly totals do not match Total taken. Reconcile the source distribution first.');
  return {date:snapshotDate, employeeName:row.employeeName, registeredName:employee.employee_name, matchingBasis:'Employee ID and full name; leading academic title normalised', allocated:allocation, taken, reportedBalance:opening,
    monthly:monthly.map(n=>n/2), undistributedDays:distributed ? 0 : taken/2,
    sha256:String(row.sourceSha256 || '').slice(0,64), format:'Annual_All'};
}

export function snapshotFunding(row, policy, profile, currentDate = today()) {
  const d = parse(policy.data_json), allocated = units(row.allocated), taken = units(row.sourceTaken), carried = units(row.carried || 0);
  if (!['Annual allocation','Monthly accrual'].includes(d.method)) throw fail('Annual export balances require an annual allocation or monthly-accrual policy.');
  // P&C has approved this full-year source snapshot as authoritative. Its
  // balance already includes the annual entitlement: credit that funding once,
  // retain total used, and cap later accrual at the same annual allocation.
  const fixed = {...d, days:allocated/2, serviceBands:[], contractDays:{}, proration:'None'};
  if (d.accrualBasis === 'Document monthly rates') {
    const amount = {14:1.2,18:1.5,21:1.75,25:2}[allocated/2];
    if (!amount) throw fail('Confirm a monthly rate for this source entitlement before importing.');
    fixed.monthlyRates = [{months:0,days:amount}];
  }
  const result = entitlement({...policy, effective_from:row.year+'-01-01', effective_to:null, data_json:JSON.stringify(fixed)}, {}, Number(row.year), currentDate);
  return {allocated, accrued:allocated, carried, taken, schedule:result.schedule,
    policyAccrued:result.accrued, sourceFundingDifference:(allocated-result.accrued)/2,
    fundingBasis:'Authoritative full-year source snapshot; future accrual is included and capped',
    available:(allocated+carried-taken)/2};
}
