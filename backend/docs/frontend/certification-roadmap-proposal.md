# Certification Roadmap — Proposal

Status: **Proposal** (not implemented)

This document captures the next architectural steps for the Organisator
learning-path domain. It is intentionally stored before implementation so the
data model can be reviewed and adjusted early.

## Agreed domain principle

Program = organizational container (duration, framework, coaches, group).
Learning Path = participant-specific curriculum. Program modules are reusable
content templates, never mandatory for every participant.

## 1. Certification Catalog (next entity)

### Motivation

Learning path items currently carry free-text titles (`"AWS SAA"`). A central
catalog removes typos, enables consistent maintenance and unlocks reporting
(“How many participants are currently doing AZ-104?”).

### Proposed type

```ts
export type Certification = {
  id: string;
  name: string;
  vendor: string;
  level?: string;
};
```

### Proposed seed data (grouped by vendor)

```text
AWS
├── Cloud Practitioner (CLP)
└── Solutions Architect Associate (SAA)

Microsoft
├── AZ-900
└── AZ-104

Linux
├── LFCS
└── RHCSA

Kubernetes
├── KCNA
└── CKA

HashiCorp
└── Terraform Associate
```

### Migration path for LearningPathItem

Replace free text with a reference, keeping free blocks possible:

```ts
export interface LearningPathItem {
  // ...
  certificationId?: string; // NEW — references Certification.id
  title: string;            // KEEP as fallback / custom training block
}
```

Display rule: `certification?.name ?? title`.

Consequences:

- Add form becomes a Select (catalog) with “custom block” fallback.
- Roadmap strings and the Participants tab resolve names via the catalog.
- Future Salesforce mapping: `Certification__c` object plus
  `LearningPathItem__c.Certification__c` lookup.

## 2. Curriculum Capacity (already implemented)

Rule: the sum of `estimatedWeeks` across a participant’s learning path must
not exceed the program’s `durationWeeks`.

Display in the participant learning path section:

```text
24 / 24 weeks ✅
28 / 24 weeks ⚠️ (over capacity)
```

Implemented as derived data (`getLearningPathWeeks` + program duration),
no model change required.

## 3. Later: Drag-and-Drop Roadmap

Reorder learning path items via drag and drop instead of up/down buttons.
Requires a new dependency (no dnd library installed yet) — evaluate
`@dnd-kit/sortable` when this is prioritized.

## 4. Later: Cross-participant progress reporting

Once the Certification Catalog exists, reporting becomes possible:

- How many participants have KCNA planned / in progress?
- Which certification is used most often?
- Which programs lead to AWS certificates?

Needs aggregated queries first (mock service, later GraphQL aggregate),
plus a Reports view. No UI work started.

## Priority order

1. ✅ Learning Path (done)
2. ✅ Program as container (done)
3. ✅ Curriculum Capacity (done)
4. 🎯 Certification Catalog
5. 🎯 Drag-and-Drop Roadmap
6. 🎯 Progress reporting across participants
