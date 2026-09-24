# Proposal: Activity Timeline / Audit Log for the Organisator

## Executive summary

Once the dashboard is live and participant status changes work reliably, the next high-value domain to complete is the Activity Timeline / Audit Log.

This is the feature that turns the system from a participant registry into a traceable operating system for onboarding and program management. It gives staff instant transparency into what happened, when it happened, and who triggered it.

From a product perspective, this provides more immediate value than a second feature wave such as bulk actions or calendar management, because every operational workflow benefits from a clear history trail.

## Why this is the next priority

The dashboard creates visibility. The Activity Timeline creates accountability.

Without history, operators can only see the current state. They cannot answer questions like:

- Who changed this participant from Onboarding to Active?
- When was the profile last updated?
- Which follow-up actions were created for this participant?
- What changed before the participant was marked as dropped or paused?

This is especially valuable for:

- support and operations teams
- stakeholder reporting and auditability
- regression analysis during onboarding issues
- future automation and workflow design

## Recommended priority order

### Priority 1: Activity Timeline / Audit Log

This provides immediate operational clarity and is the backbone for future reporting and workflows.

### Priority 2: Filter & Saved Views

Operational users need to quickly isolate participant cohorts such as:

- all Onboarding participants
- all Active participants
- new participants in the last 30 days
- participants without a scheduled appointment

Saved views such as:

- "Heidelberg Active"
- "Needs Follow-Up"
- "New this month"

will be used more often than a dashboard alone.

### Priority 3: Tasks / Follow-Ups

This turns the app from a database into a workflow tool. Examples:

- conduct first interview
- review documents
- schedule appointment
- complete onboarding

### Priority 4: Timeline on participant detail page

The participant detail page should not only show profile data, but also:

- profile changes
- status changes
- activities
- appointments
- tasks

This makes the timeline the most important secondary view after master data.

### Priority 5: Notifications

A centralized notification system should support messages such as:

- participant activated
- appointment created successfully
- participant missing email address
- onboarding task overdue

## Product use cases

### Example activity stream

24.09.2026 14:32
Samuel changed status: Onboarding → Active

24.09.2026 14:35
Participant profile updated

24.09.2026 14:40
Appointment assigned to participant

24.09.2026 14:42
Task created: Review onboarding documents

### Example use cases for support and operations

- show why a participant is in their current lifecycle state
- find who last changed coaching or program assignment
- investigate missing data issues quickly
- prepare data for compliance and operational review

## Proposed feature definition

### Feature name
Activity Timeline / Audit Log

### Goal
Capture and display a chronological record of relevant participant events with user, timestamp, and action metadata.

### Core requirements

- Record participant status changes
- Record participant updates
- Show user, timestamp, and action
- Add timeline tab to participant detail view
- Build reusable ActivityTimeline component
- Support pagination and filtering
- Prepare the data model for future audit logging

## Architecture proposal

### 1. Data model

A dedicated activity object should capture events in a structured form.

Suggested model:

```ts
interface ActivityLogEntry {
  id: string;
  subjectType: "Participant" | "Program" | "Coach" | "Task" | "Appointment";
  subjectId: string;
  actorId: string;
  actorName: string;
  eventType: "status_changed" | "profile_updated" | "task_created" | "appointment_created" | "program_assigned" | "coach_assigned" | "custom";
  actionLabel: string;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}
```

### Event examples

```ts
{
  id: "act_001",
  subjectType: "Participant",
  subjectId: "p_123",
  actorId: "user_42",
  actorName: "Samuel",
  eventType: "status_changed",
  actionLabel: "Status change",
  description: "Participant status changed from Onboarding to Active",
  metadata: {
    previousStatus: "Onboarding",
    newStatus: "Active"
  },
  createdAt: "2026-09-24T14:32:00Z"
}
```

```ts
{
  id: "act_002",
  subjectType: "Participant",
  subjectId: "p_123",
  actorId: "user_42",
  actorName: "Samuel",
  eventType: "profile_updated",
  actionLabel: "Profile updated",
  description: "Participant profile was updated",
  metadata: {
    changedFields: ["email", "programId"]
  },
  createdAt: "2026-09-24T14:35:00Z"
}
```

### Suggested storage approach

Best short-term execution path:

