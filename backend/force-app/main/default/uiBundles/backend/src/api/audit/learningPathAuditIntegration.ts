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
 * Vorher-Zustand eines geloeschten Programmmoduls.
 *
 * Genug, um das Modul von Hand wieder anzulegen: das ist der Zweck des
 * Snapshots. `description` fehlt bewusst — der Allowlist fuer `learning_path`
 * nimmt keine Freitexte auf, und der Name traegt die Wiedererkennung.
 */
export interface LearningPathModuleSnapshot {
  id: string;
  programId: string;
  name: string;
  order: number;
}

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

/**
 * Ein geloeschtes Programmmodul protokollieren.
 *
 * Bewusst OHNE `participantId`. Ein `Module__c` ist eine Vorlage des Programms,
 * nicht der Lernpfad eines Teilnehmers: `Learning_Path__c` haengt an
 * `Program__c`, nicht am Modul, und das Loeschen des Moduls loescht keine
 * Lernpfad-Eintraege. Ein Ereignis an jeden Teilnehmer des Programms zu haengen
 * waere eine Falschaussage — es waere so, als haette man bei jedem einzelnen
 * etwas geloescht.
 *
 * Deshalb steht das Ereignis nur im Audit-Protokoll und in keiner
 * Teilnehmer-Timeline. Sichtbar wird es, wenn eine Sicht auf Programmaenderungen
 * existiert; bis dahin ist es via `AuditEvent__c` mit
 * `Metadata__c.programId` auswertbar.
 */
export async function recordLearningPathModuleDeleted(
  snapshot: LearningPathModuleSnapshot,
  options: AuditOptions,
): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.LEARNING_PATH_MODULE_DELETED,
    domain: 'learning_path',
    action: 'deleted',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: 'Module__c',
    subjectId: snapshot.id,
    source: 'web',
    reason: options.reason,
    changes: [],
    metadata: {
      title: snapshot.name,
      programId: snapshot.programId,
      previousPosition: snapshot.order,
      source: 'program_editor',
    },
    correlationId: options.correlationId,
  });
}

/**
 * Eine Wiederherstellung aus dem Protokoll festhalten.
 *
 * Das ist die Haelfte der Wiederherstell-Funktion: `addLearningPathItem` bzw.
 * `createModule` protokollieren ihrerseits nur das Anlegen, nicht aber dass der
 * Datensatz eine Loeschung rueckgaengig macht. Ohne dieses Ereignis staende ein
 * neu aufgetauchter Lernpfad-Eintrag in der Timeline, ohne erklaerbare Ursache.
 *
 * `correlationId` traegt die ID des Loeschungsereignisses — das ist der einzige
 * Weg, beide Seiten zuverlaessig zusammenzufinden.
 */
export async function recordLearningPathRestored(
  sourceEvent: { id: string; eventType: string },
  restored: { id: string; title: string; programId: string; participantId?: string },
  options: AuditOptions,
): Promise<AuditEvent> {
  return auditService.record({
    eventType:
      sourceEvent.eventType === 'learning_path.module_deleted'
        ? EVENT_TYPES.LEARNING_PATH_MODULE_RESTORED
        : EVENT_TYPES.LEARNING_PATH_ITEM_RESTORED,
    domain: 'learning_path',
    // `restored`, nicht `created`: die Timeline beschriftet Ereignisse als
    // "<SubjectType> <Aktion>". Mit `created` stand dort nach der
    // Wiederherstellung ein zweites "LearningPathItem erstellt" neben dem
    // urspruenglichen — zwei Zeilen, die gleich aussahen und doch verschiedene
    // Vorgaenge waren. `restored` steht in der restricted Picklist Action__c.
    action: 'restored',
    actorType: options.actor.type,
    actorId: options.actor.id,
    actorDisplayNameSnapshot: options.actor.displayName,
    subjectType: sourceEvent.eventType === 'learning_path.module_deleted' ? 'Module__c' : SUBJECT_TYPE,
    subjectId: restored.id,
    participantId: restored.participantId,
    source: 'web',
    reason: `Aus Audit-Ereignis ${sourceEvent.id} wiederhergestellt`,
    changes: [],
    metadata: {
      title: restored.title,
      programId: restored.programId,
      source: 'audit_restore',
    },
    correlationId: sourceEvent.id,
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
