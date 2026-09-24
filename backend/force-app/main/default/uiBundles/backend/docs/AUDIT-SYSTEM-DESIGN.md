# Audit & Activity System Design

## Overview

This document describes the centralized, append-only audit and activity system for Organisator. It provides authorized staff with transparent, durable records of relevant changes across the application while maintaining privacy, operational fairness, and compliance with data protection principles.

**Scope:** Participant profile and status, Workbook, Absence management, Appointment booking, Klassenbuch, Daily check-in, Time tracking.

**Key principle:** This is an operational audit and support feature, not employee-performance scoring or surveillance.

---

## 1. Repository Analysis

### 1.1 Technology Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Frontend** | React 19, TypeScript, Vite | UI Bundle deployed to Salesforce |
| **UI Framework** | shadcn/ui, Tailwind CSS | Component library |
| **Data Layer** | GraphQL (Salesforce uiapi) | Server-side data access via SDK |
| **Backend** | Salesforce Objects (managed via GraphQL) | No Apex classes; data-driven via metadata |
| **ORM/Query** | Salesforce uiapi GraphQL | Schema auto-generated from org metadata |
| **Authentication** | Salesforce OAuth via platform SDK | Implicit user context in SDK calls |
| **API Pattern** | GraphQL mutations and queries | No REST layer detected |
| **State Management** | Local React state + async fetching | No global state manager; explicit fetch pattern |
| **Tests** | Vitest, Testing Library, Playwright | Comprehensive test setup exists |

### 1.2 Current Data Model

**Primary Objects:**
- `Participant__c` — Main domain object; contains status, dates, relationships
- `Program__c` — Program master data
- `Coach_Profile__c` — Staff/coach records
- `Account` — Platform account records

**Existing Lookups:**
- Participant.Program__c → Program__c
- Participant.Coach_Profile__c → Coach_Profile__c
- Participant fields: Name, Status__c, Email__c, StartDate__c, ExpectedEndDate__c, etc.

**Status Values (Picklist):**
Onboarding, Active, Paused, Graduated, Placed, Dropped

### 1.3 Mutation Patterns

**Example: Participant Update**
1. Frontend component calls `updateParticipant(id, patch)` from `participantService.ts`
2. Service fetches current state: `getParticipant(id)`
3. Constructs GraphQL mutation `UpdateParticipant` with new values
4. Executes mutation via `executeGraphQL()` → `data.graphql.mutate()`
5. Refetches via `getParticipant(id)` to confirm
6. Returns updated entity to caller
7. Caller updates local state and refetches list

**Key Observation:** No middleware or hook intercepts mutations; each service function handles its own cycle.

### 1.4 Existing Audit or Event Mechanisms

- **None detected** in current code
- Salesforce automatic field tracking (CreatedDate, LastModifiedDate, LastModifiedById) is available but not exposed to the app
- No custom history object identified

### 1.5 Authentication & Authorization

- **User Identity:** Available via Salesforce SDK context (implicit in `createDataSDK()`)
- **Permissions Model:** Not yet implemented in the application; assumed to be Salesforce-level
- **No API gateway or middleware** to intercept calls and enforce permissions

---

## 2. Architectural Decisions

### 2.1 Central Event Table vs. Domain-Specific History

**Decision:** One central `AuditEvent__c` custom object, not separate `ParticipantHistory`, `WorkbookHistory`, etc.

**Rationale:**
- Single schema enables organization-wide audit explorer
- Facilitates cross-domain queries and correlations
- Reduces redundant infrastructure (permissions, indexing, archival policies)
- Supports future audit rules that span domains

### 2.2 Timeline vs. Audit Log Separation

**Timeline** (UI Projection)
- Human-readable, grouped view of events for a participant
- One screen shows "Status changed" as a single activity
- May combine multiple audit events

**Audit Log** (Durable Data)
- Structured, immutable records with full detail
- Each relevant field change → one event
- Supports compliance, forensics, detailed searches

**Implementation:** Timeline queries audit events and applies presentation logic; audit events remain unchanged.

### 2.3 Event Writing Strategy: Transactional or Async?

