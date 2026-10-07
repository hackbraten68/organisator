/**
 * Verlaufs-Liste der Verfuegbarkeits-Slots.
 *
 * Der wichtigste Fall ist die geloeschte Zeile: bei einer Loeschung steht in
 * `changedFields` nur das Feldraster ohne Werte, und genau der Wert ("welcher
 * Slot ist weg?") steckt in `changes[].oldValue`. Ohne ihn saehe der Verlauf
 * aus wie eine Liste gleichwertiger Ereignisse.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AvailabilityHistory } from "./AvailabilityHistory";
import { getAvailabilityAuditTrail } from "@/api/audit/availabilityAuditTrail";
import type { AuditEvent } from "@/types/audit";

vi.mock("@/api/audit/availabilityAuditTrail", () => ({
  getAvailabilityAuditTrail: vi.fn(),
}));

const mockedTrail = vi.mocked(getAvailabilityAuditTrail);

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "a-1",
    recordedAt: "2026-10-07T09:00:01.000Z",
    occurredAt: "2026-10-07T09:00:00.000Z",
    schemaVersion: 1,
    eventType: "availability.slot_deleted",
    domain: "availability",
    action: "deleted",
    actorType: "coach",
    actorId: "005x",
    actorDisplayNameSnapshot: "Sam Dillenburg",
    subjectType: "AvailabilitySlot__c",
    subjectId: "slot-9",
    source: "web",
    changedFields: ["User__c", "DayOfWeek__c", "StartTime__c", "EndTime__c"],
    changes: [
      { field: "DayOfWeek__c", oldValue: "Monday", newValue: null, redacted: false },
      { field: "StartTime__c", oldValue: "09:00", newValue: null, redacted: false },
      { field: "EndTime__c", oldValue: "12:00", newValue: null, redacted: false },
    ],
    metadata: { dayOfWeek: "Monday", isActive: true },
    visibility: "staff",
    sensitivity: "normal",
    ...overrides,
  } as AuditEvent;
}

beforeEach(() => {
  // reset, nicht clear: clear laesst ein mockResolvedValue aus dem vorigen Test
  // weiterlaufen, dann zeigt der leere Zustand plötzlich Zeilen.
  vi.resetAllMocks();
});

describe("AvailabilityHistory", () => {
  it("fragt den Verlauf fuer die uebergebene User-ID ab", async () => {
    mockedTrail.mockResolvedValue([]);

    render(<AvailabilityHistory currentUserId="005x" />);

    await waitFor(() => expect(mockedTrail).toHaveBeenCalledWith("005x"));
  });

  it("nennt bei einer Loeschung den konkreten Slot", async () => {
    mockedTrail.mockResolvedValue([makeEvent()]);

    render(<AvailabilityHistory currentUserId="005x" />);

    expect(await screen.findByText("gelöscht")).toBeInTheDocument();
    expect(screen.getByText("Monday · 09:00–12:00")).toBeInTheDocument();
    expect(screen.getByText(/Sam Dillenburg/)).toBeInTheDocument();
  });

  it("verwendet bei einem Anlegen den neuen Wert, nicht den leeren", async () => {
    mockedTrail.mockResolvedValue([
      makeEvent({
        action: "created",
        changedFields: ["User__c", "DayOfWeek__c", "StartTime__c", "EndTime__c"],
        changes: [
          { field: "DayOfWeek__c", oldValue: null, newValue: "Tuesday", redacted: false },
          { field: "StartTime__c", oldValue: null, newValue: "14:00", redacted: false },
          { field: "EndTime__c", oldValue: null, newValue: "18:00", redacted: false },
        ],
      }),
    ]);

    render(<AvailabilityHistory currentUserId="005x" />);

    expect(await screen.findByText("angelegt")).toBeInTheDocument();
    expect(screen.getByText("Tuesday · 14:00–18:00")).toBeInTheDocument();
  });

  it("laedt nach einem Fehler neu und zeigt danach die Eintraege", async () => {
    mockedTrail.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([makeEvent()]);

    render(<AvailabilityHistory currentUserId="005x" />);

    // Fehlerfall: leere Liste, aber mit erklaerendem Text statt Stillschweigen.
    expect(
      await screen.findByText(/Der Verlauf konnte nicht geladen werden/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Aktualisieren/ }));

    expect(await screen.findByText("gelöscht")).toBeInTheDocument();
  });

  it("erklaert den leeren Zustand, solange nichts protokolliert wurde", async () => {
    mockedTrail.mockResolvedValue([]);

    render(<AvailabilityHistory currentUserId="005x" />);

    expect(
      await screen.findByText(
        "Sobald Sie Slots anlegen, bearbeiten oder löschen, erscheinen sie hier.",
      ),
    ).toBeInTheDocument();
  });
});
