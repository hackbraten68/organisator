import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAvailabilitySlot,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,
} from "./appointmentService";
import { auditService } from "@/api/audit/auditService";
import { getAuditActor } from "@/api/audit/actorContext";
import { filterForAudience } from "@/api/audit/activityProjection";
import type { AuditEvent } from "@/types/audit";

vi.mock("@/api/graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));
vi.mock("@/api/audit/auditService", () => ({
  auditService: {
    record: vi.fn().mockResolvedValue({ id: "audit-1" }),
  },
  generateUUID: vi.fn().mockReturnValue("test-correlation-id"),
}));

vi.mock("@/api/audit/actorContext", () => ({
  getAuditActor: vi.fn(),
}));

import { executeGraphQL } from "@/api/graphqlClient";

const SLOT_NODE = {
  Id: "slot-1",
  User__c: { value: "0059b00000gUfkFAAS" },
  DayOfWeek__c: { value: "Monday" },
  StartTime__c: { value: "09:00:00.000Z" },
  EndTime__c: { value: "12:00:00.000Z" },
  Type__c: { value: "Coaching" },
  IsActive__c: { value: true },
};

function route(overrides: Record<string, unknown> = {}) {
  vi.mocked(executeGraphQL).mockImplementation(async (document: string) => {
    const name = Object.keys(overrides).find((op) => document.includes(op));
    if (name) return overrides[name];
    if (document.includes("GetAvailabilitySlot")) {
      return { uiapi: { query: { AvailabilitySlot__c: { edges: [{ node: SLOT_NODE }] } } } };
    }
    return {};
  });
}

describe("availability slot audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuditActor).mockReturnValue({
      id: "user-1",
      type: "staff",
      displayName: "Test User",
    });
  });

  describe("createAvailabilitySlot", () => {
    it("records availability.slot_added", async () => {
      route({ CreateAvailabilitySlot: { uiapi: { AvailabilitySlot__cCreate: { Record: { Id: "slot-1" } } } } });

      const id = await createAvailabilitySlot({
        userId: "0059b00000gUfkFAAS",
        dayOfWeek: "Monday",
        startTime: "09:00",
        endTime: "12:00",
        type: "Coaching",
      });

      expect(id).toBe("slot-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "availability.slot_added",
          domain: "availability",
          action: "created",
          subjectType: "AvailabilitySlot__c",
          subjectId: "slot-1",
        }),
      );
    });

    it("haengt den Slot ueber parentType/parentId an den User, nicht an einen Teilnehmer", async () => {
      route({ CreateAvailabilitySlot: { uiapi: { AvailabilitySlot__cCreate: { Record: { Id: "slot-1" } } } } });

      await createAvailabilitySlot({
        userId: "0059b00000gUfkFAAS",
        dayOfWeek: "Monday",
        startTime: "09:00",
        endTime: "12:00",
      });

      const input = vi.mocked(auditService.record).mock.calls[0][0];
      expect(input.parentType).toBe("User");
      expect(input.parentId).toBe("0059b00000gUfkFAAS");
      // Ein Slot hat keinen Teilnehmerbezug — das ist die Entscheidung,
      // weshalb das Event in keiner Teilnehmer-Timeline landen darf.
      expect(input.participantId).toBeUndefined();
    });

    it("records nichts, wenn die Mutation keine Id liefert", async () => {
      route({ CreateAvailabilitySlot: { uiapi: { AvailabilitySlot__cCreate: { Record: null } } } });

      const id = await createAvailabilitySlot({
        userId: "0059b00000gUfkFAAS",
        dayOfWeek: "Monday",
        startTime: "09:00",
        endTime: "12:00",
      });

      expect(id).toBe("");
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("updateAvailabilitySlot", () => {
    it("records availability.slot_updated mit Vorher/Nachher", async () => {
      route();

      await updateAvailabilitySlot("slot-1", { startTime: "13:00" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "availability.slot_updated",
          domain: "availability",
          action: "updated",
          subjectId: "slot-1",
        }),
      );
      const input = vi.mocked(auditService.record).mock.calls[0][0];
      expect(input.changes).toEqual([
        { field: "StartTime__c", oldValue: "09:00:00.000Z", newValue: "13:00", redacted: false },
      ]);
    });

    it("records kein Event, wenn der Wert unveraendert bleibt", async () => {
      route();

      // isActive ist im Slot bereits true — ein No-Op erzeugt kein Event.
      await updateAvailabilitySlot("slot-1", { isActive: true });

      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("records kein Event bei leerem Patch", async () => {
      route();

      await updateAvailabilitySlot("slot-1", {});

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("deleteAvailabilitySlot", () => {
    it("records availability.slot_deleted", async () => {
      route();

      await deleteAvailabilitySlot("slot-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "availability.slot_deleted",
          domain: "availability",
          action: "deleted",
          subjectId: "slot-1",
        }),
      );
    });

    it("records nichts, wenn der Slot vor dem Loeschen nicht lesbar war", async () => {
      route({ GetAvailabilitySlot: { uiapi: { query: { AvailabilitySlot__c: { edges: [] } } } } });

      await deleteAvailabilitySlot("slot-1");

      // Ohne Ist-Zustand waere das Event inhaltsleer bzw. irrefuehrend.
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("Projektion", () => {
    it("erscheint in keiner Audience-Timeline, auch nicht mit Technik-Filter", () => {
      const event = { eventType: "availability.slot_added" } as unknown as AuditEvent;

      for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
        for (const includeTechnicalEvents of [false, true]) {
          expect(filterForAudience([event], audience, { includeTechnicalEvents })).toHaveLength(0);
        }
      }
    });
  });
});
