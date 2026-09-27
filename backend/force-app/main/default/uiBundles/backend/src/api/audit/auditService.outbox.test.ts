import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditService } from "./auditService";
import { createAuditEventRecord } from "./auditApiService";
import { enqueueOutboxEntry } from "./auditOutbox";

vi.mock("./auditApiService", () => ({
  createAuditEventRecord: vi.fn(),
  getParticipantActivity: vi.fn(),
}));

vi.mock("./auditOutbox", () => ({
  enqueueOutboxEntry: vi.fn(),
}));

const mockedPersist = vi.mocked(createAuditEventRecord);
const mockedEnqueue = vi.mocked(enqueueOutboxEntry);

const INPUT = {
  eventType: "participant.updated",
  domain: "participant" as const,
  action: "updated" as const,
  actorType: "staff" as const,
  actorId: "0059b00000gUfkFAAS",
  actorDisplayNameSnapshot: "Samuel",
  subjectType: "Participant__c",
  subjectId: "a059b00000gdNKkAAM",
  participantId: "a059b00000gdNKkAAM",
  source: "web" as const,
  changes: [],
  metadata: {},
};

describe("auditService outbox fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues the enriched input (with assigned correlation) and still throws", async () => {
    mockedPersist.mockRejectedValueOnce(new Error("GraphQL Error: boom"));
    mockedEnqueue.mockResolvedValueOnce("ob-1");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(auditService.record({ ...INPUT })).rejects.toThrow(
        "Audit event recording failed",
      );
      expect(mockedEnqueue).toHaveBeenCalledOnce();
      const [frozen, err] = mockedEnqueue.mock.calls[0] as unknown as [
        Record<string, unknown>,
        unknown,
      ];
      // The replay must carry the SAME correlation/request ids.
      expect(frozen.correlationId).toEqual(expect.any(String));
      expect(frozen.requestId).toEqual(expect.any(String));
      expect(err).toBeInstanceOf(Error);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("does not enqueue on success", async () => {
    mockedPersist.mockResolvedValueOnce({ id: "evt-1" } as never);

    await auditService.record({ ...INPUT });

    expect(mockedEnqueue).not.toHaveBeenCalled();
  });
});
