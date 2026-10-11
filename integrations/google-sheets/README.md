# IUC master Sheet synchronisation

The Site's P&C page is `/admin/sync`. The worker is installed with the Site, but transfers default to **paused**. Publishing code does not authorise Google or install the Google trigger.

## Activate with the authorised HR Google account

1. Keep the master spreadsheet Restricted. Sign in as `h.r@innovative.edu.my` (or an authorised account with edit access).
2. Open the existing master spreadsheet, then **Extensions → Apps Script**. Use one HR-owned script project for this connection.
3. Add `Code.gs` as a separate script file, preserving any existing workbook scripts. Show the manifest in Apps Script project settings and merge the scopes and Sheets service from `appsscript.json`, retaining any existing services, scopes and settings. Its Sheets advanced service enables the Sheets API for a default Google Cloud project. For a standard Cloud project, its administrator must enable the Google Sheets API separately.
4. Configure a cryptographically random secret of at least 32 characters as the Site secret `SHEETS_SYNC_RUNNER_KEY`. In Apps Script **Script Properties**, set the identical `SYNC_RUNNER_KEY`. Set `SITES_SERVICE_TOKEN` to the Site owner's platform service bearer token. The two credentials have different purposes; both are required. Keep credentials out of source, Sheet cells, browser code and logs. These values must be exchanged through private administrator configuration.
5. Run `installIucSync`, complete Google's authorisation, and check that it reports a verified connection. The installer creates one `runIucSync` trigger per minute and removes duplicates for this same installer account/project. Run installation only from the nominated HR account; Google does not expose other users' triggers to the installer.
6. Open **Administration → Google Sheet sync**, refresh, then choose **Enable automatic sync**. Valid editable data transfers automatically in both directions without routine P&C approval. Correct invalid values in their source when the page lists a sync exception. Sign-in account issuance remains a separate authorised P&C step in **Administration → Sign-in accounts**; see [the sign-in changeover guide](../authentication/README.md).
7. Validate an approved reversible field change in each direction, restore its original value, and check the profile audit and sync run. Confirm the employee reported missing from the Sheet is reconciled. This live acceptance test has not been performed without Google authorisation.

`verifyIucConnection` checks access without changing employee information. `pauseIucRunner` removes this installer's trigger; the P&C page can pause data transfers independently. A paused runner continues to check connectivity. Revoking Google access or either private credential prevents transfers.

## What is synchronised

The adapter preserves the seven tabs. It locates native tables by name and verifies their exact headers before updating cells. Employee ID is the permanent join key. Names stay in Employee Master and the workbook's lookup formulas supply names elsewhere. New history/portfolio rows receive stable record IDs.

| Workbook table | Behaviour |
| --- | --- |
| Employee Master / PeopleCoreRecords | Directory, overview, personal details, employment, compensation, talent and exit details; two-way validated changes |
| NetPayHistoryIntegrated / SalaryRevisionHistoryIntegrated | Two-way pay history |
| AttendanceSummary / AdditionalLeave | Two-way leave and attendance |
| CurrentPerformance | Two-way comments, PIP details, learning plan and academic summary; existing current-month MPC formulas retained |
| PerformanceHistory | Monthly MPC scores, ratings and approvals exported from the MPC workflow; previous reviews are two-way |
| DevelopmentPortfolio | Two-way training, verified CPD, academic and professional qualifications and skills |
| EmploymentJourney / RelationsCases | Two-way employment events, lifecycle events and employee relations |
| Documents | Protected metadata and URLs exported; file bytes and access settings remain in the document workflow |
| Admin / Dashboard | Existing formulas and organisation references retained; no access grants or scripts imported from cells |

Annual CPD remains 192 hours. Edited result cells cannot bypass deterministic MPC scoring or approval. A training record does not itself submit or approve an MPC month. Business unit/faculty uses the overview field with the existing employment field as a fallback. The shared notice period uses employment with exit as a fallback. Imports update those aliases together.