**Decision:** Transactional write, with fallback for async backlog.

**Rationale:**
- Salesforce strongly favors synchronous mutations within the same transaction
- Audit event write fails → domain mutation rolls back (no unaudited state)
- Simpler model: one GraphQL call handles domain + audit in one operation
- Scalability: if audit write becomes a bottleneck, defer to async later

**Implementation:**
1. Client mutation requests domain change
2. Server-side Salesforce Logic (triggers or batch apex) records audit event in same transaction
3. Client receives confirmation; audit event is durable

**Note:** Future optimization may use an outbox pattern if the system grows to multiple services.

### 2.4 Field-Level Audit Policy

**Decision:** Explicit central policy (not per-field per-service).

**Audit strategies:**
- **FULL:** Store old and new value
- **REDACTED:** Log that field changed, but not values
- **REFERENCE:** Store only referenced entity ID, not display values
- **NONE:** Do not include in audit

**Default by field type:**
- Status, date, numeric fields → FULL
- Lookup/reference fields → REFERENCE
- Free-text (workbook answers, notes) → REDACTED
- Sensitive (passwords, tokens) → NONE

**Implementation:** `AuditFieldPolicy` configuration; checked at event-write time.

### 2.5 Authorization & Visibility

**Suggested permissions** (to be finalized):
- `audit.view.participant` — View events for assigned participants
- `audit.view.organization` — View organization-wide audit events
- `audit.view.restricted` — Access sensitive/personal events
- `audit.export` — Export audit data
- `audit.manage_retention` — Configure retention policies

**Suggested audience filters:**
- Staff events visible to: staff with appropriate permissions
- Participant events visible to: the participant (if visibility allows) + staff
- System events visible to: staff + audit admins

**Every audit read** should be logged (except routine timeline renders, to avoid noise).

### 2.6 Salesforce Objects & GraphQL Schema

**New Custom Object:** `AuditEvent__c`

Fields:
- `Id` (standard)
- `CreatedDate` (standard) — recordedAt
- `OccurredAt__c` (DateTime) — when the event actually happened
- `EventType__c` (Text, 80) — e.g., "participant.status_changed"
- `SchemaVersion__c` (Number) — versioning for schema evolution
- `Domain__c` (Picklist) — participant, workbook, absence, appointment, classbook, daily_checkin, time_tracking
- `Action__c` (Picklist) — created, updated, deleted, status_changed, submitted, approved, etc.
- `ActorType__c` (Picklist) — staff, participant, system, integration
- `ActorId__c` (Text, 18) — User ID or process identifier
- `ActorDisplayName__c` (Text, 255) — snapshot of actor's name
- `SubjectType__c` (Text, 80) — entity type affected (e.g., "Participant__c")
- `SubjectId__c` (Text, 18) — entity ID
- `ParticipantId__c` (Lookup, Participant__c) — for participant-centric filtering
- `Source__c` (Picklist) — web, mobile, api, import, automation, integration
- `CorrelationId__c` (Text, 36) — UUID for grouping related events
- `RequestId__c` (Text, 36) — for idempotency
- `Reason__c` (Text, 1000) — reason for corrections or sensitive changes
- `ChangedFields__c` (Text, 4000) — JSON array of field names
- `Changes__c` (Long Text Area, 131072) — JSON structure of field-level changes
- `Metadata__c` (Long Text Area, 131072) — allowlisted context/domain metadata
- `Visibility__c` (Picklist) — staff, participant, restricted
- `Sensitivity__c` (Picklist) — normal, personal, restricted

**Indexes:**
- CreatedDate + Domain__c (common: "show me all participant events")
- ParticipantId__c + CreatedDate (participant timeline)
- ActorId__c + CreatedDate (show me who changed what)
- SubjectType__c + SubjectId__c + CreatedDate (show entity history)
- CorrelationId__c (group operations)

### 2.7 Server-Side Actor Extraction

**Why:** Prevent client impersonation; use authenticated server context.

**Implementation:**
1. Client sends mutation request
2. Salesforce SDK provides authenticated user context (`User.User.Id`, `User.User.Name`)
3. Audit service captures actor from context, not client input
4. Audit event is written with verified actor

