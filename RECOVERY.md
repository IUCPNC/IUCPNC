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

## Orders 4 and 5 — pending source recovered

The original Cloud Codex workspace is accessible again. The following Git objects and their ancestry back to the exact version 74 commit have now been verified:

1. Order 4: `f3d89389244b6bc02268fffa05ba29dce1dfdcdf` — requested-date triage and audited HR service follow-ups.
2. `bedd5fcd341fd3ff0c1cd5c4656b42e6d68530e3` — NADI terminology recorded in `AGENTS.md`.
3. Order 5: `671c8eae22c7e35bf942aac74c253422ec200c13` — approved lecturer and scoped academic contributor access.

The combined format-patch bytes exactly match the output generated from these three commits. Its SHA-256 is `954911d5e3d66705677d13ab2c014f725ba31b13b41899f6bcc7c8b95118c3d2`. Original Git object validation passed. All 427 files in the GitHub recovery baseline were verified against their GitHub blob hashes before applying the pending changes.

Changes have been ported onto the sanitized GitHub recovery. The overlapping redactions in `scripts/build-worker.mjs` and `docs/NADI-2-register.json` were retained. Other withheld private interfaces remain unchanged. The HR operations test uses an in-memory synthetic policy catalogue entry instead of depending on a withheld institutional policy. `AGENTS.md` also records the user's Cloud Codex development instruction. No employee directory, private policy catalogue, job-description source records, original private history or runtime credentials were restored into GitHub.

The Worker build and 13 synthetic suites passed **1,540 checks** on the ported sanitized source. These include lecturer/contributor authorization, identity and expiry enforcement, directory employment distinctions, navigation, authentication, payroll isolation and HR service operations. No production data or real accounts were used. Browser QA was unavailable. Approved institutional records and representative real-account acceptance remain pending.

[`docs/PENDING-ORDERS-RECOVERY.json`](docs/PENDING-ORDERS-RECOVERY.json) records the verified source commits, patch checksum, changed-file hashes and validation results. The earlier `docs/RECOVERY-MANIFEST.json` continues to describe the version 74 recovery baseline; its export hashes are not claims about files subsequently changed by Orders 4 and 5.

This GitHub source recovery does not publish NADI. The existing live application remains at version 74 until the official Sites workflow packages, saves and successfully deploys the verified pending source. The sanitized repository is still unsuitable for direct production deployment without reconciling its withheld private source inputs through approved institutional processes.

## Blockers and escalation

- Official publishing helper: the agent plugin-cache check returns `MODULE_NOT_FOUND` for `scripts/site-workflow.mjs`; the prior `/root` cache path returns `[Errno 13] Permission denied`. Skill-resource requests return `failed to read skill resource`. Ask the Cloud Codex/Sites environment maintainer to provision the official plugin scripts and dependencies for the runtime user.
- Saved deployment archive: Sites retains `file_0000000009b482079c6d280e36d41c1e`, SHA-256 `39cf812a64a146a4e1c30767de071197298d70e5e57dd5044877e05acdd9424c`; materialization returns `file could not be authorized or resolved`. Ask Sites support for an actor-authorized export if needed. Complete source was recovered through Git instead; archive completeness was not inferred from its metadata.
- Pending work: the original Cloud Codex checkout and combined patch have now been recovered and verified as described above. Preserve those original private Git objects separately from the sanitized GitHub repository.

Source recovery and synthetic validation are complete. Restore the official Sites helper, then use the supported workflow on the preserved original source while retaining Site identity, authentication and production D1/R2 data. Source publication is authorized by the user's request; institutional activation still requires approved appointment records and real-account acceptance. No publishing helper has been recreated and no alternate production publishing flow has been introduced here.
