import { describe, expect, it } from "vitest";
import type { AvailabilitySlot } from "@/types/availabilitySlot";
import { slotDateTimes, slotProposeDate } from "./slotDateTime";

/**
 * Ein Slot ist eine Wochenregel (dayOfWeek + startTime/endTime) mit einem
 * optionalen Gueltigkeitszeitraum. Fuer einen Terminvorschlag brauchen wir
 * aber ein konkretes Datum — sonst landet "09:00" (nur Uhrzeit) in der
 * Mutation und Salesforce verweigert den Wert.
 */

function slot(overrides: Partial<AvailabilitySlot> = {}): AvailabilitySlot {
  return {
    id: "a0b0000000001",
    startTime: "09:00:00",
    endTime: "10:00:00",
    dayOfWeek: "Monday",
    type: "Coaching",
    isActive: true,
    ...overrides,
  } as AvailabilitySlot;
}

describe("slotProposeDate", () => {
  it("nutzt validFrom, wenn gesetzt", () => {
    expect(slotProposeDate(slot({ validFrom: "2026-01-15" }))).toBe("2026-01-15");
  });

  it("faellt auf validTo zurueck, wenn validFrom fehlt", () => {
    expect(slotProposeDate(slot({ validTo: "2026-03-31" }))).toBe("2026-03-31");
  });

  it("liefert null, wenn der Slot kein Datum traegt", () => {
    // Ein wiedkehrender Slot ohne Zeitraum hat fuer die Kalenderwoche des
    // Slots kein eindeutiges Datum. Raten waere schlimmer als Nichtanbieten.
    expect(slotProposeDate(slot())).toBeNull();
  });

  it("ignoriert einen leeren String statt ihn zu uebernehmen", () => {
    expect(slotProposeDate(slot({ validFrom: "" }))).toBeNull();
  });
});

describe("slotDateTimes", () => {
  it("baut aus Datum und Uhrzeit ein lokales ISO-Datum", () => {
    expect(slotDateTimes(slot({ validFrom: "2026-01-15" }))).toEqual({
      startTime: "2026-01-15T09:00:00",
      endTime: "2026-01-15T10:00:00",
    });
  });

  it("nutzt validTo, wenn validFrom fehlt", () => {
    expect(slotDateTimes(slot({ validTo: "2026-03-31" }))).toEqual({
      startTime: "2026-03-31T09:00:00",
      endTime: "2026-03-31T10:00:00",
    });
  });

  it("liefert ohne Datum null statt einer nackten Uhrzeit", () => {
    // Das ist der Fehler aus dem Audit: "09:00" ging so in rescheduleAppointment.
    expect(slotDateTimes(slot())).toBeNull();
  });

  it("verlangt, dass startTime und endTime echte Uhrzeiten sind", () => {
    expect(slotDateTimes(slot({ validFrom: "2026-01-15", startTime: "9" }))).toBeNull();
    expect(slotDateTimes(slot({ validFrom: "2026-01-15", startTime: "0900" }))).toBeNull();
    expect(slotDateTimes(slot({ validFrom: "2026-01-15", endTime: "" }))).toBeNull();
  });

  it("verkraftet HH:mm ohne Sekunden", () => {
    expect(slotDateTimes(slot({ validFrom: "2026-01-15", startTime: "09:00", endTime: "10:30" }))).toEqual({
      startTime: "2026-01-15T09:00",
      endTime: "2026-01-15T10:30",
    });
  });
});
