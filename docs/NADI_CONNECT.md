# NADI CONNECT architecture and delivery plan

NADI CONNECT brings recognition, engagement, employee voice and belonging into IUC Nadi. It reuses the Employee Master, current staff photographs, departments, explicit reporting assignments and existing account permissions. Social activity is separate from attendance, MPC scores and employment decisions. Participation in mood, surveys, stories and campaigns is voluntary.

This architecture is presented before implementation. Phase 1 is a complete everyday experience with employee and P&C interfaces. Phase 2 extends the experience without changing these boundaries.

## 1 Concept and strategy

Lead with people and meaningful appreciation, not totals or competition. A warm community page helps colleagues share contributions, thank one another and see what changed because employees spoke up. Every live card uses real records; empty states invite participation without fabricated activity.

## 2 Name

Use the requested name NADI CONNECT and the descriptor Recognition • Engagement • Employee Voice • Belonging. Alternative names for a future branding decision are Nadi Together and IUC Together. Keep My Impact, Your Voice, People of IUC and Monthly Spotlight as recognisable destinations inside Connect.

## 3 Employee journey

Open Connect from Nadi, see a personal greeting, browse posts and celebrations, appreciate a colleague, optionally check in or answer a pulse, submit an idea and follow action updates. My Impact holds recognition and published awards. Preferences control personal celebrations and optional notifications.

## 4 Manager journey

Use the same community experience. A separate insights page presents recognition inclusion and safe pulse aggregates for explicitly assigned reports. Low recognition is an invitation to include colleagues, never evidence of poor performance. Managers see feelings that employees publish to colleagues in the community; they cannot see individual anonymous pulse responses or anonymous submitters.

## 5 P&C journey

Manage Connect from /admin/connect. Configure recognition limits and award categories, open nomination periods, review evidence and fairness indicators, score candidates, approve and publish recipients. Publish surveys, campaigns and stories; respond to voice submissions; moderate reported content; review aggregate trends and apply retention settings.

## 6 Homepage

A plum and lilac community header, personal greeting and Make Someone’s Day action sit above a two-column desktop layout. The central feed is accompanied by Monthly Spotlight, voluntary check-in, a current pulse, celebrations and You Said → We Did. On mobile these become one readable column with a four-action bar: Post, Appreciate, Check In and Your Voice.

## 7 Feed architecture

Posts, images, comments, positive reactions and colleague mentions have server-enforced audiences: Everyone, Department, explicit Team or Selected colleagues. An author may remove their own content; P&C can hide or remove content with a recorded reason. Existing corporate announcements are read from their current table and visibly labelled. Private images inherit the post audience, including after moderation or employee access revocation.

## 8 Recognition system

Recognition requires a current colleague, a category and a meaningful reason. Optional values use IUC’s exact CATALYST labels: Commitment, Accountability, Togetherness, Adaptability, Leadership, Youth Empowerment, Sustainability and Transformation. Recognition can be shared in the feed or sent privately to the recipient. Self-recognition and repeated identical recognition are rejected. Optional stars start disabled; P&C may enable a bounded monthly allowance and per-recipient cap.

## 9 Monthly Spotlight architecture

An explicit monthly period progresses from Open to Review to Published. Ten configurable categories cover Employee of the Month, Most Loved Colleague, Positive Energy, Unsung Hero, Teamwork Champion, Helping Hand, CATALYST Champion, Idea Maker, Impact Maker and Growth Champion. Only approved published recipients appear to employees. Nominations and draft selections remain in the review workspace.

## 10 Employee of the Month

Assess verified contribution, reliability, collaboration, values and impact. Use a suggested contribution-focused rubric of peer evidence 20%, statement quality 20%, values 25%, impact 25% and nominator diversity 10%. Each criterion receives a documented human score; nomination counts never produce an automatic winner.

## 11 Most Loved Colleague

Retain the user’s category name and focus on kindness, support, respect, inclusion and helpfulness. Suggested weights are peer evidence 35%, statement quality 25%, values 15%, interpersonal impact 15% and diversity 10%. Review quiet contributions as well as visible roles. No public vote counter or live popularity ranking is shown.

