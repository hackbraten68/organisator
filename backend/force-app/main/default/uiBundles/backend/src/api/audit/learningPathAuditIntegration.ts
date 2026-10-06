/**
 * Learning Path Audit Integration
 *
 * Wraps learning-path mutations to automatically record audit events.
 *
 * Audit semantics (fixed):
 * - One fachliche Aktion = exactly one event. A drag (or move click) that
 *   technically rewrites N positions produces a single
 *   `learning_path.item_reordered`, never N update events.
 * - `changes` holds actually changed values (before/after) and renders
 *   generically in the ChangeSetViewer.
 * - `metadata` holds describing context (allowlisted per domain): title
 *   snapshot, programId, positions. Titles are snapshots only, never identity
 *   — stable IDs (subjectId/participantId/programId) carry identity.
 * - Events are recorded only AFTER the confirmed mutation read-back.
 */

import type { LearningPathItem } from '@/types/program';
import type { AuditEvent } from '@/types/audit';
import { EVENT_TYPES } from '@/types/audit';
import { auditService } from './auditService';
import { compareFieldChanges, applyFieldRedaction } from './auditService';
import type { AuditOptions } from './participantAuditIntegration';
import { LEARNING_PATH_AUDIT_FIELDS as F } from './emittedFields';

const SUBJECT_TYPE = 'LearningPathItem__c';

/**
 * Base metadata snapshot for a learning-path item: readable context at event
 * time. Keys must stay within the learning_path metadata allowlist.
 */
function itemSnapshot(item: LearningPathItem): Record<string, unknown> {
  return {
    title: item.title,
    programId: item.programId,
    estimatedWeeks: item.estimatedWeeks ?? null,
    status: item.status,
    source: 'program_editor',
  };
}

/**
 * Record a learning-path item creation with audit event.
 */
export async function recordLearningPathItemCreated(
  item: LearningPathItem,
  options: AuditOptions,
): Promise<AuditEvent> {
  const changes = [
    { field: F.title, changed: true, oldValue: undefined, newValue: item.title },
    {
      field: F.estimatedWeeks,
      changed: true,
      oldValue: undefined,
      newValue: item.estimatedWeeks ?? null,
    },
    { field: F.status, changed: true, oldValue: undefined, newValue: item.status },
  ];

  const redactedChanges = applyFieldRedaction(changes, 'learning_path');

  return auditService.record({
    eventType: EVENT_TYPES.LEARNING_PATH_ITEM_CREATED,
    domain: 'learning_path',
    action: 'created',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: SUBJECT_TYPE,
    subjectId: item.id,
    participantId: item.participantId,
    source: 'web',
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? itemSnapshot(item),
    correlationId: options.correlationId,
  });
}

/**
 * Record a learning-path item update with audit event.
 *
 * Throws when the patch carries no fachliche Änderung so callers can skip
 * empty events (same convention as recordParticipantUpdate).
 */
export async function recordLearningPathItemUpdated(
  before: LearningPathItem,
  after: LearningPathItem,
  options: AuditOptions,
): Promise<AuditEvent> {
  const comparisons = compareFieldChanges(
    { [F.title]: before.title, [F.estimatedWeeks]: before.estimatedWeeks ?? null, [F.status]: before.status },
    { [F.title]: after.title, [F.estimatedWeeks]: after.estimatedWeeks ?? null, [F.status]: after.status },
  );

  const redactedChanges = applyFieldRedaction(comparisons, 'learning_path');

  if (redactedChanges.length === 0) {
    throw new Error('No fields changed; no audit event recorded');
  }

  return auditService.record({
    eventType: EVENT_TYPES.LEARNING_PATH_ITEM_UPDATED,
    domain: 'learning_path',
    action: 'updated',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: SUBJECT_TYPE,
    subjectId: after.id,
    participantId: after.participantId,
    source: 'web',
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? itemSnapshot(after),
    correlationId: options.correlationId,
  });
}

export interface LearningPathItemSnapshot {
  id: string;
  participantId: string;
  programId: string;
  title: string;
  order: number;
  estimatedWeeks?: number;
  status: string;
}

/**
 * Record a learning-path item deletion with audit event.
 *
 * Takes a snapshot loaded BEFORE the mutation: afterwards the referenced
 * object may no longer be loadable.
 */
export async function recordLearningPathItemDeleted(
  snapshot: LearningPathItemSnapshot,
  options: AuditOptions,
): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.LEARNING_PATH_ITEM_DELETED,
    domain: 'learning_path',
    action: 'deleted',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: SUBJECT_TYPE,
    subjectId: snapshot.id,
    participantId: snapshot.participantId,
    source: 'web',
    reason: options.reason,
    changes: [],
    metadata: options.metadata ?? {
      title: snapshot.title,
      programId: snapshot.programId,
      previousPosition: snapshot.order,
      estimatedWeeks: snapshot.estimatedWeeks ?? null,
      status: snapshot.status,
      source: 'program_editor',
    },
    correlationId: options.correlationId,
  });
}

export interface LearningPathReorder {
  itemId: string;
  participantId: string;
  programId: string;
  title: string;
  previousPosition: number;
  newPosition: number;
}

/**
 * Record a learning-path reorder as a single fachliche event.
 *
 * Callers pass the moved item with its positions; the N technical position
 * updates share the caller's correlationId but produce no further events.
 */
export async function recordLearningPathItemReordered(
  reorder: LearningPathReorder,
  options: AuditOptions,
): Promise<AuditEvent> {
  const changes = [
    {
      field: F.order,
      changed: true,
      oldValue: reorder.previousPosition,
      newValue: reorder.newPosition,
    },
  ];

  const redactedChanges = applyFieldRedaction(changes, 'learning_path');

  return auditService.record({
    eventType: EVENT_TYPES.LEARNING_PATH_ITEM_REORDERED,
    domain: 'learning_path',
    action: 'reordered',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: SUBJECT_TYPE,
    subjectId: reorder.itemId,
    participantId: reorder.participantId,
    source: 'web',
    reason: options.reason,
    changes: redactedChanges,
    metadata: options.metadata ?? {
      title: reorder.title,
      programId: reorder.programId,
      previousPosition: reorder.previousPosition,
      newPosition: reorder.newPosition,
      source: 'program_editor',
    },
    correlationId: options.correlationId,
  });
}
