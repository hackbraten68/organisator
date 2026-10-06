/**
 * Abwesenheits-Events: Feld-Redaktion.
 *
 * Nutzt das echte Modul (kein Mock von auditService), weil es hier genau um
 * applyFieldRedaction und die Policy-Schlüssel geht. Die Policies muessen die
 * emittierten Feldnamen treffen — ein Schreibfehler im Suffix erzeugt keine
 * Fehlermeldung, sondern Klartext im Audit-Log.
 */
import { describe, it, expect } from "vitest";
import { applyFieldRedaction } from "./auditService";

describe("absence field policy", () => {
  it("schwaerzt den Abwesenheitsgrund", () => {
    const [change] = applyFieldRedaction(
      [{ field: "Reason__c", oldValue: null, newValue: "Krebs, laufende Chemo" }],
      "absence",
    );

    expect(change.newValue).toBeUndefined();
    expect(change.oldValue).toBeUndefined();
    expect(change.redacted).toBe(true);
  });

  it("schwaerzt den Ablehnungskommentar des Coaches", () => {
    const [change] = applyFieldRedaction(
      [{ field: "CoachComment__c", oldValue: null, newValue: "VERTRAULICH" }],
      "absence",
    );

    expect(change.newValue).toBeUndefined();
    expect(change.oldValue).toBeUndefined();
    expect(change.redacted).toBe(true);
  });

  it("haelt Typ und Zeitraum nachvollziehbar fest", () => {
    const changes = applyFieldRedaction(
      [
        { field: "Status__c", newValue: "Submitted" },
        { field: "Type__c", newValue: "Krank" },
        { field: "StartDate__c", newValue: "2026-10-01" },
        { field: "EndDate__c", newValue: "2026-10-07" },
      ],
      "absence",
    );

    expect(changes.every((c) => c.newValue !== undefined)).toBe(true);
    expect(changes.every((c) => !c.redacted)).toBe(true);
  });

  it("speichert den genehmigenden Coach als Referenz, nicht als Namen", () => {
    const [change] = applyFieldRedaction(
      [{ field: "ApprovedBy__c", oldValue: null, newValue: "0059b00000gUfkFAAS" }],
      "absence",
    );

    expect(change.newValue).toBe("0059b00000gUfkFAAS");
    expect(change.reference).toBe("User");
    expect(change.redacted).toBe(false);
  });
});

describe("handgesetztes Redaktions-Flag", () => {
  it("schwaerzt den Wert auch dann, wenn die Policy FULL sagt", () => {
    const [change] = applyFieldRedaction(
      [
        {
          field: "CoachComment__c",
          oldValue: null,
          newValue: "VERTRAULICH",
          redacted: true,
        },
      ],
      "absence",
    );

    expect(change.newValue).toBeUndefined();
    expect(change.oldValue).toBeUndefined();
    expect(change.redacted).toBe(true);
  });

  it("schwaerzt auch Altwerte, die die Integration mitschickt", () => {
    const [change] = applyFieldRedaction(
      [
        {
          field: "CoachComment__c",
          oldValue: "Patientin in psychischer Krise",
          newValue: "Zu kurzfristig",
          redacted: true,
        },
      ],
      "absence",
    );

    expect(change.oldValue).toBeUndefined();
    expect(change.newValue).toBeUndefined();
    expect(change.redacted).toBe(true);
  });
});

describe("appointment field policy", () => {
  it("schwaerzt den Absagegrund", () => {
    const [change] = applyFieldRedaction(
      [{ field: "CancellationReason__c", oldValue: null, newValue: "Krank" }],
      "appointment",
    );

    expect(change.newValue).toBeUndefined();
    expect(change.redacted).toBe(true);
  });

  it("speichert den zugewiesenen Coach als Referenz", () => {
    const [change] = applyFieldRedaction(
      [{ field: "Coach__c", oldValue: null, newValue: "0059b00000gUfkFAAS" }],
      "appointment",
    );

    expect(change.newValue).toBe("0059b00000gUfkFAAS");
    expect(change.reference).toBe("User");
  });

  it("haelt Terminzeit und Status nachvollziehbar fest", () => {
    const changes = applyFieldRedaction(
      [
        { field: "StartTime__c", newValue: "09:00" },
        { field: "EndTime__c", newValue: "10:00" },
        { field: "Status__c", newValue: "Confirmed" },
        { field: "Type__c", newValue: "Coaching" },
      ],
      "appointment",
    );

    expect(changes.every((c) => c.newValue !== undefined)).toBe(true);
    expect(changes.every((c) => !c.redacted)).toBe(true);
  });
});