## 12 Positive Energy

Recognise constructive encouragement and support, including during difficult work. Suggested weights are 25%, 25%, 20%, 20% and 10% across the same five criteria. Do not equate extroversion, constant positivity or mood responses with eligibility.

## 13 Other categories

Unsung Hero emphasises behind-the-scenes service; Teamwork Champion and Helping Hand require examples of collaboration; CATALYST Champion requires named values and behaviours; Idea Maker requires a useful idea or improvement; Impact Maker requires an outcome; Growth Champion requires verified learning or knowledge sharing. Default weights are 35%, 20%, 20%, 15% and 10%, adjustable by category. Awards do not create CPD hours; approved learning remains in the CPD ledger.

## 14 Nominations

A short form asks for category, colleague, reason and optional value. Permit one nomination per nominator, category, recipient and period. No self-nomination. Employee-facing pages acknowledge submission without exposing other nominators, nomination counts or a candidate ranking.

## 15 Selection logic

P&C reviews nomination statements, real recognition and department diversity; enters five scores from 0 to 5 with a rationale; and sees the weighted score as decision support. Weights total 100%. A category has at most one approved recipient per period. Publication requires the period to be closed for review and a human-approved citation. A separate action publishes the reveal. The system never auto-selects a winner.

## 16 Anti-gaming and fairness

Reject duplicates and self-actions at the database boundary. Apply star limits atomically. Flag reciprocal pairs, repeated exchanges, concentration within a department and simple three-person cycles as review indicators. Small teams and legitimate collaboration can cause these patterns; P&C must review context and record its decision. Flags are confidential and are not accusations or disciplinary findings.

## 17 My Impact

Show received appreciation, exact values recognised, published monthly awards, earned badges and a positive timeline. Include award card downloads and an optional link back to authorised profile or development pages. Pending nominations are confidential; publish only approved citations rather than nomination statements or live counts.

## 18 Mood check-in

Offer Great, Good, Okay, Low and Stressed as a named daily update visible to all signed-in IUC colleagues. Before submission, explain that the employee's name, current photo, feeling and optional message appear in the Community feed. The button says Share with colleagues. Employees can update today's post or withdraw it. Allow at most one visible update per employee per Malaysia calendar day, with atomic duplicate prevention and version checks. Participation is voluntary and does not change MPC.

The named route `/api/connect/feeling` writes only a `kind='feeling'` community post. It never reads or joins anonymous answers, tickets or eligibility. Previously anonymous check-ins stay anonymous, even when the same employee posts a new named feeling. The legacy anonymous pulse response route remains isolated and its reports retain fixed periods, minimum five-respondent thresholds and free-text suppression. Named feelings are not copied into anonymous reporting totals.

## 19 Pulse surveys

P&C creates occasional short pulses or formal surveys with Likert, multiple choice, rating, yes/no and optional free text. Publish within an explicit period and allow one response per employee per survey. Use the same separate eligibility and response design. Per-question aggregates require the reporting threshold; free-text extracts do not appear in manager or leadership reports. Do not send compulsory reminders.

## 20 Your Voice

Employees choose a named or anonymous submission in one of the requested categories. Named submissions are visible to the submitter and authorised P&C, not automatically to the community. Anonymous submissions use an unlinked one-use ticket and a random receipt code for follow-up. Never put an employee identity in an anonymous response, moderation event or P&C view. Warn that self-identifying text can reveal the author. Confidential casework has a direct route to the existing HR Service Desk.

## 21 You Said → We Did

P&C records Received, Under Review, Being Explored, Planned, Implemented or Closed with Explanation, together with an action explanation. A separate public-safe summary controls what is shared with the community. Never publish a raw anonymous submission automatically. Show progress, an outcome and the responsible P&C response; receipt holders can see their private follow-up.

## 22 People of IUC

Employees may share a story through the feed. P&C publishes an opt-in featured story, including verified employee attribution and an optional approved image. Distinguish stories, campaigns, awards and corporate announcements visually. Do not scrape or disclose private profile details to create stories.

## 23 Badges and rewards

