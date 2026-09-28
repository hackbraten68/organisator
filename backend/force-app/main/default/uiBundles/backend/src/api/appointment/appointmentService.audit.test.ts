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
    generateUUID: vi.fn().mockReturnValue("test-correlation-id"),
  },
  generateUUID: vi.fn().mockReturnValue("test-correlation-id"),
}));

vi.mock("@/api/audit/actorContext", () => ({
  getAuditActor: vi.fn().mockReturnValue({
    id: "user-1",
    type: "staff",
    displayName: "Test User",
  }),
}));

import { executeGraphQL } from "@/api/graphqlClient";

describe("appointmentService audit integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAppointment", () => {
    it("records appointment.created when appointment is created", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } },
      });

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

    it("does not record audit event when creation fails", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Appointment__cCreate: { Record: null } },
      });

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
    it("records appointment.status_changed when status is updated", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await updateAppointment("apt-1", { status: "Confirmed" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          domain: "appointment",
          action: "status_changed",
          subjectId: "apt-1",
        }),
      );
    });

    it("does not record audit event when no status change", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await updateAppointment("apt-1", { location: "OnSite" });

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("confirmAppointment", () => {
    it("records appointment.status_changed when appointment is confirmed", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await confirmAppointment("apt-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          domain: "appointment",
          action: "status_changed",
          subjectId: "apt-1",
        }),
      );
    });
  });

  describe("completeAppointment", () => {
    it("records appointment.status_changed when appointment is completed", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await completeAppointment("apt-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.status_changed",
          domain: "appointment",
          action: "status_changed",
          subjectId: "apt-1",
        }),
      );
    });
  });

  describe("rescheduleAppointment", () => {
    it("records appointment.rescheduled when appointment is rescheduled", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await rescheduleAppointment("apt-1", "2026-09-29T10:00:00Z", "2026-09-29T11:00:00Z");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.rescheduled",
          domain: "appointment",
          action: "rescheduled",
          subjectId: "apt-1",
        }),
      );
    });
  });

  describe("cancelAppointment", () => {
    it("records appointment.cancelled when appointment is cancelled", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await cancelAppointment("apt-1", "No longer needed");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.cancelled",
          domain: "appointment",
          action: "cancelled",
          subjectId: "apt-1",
        }),
      );
    });
  });

  describe("updateAppointmentAttendance", () => {
    it("records appointment.attendance_changed when attendance is updated", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await updateAppointmentAttendance("apt-1", "Completed");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "appointment.attendance_changed",
          domain: "appointment",
          action: "attendance_changed",
          subjectId: "apt-1",
        }),
      );
    });
  });

  describe("actor resolution", () => {
    it("uses getAuditActor for all audit events", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Appointment__cCreate: { Record: { Id: "apt-1" } } },
      });

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
