/**
 * Audit Service
 * 
 * Central service for recording audit events. Handles:
 * - Field change comparison and redaction
 * - Event validation and enrichment
 * - Persistence via GraphQL mutation
 * - Error handling and fallback strategies
 * 
 * Use: `await auditService.record({ ... })`
 */

import type {
  AuditEvent,
  CreateAuditEventInput,
  FieldChange,
  AuditFieldPolicyConfig,
  AuditFieldStrategy,
  AuditSensitivity,
  AuditVisibility,
} from '@/types/audit';
import {
  AUDIT_FIELD_STRATEGIES,
  DEFAULT_FIELD_POLICIES,
  DEFAULT_DOMAIN_VISIBILITY,
  DEFAULT_DOMAIN_SENSITIVITY,
  METADATA_ALLOWLISTS,
  AuditFieldStrategy,
  AuditDomain,
} from '@/types/audit';
import { createAuditEventRecord, getParticipantActivity } from './auditApiService';

/**
 * Redaction indicator for sensitive values
 */
const REDACTED_MARKER = '[redacted]';

/**
 * Maximum size of metadata JSON to prevent injection attacks
 */
const MAX_METADATA_SIZE = 10000;

/**
 * Comparison result for field changes
 */
interface FieldComparison {
  field: string;
  changed: boolean;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Compare two objects and return changed fields
 * 
 * @param before Original state (may be undefined if creating new record)
 * @param after Updated state
 * @param fields List of fields to compare (if undefined, compare all)
 * @returns Array of changed fields with old/new values
 */
export function compareFieldChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
  fields?: string[],
): FieldComparison[] {
  const before_ = before ?? {};
  const fieldsToCompare = fields ?? Object.keys(after);

  return fieldsToCompare
    .map((field) => ({
      field,
      changed: before_[field] !== after[field],
      oldValue: before_[field],
      newValue: after[field],
    }))
    .filter((c) => c.changed);
}

/**
 * Apply field redaction policy to a list of field changes
 * 
 * @param changes Raw field changes
 * @param domain Domain name (determines policy)
 * @param userPermissions Optional permission flags (e.g., canSeeRedacted)
 * @returns Field changes with values redacted per policy
 */
export function applyFieldRedaction(
  changes: FieldComparison[],
  domain: AuditDomain,
  userPermissions?: { canSeeRedacted?: boolean },
): FieldChange[] {
  const policies = DEFAULT_FIELD_POLICIES[domain] ?? {};

  return changes.map(({ field, oldValue, newValue }) => {
    const policy = policies[field];
    const strategy: AuditFieldStrategy = policy?.strategy ?? 'FULL';
    const displayType = policy?.displayType;
    const reference = policy?.reference;

    let finalOldValue: unknown = oldValue;
    let finalNewValue: unknown = newValue;
    let redacted = false;

    switch (strategy) {
      case 'FULL':
        // Store old and new values as-is
        break;

      case 'REDACTED':
        // Remove values unless user has special permission
        if (!userPermissions?.canSeeRedacted || !policy.allowRedactionByPermission) {
          finalOldValue = undefined;
          finalNewValue = undefined;
          redacted = true;
        }
        break;

      case 'REFERENCE':
        // Store only the ID (value should already be an ID)
        // If value is an object, extract ID field
        finalOldValue = extractIdFromReference(oldValue);
        finalNewValue = extractIdFromReference(newValue);
        redacted = false;
        break;

      case 'NONE':
        // Do not include this change in audit event
        return null as unknown as FieldChange;
    }

    return {
      field,
      oldValue: finalOldValue,
      newValue: finalNewValue,
      displayType,
      redacted,
      reference,
    };
  }).filter((c): c is FieldChange => c !== null);
}

/**
 * Extract ID from a reference value (could be string ID or object with Id)
 */
function extractIdFromReference(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'Id' in value) {
    return (value as { Id: unknown }).Id;
  }
  return undefined;
}

/**
 * Validate and sanitize metadata to prevent injection
 * 
 * @param raw User-provided metadata
 * @param domain Domain name (determines allowlist)
 * @returns Sanitized metadata or empty object if invalid
 */
export function validateMetadata(
  raw: Record<string, unknown> | undefined,
  domain: AuditDomain,
): Record<string, unknown> {
  if (!raw || Object.keys(raw).length === 0) return {};

  const allowlist = METADATA_ALLOWLISTS[domain];
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (allowlist.has(key)) {
      // Only allow primitive values or simple arrays
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        Array.isArray(value)
      ) {
        filtered[key] = value;
      }
    }
  }

  // Size limit
  const json = JSON.stringify(filtered);
  if (json.length > MAX_METADATA_SIZE) {
    console.warn(
      `Metadata for domain ${domain} exceeds max size ${MAX_METADATA_SIZE}; truncating`,
    );
    return {};
  }

  return filtered;
}

/**
 * Generate a UUID v4 for correlation/request IDs
 */
