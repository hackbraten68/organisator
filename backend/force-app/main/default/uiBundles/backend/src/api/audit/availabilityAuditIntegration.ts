/**
 * Verfügbarkeits-Audit-Integration
 *
 * Verfügbarkeits-Slots sind Ressourcen-Daten: `AvailabilitySlot__c.User__c`
 * verweist auf einen Coach/Staff, nicht auf einen Teilnehmer. Es gibt
 * deshalb bewusst **kein** `participantId` — ein Slot-Event gehört in keine
 * Teilnehmer-Historie (Projektion: `includeInActivity: false`). Es wird
 * zentral erfasst und ist über den Audit-Explorer einsehbar.
 *
 * Die Events sind damit derzeit der einzige Ort, an dem Slot-Änderungen
 * nachvollziehbar sind — der Explorer ist noch nicht gebaut. Der Metadata-
 * Allowlist nimmt entsprechend keine Teilnehmer-Bezüge auf.
 */

import { auditService } from "./auditService";
import { EVENT_TYPES } from "@/types/audit";
import type { ActorInfo } from "@/types/audit";
import type { AvailabilitySlot } from "@/types/availabilitySlot";
import { AVAILABILITY_AUDIT_FIELDS as F } from "./emittedFields";

interface SlotContext {
  id: string;
  userId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
}

export interface RecordAvailabilitySlotOptions {
  slot: SlotContext;
  actor: ActorInfo;
  correlationId?: string;
}

function baseRecord(slot: SlotContext, actor: ActorInfo, correlationId?: string) {
  return {
    domain: "availability" as const,
    actorType: actor.type,
    actorId: actor.id,
    actorDisplayNameSnapshot: actor.displayName,
    subjectType: "AvailabilitySlot__c",
    subjectId: slot.id,
    // Kein participantId: der Slot haengt an einem User, nicht an einem
    // Teilnehmer. Zugewiesen wird er ueber parentType/parentId, damit der
    // Explorer die Ereignisse trotzdem dem Coach zuordnen kann.
    parentType: "User",
    parentId: slot.userId,
    source: "web" as const,
    metadata: {
      userId: slot.userId,
      dayOfWeek: slot.dayOfWeek,
      slotType: slot.type,
      isActive: slot.isActive,
      validFrom: slot.validFrom,
      validTo: slot.validTo,
    },
    correlationId,
  };
}

export async function recordAvailabilitySlotAdded(
  options: RecordAvailabilitySlotOptions,
): Promise<string | void> {
  const { slot, actor, correlationId } = options;
  try {
    await auditService.record({
      eventType: EVENT_TYPES.AVAILABILITY_SLOT_ADDED,
      action: "created",
      ...baseRecord(slot, actor, correlationId),
      reason: "Verfügbarkeitsslot hinzugefügt",
      changes: [
        { field: F.user, newValue: slot.userId, redacted: false, displayType: "reference", reference: "User" },
        { field: F.dayOfWeek, newValue: slot.dayOfWeek, redacted: false, displayType: "status" },
        { field: F.startTime, newValue: slot.startTime, redacted: false, displayType: "time" },
        { field: F.endTime, newValue: slot.endTime, redacted: false, displayType: "time" },
        { field: F.type, newValue: slot.type, redacted: false, displayType: "status" },
        { field: F.isActive, newValue: slot.isActive, redacted: false, displayType: "boolean" },
      ],
    });
  } catch (err) {
    console.error("[audit] Failed to record availability slot added", err);
  }
}

export interface RecordAvailabilitySlotUpdatedOptions extends RecordAvailabilitySlotOptions {
  changes: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
    redacted: boolean;
  }>;
}

export async function recordAvailabilitySlotUpdated(
  options: RecordAvailabilitySlotUpdatedOptions,
): Promise<string | void> {
  const { slot, actor, correlationId, changes } = options;
  try {
    if (changes.length === 0) return;
    await auditService.record({
      eventType: EVENT_TYPES.AVAILABILITY_SLOT_UPDATED,
      action: "updated",
      ...baseRecord(slot, actor, correlationId),
      reason: "Verfügbarkeitsslot geändert",
      changes,
    });
  } catch (err) {
    console.error("[audit] Failed to record availability slot updated", err);
  }
}

export async function recordAvailabilitySlotDeleted(
  options: RecordAvailabilitySlotOptions,
): Promise<string | void> {
  const { slot, actor, correlationId } = options;
  try {
    await auditService.record({
      eventType: EVENT_TYPES.AVAILABILITY_SLOT_DELETED,
      action: "deleted",
      ...baseRecord(slot, actor, correlationId),
      reason: "Verfügbarkeitsslot gelöscht",
      changes: [
        { field: F.user, oldValue: slot.userId, newValue: null, redacted: false, displayType: "reference", reference: "User" },
        { field: F.dayOfWeek, oldValue: slot.dayOfWeek, newValue: null, redacted: false, displayType: "status" },
        { field: F.startTime, oldValue: slot.startTime, newValue: null, redacted: false, displayType: "time" },
        { field: F.endTime, oldValue: slot.endTime, newValue: null, redacted: false, displayType: "time" },
      ],
    });
  } catch (err) {
    console.error("[audit] Failed to record availability slot deleted", err);
  }
}

/** Aus einem geholten Slot die Audit-Konfiguration ableiten. */
export function toSlotContext(slot: AvailabilitySlot): SlotContext {
  return {
    id: slot.id,
    userId: slot.userId,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    type: slot.type,
    isActive: slot.isActive,
    validFrom: slot.validFrom,
    validTo: slot.validTo,
  };
}