P&C defines a badge with clear criteria and issues it with a recorded reason. Rewards are an optional descriptive organisation-approved acknowledgement, not a monetary balance or entitlement. Downloadable recognition cards use name, category, period and approved citation. No fabricated signatures or unapproved award recipients.

## 24 Privacy and confidentiality

Named social records and anonymous response records are separate tables and API routes. Eligibility records show whether an employee obtained a ticket, but store no response ID or ticket. Unused tickets expire after 15 minutes; consumed tickets are deleted. A pending ticket is temporarily retained in the same browser tab to allow a retry after a failed submission. Eligibility indicates that a ticket was issued, not proof that an answer was received. Expired or lost tickets cannot be recovered through an employee-to-response lookup. Anonymous responses retain only a coarse reporting period and, for mood/surveys, a cohort for thresholded aggregates. P&C cannot drill down through arbitrary employee or date combinations.

This is interface-level anonymity with reduced technical metadata, not a promise of absolute anonymity. Infrastructure operators, request logs, timing or self-identifying text can create residual risk. The current Site still requires sign-in at the platform perimeter; that perimeter is not an anonymous network. Normal P&C, manager and leadership interfaces do not expose a respondent identity or an identity-to-response mapping. Anonymous mood comments and survey free text are excluded from routine insights.

## 25 Role access matrix

| Capability | Current employee | Assigned manager | Leadership grant | P&C allowlist | Technical Site editor alone |
| --- | --- | --- | --- | --- | --- |
| Community feed and appreciation | Audience permitted | Audience permitted | Audience permitted | Audience permitted and moderation | No additional access |
| Own My Impact and preferences | Own only | Own only | Own only | Own if employee | No additional access |
| Named daily feeling updates | Share, update or withdraw own; see colleagues | Same employee participation | Same employee participation | Read and moderate; participate if employee | No additional access |
| Anonymous pulse responses | Voluntary participation | Same employee participation | Same employee participation | Same if employee | No additional access |
| Insights | Own recognition only | Fixed assigned-team aggregates | Organisation aggregates | Organisation and safe department aggregates | No additional access |
| Voice submissions and follow-up | Own named or receipt | Own named or receipt | Own named or receipt | Triage and action summaries | No additional access |
| Award configuration and publication | No | No | No | Yes | No additional access |

All participation requires a current active employee record. P&C accounts without an employee record may administer but cannot impersonate an employee, check in or nominate. Exited or inactive staff immediately lose participation and private download access.

## 26 Analytics

Use recognised employee percentage, recognition inclusion, cross-department appreciation, value distribution, published awards, voice progress, closure totals and implementation ratio. Show pulse results only for fixed periods and eligible cohorts meeting thresholds. Managers see explicit assigned reports, leadership sees safe organisation aggregates, and P&C has governance detail. Never label low recognition as a performance concern or join anonymous answers to MPC, attendance or talent.

## 27 Database structure

Add Connect settings, preferences, posts, post audiences, images, comments, reactions, recognition, nomination periods, nominations, award selections, badges, badge awards, campaigns, featured stories, anonymous eligibility, short-lived tickets, mood responses, surveys, survey responses, voice submissions, voice updates, notifications, reports and moderation audit records. Reference existing employee IDs for named activities; do not copy the employee master. Anonymous responses have no employee foreign key. R2 holds private feed images; D1 holds metadata. Deploy through an append-only migration.

## 28 Integration map

Employee Master → identity, current status, name, department and job; existing photograph route → avatar; explicit management assignments → team scope; Nadi navigation and homepage → Connect entry; current announcements → corporate feed cards; Connect → its own in-app notification inbox; HR Service Desk → confidential employment queries; Culture → exact CATALYST values; CPD, MPC and career pages → contextual links only. No recognition-to-rating or recognition-to-CPD-credit write path is introduced.

## 29 Moderation

Publish Be Kind, Be Respectful, Celebrate Others, Protect Confidential Information and Keep It Professional. Allow reporting of posts and comments without notifying the author of the reporter. P&C can hide, restore or remove with a reason and audit record. Hide related images and interactions with the content. Preserve a time-limited audit trail. Confidential reports are available only to P&C, not managers or leadership.

