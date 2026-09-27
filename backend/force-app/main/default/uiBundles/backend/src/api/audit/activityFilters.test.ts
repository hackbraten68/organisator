import { describe, expect, it } from "vitest";
import { filterActivityEvents } from "./activityFilters";
import type { AuditEvent } from "@/types/audit";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "a0AA000000000001AAA",
    recordedAt: "2026-09-25T10:00:01.000Z",
    occurredAt: "2026-09-25T10:00:00.000Z",
    schemaVersion: 1,
    eventType: "participant.status_changed",
    domain: "participant",
    action: "status_changed",
    actorType: "staff",
    actorDisplayNameSnapshot: "Test Coach",
    subjectType: "Participant__c",
    subjectId: "p-1",
    participantId: "p-1",
    source: "web",
    changedFields: ["Status__c"],
    changes: [],
    metadata: {},
    visibility: "staff",
    sensitivity: "normal",
    ...overrides,
  };
}

const statusChanged = makeEvent();
const appointment = makeEvent({
  id: "a0AA000000000002AAA",
  eventType: "appointment.created",
  domain: "appointment",
  action: "created",
  actorDisplayNameSnapshot: "Other Coach",
  occurredAt: "2026-09-20T09:00:00.000Z",
  reason: "Routine check-in",
  changedFields: [],
});
const events = [statusChanged, appointment];

describe("filterActivityEvents", () => {
  it("returns all events without a filter", () => {
    expect(filterActivityEvents(events, {})).toEqual(events);
  });

  it("matches actor name, reason and changed fields (case-insensitive)", () => {
    expect(
      filterActivityEvents(events, { query: "test coach" }).map((e) => e.id),
    ).toEqual([statusChanged.id]);
    expect(
      filterActivityEvents(events, { query: "ROUTINE" }).map((e) => e.id),
    ).toEqual([appointment.id]);
    expect(
      filterActivityEvents(events, { query: "status__c" }).map((e) => e.id),
    ).toEqual([statusChanged.id]);
  });

  it("filters by inclusive occurredAt date range", () => {
    const range = {
      from: new Date("2026-09-24T00:00:00"),
      to: new Date("2026-09-26T00:00:00"),
    };
    expect(filterActivityEvents(events, { range }).map((e) => e.id)).toEqual([
      statusChanged.id,
    ]);
  });

  it("treats a single from-date as that calendar day", () => {
    const range = { from: new Date("2026-09-20T15:00:00") };
    expect(filterActivityEvents(events, { range }).map((e) => e.id)).toEqual([
      appointment.id,
    ]);
  });

  it("combines text and date filters", () => {
    const range = {
      from: new Date("2026-09-01T00:00:00"),
      to: new Date("2026-09-30T00:00:00"),
    };
    expect(
      filterActivityEvents(events, { query: "coach", range }).map((e) => e.id),
    ).toEqual([statusChanged.id, appointment.id]);
    expect(
      filterActivityEvents(events, { query: "routine", range }).map(
        (e) => e.id,
      ),
    ).toEqual([appointment.id]);
  });
});