Account activity, photos, protected links and directory timestamps are Site-owned exports. Legacy section-version columns in the Sheet are informational, not authorisation or concurrency controls. Synchronisation uses its own server-side baseline and the current database section versions; it never trusts a Sheet version to authorise a write.

## Reconciliation and limits

- The Google trigger runs approximately once per minute. Each run reads both sides, applies up to six changed records, and defers excess work. Initial reconciliation or bulk edits can take several runs. Google quotas, outages and long runs can increase delays.
- A database lease and Apps Script lock prevent overlapping cooperating runners. Failed network operations leave the baseline unchanged; repeat processing reconciles safely. Connection failures use exponential backoff up to 15 minutes.
- Changes to different fields can merge. Changes to the same field on both sides, initial differences, concurrent edits versus deletion, invalid values, identity changes and lifecycle access changes require P&C review. Resolutions are revalidated before use and audited.
- The Google adapter refreshes table positions and values before writes, writes only mapped cells as typed values, then reads them back. New table capacity is inserted inside the native table so references and lower sections move with it. The next run continues after structural changes.
- Google Sheets does not offer an atomic compare-and-swap transaction spanning the Sheet and this database. A manual edit in the brief interval between the final read and write can still race. Avoid simultaneous structural edits during sync; pause in P&C before moving columns or changing table definitions. Header changes stop processing instead of guessing a mapping.
- This implementation covers the configured master spreadsheet, not automatic extraction of every file in HR's Drive. Existing reviewed Drive import remains separate.

## Security and verification

The runner exchanges only a short-lived Google access token over HTTPS with the fixed Site endpoint. The token is used solely against Google's fixed Sheets endpoint and is not persisted. Google permissions govern spreadsheet access. The Site requires its platform service credential and an independent runner secret. P&C-only APIs show conflicts; employee and manager routes cannot access them. Existing per-employee permissions, profile validation, revisions and audit trails remain enforced.

Run `node scripts/test-sheets-sync.mjs` plus the existing profile, management and people-hub checks. Tests use isolated in-memory databases and synthetic records, including simulated Google requests. Passing tests and deployment do not establish that a Google trigger is authorised or running.

Google references: [installable triggers](https://developers.google.com/apps-script/guides/triggers/installable), [advanced services](https://developers.google.com/apps-script/guides/services/advanced), [Sheets tables](https://developers.google.com/workspace/sheets/api/guides/tables).

## Sheet deletions

Clearing an editable field clears it on the Site, subject to existing validation and workflow ownership. Deleting a previously synchronised collection row removes that specific record; deleting an editable summary row clears its mapped fields while preserving separately managed collections. Revisions and audit history remain available. Deletion markers prevent unchanged summaries from being recreated. A subsequent deliberate Site edit may recreate the summary.

Deleting the main Employee Master row archives the employee using the existing deactivation flow. Access is disabled and their history is retained; other records for that employee stop syncing and the master row is not recreated. P&C must reactivate the employee through the Site to restore access and resume sync. Restoring a Sheet row alone never reactivates access.

Only previously synchronised rows can be recognised as deletions; a row absent before the first baseline cannot be distinguished from a new Site record. Missing tables, changed headers, duplicate IDs and incomplete IDs stop processing. Do not clear only an Employee ID or record ID: delete the intended full data row. Never remove table headers. MPC results, document files, calculated cells and access controls remain owned by their workflows. Deleting an exported MPC/document row creates a review item, not a destructive workflow change.

Checks run approximately every minute once Google authorisation and automatic sync are active. Bulk changes can span multiple runs; connection failures pause transfers. Run `node scripts/test-sheet-deletions.mjs` after building in addition to the normal sync tests.
## Nadi calendar

Salary and IUC event dates use stored copies in Nadi. Birthdays use the current
employee records; public holidays use the saved Selangor schedule. The Sheet
runner does not read or synchronise Google Calendar, and Calendar Read scope
is not required. Existing employee Sheet synchronisation continues separately.