### 2.8 Idempotency & Retry Safety

**Problem:** Retried mutations could create duplicate events.

**Solution:** Optional `RequestId__c` field (UUID sent by client).
- If mutation is retried with same RequestId, event write is idempotent
- Application must propagate RequestId through GraphQL mutation
- Database unique constraint or deduplication logic prevents duplicates

**Note:** Initial implementation forwards requests as-is; idempotency added later if needed.

---

## 3. Event Schema

### 3.1 AuditEvent Structure

```typescript
interface AuditEvent {
  id: string; // Salesforce Id
  occurredAt: ISO8601DateTime; // When the actual event happened (may differ from recordedAt)
  recordedAt: ISO8601DateTime; // When we logged it (CreatedDate)
  eventType: string; // "participant.status_changed", "workbook.answer_updated", etc.
  schemaVersion: number; // Version of this event schema (for evolution)
  domain: 'participant' | 'workbook' | 'absence' | 'appointment' | 'classbook' | 'daily_checkin' | 'time_tracking' | 'system';
  action: 'created' | 'updated' | 'deleted' | 'archived' | 'restored' | 'status_changed' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'checked_in' | 'checked_out' | 'corrected';
  actorType: 'staff' | 'participant' | 'system' | 'integration';
  actorId?: string; // Salesforce User ID or system identifier
  actorDisplayNameSnapshot?: string; // Snapshot of actor's name at time of event
  subjectType: string; // 'Participant__c', 'Workbook__c', etc.
  subjectId: string; // Salesforce record ID
  participantId?: string; // For participant-centric filtering; may differ from subjectType if subject is not a participant
  parentType?: string; // If subject belongs to a parent (e.g., Workbook → Program)
  parentId?: string;
  source: 'web' | 'mobile' | 'api' | 'import' | 'automation' | 'integration';
  correlationId?: string; // UUID to group related events from one operation
  requestId?: string; // For idempotency
  reason?: string; // Reason for corrections, sensitive changes, or rejections
  changedFields: string[]; // Array of field names that changed
  changes: FieldChange[]; // Detailed changes per field
  metadata: Record<string, unknown>; // Allowlisted context metadata
  visibility: 'staff' | 'participant' | 'restricted'; // Who can see this event
  sensitivity: 'normal' | 'personal' | 'restricted'; // Data protection classification
}

interface FieldChange {
  field: string;
  oldValue?: unknown; // May be null/undefined if redacted or not applicable
  newValue?: unknown;
  displayType?: string; // 'status', 'date', 'email', 'multiline_text', etc.
  redacted: boolean;
  reference?: string; // If displayType is 'reference': related entity type
}
```

---

## 4. Domain Event Coverage

### 4.1 Participant Domain

| Event Type | When | Record |
|-----------|------|--------|
| `participant.created` | New participant record created | parent program, coach, initial status |
| `participant.updated` | Any field updated (except status) | changed fields (name, email, dates, program, coach) |
| `participant.status_changed` | Status field changes | old status → new status |
| `participant.archived` | Participant marked as archived/deleted | reason if provided |
| `participant.restored` | Archived participant reactivated | — |

### 4.2 Workbook Domain

| Event Type | When | Record |
|-----------|------|--------|
| `workbook.assigned` | Workbook assigned to participant | workbook ID, learning path, sequence |
| `workbook.started` | Participant starts workbook | — |
| `workbook.answer_updated` | Any answer changes | REDACTED by default (policy: no answer text stored) |
| `workbook.submitted` | Workbook submitted for review | submission timestamp |
| `workbook.reviewed` | Feedback provided; status changed | reviewer, feedback summary (redacted or visible per policy) |

### 4.3 Absence Management Domain

| Event Type | When | Record |
|-----------|------|--------|
| `absence.reported` | Absence created | start/end dates, type, reason (REDACTED) |
| `absence.updated` | Details changed | changed fields |
| `absence.approved` | Manager/staff approves | approver, approval note (REDACTED) |
| `absence.rejected` | Manager rejects | rejection reason (REDACTED) |
| `absence.cancelled` | Absence removed | cancellation reason (REDACTED) |
| `absence.document_added` | Supporting document attached | document name, size (not content) |

