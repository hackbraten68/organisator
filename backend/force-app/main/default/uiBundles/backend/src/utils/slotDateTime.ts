/**
 * Datum-Aufloesung fuer Verfuegbarkeits-Slots.
 *
 * Ein Slot beschreibt eine Wochenregel (dayOfWeek + Uhrzeiten) mit optionalem
 * Gueltigkeitszeitraum. Fuer einen Terminvorschlag brauchen wir ein konkretes
 * Datum. Fehlt es, wurde im Bundle vorher schlicht die nackte Uhrzeit
 * weitergereicht ("09:00") — die ging als unparsbarer Wert in die Mutation.
 * Lieber nichts anbieten als ein geratenes Datum.
 */
import type { AvailabilitySlot } from "@/types/availabilitySlot";

/** HH:mm oder HH:mm:ss */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

function normalizeTime(value: string | undefined): string | null {
  if (!value) return null;
  const match = TIME_PATTERN.exec(value.trim());
  return match ? match[0] : null;
}

/**
 * Das Datum, an dem der Slot vorgeschlagen wird, oder null, wenn der Slot
 * keines traegt. validFrom hat Vorrang vor validTo: validTo ist das Ende der
 * Gueltigkeit, nicht ihr Anfang.
 */
export function slotProposeDate(slot: Pick<AvailabilitySlot, "validFrom" | "validTo">): string | null {
  const date = (slot.validFrom || slot.validTo || "").trim();
  return date || null;
}

/**
 * Start- und Endzeit als lokales ISO-Datum, oder null, wenn der Slot nicht
 * auf einen konkreten Termin abbildbar ist (kein Datum, kaputte Uhrzeit).
 */
export function slotDateTimes(slot: AvailabilitySlot): { startTime: string; endTime: string } | null {
  const date = slotProposeDate(slot);
  const startTime = normalizeTime(slot.startTime);
  const endTime = normalizeTime(slot.endTime);
  if (!date || !startTime || !endTime) return null;
  return { startTime: `${date}T${startTime}`, endTime: `${date}T${endTime}` };
}
