# NADI source recovery — 11 October 2026

This repository is a sanitized recovery of the source for the existing **IUC Nadi — MPC & People Culture** application. It does not create another Site or change production.

## Relationship to the live application

| Record | Verified value |
| --- | --- |
| Existing Sites project | `appgprj_6abe29d9b6bc8191a17de96f35cbcfee` |
| Production URL | https://iuc-nadi-mpc-hr.iuc-people-a-4289.chatgpt.site |
| Live version | **74** |
| Original source commit | `ed2bed22be4c38d9f1b78fed5ce5c65629103a4c` |
| Saved version ID | `appgprj_6abe29d9b6bc8191a17de96f35cbcfee~appgver_93715ec95fac8191ab403300b6caa401` |
| Deployment ID | `appgdep_6aca6b1c1d8c8191aaca3fdc18b438c6` |
| Deployment status | `succeeded`, confirmed through Sites |
| Recovery source | Official Sites Git endpoint, using a native ephemeral repository credential |
| Original Git history | 77 commits; `git fsck --full` passed |
| Original tracked source | 425 files |

The official Sites repository HEAD exactly matched the saved version's source commit. The recovered checkout had no source modifications. GitHub has a new sanitized history: its commit SHA differs from the original Sites commit. Original history was retained privately and was **not pushed to GitHub** because it contains employee records and institutional source data.

[`docs/RECOVERY-MANIFEST.json`](docs/RECOVERY-MANIFEST.json) records every original file's Git blob ID, original SHA-256, export SHA-256, and the reason for any difference. It is the authoritative mapping between this export and version 74.

## Data withheld from GitHub

- `lib/employee-seed.ts`: the legacy 86-person directory is removed; its type and empty array remain.
- `worker/position-sources.js`: private job-description source records are removed; its empty exported interface remains.
- `worker/policy-catalog.json`: institutional policy catalogue and full-text search records are removed; the file contains an empty array.
- `scripts/build-worker.mjs`: the owner's personal address in sample local configuration is replaced with an example address.
- `docs/NADI-2-register.json`: the private framework spreadsheet locator is omitted.
- `.gitignore`: private recovery artifacts and Git bundles are excluded.

Runtime secrets, database contents, storage objects, credentials and original Git history are not included. Synthetic test credentials are test fixtures, not production secrets. Existing code still describes its established institutional mailbox and domain routing; these are not copied employee records or runtime credentials.

The private data interfaces are intentionally empty. This export is **not a byte-identical production artifact and must not be deployed directly**. Source-data import and catalogue tests may require their approved private inputs. Any future use must preserve production D1/R2 data and the existing Site's identity, authentication and access configuration.

## Recovery validation

All 425 source-file mappings were verified. The manifest records 419 byte-identical files and six documented changes. No legacy directory names or email records remained in the export, the three private data interfaces were empty, and checks for standard private-key and API-token signatures found no matches. The institutional letterhead asset was inspected and contains branding and general contact information, without employee records.

A local Worker build passed in the isolated export folder. Five existing synthetic suites passed **391 checks**: lifecycle integration (77), profiles (49), employee eligibility (114), core integration (55), and HR service (96). Production data was not used. This is focused source-recovery validation, not full production-user acceptance or validation of withheld private source inputs.

## Orders 4 and 5

Historical command outputs in the original **IUC NADI Dev.** chat establish this unpublished sequence:

1. Order 4: `f3d89389244b6bc02268fffa05ba29dce1dfdcdf` — requested-date triage and audited HR service follow-ups.
2. `bedd5fc` — NADI terminology recorded in `AGENTS.md`.
3. Order 5: `671c8eae22c7e35bf942aac74c253422ec200c13` — approved lecturer and scoped academic contributor access.

The chat records creation of a 363 KB format-patch covering the changes from version 74 through that final commit. These are historical observations, **not recovered or integrity-verified Git objects**. Neither pending commit is present in the recovered official Sites history, and the patch bytes are not accessible in this environment. None of those changes is represented as recovered in this GitHub snapshot.

Recovery locations from that original chat:

- Chat ID: `01a126c8-20f5-71e5-a480-f13a3ca870a5` (durable host).
- Original checkout: `/workspace/scratch/nadi-readiness`.
- Combined patch: `/workspace/outputs/NADI-cloud-pending-changes.patch`.
- Individual patches: `/workspace/outputs/NADI-order-4.patch` and `/workspace/outputs/NADI-order-5.patch`.
- Earlier sanitized review ZIP, including Order 4 but predating Order 5: `/workspace/outputs/NADI-review/NADI-complete-source-review.zip`.

Those paths and the version 74 preparation checkout (`/workspace/scratch/a1390065d583/.sites-checkout`) are absent from the attached environment. Filename searches for those source backups in both connected Drive accounts returned no matches. Chat transcripts are evidence and are not a substitute for the original code or patch bytes.

## Blockers and escalation

- Official publishing helper: the agent plugin-cache check returns `MODULE_NOT_FOUND` for `scripts/site-workflow.mjs`; the prior `/root` cache path returns `[Errno 13] Permission denied`. Skill-resource requests return `failed to read skill resource`. Ask the Cloud Codex/Sites environment maintainer to provision the official plugin scripts and dependencies for the runtime user.
- Saved deployment archive: Sites retains `file_0000000009b482079c6d280e36d41c1e`, SHA-256 `39cf812a64a146a4e1c30767de071197298d70e5e57dd5044877e05acdd9424c`; materialization returns `file could not be authorized or resolved`. Ask Sites support for an actor-authorized export if needed. Complete source was recovered through Git instead; archive completeness was not inferred from its metadata.
- Pending work: `git cat-file -t` for either pending commit returns `fatal: git cat-file: could not get object info`. Ask the Cloud Codex workspace maintainer to restore or export the original checkout's Git objects and the combined patch from the identified chat's workspace/snapshot. Preserve the snapshot and files; do not reset the existing Site or database.

After recovering the pending objects/patch, verify their hashes, ancestry and clean applicability to the exact version 74 commit, inspect their sensitive content, and run appropriate checks. Production deployment remains on hold until the source, publishing environment and pending changes are verified. Use the official Sites workflow when publication is eventually authorized; no publishing helper has been recreated and no alternate publishing flow has been introduced here.