### 4.4 Appointment Domain

| Event Type | When | Record |
|-----------|------|--------|
| `appointment.created` | New appointment scheduled | participant, datetime, type, attendees |
| `appointment.rescheduled` | Date/time/location changed | old datetime → new datetime |
| `appointment.cancelled` | Appointment removed | cancellation reason (REDACTED) |
| `appointment.attendance_changed` | Attendance status updated | status change (scheduled → attended, no-show, etc.) |

### 4.5 Klassenbuch (Class Record) Domain

| Event Type | When | Record |
|-----------|------|--------|
| `classbook.entry_created` | New entry posted | entry type, class, timestamp |
| `classbook.entry_updated` | Entry text or metadata changed | changed fields; entry text REDACTED |
| `classbook.entry_deleted` | Entry removed | deletion reason (REDACTED) |
| `classbook.attendance_changed` | Attendance status updated | participant, status (present/absent/excused) |

### 4.6 Daily Check-In Domain

| Event Type | When | Record |
|-----------|------|--------|
| `daily_checkin.submitted` | Participant submits check-in | submission summary (REDACTED: no free text) |
| `daily_checkin.updated` | Resubmitted or edited | changed fields |
| `daily_checkin.flagged` | Staff flags for follow-up | flag reason (REDACTED) |
| `daily_checkin.reviewed` | Staff reviews and adds feedback | reviewer, feedback (REDACTED) |

### 4.7 Time Tracking Domain

| Event Type | When | Record |
|-----------|------|--------|
| `time_entry.started` | Participant starts time tracking | start time |
| `time_entry.stopped` | Participant stops time tracking | end time, duration |
| `time_entry.created` | Manual entry created | start, end, duration |
| `time_entry.corrected` | Entry time adjusted | old start → new start (where visible); correction reason (REQUIRED) |
| `time_entry.deleted` | Entry removed | deletion reason (REQUIRED) |
| `time_entry.approved` | Manager approves | approver |
| `time_entry.rejected` | Manager rejects | rejection reason (REDACTED or visible per policy) |

**Time Tracking Note:** Do NOT infer productivity, engagement, or performance from these events. Events record *what happened*, not *how well it was done*.

---

## 5. Field Classification & Redaction Policy

### 5.1 Audit Field Policy

```typescript
interface AuditFieldPolicy {
  [fieldName: string]: FieldAuditStrategy;
}

type FieldAuditStrategy = 'FULL' | 'REDACTED' | 'REFERENCE' | 'NONE';
```

### 5.2 Default Policies by Domain

#### Participant
| Field | Policy | Reason |
|-------|--------|--------|
| Name | FULL | Essential for audit trail |
| Email | FULL | Operational necessity |
| Status | FULL | Core change record |
| Program | REFERENCE | Store only ID, not name |
| Coach | REFERENCE | Store only ID, not name |
| StartDate | FULL | Important timeline marker |
| ExpectedEndDate | FULL | Program tracking |
| GitHub | FULL | Contact/identity field |
| Discord | FULL | Contact/identity field |

#### Workbook
| Field | Policy | Reason |
|-------|--------|--------|
| Answer Text | REDACTED | Potentially sensitive learning content |
| Answer Metadata | REDACTED | Supporting detail may be personal |
| Submission Timestamp | FULL | Timeline |
| Reviewer Feedback | REDACTED | Default; may be sensitive |

#### Absence
| Field | Policy | Reason |
|-------|--------|--------|
| Type | FULL | Operational necessity |
| Start/End Dates | FULL | Timeline |
| Reason | REDACTED | May be personal/medical |
| Approval Notes | REDACTED | May reference sensitive info |

#### Appointment
| Field | Policy | Reason |
|-------|--------|--------|
| DateTime | FULL | Core fact |
| Attendees | REFERENCE | Store only IDs |
| Status | FULL | Operational tracking |
| Cancellation Reason | REDACTED | May be sensitive |

