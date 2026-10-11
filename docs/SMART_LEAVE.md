# IUC Nadi Smart Leave Management

This module reuses the existing employee master, IUC sign-in, explicit management grants, reporting relationships, private file storage and notification sender. It adds leave records without duplicating employees or replacing existing HR, MPC or attendance history.

## Entrances

- Employee: `/employee/leave` — dashboard, three-step application, history, calendar and planner.
- P&C: `/admin/leave` — policies, employee setup, balances, coverage, migration, audit and analytics.
- Manager/HOD: `/manager/leave` — authorised reports, current approval routes and team availability.
- Senior management: `/top-management/leave` — scoped aggregate workforce insights.

The shared navigation, homepage, employee profiles and MPC period context link to these records. Approved leave does not change MPC scores. Public business cards never receive leave records.

## Safe production starting state

The default stage is **Configuration**. No production entitlement, employee allocation or holiday is seeded. Kakitangan remains authoritative. Configuration, Migration, Parallel Validation and User Acceptance Testing maintain a validation ledger; they do not update attendance as authoritative leave.

Only formal P&C cutover enables authoritative Nadi leave and attendance integration. Publication of the software is separate from this operational approval.

## P&C setup and controlled rollout

1. Open **P&C administration → Policies**. Publish effective-dated policies using approved IUC document references. Select statutory or institutional origin, allocation/accrual method, charge basis, paid status, half-day/document rules, service bands, proration and carry-forward rules. Confirm eligibility and statutory applicability against the approved terms; the module does not certify legal compliance.
2. Open **Employee setup**. Assign applicable policy versions and approved working calendars to current employees. Verify workdays, state/location, holiday years and any contract entitlement override. Approval authority uses existing explicit reporting relationships and management grants; committee appointments do not establish approval authority.
3. Open **Calendars & coverage**. Add verified state/public/institutional holidays with source references, coverage requirements and reminder settings. Missing verified calendars block applications and optimiser recommendations.
4. Open **Balances & year-end**. Allocate the appropriate year. Monthly accrual, joiner/leaver proration and service bands use policy configuration. Adjustments and recalculations require reasons and retain the ledger. Resolve reservations before replacing an allocation's policy calculation.
5. Open **Migration & cutover**. Obtain an authorised Kakitangan CSV/XLSX export. Download the import template, select the source file, map its columns, stage it and correct any reported errors. Verify stable employee IDs/emails, policy assignments, opening balances, historical charged days and future/pending applications before applying.
6. Download and review the reconciliation report. Keep the Kakitangan source export and comparison evidence. Resolve or explicitly discard invalid staged batches with an audited reason.
7. Run **Parallel Validation** with employees, managers and P&C. Continue administering official leave in Kakitangan during comparison; avoid conflicting updates or duplicate official deductions.
8. Record the eight human UAT sign-offs and their evidence references: application/documents; routing/delegation; HR allocation/cancellation; balances; history/future leave; attendance/half days; mobile; access/medical privacy.
9. Select **Controlled Cutover**, record reconciliation approval and complete the explicit formal cutover confirmation. The server checks outstanding validation applications, import verification and current employee setup. Keep Kakitangan data intact. Reverting the system of record requires a separately reconciled operational plan.

## Import semantics

- Use a stable source reference for each balance/history row. Previously applied references are rejected to avoid duplicate imports.
- Opening balance must already include historical use and **exclude deductions for pending/future leave**. Future approved deductions and pending reservations are applied once by the validation ledger.
- Historical rows require the source's charged days. Past history is retained without deducting it again. Future leave must pass the actual policy, working-calendar and overlap checks.
- Nonconsecutive or partial historical records must retain their source identity and source total. The importer does not guess a distribution of historical days across months. Historical records crossing reporting months are identified separately in trend reports.
- Corrections to a reconciled opening balance preserve previously imported future deductions. Pending reservations must be resolved before opening-balance correction.
- CSV/XLSX imports are bounded to 250 rows per batch. Split larger authorised exports into batches, keeping unique references. XLSX parsing uses the first worksheet; CSV/template export is useful for selecting the intended table.

