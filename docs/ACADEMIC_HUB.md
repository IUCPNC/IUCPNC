# Nadi Academic Hub implementation and operating guide

Reviewed: 9 October 2026. Baseline: published Nadi version 67, source commit `367e5ab9bcf7ac413489092738cb8e21a9029774`.

## Existing-system assessment

The source assessment was completed before implementation. Nadi is an authenticated Cloudflare Worker with D1, private R2 documents, canonical employee/account binding and shared audit, integration and notification services. The Site's existing public audience is preserved; protected application pages and APIs still require authentication and module permissions.

| Authoritative owner | Existing source assessed | Academic Hub treatment |
| --- | --- | --- |
| Employee Profile and people master | employees, people/employment records, profile sections; profile-api.js | Reuse employee IDs, account binding, qualification sections and a limited employment projection. No second staff database. No pay, personal, disciplinary or talent sections in academic responses. |
| Position & Role Library | position_library, position_assignments; position-api.js | Reuse current appointments, permit multiple roles on one employee, and revalidate linked appointment dates in access checks and transactions. A title does not grant access. |
| MPC | mpc_submissions, lib/mpc-scoring.ts, existing employee form | Supply idempotent evidence for already approved KPI definitions. Do not write evaluations, approve KPI definitions, calculate scores or modify weights: KPI 50%, Values 20%, CPD 15%, Social Media 15%. Finalised months retain their evidence value and receive correction-review flags. |
| CPD | cpd_credits and cpd-mpc.js | Read non-voided verified credits. Training completion stays in CPD. |
| Leave Management | leave-api.js and authoritative leave_requests | Add teaching-impact advice and shared continuity alerts. Leave entitlement, approval, cutover mode and attendance interaction remain with Leave. Half-day and nonconsecutive selections are respected. |
| Employee Attendance | attendance sessions and existing attendance workflow | No academic writes to employee attendance. Teaching timestamps and student attendance are separate academic concepts. |
| Payroll | existing remuneration, input approvals, payroll processing, statutory and document modules | Supply independently approved teaching hours and contract references. Payroll determines amount, classification, approval, cut-off, calculation and payment. Source changes block stale academic inputs at approval and calculation/approval/finalisation. |
| Shared services | document_assets + private R2, audit_events, nadi_notifications, integration_events | Reuse private documents and the existing notification/mail runner. No public permanent document URLs or second notification system. |
| Student SIS/LMS | No confirmed attendance connection was present in the inspected source | Entry remains disabled. Registrar must confirm the authoritative source and accountable owner. An approved manual fallback is available only after institutional confirmation. No production source was enabled. |
| Academic calendar | No confirmed institutional timetable/calendar integration was present | Reference an approved Registrar calendar, import bounded periods, or configure the existing external source link. The build does not invent an authoritative calendar. |

Production account records and private documents were not copied into local academic fixtures. The source checkout and deployed database are distinct. The limited database-overview response does not establish that omitted tables are absent.

## Delivered workflows

- Academic programmes, teaching periods, holidays/exclusions, course offerings, credit and Student Learning Time references, teaching venues and source-backed policy records.
- Qualification-review attestation against existing profile and appointment references before allocation; lecturer allocation confirmation; draft-only reassignment and approved replacement for published classes.
- Weekly, monthly and list timetables; bounded recurrence/import; lecturer, venue, student-group, period, holiday, academic-commitment and authoritative-leave checks.
- Draft → Validated → independent Approved → Published. Pending revisions leave the previous official timetable visible. A formally approved conflict exception identifies the exact conflicting source and authority; it cannot mask another conflict of the same type.
- Lecturer next-class, today, week, actions, course, appointments and workload views. Published consultation/supervision commitments and approved activities appear in the daily schedule. Online meeting links use HTTPS.
- Lecturer start → submit → independent verify → complete, with timestamps, recognised minutes and retained revisions. Start/submit does not automatically verify teaching. Delivery corrections require an authorised verifier and a reason. Recognised minutes are bounded by the approved session duration; actual timestamps remain available for review.
- Replacement lineage: a draft replacement does not change the original. Approved publication supersedes the original; delivered originals cannot be replaced and duplicate lineage hours are excluded.
- Research, publication, supervision, consultation, curriculum, assessment, projects, industry/community work, presentations and academic administration, with independent verification and approved workload-equivalence policies.
- Separate assigned contact, independently verified delivery, outstanding scheduled and approved workload-equivalent hours. Course credit and SLT remain distinct. Source-backed staff/category/designation policies flag workload review; they do not create performance ratings.
- Approved-KPI evidence mapping follows existing MPC approval. An Academic mapping has no second KPI approval. Evidence records carry employee, programme/course, source/version, reporting month, KPI reference, category, value, verifier/date, status and audit lineage.
- Verified teaching payment evidence → independent academic approval → existing Payroll input with contract/source references. Corrections retain prior academic approvals, existing processed/finalised snapshots and the existing Payroll correction workflow.
- Scoped staffing, appointments, qualification, CPD, teaching, workload, exception, document-retention and attendance reporting; Excel/CSV/PDF exports and official-session ICS export. CSV formula prefixes are escaped. Academic reports support QA evidence review and do not declare accreditation compliance.
- Private PDF/PNG/JPEG evidence uses canonical document assets, content hashes, download audit and an optional effective institutional retention-review date. Identical files on the same source are reused. Retention expiry prompts review and does not automatically purge records.

