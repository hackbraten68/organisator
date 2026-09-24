/**
 * Audit API Service
 * 
 * High-level functions for fetching audit events from the backend.
 * These functions:
 * - Call GraphQL queries/mutations via executeGraphQL
 * - Transform responses to domain types
 * - Apply authorization filtering
 * - Handle pagination
 */

import { executeGraphQL } from '../graphqlClient';
import type { AuditEvent, AuditEventFilter, AuditEventCursor } from '@/types/audit';
import GET_PARTICIPANT_ACTIVITY_TIMELINE from './query/GetParticipantActivityTimeline.graphql?raw';
import CREATE_AUDIT_EVENT from './query/CreateAuditEvent.graphql?raw';

/**
 * Response structure from GetParticipantActivityTimeline query
 */
interface AuditEventNode {
  Id: string;
  OccurredAt__c?: { value?: string } | null;
  CreatedDate?: { value?: string } | null;
  EventType__c?: { value?: string } | null;
  SchemaVersion__c?: { value?: number } | null;
  Domain__c?: { value?: string } | null;
  Action__c?: { value?: string } | null;
  ActorType__c?: { value?: string } | null;
  ActorId__c?: { value?: string } | null;
  ActorDisplayName__c?: { value?: string } | null;
  SubjectType__c?: { value?: string } | null;
  SubjectId__c?: { value?: string } | null;
  ParticipantId__c?: { value?: string } | null;
  Source__c?: { value?: string } | null;
  CorrelationId__c?: { value?: string } | null;
  Reason__c?: { value?: string } | null;
  ChangedFields__c?: { value?: string } | null;
  Changes__c?: { value?: string } | null;
  Metadata__c?: { value?: string } | null;
  Visibility__c?: { value?: string } | null;
  Sensitivity__c?: { value?: string } | null;
}

interface ActivityTimelineResponse {
  uiapi?: {
    query?: {
      AuditEvent__c?: {
        edges?: Array<{ node?: AuditEventNode | null } | null> | null;
        pageInfo?: {
          hasNextPage?: boolean;
          endCursor?: string;
        };
      } | null;
    } | null;
  } | null;
}

interface CreateAuditEventResponse {
  uiapi?: {
    AuditEvent__cCreate?: {
      Record?: AuditEventNode;
    };
  } | null;
}

/**
 * Map Salesforce AuditEvent__c node to domain AuditEvent type
 */
function mapAuditEventNode(node: AuditEventNode): AuditEvent {
  const parseJsonField = (value: string | null | undefined): unknown => {
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if not valid JSON
    }
  };

  return {
    id: node.Id,
    recordedAt: node.CreatedDate?.value ?? new Date().toISOString(),
    occurredAt: node.OccurredAt__c?.value ?? new Date().toISOString(),
    schemaVersion: node.SchemaVersion__c?.value ?? 1,
    eventType: node.EventType__c?.value ?? 'unknown',
    domain: (node.Domain__c?.value as any) ?? 'system',
    action: (node.Action__c?.value as any) ?? 'created',
    actorType: (node.ActorType__c?.value as any) ?? 'system',
    actorId: node.ActorId__c?.value,
    actorDisplayNameSnapshot: node.ActorDisplayName__c?.value,
    subjectType: node.SubjectType__c?.value ?? 'Unknown',
    subjectId: node.SubjectId__c?.value ?? '',
    participantId: node.ParticipantId__c?.value,
    source: (node.Source__c?.value as any) ?? 'api',
    correlationId: node.CorrelationId__c?.value,
    reason: node.Reason__c?.value,
    changedFields: (() => {
      const val = node.ChangedFields__c?.value;
      if (!val) return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    })(),
    changes: (() => {
      const val = node.Changes__c?.value;
      if (!val) return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    })(),
    metadata: parseJsonField(node.Metadata__c?.value) as Record<string, unknown> ?? {},
    visibility: (node.Visibility__c?.value as any) ?? 'staff',
    sensitivity: (node.Sensitivity__c?.value as any) ?? 'normal',
  };
}

