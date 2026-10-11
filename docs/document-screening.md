# Employee document screening

P&C opens `/admin/document-screening` from the P&C menu or an employee profile's Documents section. Upload PDF, DOCX, PNG or JPEG (10 MB maximum), screen it, confirm the employee from the register, review every evidence excerpt, select blank fields, and apply. Screening alone never updates a profile. Multi-employee documents cannot be applied. Conflicts and existing portfolio collections remain unchanged. Training records are Pending with zero verified CPD hours until separately approved.

The original is private R2 storage (`PROFILE_FILES`). Extraction results, review status and selected fact IDs are in `document_screenings` (migration 0008). Applied originals are linked to the employee's private Personal documents; profile revisions and audit events retain source ID, SHA-256, field and evidence location. Existing profile version checks protect concurrent edits. Partial saves are reported and can be reviewed again. Employee and management accounts cannot access the screening APIs or originals.

## Production configuration

The Site owner must set `OPENAI_API_KEY` as a secret through Sites environment management. Never place it in source, Sheet cells, browser code, logs or chat. Optional `DOCUMENT_SCREENING_MODEL` defaults to `gpt-4.1`. No client chooses the model or receives credentials. Requests use OpenAI Responses structured output with `store:false`; only the uploaded document is sent, never the entire employee database. Provider retention and billing policies still apply.

The selected OpenAI API organization/project needs available API credits and model access. ChatGPT seats and API billing are separate. HTTP 429 quota exhaustion is distinguished from ordinary rate limiting. Safe error messages do not expose provider response bodies or credentials.

Apply migration 0008 and publish the archive generated from the pushed source after the production secret is configured. Preserve the Site's existing audience and P&C allowlist. A configured status response means the secret and storage bindings exist; successful hosted extraction is a separate verification step.

## Verification

`node scripts/test-document-screening.mjs` checks P&C isolation, origins, file limits/types, duplicate uploads, schema/evidence validation, manual identity confirmation, current-value checks, zero-value preservation, idempotence, locks, source audit, pending CPD and exited employee status. Existing profile and people-hub suites must continue to pass. Synthetic browser verification must be identified as mocked extraction. Live API or hosted extraction must not be claimed when blocked by quota or production configuration.