## Access and institutional configuration

No Academic production permission grants, course data, synthetic records or student source were seeded.

P&C can assign dated Academic grants to existing active employees, limited to named programmes or institution-wide scope. Administrator and independent approver grants must be decided by the institution. Appointment-linked access ends with the appointment. Lecturer ownership enables the lecturer's own assigned classes; it does not confer administrative approval powers. Leadership, QA and People roles observe their explicit scopes; student rosters are restricted to the class lecturer and academic administrators. Existing explicit Payroll entity grants control the payment-evidence adapter. P&C configuration access alone does not confer academic administrator, student-roster or Payroll access.

The Registrar decision recorded for this implementation is: **keep attendance entry disabled until the Registrar confirms the source**. Access decisions are **to be decided later**. These decisions are rollout gates and must not be replaced with guessed personnel or test accounts.

Before operational use:

1. P&C records approved administrator and independent-approver IDs, programme scopes and effective dates.
2. Registrar approves the calendar source, programmes, teaching periods, holiday coverage, course offerings and venues. Calendar and timetable imports initially create drafts, not published schedules.
3. Academic administration reviews canonical qualifications and appointments, records the relevant programme-standard source, allocates staff and obtains lecturer confirmation.
4. The institution approves any workload, equivalence, attendance, replacement, ODL, cut-off and retention policies, with source, authority and effective dates. There is no universal invented statutory workload, attendance threshold or credit-to-contact-hours conversion.
5. Registrar identifies the existing SIS/LMS. Keep the manual source disabled if that system is authoritative. An external link is a handoff, not an automated SIS API connection.
6. Academic, P&C, QA and Finance perform real-account acceptance tests using approved academic records. Local synthetic role tests do not establish this acceptance.
7. The institution confirms provider database/R2 backup ownership, retention and a restoration exercise. No production full-database backup or restoration was executed in this task.

## Migration and rollback

`0024_academic_hub.sql` creates eleven academic-only tables and their indexes. It alters or drops no existing HR, MPC, leave, attendance or Payroll tables. No real grants, roster rows or institutional policy defaults are inserted.

The published version 67 is the retained code rollback point. If rollback is needed, redeploy that exact saved version through Sites. Retain academic tables and private evidence objects: never drop them as part of a code rollback. Previously finalised MPC and Payroll snapshots remain authoritative. Once institutions enter live academic data, follow the provider's approved database and R2 backup/restore procedure; a source-version rollback is not a database restoration.

## Validation and acceptance evidence

`scripts/test-academic.mjs`: scenarios A–G, role/identity/origin checks, independence, published revisions, verified delivery, leave continuity, student-source gating, documents, idempotent evidence, finalised MPC protection, export signatures and preserved existing records/scoring.

`scripts/test-academic-governance.mjs`: multiple canonical roles, appointment-expiry races, calendar atomicity, half-day leave, resource-specific conflict exceptions, canonical category policies, retention metadata, duplicate documents, and teaching → academic payment → real existing Payroll staging/approval/calculation with source-correction blocking.

`scripts/validate-payroll-suite.mjs`: all local Nadi test scripts, including Academic, existing MPC/profile/position, leave, attendance, CPD, Connect, auth/invitations, notifications and Payroll. Logs and final counts are in the deliverable validation report. Tests use synthetic in-memory databases and do not make payroll payments or send production messages.

Desktop/mobile browser verification covers navigation, course credit/SLT, weekly/monthly timetables, reports, management forms and source gating. The deployment record separately distinguishes native deployment success, live migration readback, protected-route checks and any real-account UAT limitation.

## Framework sources checked

The sources below were checked on 9 October 2026 to anchor policy configuration and report labels. They do not establish institutional compliance or a universal programme requirement.

- [MQA Malaysian Qualifications Framework](https://www.mqa.gov.my/new/mqf.cfm), including the second edition 2024.
- [MQA publications and current application forms](https://www.mqa.gov.my/new/pubs_form.cfm), including COPPA and MQA-01/MQA-02 resources.
- [MQA ODL resources](https://www.mqa.gov.my/new/pubs_form2.cfm) and [COPPA ODL evaluation guidance](https://www2.mqa.gov.my/qad/v2/document/2024/Guidelines%20for%20Evaluation%20COPPA%20ODL.pdf).
- [Department of Higher Education private-HEI documents](https://jpt.mohe.gov.my/portal/index.php/en/hei/private-hei/24-private-hei-document), including Act 555.
- [Personal Data Protection Amendment Act 2024](https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-amendment-act-2024/) and [official commencement notice](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf).

Programme-specific and professional-body standards still require the institution's applicable approved source. No compliance pass/fail finding or academic staff performance decision is inferred by the software.