#### Klassenbuch
| Field | Policy | Reason |
|-------|--------|--------|
| Entry Text | REDACTED | Classroom notes may be sensitive |
| Entry Type | FULL | Operational tracking |
| Attendance Status | FULL | Necessary for compliance |

#### Daily Check-In
| Field | Policy | Reason |
|-------|--------|--------|
| Response Text | REDACTED | Free-text responses may be personal |
| Mood/Status | FULL (non-text) | Aggregatable metadata |
| Flag Reason | REDACTED | May relate to sensitive issues |
| Feedback | REDACTED | Staff feedback may be sensitive |

#### Time Tracking
| Field | Policy | Reason |
|-------|--------|--------|
| Start Time | FULL | Operational necessity |
| End Time | FULL | Operational necessity |
| Duration | FULL | Aggregatable |
| Correction Reason | FULL (with care) | Required for transparency; redacted if sensitive |
| Activity Type | FULL | Operational classification |

**Note:** Policies are configurable. The above are defaults. A supervisor may be permitted to see redacted fields for participants in their scope; this is enforced at query/export time, not at write time.

---

## 6. Authorization & Permissions

### 6.1 Permission Model

**Custom Permissions (to be implemented in Salesforce):**

| Permission | Scope | Use Case |
|-----------|-------|----------|
| `AuditViewParticipant` | Participant-level | View activity for assigned participants |
| `AuditViewOrganization` | Organization-wide | View all audit events |
| `AuditViewRestricted` | Restricted visibility | Access personal/sensitive events |
| `AuditExport` | Export operations | Export audit data (csv, excel) |
| `AuditManageRetention` | Policy administration | Configure retention rules |

### 6.2 Suggested Role-Based Access Control

**Staff (default permission set)**
- ✅ Can view events for participants assigned to them
- ❌ Cannot view organization-wide events
- ❌ Cannot export
- ❌ Cannot see restricted-visibility events

**Program Manager / Supervisor**
- ✅ Can view events for all participants in program/department
- ✅ Can view organization-wide events (filtered)
- ✅ Can export (auditable)
- ❌ Cannot manage retention

**Audit Administrator**
- ✅ Can view all events including restricted
- ✅ Can export (auditable)
- ✅ Can manage retention policies
- ✅ Can view audit access logs

**Participant (future)**
- ✅ Can view only events marked visibility=participant or their own actions
- ❌ Cannot export
- ❌ Cannot see staff-internal events
- ❌ Cannot see other participants' events

### 6.3 Audit Query Enforcement

**Every query for audit events must:**
1. Identify the authenticated user
2. Check their permission level
3. Filter results to allowed record types, domains, and visibility levels
4. Log the query itself (if access to restricted or detailed exports)

**Example:** A staff member calls `GET /participants/:id/activity`. Filter returns only events where:
- `participantId = :id`
- AND (
    - `visibility = 'staff'` AND user has `AuditViewParticipant` for this participant
    - OR `visibility = 'participant'` AND permission level ≥ supervisor
  )

---

## 7. Privacy & Data Protection Considerations

### 7.1 Data Minimization

**Captured:**
- Actor ID (not name, to allow staff moves)
- Snapshot of actor name (for readability at query time; not updated)
- Entity ID (not full entity snapshot)
- Changed field names and (optional) values
- Timestamp, context, reason

**Not captured:**
- Request body (too large, may contain unrelated data)
- Passwords, tokens, secrets
- Session IDs, cookies
- Unrestricted headers (User-Agent logged elsewhere if needed)
- Unredacted free-text payloads
- IP addresses (unless legally required)
- Behavioral inferences (no "engagement score", "performance rating", or predictive metadata)

### 7.2 Purpose Binding

**Purpose:** Operational audit, support, compliance, and authorized staff transparency.

**Not permitted:**
- Monitoring employee/participant behavior scores
- Tracking productivity or engagement metrics
- Profiling or predictive analytics
- Marketing or behavioral research
- Automated decision-making based on audit events alone

### 7.3 Retention & Deletion

**Default retention:** Configure per domain and event type (e.g., 7 years for audit, 1 year for audit access logs).

