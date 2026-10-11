# Management views

The Employee Profile module has two read-only management surfaces and one P&C access screen:

- `/manager`: explicitly assigned direct reports' work overview, employment information, MPC components and KPI records, comments, CPD/training, qualifications and skills. Work alerts exclude passport, visa and personal identifiers. P&C can use this route for organisation-wide oversight, clearly labelled in the UI.
- `/top-management`: workforce totals and department counts, latest-record MPC average and coverage, annual training-portfolio CPD completion, and restricted career/talent records. It does not return individual MPC, training or skill records.
- `/people-culture/management-access`: P&C grants/revokes roles and assigns each employee to one direct manager. Assignments and management reads are audited. Site audience sharing remains a separate owner-controlled requirement.

No real management accounts or reporting lines are preassigned. Grants use stable directory employee IDs and the platform's authenticated email/account binding. Inactive employees and mismatched account bindings cannot use a grant. A stale assignment form returns a conflict; grant and reporting-line changes are transactional. Names, job titles and the existing free-text appraiser field do not confer access.

Personal, compensation, bank, employee-relations, document, exit and unrestricted lifecycle records are absent from these management APIs. Managers receive explicit work-field allowlists. Qualification and learning attachments and training costs are excluded. The existing employee self-service and P&C routes keep their prior access rules. The legacy environment-granted `/people-culture/talent` route remains separate; new Top Management assignments use the P&C screen.

Annual CPD is 192 hours. Management dashboard completion uses training records dated within the current Kuala Lumpur calendar year. MPC CPD figures are not added to training hours, avoiding double counting. The latest MPC average is descriptive and can combine different reporting periods; coverage and this limitation are displayed. Missing records never count as completed CPD. Talent decisions remain P&C-maintained; there are no automated promotion, pay or disciplinary decisions.

Data comes from the existing employee directory, profile records and saved MPC submissions. This release does not activate a Google Drive staff import, Sheets synchronisation, payroll or attendance feed. Empty fields mean no record has been entered.

Validation: `node scripts/test-profiles.mjs` (49 existing profile checks); `node scripts/test-management.mjs` (60 management checks). Synthetic browser review covers the direct-report dashboard, restricted work tabs, 192-hour CPD, leadership summary/talent directory and saving an existing access assignment. Migration 0004 adds only management grants, reporting lines and audit tables.
