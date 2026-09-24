# Audit System Implementation Guide

## Quick Start

After the Salesforce admin has deployed the `AuditEvent__c` custom object, integrate the audit system into your mutations with these steps:

### 1. Import Audit Helpers

```typescript
import { recordParticipantStatusChange, recordParticipantUpdate } from '@/api/audit/participantAuditIntegration';
import { auditService } from '@/api/audit/auditService';
```

### 2. Capture Actor Context

Before calling mutations, get the authenticated user:

```typescript
const currentUser = await getUserContext(); // Implementation depends on Salesforce SDK
const auditActor = {
  id: currentUser.id,
  type: 'staff' as const,
  displayName: currentUser.name,
};
```

### 3. Record Audit on Mutation Success

**For status changes:**

```typescript
// Participant service
export async function updateParticipant(
  id: string,
  patch: ParticipantPatch,
): Promise<Participant | null> {
  const existing = await getParticipant(id);
  if (!existing) return null;

  // ... perform mutation ...

  const result = await getParticipant(id);
  
  // NEW: Record audit event if status changed
  if (patch.status && patch.status !== existing.status) {
    await recordParticipantStatusChange(
      id,
      existing.status,
      patch.status,
      { actor: auditActor },
    );
  }
  
  return result;
}
```

**For general updates:**

```typescript
// After successful mutation
if (saved) {
  try {
    await recordParticipantUpdate(id, existing, saved, {
      actor: auditActor,
      correlationId, // Share across related mutations
    });
  } catch (err) {
    console.error('Audit event failed; mutation succeeded', err);
    // Do NOT fail the mutation if audit fails
  }
}
```

### 4. Add Activity Tab to Participant Page

In `ParticipantDetailPage.tsx`:

```typescript
import { ActivityTimeline } from '@/components/audit';
import { getParticipantActivity } from '@/api/audit/auditApiService';
import { useAsyncData } from '@/hooks/useAsyncData';

function ParticipantDetailPage() {
  // ... existing code ...

  const { data: activityData } = useAsyncData(
    () => getParticipantActivity(participant.id, 50),
    [participant.id],
  );

  return (
    <Tabs>
      {/* Existing tabs */}
      <TabsList>
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        {/* NEW */}
        <TabsTrigger value="activity">Aktivitäten</TabsTrigger>
      </TabsList>

      <TabsContent value="activity">
        <ActivityTimeline
          events={activityData?.events ?? []}
          hasMore={activityData?.hasNextPage}
          onLoadMore={async () => {
            // Implement pagination if needed
          }}
          participantId={participant.id}
        />
      </TabsContent>
    </Tabs>
  );
}
```

---

## Integration Examples

### Adding Audit to Workbook Mutations

1. **Create integration module** (`workbookAuditIntegration.ts`):

```typescript
import { auditService } from './auditService';
import type { AuditActor } from './participantAuditIntegration';
import { EVENT_TYPES } from '@/types/audit';

export async function recordWorkbookAnswerUpdated(
  workbookId: string,
  participantId: string,
  answerIndex: number,
  oldAnswer: string,
  newAnswer: string,
  options: { actor: AuditActor; reason?: string },
): Promise<void> {
  await auditService.record({
    eventType: EVENT_TYPES.WORKBOOK_ANSWER_UPDATED,
    domain: 'workbook',
    action: 'updated',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Workbook__c',
    subjectId: workbookId,
    participantId,
    source: 'web',
    reason: options.reason,
    changes: [
      {
        field: `Answer[${answerIndex}]`,
        oldValue: undefined, // Redacted by default
        newValue: undefined,
        displayType: 'text',
        redacted: true,
      },
    ],
    metadata: {
      answerIndex,
      wordCountOld: oldAnswer.split(/\s+/).length,
      wordCountNew: newAnswer.split(/\s+/).length,
    },
  });
}
```

2. **Call from workbook service**:

