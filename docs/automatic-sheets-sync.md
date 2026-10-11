# Automatic employee-master synchronization

The fixed master is `1MjFoy_Uo95w7t6rJ04CC5rQT2wd3o6jmVjxyQCD5gQg`. The existing authorised Apps Script runner calls the Site about every minute. No new API credential, AI model or AI credits are needed for synchronization.

Production uses automatic reconciliation. Independent fields merge using the last successful baseline. If both sides change the same field before synchronization, the Sheet wins. On the first reconciliation, an empty side does not clear an existing populated value; populated differences prefer the Sheet. Once a baseline exists, intentional cell clearing and editable row deletion propagate normally. Each cycle handles up to 25 changes within a 45-second processing budget, with remaining changes queued automatically.

New employee records, sign-in email changes and employment status changes no longer require an approval in `/admin/sync`. Normal validation, unique employee/email identity, account-link reset after an email change, profile versions, source re-reads, runner authentication, leases, audits and revision history remain enforced. Missing tables and altered field headers fail safely. Invalid values are exceptions that retry after correction, not approval items.

Deleting a previously synchronized Employee Master row archives that employee, marks the profile Exited, disables self-service, and retains HR/MPC history. Restoring the row with an explicit valid employment status resumes synchronization. An active status explicitly restores employee activity; an ended status preserves inactive access. Re-reads protect against a restored row or changed source during transfer.

MPC results, document URLs/permissions and derived account indicators remain Site-owned. A changed or removed Sheet mirror is restored automatically from the Site. A Sheet-only result/document without an owning Site record is reported as invalid source data; it cannot fabricate an MPC submission or grant file access. Edit source MPC inputs and approvals in the MPC workflow, and upload/manage documents in their owning workflow.

The P&C sync page is a connection/status/error dashboard with pause/enable controls. It no longer requires a per-record source selection for ordinary changes. Existing historical queued P&C selections are honoured only where still valid; obsolete snapshots are reconciled automatically.

Verification: `scripts/test-automatic-sync.mjs`, `scripts/test-sheets-sync.mjs`, `scripts/test-sheet-deletions.mjs`, `scripts/test-sheets-fetch-receiver.mjs`, plus profile and people-hub regressions. The legacy review merge tests explicitly exercise non-production manual mode so its older behavior remains covered. Production uses automatic mode by default.

## Position and appointment source

An effective active primary appointment materializes the employee job title, concrete department, explicitly linked reporting manager, and supplied faculty/grade/category into the canonical employee master. Draft/unassigned positions do not change staff. Generic academic department placeholders retain the employee's actual department. Additional roles remain separate. Ending/expiry restores prior values only when they still equal the last applied appointment values; inactive/exited employees are never reactivated. Changes are audited and current-profile history is appended; historical MPC submissions and issued letters retain their snapshots. New letters consume the current master.

The runner exports three Site-owned named ranges inside the existing Admin tab: NadiPositions, NadiAppointments and NadiResponsibilities. They preserve position IDs, employee IDs plus full names, dates, current/historical periods, acknowledgement status and protected Site links. No document body, salary, private identifier or credential is added to those registers. The fixed employee master table retains its headers/layout. Controlled position fields follow the appointment; all other editable fields retain automatic two-way merge behavior. Missing employee-master rows still archive the employee. Exports are verified and idempotent.

No additional Apps Script setup is needed. The existing enabled authenticated runner supplies Google authorization on each check. Site saves propagate immediately; Sheets receives changes on the next successful check (normally around a minute, longer for retries/large batches). Verify connection status and the new Admin registers in production; local tests alone do not confirm a hosted transfer.
