import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAbsence,
  updateAbsence,
  approveAbsence,
  rejectAbsence,
  cancelAbsence,
  uploadAbsenceDocument,
} from "./absenceService";
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

describe("absenceService audit integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAbsence", () => {
    it("records absence.reported when absence is created", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Absence__cCreate: { Record: { Id: "abs-1" } } },
      });

      const id = await createAbsence({
        participantId: "p-1",
        type: "Krank",
        startDate: "2026-09-28",
        endDate: "2026-09-30",
        reason: "Flu",
      });

      expect(id).toBe("abs-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.reported",
          domain: "absence",
          action: "submitted",
          subjectId: "abs-1",
          participantId: "p-1",
        }),
      );
    });

    it("does not record audit event when creation fails", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Absence__cCreate: { Record: null } },
      });

      const id = await createAbsence({
        participantId: "p-1",
        type: "Krank",
        startDate: "2026-09-28",
        endDate: "2026-09-30",
      });

      expect(id).toBe("");
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("updateAbsence", () => {
    it("records absence.updated when absence is updated", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await updateAbsence("abs-1", { type: "Urlaub" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.updated",
          domain: "absence",
          action: "updated",
          subjectId: "abs-1",
        }),
      );
    });

    it("does not record audit event when no fields change", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await updateAbsence("abs-1", {});

      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("approveAbsence", () => {
    it("records absence.approved when absence is approved", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await approveAbsence("abs-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.approved",
          domain: "absence",
          action: "approved",
          subjectId: "abs-1",
        }),
      );
    });
  });

  describe("rejectAbsence", () => {
    it("records absence.rejected when absence is rejected", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await rejectAbsence("abs-1", "Not enough notice");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.rejected",
          domain: "absence",
          action: "rejected",
          subjectId: "abs-1",
        }),
      );
    });
  });

  describe("cancelAbsence", () => {
    it("records absence.cancelled when absence is cancelled", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({});

      await cancelAbsence("abs-1");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.cancelled",
          domain: "absence",
          action: "cancelled",
          subjectId: "abs-1",
        }),
      );
    });
  });

  describe("uploadAbsenceDocument", () => {
    it("records absence.document_added when document is uploaded", async () => {
      vi.mocked(executeGraphQL)
        .mockResolvedValueOnce({
          uiapi: { ContentVersionCreate: { Record: { Id: "cv-1" } } },
        })
        .mockResolvedValueOnce({
          uiapi: {
            query: {
              ContentVersion: {
                edges: [{ node: { ContentDocumentId: "cd-1" } }],
              },
            },
          },
        });

      await uploadAbsenceDocument(
        "abs-1",
        { title: "note.pdf", pathOnClient: "note.pdf", versionData: new Blob() },
        "user-1",
      );

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "absence.document_added",
          domain: "absence",
          action: "document_added",
          subjectId: "abs-1",
        }),
      );
    });
  });

  describe("actor resolution", () => {
    it("uses getAuditActor for all audit events", async () => {
      vi.mocked(executeGraphQL).mockResolvedValueOnce({
        uiapi: { Absence__cCreate: { Record: { Id: "abs-1" } } },
      });

      await createAbsence({
        participantId: "p-1",
        type: "Krank",
        startDate: "2026-09-28",
        endDate: "2026-09-30",
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
