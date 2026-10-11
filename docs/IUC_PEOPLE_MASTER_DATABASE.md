# IUC People Master Database

## Purpose

This database is the authoritative identity and employment foundation for IUC People & Culture modules. Talent, HR Letters, onboarding, the Employee Directory, MPC, leave, learning and future modules should integrate through a secured server-side API rather than receiving database credentials.

## Ownership rules

| Data | System of record |
| --- | --- |
| Legal/preferred name and contact identity | `people` |
| Employee number, work email and employment state | `employment_records` |
| Department and position vocabulary | `departments`, `positions` |
| Recruitment decision and application state | `recruitment_applications` |
| Letter lifecycle and document reference | `employment_letters` |
| Monthly performance content | existing `mpc_submissions` |
| Authentication identities and roles | `access_subjects`, `role_assignments` |
| Cross-module history | `audit_events`, `integration_events` |

No module may use email as its permanent person key. Use `person_id`; use `employment_id` or the IUC-issued `employee_id` for employment operations.

## Data boundaries

- The employee/MPC module receives identity, work email, department, position, appraiser and status only.
- Recruitment files, identity documents and candidate videos belong in protected file storage and are represented by `document_assets` metadata.
- Letter documents, salary and contract details must be restricted to explicitly authorised roles. Salary is deliberately absent from general person and employment tables.
- `document_assets.storage_key` is an internal storage key, never a public download URL.
- Deactivation and end-of-employment preserve history; records are not physically deleted as an ordinary workflow.

## Person lifecycle

`prospect -> candidate -> employee -> former_employee -> archived`

Candidate conversion is a P&C-controlled transaction:

1. Confirm that the application is approved and the offer is accepted.
2. Search for an existing person by verified identifiers.
3. Create or reuse the `person_id`.
4. Create one `employment_records` row with a unique IUC employee number.
5. Link `recruitment_applications.converted_employment_id`.
6. Write `employee.created` to `integration_events`.
7. Write a complete security event to `audit_events`.

The conversion endpoint must require an idempotency key so retrying a request cannot create two employees.

## Integration contract

Future modules should use versioned endpoints such as:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/people/{personId}` | Authorised canonical-person lookup |
| `GET` | `/api/v1/employees/{employeeId}` | Current employment view |
| `POST` | `/api/v1/candidates` | Create/reuse a person and candidate record |
| `POST` | `/api/v1/applications/{id}/convert` | Controlled candidate-to-employee conversion |
| `GET` | `/api/v1/employees/{id}/letter-prefill` | Minimum approved fields for HR Letters |
| `POST` | `/api/v1/letters` | Register a letter lifecycle record |
| `GET` | `/api/v1/employees/{id}/mpc-context` | Minimum directory context for MPC |

Every write request must carry:

- authenticated provider and stable provider subject;
- module/service identity;
- role and scope;
- purpose;
- correlation ID;
- idempotency key;
- validated schema version.

Responses must be field-filtered by module and role. The API must not expose a generic table browser or accept arbitrary SQL.

## Initial role codes

- `candidate_self`
- `employee_self`
- `appraiser`
- `talent_officer`
- `letter_officer`
- `pc_directory_admin`
- `pc_mpc_admin`
- `compensation_officer`
- `security_auditor`
- `system_admin`

Authentication and authorization remain separate. A Google Workspace or ChatGPT login establishes identity; `role_assignments` determines what that identity can do.

## Migration and compatibility

Migration `0002_iuc_people_master.sql` adds the master schema alongside the current MPC tables. On the first protected master-database request, the application then:

- creates a canonical person for every existing employee;
- creates department and position reference records;
- creates an effective employment record;
- links the legacy `employees` row through `person_id` and `employment_id`;
- leaves all current MPC columns and submissions intact.

The existing application may continue to use `employees` while the API is introduced. During that transition, employee-directory writes must update both the compatibility row and the canonical tables in one transaction/batch.

## Deployment gate

Before applying this migration to production:

1. Take and verify a D1 backup/export.
2. Apply the migration to a non-production copy containing representative employee and MPC records.
3. Verify row counts and uniqueness for people, employees and employment records.
4. Test employee sign-in, directory changes, MPC create/update and P&C reporting.
5. Confirm P&C role assignments and retention rules.
6. Apply to production once, through the migration journal.
7. Run the verification queries in `scripts/verify-master-database.sql`.