**Legal hold:** If required by law or regulation, events may be preserved beyond normal retention.

**Deletion process:**
1. Identify events matching retention criteria
2. If legal hold exists, skip
3. Delete in batches (async to avoid performance impact)
4. Log deletion event (immutable; itself retained per policy)
5. Report deletion count for compliance tracking

**Never:** Modify or physically delete individual audit events through user-facing endpoints.

### 7.4 Transparency Controls in UI

- Clearly label audit events as audit data, not operational records
- Distinguish staff actions, participant actions, and system actions
- Explain why certain fields are redacted (if visible in UI)
- Provide privacy policy link or explanation of audit scope
- Show retention period where appropriate

### 7.5 GDPR and Data Subject Rights (prospective)

If Organisator operates in EU or serves EU subjects:
- **Right to access:** Audit events are accessible via the activity timeline (filtered by permission)
- **Right to erasure:** Implement deletion per retention policy; document in privacy policy
- **Right to portability:** Export includes audit events in machine-readable format
- **Right to object:** Audit is mandatory for operational necessity; some filtering/redaction possible

---

## 8. Implementation Phases

### Phase 1: Foundation (Vertical Slice)
**Duration:** 1-2 weeks

1. **Salesforce Setup**
   - Create `AuditEvent__c` custom object with required fields
   - Create indexes
   - Deploy via script

2. **Backend Audit Service**
   - Implement `auditService.record()` function
   - Add field redaction logic
   - Add field change comparison logic
   - Add GraphQL mutation support

3. **Participant Integration**
   - Hook into `updateParticipant()` mutation
   - Capture before/after state
   - Write audit event on successful mutation

4. **Audit Queries**
   - GraphQL query for participant timeline
   - API service function to fetch and format events

5. **UI**
   - Create basic `ActivityTimeline` component
   - Add tab to participant detail page
   - Display events in chronological order
   - Show actor, action, timestamp, changed fields

6. **Tests**
   - Unit tests for audit service (redaction, field comparison)
   - Integration tests (mutation + audit write)
   - Component tests (timeline rendering)
   - Authorization tests (filtered queries)

### Phase 2: Expansion (Other Domains)
**Duration:** 2-3 weeks

1. Hook workbook, absence, appointment mutations
2. Add workbook, absence, appointment event types
3. Test and refine redaction policies based on domain sensitivity
4. Add domain filtering to queries

### Phase 3: Staff Explorer
**Duration:** 1-2 weeks

1. Create `AuditExplorer` component
2. Add filter UI (domain, action, date range, actor, sensitivity)
3. Implement organization-wide query with authorization
4. Add event detail drawer
5. Add correlation grouping

### Phase 4: Permissions & Export
**Duration:** 1-2 weeks

1. Implement custom permissions in Salesforce
2. Add query-level authorization checks
3. Add export functionality (CSV, JSON)
4. Log all access to events with restricted visibility
5. Restrict export to permitted users only

### Phase 5: Retention & Scaling
**Duration:** As needed

1. Implement retention policy configuration
2. Add scheduled deletion/archival job
3. Monitor query performance; optimize indexes
4. Add aggregation views for reporting
5. Backfill historical events (if feasible)

---

## 9. Known Limitations & Future Considerations

### 9.1 Current Limitations

1. **No Apex Triggers:** If mutations occur outside the app (via Salesforce UI, API, or integrations), they won't be audited unless triggers are added. This is a future enhancement.

2. **One-Way Flow:** Audit events record what the app does; if data is corrected externally (Salesforce data loader, admin correction), that won't appear in audit events until a new mutation occurs.

3. **User Identification:** The app does not yet expose user identity in the session. The audit service assumes Salesforce SDK will provide context; if not available, a fallback to "system" may be necessary.

4. **No Encryption or Tamper Evidence:** Audit events are stored in the same Salesforce org as operational data. No cryptographic integrity proof is implemented. This is acceptable for operational audit; if forensic-grade tamper-evidence is needed, a separate immutable store is recommended.

5. **Participant Visibility:** The initial implementation logs events to the Salesforce org. If the app later supports participant-facing views, visibility controls must be applied at query time.