export function generateUUID(): string {
  return crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Main audit service: record an audit event
 * 
 * Responsibilities:
 * 1. Validate input
 * 2. Capture actor from server context (when available)
 * 3. Build FieldChange array with redaction
 * 4. Persist to AuditEvent__c via GraphQL
 * 5. Return created event or raise error
 * 
 * Usage:
 *   await auditService.record({
 *     eventType: 'participant.status_changed',
 *     domain: 'participant',
 *     action: 'status_changed',
 *     actorType: 'staff',
 *     subjectType: 'Participant__c',
 *     subjectId: participantId,
 *     participantId: participantId,
 *     source: 'web',
 *     changes: [{ field: 'Status__c', oldValue: 'Onboarding', newValue: 'Active' }],
 *     metadata: { previousStatus: 'Onboarding', newStatus: 'Active' },
 *   })
 */
export const auditService = {
  /**
   * Record an audit event atomically
   * 
   * This should typically be called AFTER a successful mutation in the same
   * transaction. If the mutation fails, this should NOT be called.
   * 
   * If audit event writing fails, the mutation is already persisted. Future
   * implementations may use an outbox pattern to handle this gracefully.
   */
  async record(input: CreateAuditEventInput): Promise<AuditEvent> {
    // 1. Validation
    if (!input.eventType || !input.domain || !input.action) {
      throw new Error(
        `Invalid audit event input: missing eventType, domain, or action`,
      );
    }

    if (!input.subjectType || !input.subjectId) {
      throw new Error(
        `Invalid audit event input: missing subjectType or subjectId`,
      );
    }

    // 2. Defaults and enrichment
    const now = new Date().toISOString();
    const occurredAt = input.occurredAt ?? now;

    const correlationId = input.correlationId ?? generateUUID();
    const requestId = input.requestId ?? generateUUID();

    // 3. Actor context (would come from Salesforce SDK in real implementation)
    // TODO: Extract from authenticated context when available
    const actorId = input.actorId ?? 'SYSTEM'; // Fallback to system if not provided
    const actorDisplayNameSnapshot = input.actorDisplayNameSnapshot ?? 'System';

    // 4. Visibility and sensitivity defaults
    const visibility = input.visibility ?? DEFAULT_DOMAIN_VISIBILITY[input.domain];
    const sensitivity = input.sensitivity ?? DEFAULT_DOMAIN_SENSITIVITY[input.domain];

    // 5. Process field changes and apply redaction
    const fieldChanges = input.changes ?? [];
    const redactedChanges = applyFieldRedaction(fieldChanges, input.domain, {
      canSeeRedacted: false, // TODO: Check user permissions
    });

    // 6. Validate and sanitize metadata
    const sanitizedMetadata = validateMetadata(input.metadata, input.domain);

    // 7. Build the audit event
    const event: AuditEvent = {
      id: '', // Will be set by Salesforce on creation
      recordedAt: now,
      occurredAt,
      schemaVersion: 1,
      eventType: input.eventType,
      domain: input.domain,
      action: input.action,
      actorType: input.actorType,
      actorId,
      actorDisplayNameSnapshot,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      participantId: input.participantId,
      parentType: input.parentType,
      parentId: input.parentId,
      source: input.source,
      correlationId,
      requestId,
      reason: input.reason,
      changedFields: redactedChanges.map((c) => c.field),
      changes: redactedChanges,
      metadata: sanitizedMetadata,
      visibility,
      sensitivity,
    };

    // 8. Persist via GraphQL mutation
    try {
      const result = await createAuditEventRecord(event);
      return result;
    } catch (err) {
      console.error('Failed to record audit event:', err);
      // TODO: In production, implement fallback (e.g., async queue, retry, alert)
      throw new Error(`Audit event recording failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  },

  /**
   * Fetch audit events for a participant (timeline view)
   */
  async getParticipantTimeline(
    participantId: string,
    limit: number = 50,
  ): Promise<AuditEvent[]> {
    const { events } = await getParticipantActivity(participantId, limit);
    return events;
  },

  /**
   * Fetch organization-wide audit events (requires permission)
   */
  async getOrganizationEvents(
    filters: Record<string, unknown> = {},
    limit: number = 50,
  ): Promise<AuditEvent[]> {
    // TODO: Implement GraphQL query with authorization
    return [];
  },
};

/**
 * Helper: Create a field change record from old and new values
 */
export function createFieldChange(
  field: string,
  oldValue: unknown,
  newValue: unknown,
  displayType?: string,
): FieldComparison {
  return {
    field,
    changed: oldValue !== newValue,
    oldValue,
    newValue,
  };
}

/**
 * Helper: Create field changes for a participant status change
 */
export function createParticipantStatusChangeFields(
  oldStatus: string,
  newStatus: string,
): FieldChange[] {
  return [
    {
      field: 'Status__c',
      oldValue: oldStatus,
      newValue: newStatus,
      displayType: 'status',
      redacted: false,
    },
  ];
}

/**
 * Helper: Create field changes from a participant patch
 * 
 * Compares before and after states and returns changed fields.
 */
export function createParticipantPatchFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const comparisons = compareFieldChanges(before, after);
  return applyFieldRedaction(comparisons, 'participant');
}