```typescript
export async function updateWorkbookAnswer(
  workbookId: string,
  answerIndex: number,
  newAnswer: string,
  actor: AuditActor,
): Promise<Workbook> {
  const before = await getWorkbook(workbookId);
  const oldAnswer = before.answers?.[answerIndex] ?? '';

  // Perform mutation
  const result = await executeGraphQL(UPDATE_WORKBOOK_ANSWER, {
    // ...variables
  });

  // Record audit
  await recordWorkbookAnswerUpdated(
    workbookId,
    before.participantId,
    answerIndex,
    oldAnswer,
    newAnswer,
    { actor },
  );

  return result;
}
```

### Adding Audit to Appointment Mutations

1. **Create integration module** (`appointmentAuditIntegration.ts`):

```typescript
import { auditService } from './auditService';
import { EVENT_TYPES } from '@/types/audit';

export async function recordAppointmentCreated(
  appointmentId: string,
  participantId: string,
  startTime: string,
  endTime: string,
  options: { actor: AuditActor },
): Promise<void> {
  await auditService.record({
    eventType: EVENT_TYPES.APPOINTMENT_CREATED,
    domain: 'appointment',
    action: 'created',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Appointment__c',
    subjectId: appointmentId,
    participantId,
    source: 'web',
    changes: [
      {
        field: 'StartTime',
        oldValue: undefined,
        newValue: startTime,
        displayType: 'date',
        redacted: false,
      },
      {
        field: 'EndTime',
        oldValue: undefined,
        newValue: endTime,
        displayType: 'date',
        redacted: false,
      },
    ],
    metadata: {
      durationMinutes: calculateDuration(startTime, endTime),
    },
  });
}

export async function recordAppointmentRescheduled(
  appointmentId: string,
  participantId: string,
  oldStartTime: string,
  oldEndTime: string,
  newStartTime: string,
  newEndTime: string,
  options: { actor: AuditActor; reason?: string },
): Promise<void> {
  await auditService.record({
    eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULED,
    domain: 'appointment',
    action: 'rescheduled',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Appointment__c',
    subjectId: appointmentId,
    participantId,
    source: 'web',
    reason: options.reason,
    changes: [
      {
        field: 'StartTime',
        oldValue: oldStartTime,
        newValue: newStartTime,
        displayType: 'date',
        redacted: false,
      },
      {
        field: 'EndTime',
        oldValue: oldEndTime,
        newValue: newEndTime,
        displayType: 'date',
        redacted: false,
      },
    ],
  });
}
```

---

## Authorization & Filtering

### Query-Level Filtering

The audit API automatically applies authorization. To check permissions:

```typescript
import type { AuditActorType } from '@/types/audit';

/**
 * Determine what audit events a user can see
 */
function canViewAuditEvent(
  userRole: string,
  eventVisibility: string,
  eventSensitivity: string,
): boolean {
  // Staff can see staff-level events for assigned participants
  if (userRole === 'staff') {
    return eventVisibility === 'staff' && eventSensitivity === 'normal';
  }

  // Supervisors can see organization-wide events
  if (userRole === 'supervisor') {
    return eventVisibility !== 'restricted';
  }

  // Admins can see everything
  if (userRole === 'admin') {
    return true;
  }

  return false;
}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { compareFieldChanges, applyFieldRedaction } from '@/api/audit/auditService';

describe('Audit Service', () => {
  it('should compare field changes correctly', () => {
    const before = { name: 'Alice', status: 'Onboarding' };
    const after = { name: 'Alice', status: 'Active' };

    const changes = compareFieldChanges(before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      field: 'status',
      changed: true,
      oldValue: 'Onboarding',
      newValue: 'Active',
    });
  });

  it('should redact sensitive fields', () => {
    const changes = [
      { field: 'Name', oldValue: undefined, newValue: 'Alice', changed: true },
      {
        field: 'AnswerText',
        oldValue: 'old answer',
        newValue: 'new answer',
        changed: true,
      },
    ];

    const redacted = applyFieldRedaction(changes, 'workbook');

    expect(redacted[0].redacted).toBe(false);
    expect(redacted[1].redacted).toBe(true);
    expect(redacted[1].oldValue).toBeUndefined();
  });
});
```