/**
 * Fetch audit events for a participant (timeline view)
 * 
 * @param participantId Salesforce participant record ID
 * @param limit Number of events to fetch (default 50, max 200)
 * @param after Pagination cursor (for next page)
 * @returns Array of audit events
 */
export async function getParticipantActivity(
  participantId: string,
  limit: number = 50,
  after?: string,
): Promise<{ events: AuditEvent[]; hasNextPage: boolean; nextCursor?: string }> {
  if (limit > 200) limit = 200; // Prevent abuse

  try {
    const response = await executeGraphQL<ActivityTimelineResponse, {
      participantId: string;
      limit: number;
      after?: string;
    }>(GET_PARTICIPANT_ACTIVITY_TIMELINE, {
      participantId,
      limit,
      after,
    });

    const edges = response.uiapi?.query?.AuditEvent__c?.edges ?? [];
    const events = edges
      .map((edge) => edge?.node)
      .filter((node): node is AuditEventNode => node != null)
      .map(mapAuditEventNode);

    const pageInfo = response.uiapi?.query?.AuditEvent__c?.pageInfo;
    const hasNextPage = pageInfo?.hasNextPage ?? false;
    const nextCursor = pageInfo?.endCursor;

    return {
      events,
      hasNextPage,
      nextCursor,
    };
  } catch (err) {
    console.error('Failed to fetch participant activity timeline:', err);
    throw err;
  }
}

/**
 * Fetch organization-wide audit events (requires permission)
 * 
 * TODO: Implement with proper authorization checks and filtering
 */
export async function getOrganizationAuditEvents(
  filters: AuditEventFilter = {},
  limit: number = 50,
  after?: string,
): Promise<{ events: AuditEvent[]; hasNextPage: boolean; nextCursor?: string }> {
  // Placeholder for organization-wide query
  // Would require a different GraphQL query with more filtering options
  return {
    events: [],
    hasNextPage: false,
  };
}

/**
 * Record a new audit event via GraphQL mutation
 * 
 * Called by auditService.record() after mutation validation
 */
export async function createAuditEventRecord(
  event: Omit<AuditEvent, 'id' | 'recordedAt'>,
): Promise<AuditEvent> {
  try {
    const response = await executeGraphQL<CreateAuditEventResponse, {
      occurredAt: string;
      eventType: string;
      schemaVersion: number;
      domain: string;
      action: string;
      actorType: string;
      actorId?: string;
      actorDisplayName?: string;
      subjectType: string;
      subjectId: string;
      participantId?: string;
      parentType?: string;
      parentId?: string;
      source: string;
      correlationId?: string;
      requestId?: string;
      reason?: string;
      changedFields: string;
      changes: string;
      metadata: string;
      visibility: string;
      sensitivity: string;
    }>(CREATE_AUDIT_EVENT, {
      occurredAt: event.occurredAt,
      eventType: event.eventType,
      schemaVersion: event.schemaVersion,
      domain: event.domain,
      action: event.action,
      actorType: event.actorType,
      actorId: event.actorId,
      actorDisplayName: event.actorDisplayNameSnapshot,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      participantId: event.participantId,
      parentType: event.parentType,
      parentId: event.parentId,
      source: event.source,
      correlationId: event.correlationId,
      requestId: event.requestId,
      reason: event.reason,
      changedFields: JSON.stringify(event.changedFields),
      changes: JSON.stringify(event.changes),
      metadata: JSON.stringify(event.metadata),
      visibility: event.visibility,
      sensitivity: event.sensitivity,
    });

    const createdNode = response.uiapi?.AuditEvent__cCreate?.Record;
    if (!createdNode) {
      throw new Error('No record returned from audit event creation');
    }

    return mapAuditEventNode(createdNode);
  } catch (err) {
    console.error('Failed to create audit event record:', err);
    throw err;
  }
}
