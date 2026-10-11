# IUC email/password sign-in

This is a change to the existing IUC Nadi Site. Keep its Site ID, D1 database,
R2 documents, employee IDs, existing account links and management grants.
Migration 0017 only adds login, session, audit, rate-limit and calendar-cache
tables. It does not reset or seed employee data.

## Current setup and changeover

The runtime `NADI_AUTH_SECRET` is a private server secret; do not put it in
source, Sheet cells, browser code, passwords or messages. `PC_EMAILS` remains
the explicit P&C allowlist. An institutional address alone grants no HR or
management permissions.

1. Open `/admin/sign-in-accounts?recovery=1` through the current owner/P&C
   ChatGPT connection. The current login continues while setup is incomplete.
2. The human P&C owner issues access to `h.r@innovative.edu.my`, then signs in
   at `/login` and privately changes the one-time temporary password.
3. P&C prepares the current employee accounts. After invitation sender setup,
   issuing/resetting access queues an email only to that employee's IUC address. Temporary passwords expire
   in seven days and require a change before any private module opens.
4. Activate IUC email/password sign-in when the page shows a ready P&C account,
   all current employee accounts prepared, and zero work-email issues. Expired
   temporary passwords, changed email links and disabled accounts block readiness.
5. Calendar dates are stored in Nadi. Salary and IUC event entries copied for
   January-December remain in the existing database; birthdays use current
   employee records and holidays use the saved Selangor schedule. Neither
   Google Calendar authorisation nor a browser connector is required.
6. Only after explicit owner approval, allow public reachability to the login
   entrance using Sites Settings. This makes the app's own password gate the
   access boundary. Every private page, file and API still requires a valid
   session and its existing server-side role checks. Until this Site access
   change, visitors may still meet the platform's ChatGPT sign-in first.

Permanent password entry is a human step. Email invitations are explicitly
authorised by the owner; do not print credentials in chat or logs. Do not change
the Site audience during a routine code deployment.

## Identity and access

Existing `employees.account_user_id` links are reused. If an unlinked employee
has one historical MPC account ID, that ID is retained. Multiple historical
IDs require resolution rather than silently choosing one. A new canonical ID
is created only when no historical identity exists.

Employees keep their own records. Manager and leadership permissions continue
to use explicit `management_grants` and report assignments. P&C keeps its
existing restricted workflows. Inactive, Resigned, Exited and Alumni records
cannot sign in, and session checks re-read current employee access each time.
Reset, disable and password changes revoke existing password sessions.

Opaque session tokens are stored as hashes. Cookies are Secure, HttpOnly,
SameSite=Lax and host-only. Sessions expire after eight hours or thirty minutes
without a request. Passwords use bcrypt cost 10 over a keyed SHA-384 prehash
and are never stored in plaintext. Account operations are audited without
credentials. All mutations require a same-origin form/API request.

## Integrations and recovery

The Google Sheets runner still uses its existing platform service token and
shared runner key. It never relies on an employee's browser session or password.
Ordinary valid editable data transfers automatically in both directions;
source errors require correction, not routine P&C approval.

Salary and IUC event dates are read only from the copies in Nadi's existing
calendar table. There are no Calendar API calls, automatic imports or remote
refreshes. The Google Sheets runner handles employee spreadsheet data only;
its manifest does not request Calendar Read scope. Birthdays and holidays
continue to be read from their existing Nadi sources.

After activation, legacy ChatGPT identity is accepted only for explicit P&C
recovery/account administration. `/login`
contains the owner recovery link. Employee profile APIs do not silently fall
back to ChatGPT when a password session is invalid or expired.

## Validation

Run `node scripts/build-worker.mjs`, `node scripts/test-nadi-auth.mjs` and the
affected module checks. Before widening the login entrance, verify the deployed
worker rejects anonymous private API calls, forged user headers and invalid
passwords. Check P&C readiness, employee record counts and existing account
links against the live baseline, and confirm the unattended Sheet runner still
reports successful checks with no exceptions.

## Email invitation setup

Update the existing Apps Script IUC runner from /admin/sync/runner.gs and merge
/admin/sync/appsscript.json, preserving unrelated scripts and private properties.
As h.r@innovative.edu.my, run enableIucInvitations and authorise Send email and
email identity. This adds one invitation trigger independent of Sheet sync.
It uses MailApp, not inbox access or Google Calendar. A separate pause function
(pauseIucInvitations) stops mail without stopping employee data sync.

The Sign-in accounts page shows sender readiness and delivery status. Before
setup, legacy manual issuance remains available and is labelled clearly. After
setup, new/reset access defaults to email; temporary passwords are omitted from
the browser response. Existing manually issued passwords cannot be retrieved:
choose Reset and email to replace one, revoking prior sessions and credentials.

Migration 0018 is additive. The outbox holds an AES-GCM encrypted temporary
password bound to its account, version and recipient. Keys are derived from the
private NADI_AUTH_SECRET with a separate purpose label. No plaintext is stored.
The authenticated runner claims one eligible current account version at a time,
sends the message and acknowledges it. The encrypted payload is removed on
acknowledgement, expiry, cancellation or ambiguous delivery. Claimed jobs that
time out require review, not automatic retries; Google may already have sent
them. Apps Script retains only an acknowledgement receipt for network recovery.
'Email sent' means accepted by MailApp, not delivery/read confirmation. Quotas,
trigger pauses or expired authorisation can delay invitations.
