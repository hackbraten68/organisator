import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAppointment,
  updateAppointment,
  confirmAppointment,
  completeAppointment,
  rescheduleAppointment,
  cancelAppointment,
  updateAppointmentAttendance,
} from "./appointmentService";
import { auditService } from "@/api/audit/auditService";
import { getAuditActor } from "@/api/audit/actorContext";

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

/** Routed GraphQL mock: keyed by operation name, not call order. */
const APPOINTMENT_NODE = { Id: "apt-1", Participant__c: { value: "p-1" } };

function route(overrides: Record<string, unknown> = {}) {
  vi.mocked(executeGraphQL).mockImplementation(async (document: string) => {
    const name = Object.keys(overrides).find((op) => document.includes(op));
    if (name) return overrides[name];
    if (document.includes("GetAppointment")) {
      return { uiapi: { query: { Appointment__c: { edges: [{ node: APPOINTMENT_NODE }] } } } };
    }
    return {};
  });
}

describe("appointmentService audit integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuditActor).mockReturnValue({
      id: "user-1",
      type: "staff",
      displayName: "Test User",
    });
  });

  describe("createAppointment", () => {
    it("records appointment.created", async () => {
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } } } });

      const id = await createAppointment({
        participantId: "p-1",
        coachId: "c-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
      });

      expect(id).toBe("apt-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.created",
          domain: "appointment",
          action: "created",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });

    it("does not record an audit event when creation fails", async () => {
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: null } } } });

      const id = await createAppointment({
        participantId: "p-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
      });

      expect(id).toBe("");
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("updateAppointment", () => {
    it("records appointment.status_changed with the participant resolved from the record", async () => {
      route();

      await updateAppointment("apt-1", { status: "Confirmed" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          domain: "appointment",
          action: "status_changed",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });

    it("does not record an audit event when the status is untouched", async () => {
      route();

      await updateAppointment("apt-1", { location: "OnSite" });

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("confirmAppointment", () => {
    it("records appointment.status_changed", async () => {
      route();

      await confirmAppointment("apt-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });
  });

  describe("completeAppointment", () => {
    it("records appointment.status_changed", async () => {
      route();

      await completeAppointment("apt-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });
  });

  describe("rescheduleAppointment", () => {
    it("records appointment.rescheduled with the participant resolved from the record", async () => {
      route();

      await rescheduleAppointment("apt-1", "2026-09-29T10:00:00Z", "2026-09-29T11:00:00Z");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.rescheduled",
          domain: "appointment",
          action: "rescheduled",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });
  });

  describe("cancelAppointment", () => {
    it("records appointment.cancelled with the participant resolved from the record", async () => {
      route();

      await cancelAppointment("apt-1", "No longer needed");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.cancelled",
          domain: "appointment",
          action: "cancelled",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });
  });

  describe("updateAppointmentAttendance", () => {
    it("records appointment.attendance_changed with the participant resolved from the record", async () => {
      route();

      await updateAppointmentAttendance("apt-1", "Completed");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.attendance_changed",
          domain: "appointment",
          action: "attendance_changed",
          subjectId: "apt-1",
          participantId: "p-1",
        }),
      );
    });
  });

  describe("correlationId", () => {
    it("uebernimmt die fachliche Correlation-Id in das create-Event", async () => {
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } } } });

      await createAppointment({
        participantId: "p-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
        correlationId: "biz-42",
      });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: "biz-42" }),
      );
    });

    it("erzeugt eine Correlation-Id, wenn keine fachliche vorliegt", async () => {
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } } } });

      await createAppointment({
        participantId: "p-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
      });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: "test-correlation-id" }),
      );
    });

    it("laesst Anlegen und Reschedule eines Termins in einer Gruppe landen", async () => {
      // Der Datensatz traegt CorrelationId__c = "biz-42"; das Resschedule
      // liest sie zurueck. Beide Events muessen dieselbe Id nutzen, sonst
      // zeigt die Timeline zwei getrennte Karten statt einer.
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } } } });

      await createAppointment({
        participantId: "p-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
        correlationId: "biz-42",
      });
      await rescheduleAppointment("apt-1", "2026-09-29T10:00:00Z", "2026-09-29T11:00:00Z", "biz-42");

      const correlations = vi
        .mocked(auditService.record)
        .mock.calls.map(([input]) => input.correlationId);
      expect(correlations).toEqual(["biz-42", "biz-42"]);
    });

    it("uebernimmt die Correlation-Id auch beim Status-Update", async () => {
      route();

      await updateAppointment("apt-1", { status: "Confirmed", correlationId: "biz-7" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: "biz-7" }),
      );
    });
  });

  describe("actor resolution", () => {
    it("stamps the session actor on the event", async () => {
      route({ CreateAppointment: { uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } } } });

      await createAppointment({
        participantId: "p-1",
        type: "Coaching",
        startTime: "2026-09-28T10:00:00Z",
        endTime: "2026-09-28T11:00:00Z",
      });

      expect(getAuditActor).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: "staff",
          actorId: "user-1",
          actorDisplayNameSnapshot: "Test User",
        }),
      );
    });
  });
});
