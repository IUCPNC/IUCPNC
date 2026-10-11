# IUC Employee Profile

P&C, PNC and HR mean People and Culture.

## Working surfaces

- `/employee/profile`: signed-in employee's own record, read-only.
- `/people-culture/profiles`: P&C directory, search, records and document maintenance.
- `/people-culture/talent`: read-only career/talent view for P&C or accounts explicitly listed in `PROFILE_TALENT_EMAILS`. Empty configuration grants no senior-management access.

The existing MPC and People Master Database routes remain available. The hosting audience is unchanged. Site access and employee/P&C authorisation are separate checks: admitting an account to the Site does not grant it HR rights or another employee's record.

## Coverage

| Section | Implemented behaviour |
|---|---|
| Employee Overview | Existing ID, name, title, department, manager; preferred name, status, faculty, type, join date, calculated service, location, arrangement and uploaded profile photo. |
| Personal Information | Identity, contact, emergency, foreign-worker and teaching-permit fields; identifiers masked in employee responses. |
| Employment Information | Appointment, grade, faculty, cost centre, managers, probation/confirmation/contract dates, notice, hours and employment-history records. Core directory fields continue to use the existing P&C directory. |
| Compensation & Benefits | Own compensation visible to employee; bank account masked; tax details restricted to P&C. Salary history includes calculated percentage changes. All saved sections have immutable revisions. |
| Leave & Attendance | P&C-maintained balances and counts; computed annual leave balance and attendance percentage. No payroll or attendance-system feed is connected. |
| Performance Management | Reads live MPC submissions, component scores, trend, status and KPI records by stable employee ID. P&C maintains comments, historical reviews and PIP records. |
| Learning, CPD & Development | Training records, provider/date/hours/cost, certificate references, skills, plans, needs and fixed annual CPD target of 192 hours. Portfolio CPD is not double-counted with MPC CPD. |
| Qualifications & Credentials | Academic/professional records and attachments, discipline, subjects, research/publications/supervision, appointments/memberships/grants and researcher identifiers. |
| Skills & Competencies | Skill, level, experience years and evidence. P&C directory supports keyword/skill search and a minimum experience filter. |
| Career & Talent | P&C maintenance, explicitly authorised senior-management read-only view. Excluded from employee responses. |
| Disciplinary & Relations | P&C-only case type, status, details, outcome and document references. |
| Documents | Private R2 files with D1 ownership/category/access/hash metadata; authenticated downloads; P&C uploads/archives; profile photos and certificate selections. |
| HR Alerts | Date-based alerts and outstanding prior-month MPC status, calculated when opened. |
| Lifecycle Timeline | Combined joined/confirmed/resigned dates, employment movements, salary history, training and manually entered journey events. |
| Exit Management | Resignation, notice, last day, reason, interview, clearance, assets, final salary, leave encashment, outstanding sums and rehire eligibility. P&C-controlled opt-in date transitions. |

## Access and storage

Server-side checks apply to every API request and file download. Employees are bound to their authenticated account and employee ID. Missing, inactive, mismatched or unlinked identities fail closed. P&C uses the existing server-side P&C authorisation configuration. Senior-manager accounts must be separately configured; the talent view cannot retrieve compensation, personal data, disciplinary records or documents.

NRIC/passport/teaching-permit identifiers and bank accounts are masked before the employee response is generated. Personal identity and disciplinary files cannot be marked employee-visible. Other document categories default to P&C-only; P&C may explicitly allow the relevant employee.

File bytes live in the Site's private `PROFILE_FILES` R2 binding. D1 `document_assets` and `profile_documents` contain ownership, filename, type, category, visibility, byte size and SHA-256 metadata. No permanent public object URLs are returned. The permitted file types are PDF, DOCX, PNG and JPEG, with signature and size checks (10 MB per file). No external malware-scanning service is configured. Archives hide documents and retain bytes and metadata; automatic retention/purge is not enabled. Google Shared Drive auto-saving remains unconfigured.

`employee_profile_sections` stores structured validated section data; `profile_revisions` retains each saved version. `profile_audit` records views, changes, uploads, downloads, archives and lifecycle transitions. Writes use optimistic version checks and transactional updates. Existing `integration_events` receives schema-versioned employee-profile events without sensitive field contents.

## Deterministic rules

- Contract alerts: 60 days; probation: 30 days; passport: 183 days; visa and teaching permit: 90 days. Overdue dates remain visible. Dates use Asia/Kuala_Lumpur.
- Two consecutive calendar months with completed MPC scores at or below 2.99 produce an HR-review flag. No automatic PIP or employment decision follows.
- P&C can enable date-based lifecycle changes: resignation date → Notice Period; day after last working day → Exited; explicit alumni approval → Alumni. They run on profile access, not an unattended scheduler. Employee-profile access and downloads are refused on expiry; the employee directory is deactivated when the transition is applied.
- Current MPC scoring weights and rules are unchanged. The annual CPD target is 192 hours, as confirmed by P&C. Employee Profile progress uses completed hours divided by 192. The target is enforced for new saves and displayed consistently for existing profiles.

## Validation

`node scripts/test-profiles.mjs` runs an isolated in-memory SQLite/D1 adapter with synthetic employee identities and mocked R2. It covers migrations/FKs, employee isolation, P&C and senior-manager restrictions, masking, write origins, conflicting updates, revision audit, the two-month MPC rule, document visibility/downloads, and exit access removal. It does not write production data. Browser smoke checks use the same synthetic fixture and verify employee/P&C views and a saved edit.

No sample employee profile details or test documents are seeded into production. The existing employee directory and MPC records are reused; new fields remain unfilled until P&C supplies them.

## Order 3 lifecycle integration increment (11 October 2026)

Approved date transitions now recheck the raw profile instructions, employee identity/account/canonical links and employment record inside the existing D1 batch. Concurrent changes return HTTP 409 without partial lifecycle history or canonical updates; refresh uses the current P&C instruction. A mismatched canonical employment/person link requires P&C reconciliation. Successful profile responses show the saved active state immediately. This does not add an approval authority, automate an employment decision or complete onboarding, probation, renewal or clearance.

`node scripts/test-lifecycle-integration.mjs` adds 77 synthetic checks for concurrency, rollback, retry, idempotence, Malaysia date boundaries and canonical-link consistency. See `docs/NADI-2-lifecycle-integration.json` for the focused evidence and blockers.
