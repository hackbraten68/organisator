/**
 * Verlauf der Verfuegbarkeits-Slots.
 *
 * Deckt die Luecke ab, die vor der Query existierte: geloeschte Slots waren
 * protokolliert, aber ueber keine Oberflaeche erreichbar.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { getAvailabilityAuditTrail, AVAILABILITY_TRAIL_DEFAULT_LIMIT } from "./availabilityAuditTrail";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);
const value = (v: unknown) => ({ value: v });

function eventNode(overrides: Record<string, unknown> = {}) {
  return {
    Id: "a-1",
    OccurredAt__c: value("2026-10-07T09:00:00.000Z"),
    CreatedDate: value("2026-10-07T09:00:01.000Z"),
    EventType__c: value("availability.slot_deleted"),
    SchemaVersion__c: value(1),
    Domain__c: value("availability"),
    Action__c: value("deleted"),
    ActorType__c: value("coach"),
    ActorId__c: value("005x"),
    ActorDisplayName__c: value("Sam Dillenburg"),
    SubjectType__c: value("AvailabilitySlot__c"),
    SubjectId__c: value("slot-9"),
    ParticipantId__c: value(null),
    Source__c: value("web"),
    CorrelationId__c: value("corr-1"),
    Reason__c: value("Verfügbarkeitsslot gelöscht"),
    ChangedFields__c: value('["User__c","DayOfWeek__c"]'),
    Changes__c: value(
      JSON.stringify([
        { field: "DayOfWeek__c", oldValue: "Monday", newValue: null, redacted: false },
        { field: "StartTime__c", oldValue: "09:00", newValue: null, redacted: false },
        { field: "EndTime__c", oldValue: "12:00", newValue: null, redacted: false },
      ]),
    ),
    Metadata__c: value('{"dayOfWeek":"Monday","isActive":true}'),
    Visibility__c: value("staff"),
    Sensitivity__c: value("normal"),
    ...overrides,
  };
}

function mockResponse(nodes: unknown[]) {
  mockedExecute.mockResolvedValue({
    uiapi: { query: { AuditEvent__c: { edges: nodes.map((node) => ({ node })) } } },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAvailabilityAuditTrail", () => {
  it("fragt nach der eigenen User-ID und der Domain availability", async () => {
    mockResponse([eventNode()]);

    await getAvailabilityAuditTrail("005x");

    const [query, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];
    expect(query).toContain("ParentId__c");
    expect(query).toContain("eq: $userId");
    expect(query).toContain('Domain__c: { eq: "availability" }');
    expect(variables).toMatchObject({ userId: "005x", limit: AVAILABILITY_TRAIL_DEFAULT_LIMIT });
  });

  it("liefert die Ereignisse auch ohne Audience-Projektion", async () => {
    // availability.* ist bewusst als "erscheint in keiner Audience-Ansicht"
    // klassifiziert. Ein filterForAudience-Aufruf wuerde die Liste hier leeren.
    mockResponse([eventNode()]);

    const events = await getAvailabilityAuditTrail("005x");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "availability.slot_deleted",
      action: "deleted",
      subjectId: "slot-9",
      actorDisplayNameSnapshot: "Sam Dillenburg",
    });
  });

  it("behaelt die alten Werte, damit der geloeschte Slot benennbar bleibt", async () => {
    mockResponse([eventNode()]);

    const [event] = await getAvailabilityAuditTrail("005x");

    const changes = event.changes as Array<{ field: string; oldValue: unknown }>;
    expect(changes.find((c) => c.field === "StartTime__c")?.oldValue).toBe("09:00");
  });

  it("fragt nicht ab, wenn keine User-ID vorliegt", async () => {
    expect(await getAvailabilityAuditTrail("")).toEqual([]);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("verkraftet eine leere Antwort", async () => {
    mockedExecute.mockResolvedValue({ uiapi: { query: { AuditEvent__c: { edges: [] } } } } as never);

    expect(await getAvailabilityAuditTrail("005x")).toEqual([]);
  });

  it("überspringt Kanten ohne Knoten", async () => {
    mockedExecute.mockResolvedValue({
      uiapi: { query: { AuditEvent__c: { edges: [{ node: null }, null] } } },
    } as never);

    expect(await getAvailabilityAuditTrail("005x")).toEqual([]);
  });

  it("übernimmt ein selbst gewähltes Limit", async () => {
    mockResponse([]);

    await getAvailabilityAuditTrail("005x", { limit: 5 });

    expect((mockedExecute.mock.calls[0] as [string, Record<string, unknown>])[1].limit).toBe(5);
  });
});
