/**
 * Participant Audit Integration
 * 
 * Wraps participant mutations to automatically record audit events.
 * 
 * Usage:
 *   const result = await auditedParticipantService.updateParticipant(id, patch, { 
 *     actor: { id, type, name } 
 *   });
 * 
 * This handles:
 * - Before/after comparison
 * - Field redaction per policy
 * - Audit event creation
 * - Error handling
 */

import type { Participant } from '@/types/participant';
import type { AuditActorType, AuditEvent } from '@/types/audit';
import { EVENT_TYPES } from '@/types/audit';
import { auditService } from './auditService';
import {
  compareFieldChanges,
  applyFieldRedaction,
} from './auditService';

/**
 * Actor context for audit logging. `id` is optional: self-attested session
 * actors (ActorPicker) carry a first name but no verified Salesforce User id.
 * Downstream `actorId` is optional too (service defaults to 'SYSTEM').
 */
export interface AuditActor {
  id?: string;
  type: AuditActorType;
  displayName: string;
}

/**
 * Optional auditing configuration per mutation
 */
export interface AuditOptions {
  actor: AuditActor;
  reason?: string;              // Required for some mutations (e.g., status corrections)
  correlationId?: string;       // Group related mutations
  metadata?: Record<string, unknown>; // Domain-specific context
}

/**
 * Record a participant status change with audit event
 * 
 * @param participantId Participant record ID
 * @param oldStatus Previous status value
 * @param newStatus New status value
 * @param options Audit options including actor
 * @returns The audit event that was created
 */
export async function recordParticipantStatusChange(
  participantId: string,
  oldStatus: string,
  newStatus: string,
  options: AuditOptions,
): Promise<AuditEvent> {
  const changes = [
    {
      field: 'Status__c',
      changed: oldStatus !== newStatus,
      oldValue: oldStatus,
      newValue: newStatus,
    },
  ];

  const redactedChanges = applyFieldRedaction(changes, 'participant');

  return auditService.record({
    eventType: EVENT_TYPES.PARTICIPANT_STATUS_CHANGED,
    domain: 'participant',
    action: 'status_changed',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Participant__c',
    subjectId: participantId,
    participantId,
    source: 'web', // Can be made configurable
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? {
      previousStatus: oldStatus,
      newStatus,
    },
    correlationId: options.correlationId,
  });
}

/**
 * Record a participant profile update with audit event
 * 
 * @param participantId Participant record ID
 * @param before Previous participant state
 * @param after Updated participant state
 * @param options Audit options including actor
 * @returns The audit event that was created
 */
export async function recordParticipantUpdate(
  participantId: string,
  before: Participant,
  after: Participant,
  options: AuditOptions,
): Promise<AuditEvent> {
  // Compare all participant fields except id
  const beforeObj: Record<string, unknown> = { ...before };
  const afterObj: Record<string, unknown> = { ...after };
  
  delete beforeObj.id;
  delete afterObj.id;
  
  // Map from Participant entity to Salesforce field names
  const fieldMapping: Record<string, string> = {
    name: 'Name',
    status: 'Status__c',
    email: 'Email__c',
    github: 'GitHub__c',
    discord: 'Discord__c',
    startDate: 'StartDate__c',
    expectedEndDate: 'ExpectedEndDate__c',
    programId: 'Program__c',
    coachId: 'Coach_Profile__c',
  };

  const comparisons = compareFieldChanges(beforeObj, afterObj);
  const mappedComparisons = comparisons.map(c => ({
    ...c,
    field: fieldMapping[c.field] || c.field,
  }));

  const redactedChanges = applyFieldRedaction(mappedComparisons, 'participant');

  // Only record if something actually changed
  if (redactedChanges.length === 0) {
    throw new Error('No fields changed; no audit event recorded');
  }

  return auditService.record({
    eventType: EVENT_TYPES.PARTICIPANT_UPDATED,
    domain: 'participant',
    action: 'updated',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Participant__c',
    subjectId: participantId,
    participantId,
    source: 'web',
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? {
      changedFieldCount: redactedChanges.length,
    },
    correlationId: options.correlationId,
  });
}

/**
 * Record a participant creation with audit event
 */
export async function recordParticipantCreation(
  participantId: string,
  participant: Participant,
  options: AuditOptions,
): Promise<AuditEvent> {
  const changes = [
    {
      field: 'Name',
      changed: true,
      oldValue: undefined,
      newValue: participant.name,
    },
    {
      field: 'Status__c',
      changed: true,
      oldValue: undefined,
      newValue: participant.status,
    },
  ];

  if (participant.email) {
    changes.push({
      field: 'Email__c',
      changed: true,
      oldValue: undefined,
      newValue: participant.email,
    });
  }

  if (participant.programId) {
    changes.push({
      field: 'Program__c',
      changed: true,
      oldValue: undefined,
      newValue: participant.programId,
    });
  }

  if (participant.coachId) {
    changes.push({
      field: 'Coach_Profile__c',
      changed: true,
      oldValue: undefined,
      newValue: participant.coachId,
    });
  }

  const redactedChanges = applyFieldRedaction(changes, 'participant');

  return auditService.record({
    eventType: EVENT_TYPES.PARTICIPANT_CREATED,
    domain: 'participant',
    action: 'created',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Participant__c',
    subjectId: participantId,
    participantId,
    source: 'web',
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? {
      initiatedFrom: 'ui',
    },
    correlationId: options.correlationId,
  });
}

/**
 * Record a participant deletion/archiving with audit event
 */
export async function recordParticipantArchived(
  participantId: string,
  _participant: Participant,
  options: AuditOptions,
): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.PARTICIPANT_ARCHIVED,
    domain: 'participant',
    action: 'archived',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Participant__c',
    subjectId: participantId,
    participantId,
    source: 'web',
    reason: options.reason ?? 'Participant archived',
    changes: [],
    metadata: options.metadata,
    correlationId: options.correlationId,
  });
}

/**
 * Record a participant restoration with audit event
 */
export async function recordParticipantRestored(
  participantId: string,
  _participant: Participant,
  options: AuditOptions,
): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.PARTICIPANT_RESTORED,
    domain: 'participant',
    action: 'restored',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Participant__c',
    subjectId: participantId,
    participantId,
    source: 'web',
    reason: options.reason ?? 'Participant restored',
    changes: [],
    metadata: options.metadata,
    correlationId: options.correlationId,
  });
}
