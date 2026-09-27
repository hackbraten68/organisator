# Proposal: Learning Progress Tracking & Early Warning

**Status:** Proposal (2026-09-27) — no code, decisions required.
**Goal:** Know per participant whether they are on track, and warn early when
they fall behind — without turning the audit log into a tracking database.

## 1. Architecture: three stores, three jobs (fixed)

| Store | Job | Examples |
|---|---|---|
| `Learning_Path__c` | **Plan** — what should happen, in which order, how long | items, `Order__c`, `Estimated_Weeks__c` |
| **Progress state (new)** | **Position** — where the participant stands right now | `Completed` at item/video level, timestamps |
| `AuditEvent__c` | **History** — what happened, immutably | `learning_path.item_updated` (milestones only) |

Non-negotiable: high-frequency progress signals (video heartbeats, page
views) never land in `AuditEvent__c`. Audit records milestones
(`started`/`completed`); the progress store holds mutable state; warnings
are derived queries over plan vs. position.

## 2. Granularity decision (open)

| Option | Pro | Contra |
|---|---|---|
| **A. Per learning-path item (recommended)** | Maps 1:1 onto existing `Learning_Path__c` + `Status__c`; no schema change for v1 (add `StartedAt`/`CompletedAt` or derive from audit); early warning per item delay | Coarse: a 6-week item can silently stall for weeks |
| **B. Per video/lesson within an item** | Fine-grained stall detection | New object (`LearningProgress__c` per video × participant), volume, needs LMS content model first |
| **C. Hybrid** | A now, B later | Two migrations |

Recommendation: **A for v1**, schema-ready for B (progress object keyed by
`participantId + itemId + optional lessonRef` from day one, so B is additive).

## 3. Data source decision (open)

| Option | Pro | Contra |
|---|---|---|
| **A. Coach-entered (recommended for v1)** | No integration; matches current manual workflow; trustworthy | Manual effort, coarse timestamps |
| **B. Participant self-report** | Scales, engages | Gaming risk, needs verification UX |
| **C. LMS platform API** | Automatic, fine-grained | Integration project; external dependency; privacy review |

Recommendation: **A now** (status flips already exist in the Lernpfad tab),
**C as the growth path** once an LMS is chosen.

## 4. Early-warning definition (open, needs fachliche Festlegung)

Proposed v1 rule (per item):
- `Planned` + `ExpectedStart` passed by more than X days → `at-risk`
- `In Progress` + elapsed time > `Estimated_Weeks__c` × Y → `behind`
- No activity on any item for Z days → `stalled`

X/Y/Z are program parameters, not constants. Surface: Needs-Attention-Inbox
(new rules beside the current completeness rules) + coach view badge. No
automated messages to participants in v1 (human decides).

## 5. Schema sketch (v1, additive only)

On `Learning_Path__c` (or new `LearningProgress__c` if B-shape preferred):
- Progress position derives from existing `Status__c` — no new field needed
  for A, except optional `StartedAt__c`/`CompletedAt__c` for delay math
  (fallback: derive from audit `item_updated` events).
- Warning state is **never stored**: computed at read time from plan +
  position + program parameters (no stale flags, no sync jobs).

## 6. Audit interaction

- Progress *edits* (status flips) already emit `learning_path.item_updated`
  via `programService` — no new event types for v1.
- If option B lands later: lesson completions emit **one**
  `learning_path.item_updated` when the *item* completes, not per lesson.

## 7. Privacy notes (vorab zu klären)

- Progress data is behavioral data: Zweckbindung (coaching, not scoring),
  retention, and participant visibility (external dashboard shows *own*
  progress only) need sign-off before building.
- No per-video surveillance semantics: track completion, not watch time,
  unless explicitly decided otherwise.

## 8. Phased rollout

1. **v1 (small):** delay math on `Status__c` + optional date fields, inbox
   rules `at-risk`/`behind`, coach badge. No new objects.
2. **v2:** `LearningProgress__c` object (lesson granularity), LMS import.
3. **Later:** participant-facing progress + automated nudges (human-approved).

## Open questions for review

1. Granularity: A now, B later — agreed?
2. Source: coach-entered v1, LMS later — agreed?
3. X/Y/Z thresholds: global defaults or per program?
4. Who sees warnings: coach only, or also supervisor + participant (own)?
5. Retention: how long is progress history kept?
