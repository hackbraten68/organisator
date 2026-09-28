/**
 * Verfuegbarkeits-Events: Projektsions- und Metadaten-Regeln.
 *
 * Nutzt die echten Module (kein Mock von auditService), weil es hier genau
 * um validateMetadata und die Projektion geht.
 */
import { describe, it, expect } from "vitest";
import { validateMetadata, applyFieldRedaction } from "./auditService";
import { filterForAudience, projectEvent } from "./activityProjection";
import { METADATA_ALLOWLISTS, EVENT_TYPES, DEFAULT_DOMAIN_VISIBILITY, DEFAULT_DOMAIN_SENSITIVITY } from "@/types/audit";
import type { AuditEvent } from "@/types/audit";

const SLOT_EVENT_TYPES = [
  EVENT_TYPES.AVAILABILITY_SLOT_ADDED,
  EVENT_TYPES.AVAILABILITY_SLOT_UPDATED,
  EVENT_TYPES.AVAILABILITY_SLOT_DELETED,
];

describe("availability metadata allowlist", () => {
  it("lässt die von der Integration gesetzten Schlüssel durch", () => {
    const metadata = validateMetadata(
      {
        userId: "0059b00000gUfkFAAS",
        dayOfWeek: "Monday",
        slotType: "Coaching",
        isActive: true,
        validFrom: "2026-10-01",
        validTo: "2026-12-31",
      },
      "availability",
    );

    expect(metadata).toEqual({
      userId: "0059b00000gUfkFAAS",
      dayOfWeek: "Monday",
      slotType: "Coaching",
      isActive: true,
      validFrom: "2026-10-01",
      validTo: "2026-12-31",
    });
  });

  it("lässt keinen Teilnehmerbezug durch", () => {
    const metadata = validateMetadata(
      { participantId: "a059b00000gdNKkAAM", participantName: "Sam" },
      "availability",
    );

    expect(metadata).toEqual({});
    expect(METADATA_ALLOWLISTS.availability.has("participantId")).toBe(false);
    expect(METADATA_ALLOWLISTS.availability.has("participantName")).toBe(false);
  });

  it("verwirft eingeschleuste unbekannte Schlüssel", () => {
    const metadata = validateMetadata(
      { userId: "0059b00000gUfkFAAS", injected: "x" },
      "availability",
    );

    expect(metadata).toEqual({ userId: "0059b00000gUfkFAAS" });
  });
});

describe("availability field policy", () => {
  it("speichert den Slot-Owner nur als Referenz, nicht als Namen", () => {
    const [change] = applyFieldRedaction(
      [{ field: "User__c", oldValue: undefined, newValue: "0059b00000gUfkFAAS" }],
      "availability",
    );

    expect(change.newValue).toBe("0059b00000gUfkFAAS");
    expect(change.reference).toBe("User");
    expect(change.redacted).toBe(false);
  });

  it("hält Uhrzeiten und Gültigkeit nachvollziehbar fest", () => {
    const changes = applyFieldRedaction(
      [
        { field: "StartTime__c", newValue: "09:00" },
        { field: "EndTime__c", newValue: "12:00" },
        { field: "DayOfWeek__c", newValue: "Monday" },
        { field: "IsActive__c", newValue: true },
        { field: "ValidFrom__c", newValue: "2026-10-01" },
      ],
      "availability",
    );

    expect(changes.map((c) => c.field)).toEqual([
      "StartTime__c",
      "EndTime__c",
      "DayOfWeek__c",
      "IsActive__c",
      "ValidFrom__c",
    ]);
    expect(changes.every((c) => !c.redacted)).toBe(true);
  });
});

describe("availability projection", () => {
  it.each(SLOT_EVENT_TYPES)("%s ist klassifiziert, aber aus Timelines ausgeschlossen", (eventType) => {
    const rule = projectEvent({ eventType } as AuditEvent);

    expect(rule.category).toBe("administration");
    expect(rule.includeInActivity).toBe(false);
    expect(rule.technical).toBe(false);
  });

  it.each(SLOT_EVENT_TYPES)("%s erscheint in keiner Audience-Ansicht", (eventType) => {
    const event = { eventType } as AuditEvent;

    for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
      for (const includeTechnicalEvents of [false, true]) {
        expect(filterForAudience([event], audience, { includeTechnicalEvents })).toHaveLength(0);
      }
    }
  });
});

describe("availability domain defaults", () => {
  it("ist staff-sichtbar und von normaler Sensitivität", () => {
    expect(DEFAULT_DOMAIN_VISIBILITY.availability).toBe("staff");
    expect(DEFAULT_DOMAIN_SENSITIVITY.availability).toBe("normal");
  });
});