### Integration Test Example

```typescript
describe('Participant Mutations with Audit', () => {
  it('should create audit event on status change', async () => {
    const participantId = 'p_001';
    const actor = { id: 'u_1', type: 'staff' as const, displayName: 'Alice' };

    // Mock the mutation
    vi.mocked(updateParticipant).mockResolvedValueOnce({
      id: participantId,
      status: 'Active',
      // ... other fields
    });

    // Call the wrapped service
    await updateParticipantWithAudit(participantId, { status: 'Active' }, actor);

    // Check that audit event was recorded
    expect(createAuditEventRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'participant.status_changed',
        domain: 'participant',
        actorId: 'u_1',
      }),
    );
  });
});
```

---

## Deployment Checklist

Before deploying the audit system:

- [ ] Salesforce admin has deployed `AuditEvent__c` custom object
- [ ] GraphQL schema is updated and includes AuditEvent__c
- [ ] Field policies are reviewed and finalized
- [ ] User authentication context is accessible in mutations
- [ ] Tests pass (unit + integration + authorization)
- [ ] activity-timeline tab is added to participant detail page
- [ ] Audit recordings are wired into participant mutation service
- [ ] Error handling is in place (audit failures don't break mutations)
- [ ] Documentation is updated with new audit fields in data dictionary

---

## Troubleshooting

### Audit events not being created

1. Check that `AuditEvent__c` custom object exists in Salesforce
2. Verify GraphQL mutation imports are correct
3. Check browser console for GraphQL errors
4. Verify actor context is available and passed correctly

### Sensitive fields visible when redacted

1. Check field policy configuration in `audit.ts`
2. Verify `applyFieldRedaction()` is called before persistence
3. Check that UI respects `redacted` flag in `ChangeSetViewer`

### Performance issues with large activity timelines

1. Enable pagination cursor
2. Increase database indexes on `ParticipantId__c + CreatedDate`
3. Implement activity aggregation for older events
4. Archive very old events per retention policy

### Missing audit events for mutations not in participant service

1. Check that all mutation points are wrapped with audit recording
2. Use `participantAuditIntegration` as template for other domains
3. Ensure mutations are called through service layer, not directly via GraphQL

---

## Extension Points

### Adding a New Domain

1. Define event types in `types/audit.ts`:
   ```typescript
   DOMAIN_XYZ_CREATED: 'xyz.created',
   DOMAIN_XYZ_UPDATED: 'xyz.updated',
   ```

2. Create field policies:
   ```typescript
   export const DEFAULT_FIELD_POLICIES['xyz'] = {
     FieldName: { strategy: 'FULL', displayType: 'text' },
   };
   ```

3. Create `xyzAuditIntegration.ts` module
4. Wire into mutation service
5. Add tests

### Custom Visibility Rules

Override `canViewAuditEvent()` in your authorization layer:

```typescript
export function canViewAuditEvent(
  user: CurrentUser,
  event: AuditEvent,
): boolean {
  // Custom logic
  if (event.domain === 'time_tracking' && user.role !== 'supervisor') {
    return false;
  }
  return true;
}
```

---

## References

- [AUDIT-SYSTEM-DESIGN.md](./AUDIT-SYSTEM-DESIGN.md) — Full architecture and design
- [audit types](../types/audit.ts) — Event and schema definitions
- [auditService](../api/audit/auditService.ts) — Core recording logic
- [participantAuditIntegration](../api/audit/participantAuditIntegration.ts) — Integration example
- [ActivityTimeline component](../components/audit/ActivityTimeline.tsx) — UI display