## 30 Mobile experience

Use readable compact typography, rounded cards, clear labels, employee avatars, accessible form controls, one-column layouts and a sticky action bar. Forms open in accessible dialogs, prevent duplicate submission and confirm the result in plain language. Honour reduced-motion preferences and avoid heavy animation or chart libraries.

## 31 Phase 1 delivery

Deliver the community feed with scoped images, comments, mentions and positive reactions; recognition with optional controlled stars; My Impact; nomination periods, human-scored award review, published Spotlight and cards; voluntary mood; configurable surveys; named and anonymous voice with receipts and public-safe action summaries; stories, campaigns, opt-in birthday and service anniversary cards; badge criteria and issuance; in-app notifications; P&C settings, moderation, aggregate insights and retention. Add role-based navigation, security tests, local visual proof, publication and hosted checks. No example posts, moods or winners are seeded into production.

## 32 Phase 2 roadmap

Add a separately authorised award committee workflow and annual awards, more complex multi-session campaigns, approval-aware promotion/qualification/CPD celebration events, richer downloadable certificates, notification delivery integrations if explicitly authorised, and optional batched AI summaries of permitted aggregates. AI requires a separate cost and privacy decision; it is not needed to operate Phase 1.

## 33 Features deliberately excluded

No public live rankings, raw popularity winners, negative reactions, staff surveillance, automatic performance ratings, diagnoses, sensitive inferences, automated disciplinary or employment decisions, or attempts to identify anonymous authors. Named feeling posts are public within the signed-in IUC community, with clear employee-facing disclosure. Do not publish employee personal contact details or birth years. Do not infer management permissions from a title.

## 34 Low-credit architecture

Use deterministic validation, SQL aggregation, paginated feed reads, bounded uploads and existing photos. There are no model calls for posting, appreciation, survey collection, award scoring, cards or analytics. Keep assets local, cache static resources, avoid continuous polling and load administration detail only when requested. Retention runs through an explicit P&C maintenance action in Phase 1 rather than an undisclosed scheduler.

## 35 Risks and safeguards

Limit uploads and text lengths; render user text safely; validate origins, current access and audiences on every read and write; use database uniqueness and atomic guards for allowances, tickets and awards; record moderation decisions; protect receipt codes; suppress small aggregates; and disclose anonymity limits. P&C must govern public citations, celebration consent, selection fairness and retention. Full database or infrastructure access is a technical trust boundary, not an entitlement created by a manager or P&C interface.

The default anonymity threshold is five. Personal celebrations and stars are off until enabled by the relevant employee or P&C. Connect records are retained according to configurable operational limits; deleting an employee is not required to retain or restrict their historical recognition.

## Release verification

The current release passed 311 Connect checks, including named feeling visibility, employee ownership, duplicate prevention, concurrent updates, withdrawal, unchanged anonymous answers, private audiences and image reads, account revocation, star budgets, human approval and publication, daily anonymity thresholds, receipt follow-up and retention. Existing navigation, homepage, employee-profile (49 checks) and HR Service Desk (96 checks) regressions also passed.

Local browser verification used clearly labelled sample records and exercised named feeling sharing, updates and withdrawal, appreciation, P&C selection review and the separate publication step. The 390-pixel mobile view had no horizontal overflow and retained the four quick actions. No sample records are included in the live migration. Hosting verification is performed after publication; the existing Site audience is preserved.

Phase 2 remains a roadmap: annual and committee awards, approval-aware milestone automation, richer certificates, external notification delivery and optional AI summaries are not part of this release.

## Homepage integration — 6 October 2026

The signed-in homepage now mounts the Connect community directly, using the same APIs, role checks, data and controls. Community, My Impact and Your Voice switch within the homepage. Shared feelings, posts, appreciation, reactions, comments, nominations, preferences and notifications remain available. P&C moderation and management insights retain their protected workspaces. Legacy /connect links redirect to the homepage with query parameters retained. Community styles are scoped to the homepage section to preserve existing module controls. No sample records are deployed.
