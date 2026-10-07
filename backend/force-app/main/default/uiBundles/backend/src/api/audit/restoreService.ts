/**
 * Wiederherstellen aus dem Audit-Protokoll.
 *
 * Bisher existierte die Funktion nirgends: `recordParticipantArchived` und
 * `recordParticipantRestored` sind implementiert, werden aber von keiner Stelle
 * aufgerufen, und es gibt keine Oberflaeche. Ein Coach, der etwas geloescht hat,
 * konnte das Ereignis sehen, aber nicht rueckgaengig machen — er musste wissen,
 * welche Werte es hatte, und sie von Hand eintragen.
 *
 * Zwei Typen sind wiederherstellbar, weil ihr Snapshot vollstaendig ist:
 *
 * - `learning_path.item_deleted`  → Lernpfad-Eintrag eines Teilnehmers
 *   (title, programId, estimatedWeeks, status, participantId auf dem Ereignis)
 * - `learning_path.module_deleted` → Modul eines Programms (title, programId)
 *
 * Bewusst NICHT wiederherstellbar: Teilnehmer, Termine und Abwesenheiten. Die
 * lassen sich nicht loeschen, sondern nur auf einen Status setzen — dafuer fehlt
 * eine durchgaengige Protokollierung, und eine halb gebaute Wiederherstellung
 * waere schlimmer als keine.
 *
 * Ehrliche Grenze: `addLearningPathItem` vergibt die Position selbst (max + 1),
 * ein uebergemessener `order` wuerde also ignoriert. Der wiederhergestellte
 * Eintrag landet am Ende der Liste, nicht an seiner alten Stelle. Fuer den
 * Inhalt ist das egal, fuer die Reihenfolge nicht — deshalb steht es im
 * Ergebnistext.
 */

import { addLearningPathItem, createModule } from '@/api/program/programService';
import { recordLearningPathRestored } from './learningPathAuditIntegration';
import { getAuditActor } from './actorContext';
import { LEARNING_PATH_STATUSES } from '@/types/program';
import type { LearningPathItemStatus } from '@/types/program';
import type { AuditEvent } from '@/types/audit';

export type RestorableKind = 'learning_path_item' | 'program_module';

export interface RestorePreview {
  kind: RestorableKind;
  /** Was genau wiederhergestellt wird — fuer Bestaetigung und Ergebnistext. */
  headline: string;
  /** Was dabei anders bleibt als vor der Loeschung. */
  caveat?: string;
}

export interface RestoreResult {
  kind: RestorableKind;
  newId: string;
}

/**
 * Ist dieses Ereignis ueberhaupt rueckgaengig zu machen?
 *
 * Bewusst streng: fehlt ein Wert im Snapshot, der fuer das Neuanlegen noetig
 * ist, wird nicht geraten, sondern `null` zurueckgegeben. Ein halb
 * wiederhergestellter Datensatz waere schlimmer als keiner.
 */
export function describeRestore(event: AuditEvent): RestorePreview | null {
  const metadata = event.metadata ?? {};
  const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
  const programId = typeof metadata.programId === 'string' ? metadata.programId.trim() : '';

  if (event.action !== 'deleted') return null;

  if (event.eventType === 'learning_path.item_deleted') {
    if (!title || !programId || !event.participantId) return null;
    return {
      kind: 'learning_path_item',
      headline: `Lernpfad-Eintrag „${title}" wieder anlegen`,
      caveat: 'Die Position am Ende der Liste wird vergeben, nicht die alte.',
    };
  }

  if (event.eventType === 'learning_path.module_deleted') {
    if (!title || !programId) return null;
    return {
      kind: 'program_module',
      headline: `Modul „${title}" wieder anlegen`,
      caveat: 'Die Position am Ende des Programms wird vergeben, nicht die alte.',
    };
  }

  return null;
}

export function canRestore(event: AuditEvent): boolean {
  return describeRestore(event) !== null;
}

function readStatus(metadata: Record<string, unknown>): LearningPathItemStatus | null {
  const value = metadata.status;
  if (typeof value !== 'string') return null;
  // Der Wert kommt aus der Org und wird nicht etwa erfunden: ein unbekannter
  // Picklist-Wert darf nicht per Cast in den Typ wandern.
  return (LEARNING_PATH_STATUSES as string[]).includes(value)
    ? (value as LearningPathItemStatus)
    : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Loest das Ereignis aus: legt den Datensatz aus dem Snapshot neu an.
 *
 * Der Aufrufer muss `describeRestore(event)` geprueft haben — `restoreFromEvent`
 * wirft sonst, statt still nichts zu tun.
 */
export async function restoreFromEvent(event: AuditEvent): Promise<RestoreResult> {
  const preview = describeRestore(event);
  if (!preview) {
    throw new Error(
      `Ereignis ${event.id} (${event.eventType}) laesst sich nicht wiederherstellen`,
    );
  }

  const metadata = event.metadata ?? {};
  const title = String(metadata.title).trim();
  const programId = String(metadata.programId).trim();

  if (preview.kind === 'learning_path_item') {
    const status = readStatus(metadata);
    if (!status) {
      throw new Error(
        `Ereignis ${event.id}: Status "${String(metadata.status)}" ist heute nicht mehr anlegbar`,
      );
    }

    // `audit: false`: `recordLearningPathRestored` schreibt das einzige
    // Ereignis. Ohne das stuenden fuer einen Klick zwei Zeilen in der
    // Timeline, und die koennte nicht mehr sagen, welche davon die
    // Wiederherstellung ist — genau das Problem, das aus dem Sandbox-Test
    // entstanden ist.
    const item = await addLearningPathItem(
      event.participantId as string,
      programId,
      {
        title,
        estimatedWeeks: readNumber(metadata.estimatedWeeks),
        status,
      },
      { audit: false },
    );
    await recordRestoreEvent(event, {
      id: item.id,
      title,
      programId,
      participantId: event.participantId,
    });
    return { kind: preview.kind, newId: item.id };
  }

  const module = await createModule(programId, { name: title });
  await recordRestoreEvent(event, { id: module.id, title, programId });
  return { kind: preview.kind, newId: module.id };
}

/**
 * Das Protokoll der Wiederherstellung ist best-effort, genau wie die uebrigen
 * Audit-Aufrufe in den Services (ADR-14): ein Fehler hier darf einen
 * wiederhergestellten Datensatz nicht wieder wegnehmen. Wuerde man stattdessen
 * werfen, bliebe der Datensatz stehen und die Meldung behauptete das Gegenteil.
 */
async function recordRestoreEvent(
  event: AuditEvent,
  restored: { id: string; title: string; programId: string; participantId?: string },
): Promise<void> {
  try {
    await recordLearningPathRestored(event, restored, { actor: getAuditActor() });
  } catch (err) {
    console.error("[audit] Failed to record restore", event.id, err);
  }
}