## Entitlements and integrity

### Benefits document customisation (8 October 2026)

The six benefit templates are grounded in `Leave Benefits.docx`: full-time annual, medical and hospitalisation leave, maternity leave, and part-time annual/medical leave. They retain the source reference and document hash. Templates require P&C to confirm the effective date and applicability before publishing; no approval date, carry-forward rule or additional category entitlement is invented.

- Full-time annual leave: 14 / 18 / 21 / 25 days at joining, two, five and ten completed years. P&C clarified that 21 days continues until the tenth anniversary and 25 days begins at ten years.
- Monthly annual accrual retains the document's 1.2 / 1.5 / 1.75 / 2 days. P&C selected these rates. The UI flags the 14.4 versus 14 and 24 versus 25 annual differences, rounds cumulative usable credit down to half-day units, and caps credit at annual entitlement.
- Annual leave has a 90-day waiting period, five-day notice guideline and three-working-day monthly planning guideline. Longer approved annual leave remains possible. The latter two rules produce review warnings rather than automatic denial.
- Medical leave is 14 / 18 / 22 days, hospitalisation is a separate 60 days, and maternity is 98 consecutive calendar days. Annual waiting/notice/planning rules never gate these protected categories. Medical notification guidance explains reasonable impediments and never silently converts the leave to unpaid.
- Part-time annual leave is 6 / 8 / 11 days, and medical leave is 10 / 13 / 15 days at joining, two and five years. Unknown employment types require explicit applicability confirmation.
- Most objective fields use structured dropdowns, including service thresholds/rates, employment scope, charge basis, proration, yes/no choices, carry rules, notice/waiting guidelines, calendar location, year and half-day boundary. Free text remains for source references, reasons and handover notes; actual dates use date controls.

### Authoritative annual snapshot import

`Annual_All_y2026.xlsx` is authorised as the 2026 balance snapshot as of **8 October 2026**, subject to resolving source exceptions. Its 17-column layout is detected automatically. File upload and a pasted CSV export both use the same private P&C staging workflow; parsing does not call an AI/model service.

Stable employee ID and normalised full name must agree. Entitlement, total taken and balance must reconcile in half-day units. Every raw source row, including held exceptions and archived employees, remains in the private review trail. P&C may explicitly apply verified rows while holding exceptions, but that batch cannot be marked fully verified or used for cutover until those exceptions are resolved.

Name matching normalises letter case, punctuation and leading academic titles (`Dr`, `Prof`, `Professor`); the stable employee ID and all remaining name tokens must agree. The source name, registered name and matching basis remain recorded. Unknown IDs and substantive name differences are never matched by a name-only guess. Snapshot validation, application and reconciliation use bounded bulk database reads; ledger writes still use one atomic transaction with version guards.

The approved snapshot includes full-year funding. Import credits it once, retains actual annual usage and caps subsequent accrual at that same source allocation. Assigning an approved benefits policy later preserves the source bank while applying policy eligibility and future-year rules. A balance-only source policy cannot be used to grant application eligibility or satisfy cutover.

All twelve monthly columns in this export are zero despite nonzero annual usage. The module retains the annual taken total and reports its missing monthly distribution. It does not invent dated leave requests, monthly trends, approvals or additional credit to conceal discrepancies. Held exceptions and reconciliation reports can be downloaded as CSV.

After source correction, P&C can link a fully verified complete replacement snapshot for the same date. It must retain all previously matched balances, and every held row needs an explicit corrected employee balance or documented exclusion with evidence. The original partial batch becomes `Superseded`, never silently `Verified`; its raw source, errors and resolution trail remain intact.

The account stores allocated, accrued, carried, expired, adjusted, reserved and used half-day units separately. Carry reservations/use/expiry have separate counters. Every write retains its reason, actor and reference in the transaction ledger.