- store activity records in a dedicated custom object or related object model
- if a custom object is not yet available, use a lightweight event table in the backend layer or first implementation store
- keep all activity entries append-only
- avoid allowing edits to historical activity records

This supports future audit-grade logging without overengineering the first pass.

## API design

### Core endpoints

#### GET /participants/:id/activity
Returns paginated activity entries for one participant.

Example response:

```json
{
  "items": [
    {
      "id": "act_001",
      "actorName": "Samuel",
      "eventType": "status_changed",
      "description": "Status changed from Onboarding to Active",
      "createdAt": "2026-09-24T14:32:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 42
}
```

#### POST /participants/:id/activity
Creates a new activity entry.

Used for:

- manual actions
- task creation
- appointment creation
- bulk updates

#### GET /activity
Returns filtered timeline across all participants.

Supported filters:

- participantId
- actorId
- eventType
- dateFrom
- dateTo
- subjectType

#### GET /activity/summary
Returns counts for aggregate reporting such as:

- most active users
- event counts by type
- most recent status transitions

## Frontend requirements

### Reusable component

Create a reusable component:

`ActivityTimeline`

Props:

```ts
interface ActivityTimelineProps {
  participantId?: string;
  pageSize?: number;
  filter?: ActivityFilter;
  compact?: boolean;
}
```

### Display format

Each timeline item should show:

- actor name
- action label
- timestamp
- description
- optional metadata badge or field changes

Example UI:

```text
Samuel
Status change
24.09.2026 14:32
Onboarding → Active
```

### Tabs and placement

Add a new Timeline tab to the participant detail view.

Suggested layout:

- Participant
- Documents
- Activities
- Appointments
- Tasks

The Timeline tab should be the default operational tab for support and admin workflows.

## Data flow and event recording

### Events to capture

#### Participant-level events

- participant created
- participant status changed
- participant profile updated
- program assigned
- coach assigned
- participant archived

#### Task-level events

- task created
- task completed
- task overdue

#### Appointment-level events

- appointment created
- appointment updated
- appointment canceled

### Recording strategy

Events should be created in a central service layer so that all mutations go through one event publisher.

Example pattern:

```ts
await recordActivity({
  subjectType: "Participant",
  subjectId: participantId,
  actorId: currentUser.id,
  eventType: "status_changed",
  description: "Status changed from Onboarding to Active",
  metadata: {
    previousStatus: "Onboarding",
    newStatus: "Active"
  }
});
```

This guarantees that all status changes are logged consistently, instead of being added ad hoc in each UI action.

## Implementation plan

### Phase 1: foundation

- define activity event types
- add data model and schema
- add backend API for create/list/filter
- add server-side validation around actor and subject

### Phase 2: participant status tracking

- log status changes when a participant status is updated
- log profile updates on save
- show first activity entries in the UI

### Phase 3: timeline UI

- create `ActivityTimeline` component
- add timeline tab to participant detail view
- support basic sorting and pagination
- show user name, timestamp, action, and summary

### Phase 4: filtering and saved views

- implement filters by type, actor, date, and participant cohort
- allow saved filters and reusable views
- connect to list pages and overview screens

### Phase 5: operational extensions

- add notification triggers
- integrate task and appointment events
- prepare reporting layer for audit-based views

## Technical considerations

### Pagination and performance

- default page size: 20 items
- server-side pagination preferred
- add ordering by `createdAt DESC`
- support incremental loading for long histories

### Filtering

Initial filter set:

- event type
- date range
- participant
- actor
- subject type

### Security and auditability

- only privileged users should create or view full audit logs
- log actor identity, not just the UI action
- treat log entries as append-only

## Recommendation

The next major productivity gain is not another dashboard gimmick or cosmetic addition. It is the implementation of a complete Activity Timeline feature.

This is the foundation for:

- trust in operational data
- faster issue resolution
- cleaner support workflows
- future reporting and automation
- eventual task and appointment integration

This should be the next build target after the dashboard is stable and participant status changes are proven reliable.

## Immediate next step

Assign engineering work to implement:

- Activity Timeline feature
- data model and API contract
- participant detail tab
- reusable ActivityTimeline component
- first filter and pagination support

This should be treated as the next core product milestone and should be prioritized before broader task and calendar features.