### 9.2 Future Enhancements

- [ ] Apex triggers to audit all mutations, not just those via GraphQL
- [ ] Async event publishing (event bus) for high-load scenarios
- [ ] Audit event aggregation and reporting dashboard
- [ ] Risk scoring for unusual audit patterns (not employee performance scoring)
- [ ] SIEM integration (export to security monitoring systems)
- [ ] Cryptographic hash-chaining for tamper evidence
- [ ] Participant-facing audit view (with strict filtering)
- [ ] Real-time alerts for sensitive changes

---

## 10. Security Checklist

- [ ] Audit events cannot be modified or deleted through normal application endpoints
- [ ] Audit events created only on successful mutations; rolled back if mutation fails
- [ ] Actor information comes from authenticated server context, not client input
- [ ] All queries enforce authorization; cross-tenant access is impossible
- [ ] Sensitive fields are redacted in UI, API, and exports consistently
- [ ] Participant cannot view staff-internal events
- [ ] Staff cannot impersonate other staff in audit events
- [ ] Rate limits on broad searches and exports to prevent abuse
- [ ] Metadata size limits enforced to prevent injection attacks
- [ ] Indexes created for performance-critical queries
- [ ] Retention policies regularly reviewed for legal/compliance requirements
- [ ] Audit access itself is logged (at least for restricted events)
- [ ] Deletion of audit events is itself auditable
- [ ] Output encoding applied in all UI rendering

---

## 11. Assumptions & Open Decisions

### 11.1 Assumptions

1. **Salesforce SDK provides user context:** The `createDataSDK()` call grants access to authenticated user ID and name.
2. **All mutations go through the GraphQL service:** We audit at the service layer, not at the Salesforce trigger layer.
3. **Participant records are the primary audit focal point:** Not all mutations affect participants, but participant-related changes are the priority.
4. **Time zone handling:** Front-end will display times in user's local zone; backend stores UTC.

### 11.2 Open Product Decisions

**To be decided internally:**

1. **Scope of participant visibility:** Can a participant see that a staff member changed their status? Or only self-initiated changes?
2. **Default retention period:** How long should events be retained? (e.g., 7 years for regulatory, 1 year for operational, 90 days for audit access logs)
3. **Export permissions:** Who can export? Only audit admins? Or supervisors too?
4. **Multi-tenancy:** Is Organisator single-tenant (one org) or multi-tenant (many customers)? If multi-tenant, all queries must include tenant filtering.
5. **Workbook answer visibility:** Should supervisors be able to see redacted workbook answers if they request unrestricted access?
6. **Time tracking interpretation:** Does "time tracking" mean clock-in/out, weekly hour reporting, or activity logging? Clarify to set redaction policies.
7. **Klassenbuch audience:** Is the klassenbuch read by participants (and thus audit events visible to them) or staff-only?

---

## 12. Testing Strategy

### Unit Tests
- Redaction logic: verify REDACTED fields have no values in output
- Field comparison: old vs. new values correctly captured
- Event serialization: JSON structure valid per schema

### Integration Tests
- Participant mutation → audit event written in same transaction
- Rollback: failed mutation → no audit event
- Refetch: new event appears in timeline query immediately after write

### Authorization Tests
- Staff cannot see events for participants not assigned to them
- Participant cannot see staff-internal events
- Restricted events filtered from results for unprivileged users

### Component Tests
- Timeline renders with correct order (descending by timestamp)
- Actor, action, changed fields displayed correctly
- Sensitive fields remain redacted in UI
- Expandable details show full change structure

### E2E Tests
- Participant status change flows through to activity timeline
- Supervisor can search across multiple participants' events
- Export respects user permissions

---

## 13. References

- **Salesforce uiapi GraphQL:** Platform SDK documentation
- **Participant types:** `/src/types/participant.ts`
- **Participant mutations:** `/src/api/participant/participantService.ts`
- **GraphQL client:** `/src/api/graphqlClient.ts`
- **Activity Timeline Proposal:** `./activity-timeline-proposal.md`

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-24  
**Status:** Design Phase