Requests snapshot policy, calendar, approval route and charges. Approval rechecks employee lifecycle, current reporting/grants, policy/calendar version, available balance and overlap. Changes requiring reassessment are surfaced to P&C instead of silently rewriting historical approvals.

Full, morning and afternoon selections use date/slot uniqueness. Version guards and atomic batches prevent simultaneous applications from overdrawing an account. JSON mutations require idempotency keys; repeated identical calls reuse the result, while changed payloads conflict.

Per-event leave limits apply to each event and are distinct from annual entitlement buckets. Annual/monthly methods, carry-forward expiry, cancellation reversals, completed-year processing and approved recalculation are auditable.

## Access and privacy

- Employees receive their own records and balances.
- Managers receive explicitly assigned reports or current authorised approval/delegation routes. Current reviewers receive the relevant request balance; they do not obtain all unrelated entitlement records.
- P&C administers all leave records through its existing authorised role.
- Senior management receives scoped aggregate insights, without individual reasons, medical evidence or balances.
- Shared calendars expose availability and dates, without private reasons, leave category or supporting documents.
- Private evidence is limited to PDF/JPG/PNG up to 5 MB, with content-signature checks. Supporting documents are stored in private R2 and served through authenticated, employee-bound routes. Approver evidence access requires policy authorisation and a current valid route/grant; revoked delegates lose access.
- Inactive/Exited accounts and anonymous users cannot access private leave data. Supporting files have no permanent public links.

## Attendance, MPC and notifications

After formal cutover, approved leave is read as the authoritative attendance context. Full/half days distinguish paid and unpaid time; backdated approval is included, and approved cancellation restores the original attendance context. Missing-clock/absence flags are suppressed only for the applicable leave portion. Actual late arrival outside the exempt portion remains visible.

MPC and manager review show approved leave context for the selected period. Leave never changes score calculation or submitted score payloads automatically.

Submission, decisions, information requests, cancellation, upcoming leave, expiry and outstanding approvals reuse Nadi notifications and the configured email sender. Duplicate reminders are suppressed. Email availability and delivery depend on the existing sender configuration; local tests do not establish production email deliverability.

Visible leave screens refresh approximately every minute when no form/dialog is being edited. This is near real time, not guaranteed instantaneous delivery. Existing attendance and notification clients follow their own refresh intervals.

## Scope and operational limits

- The planner/holiday optimiser uses deterministic rules, verified holidays and actual available entitlement; routine operation makes no AI/model calls or paid third-party API calls.
- Coverage is advisory unless an approved policy explicitly requires a restriction. It must not be treated as an automatic denial of a lawful entitlement.
- Academic handover, replacement lecturer and rescheduling notes are supported. Automatic timetable/examination checks require an operational scheduling source; no timetable data is fabricated.
- Analytics/export supports Excel, CSV and PDF with scope enforcement. Leave liability is reported in days; a monetary liability calculation requires approved payroll terms and an operational payroll integration.
- Kakitangan import is through authorised files, not a live external write/API connection. No Kakitangan record is modified by Nadi.
- Existing employee master changes are reused; the new leave ledger is not silently mirrored into legacy profile counters or unconfigured spreadsheet tabs.

## Validation evidence

Automated leave suites cover core, integration and benefits/snapshot checks using synthetic data only. Covered cases include full/half/nonconsecutive/cross-year leave, concurrent reservations, idempotency, carry expiry, documented monthly rates, completed service anniversaries, per-event leave, exact employee/source matching, staged and partial import/reconciliation, corrected-source linking, multi-level routing, revoked delegation, evidence privacy, attendance reconciliation and cancellation.

Existing navigation, homepage, IUC authentication, management, profiles, notifications and attendance suites also passed. Desktop and 390-pixel mobile browser checks covered dashboard, three-step submission, planner recommendations, calendar agenda and P&C configuration. Browser fixtures remain local and are not institutional policies or real employee records.

These checks support software readiness for controlled validation. They do not replace P&C's source-data reconciliation, actual employee/manager UAT, email delivery check or formal system-of-record cutover approval.
