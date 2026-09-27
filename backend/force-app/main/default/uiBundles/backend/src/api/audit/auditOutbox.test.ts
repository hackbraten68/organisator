import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { auditService } from "./auditService";
import {
  enqueueOutboxEntry,
  listOutboxEntries,
  outboxRetryDelayMinutes,
  processOutboxOnce,
  requeueOutboxEntry,
  MAX_OUTBOX_RETRIES,
} from "./auditOutbox";
import type { CreateAuditEventInput } from "@/types/audit";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

vi.mock("./auditService", () => ({
  auditService: { record: vi.fn() },
}));

const mockedExecute = vi.mocked(executeGraphQL);
const mockedRecord = vi.mocked(auditService.record);

const INPUT: CreateAuditEventInput = {
  eventType: "participant.status_changed",
  domain: "participant",
  action: "status_changed",
  actorType: "staff",
  actorId: "0059b00000gUfkFAAS",
  actorDisplayNameSnapshot: "Samuel",
  subjectType: "Participant__c",
  subjectId: "a059b00000gdNKkAAM",
  participantId: "a059b00000gdNKkAAM",
  source: "web",
  correlationId: "corr-1",
  requestId: "req-1",
  changes: [],
  metadata: {},
};

function outboxNode(overrides: Record<string, unknown> = {}) {
  return {
    Id: "ob-1",
    Status__c: { value: "PENDING" },
    EventType__c: { value: "participant.status_changed" },
    Payload__c: { value: JSON.stringify(INPUT) },
    SubjectId__c: { value: "a059b00000gdNKkAAM" },
    ParticipantId__c: { value: "a059b00000gdNKkAAM" },
    Error__c: { value: "GraphQL Error: boom" },
    RetryCount__c: { value: 0 },
    CorrelationId__c: { value: "corr-1" },
    NextRetryAt__c: null,
    ...overrides,
  };
}

function listResponse(nodes: unknown[]) {
  return {
    uiapi: { query: { AuditOutbox__c: { edges: nodes.map((node) => ({ node })) } } },
  };
}

describe("auditOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a PENDING entry with the frozen input as payload", async () => {
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cCreate: { Record: { Id: "ob-1" } } },
    });

    const id = await enqueueOutboxEntry(INPUT, new Error("GraphQL Error: boom"));

    expect(id).toBe("ob-1");
    const [, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];
    expect(variables.status).toBe("PENDING");
    expect(variables.eventType).toBe("participant.status_changed");
    expect(variables.retryCount).toBe(0);
    expect(variables.error).toBe("GraphQL Error: boom");
    expect(JSON.parse(variables.payload as string)).toMatchObject({
      domain: "participant",
      correlationId: "corr-1",
      requestId: "req-1",
    });
  });

  it("never throws: returns null when the outbox write fails", async () => {
    mockedExecute.mockRejectedValueOnce(new Error("down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(enqueueOutboxEntry(INPUT, new Error("boom"))).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("replays PENDING entries to PROCESSED with the original correlation", async () => {
    mockedExecute.mockResolvedValueOnce(listResponse([outboxNode()]));
    mockedRecord.mockResolvedValueOnce({ id: "evt-1" } as never);
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cUpdate: { Record: { Id: "ob-1" } } },
    });

    const result = await processOutboxOnce();

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });
    expect(mockedRecord).toHaveBeenCalledOnce();
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "corr-1" }),
    );
    const [, updateVars] = mockedExecute.mock.calls[1] as [string, Record<string, unknown>];
    expect(updateVars).toMatchObject({ id: "ob-1", status: "PROCESSED" });
  });

  it("backs off with incremented retry count while retries remain", async () => {
    mockedExecute.mockResolvedValueOnce(listResponse([outboxNode()]));
    mockedRecord.mockRejectedValueOnce(new Error("still down"));
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cUpdate: { Record: { Id: "ob-1" } } },
    });

    const result = await processOutboxOnce();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    const [, updateVars] = mockedExecute.mock.calls[1] as [string, Record<string, unknown>];
    expect(updateVars.status).toBe("PENDING");
    expect(updateVars.retryCount).toBe(1);
    expect(typeof updateVars.nextRetryAt).toBe("string");
  });

  it(`fails terminally after ${MAX_OUTBOX_RETRIES} attempts`, async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([outboxNode({ RetryCount__c: { value: MAX_OUTBOX_RETRIES - 1 } })]),
    );
    mockedRecord.mockRejectedValueOnce(new Error("still down"));
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cUpdate: { Record: { Id: "ob-1" } } },
    });

    const result = await processOutboxOnce();

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    const [, updateVars] = mockedExecute.mock.calls[1] as [string, Record<string, unknown>];
    expect(updateVars).toMatchObject({ status: "FAILED", retryCount: MAX_OUTBOX_RETRIES });
    expect(updateVars.nextRetryAt).toBeNull();
  });

  it("fails unparseable payloads immediately without replay", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([outboxNode({ Payload__c: { value: "not-json{{{" } })]),
    );
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cUpdate: { Record: { Id: "ob-1" } } },
    });

    const result = await processOutboxOnce();

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("skips entries whose retry is not due yet", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    mockedExecute.mockResolvedValueOnce(
      listResponse([outboxNode({ NextRetryAt__c: { value: future } })]),
    );

    const result = await processOutboxOnce();

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it("requeues FAILED entries to PENDING for manual replay", async () => {
    mockedExecute.mockResolvedValueOnce({
      uiapi: { AuditOutbox__cUpdate: { Record: { Id: "ob-1" } } },
    });

    await requeueOutboxEntry("ob-1");

    const [, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];
    expect(variables).toMatchObject({ id: "ob-1", status: "PENDING", nextRetryAt: null });
  });

  it("lists entries oldest-first and tolerates list failures", async () => {
    mockedExecute.mockResolvedValueOnce(listResponse([outboxNode()]));
    const entries = await listOutboxEntries("PENDING");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "ob-1", status: "PENDING", retryCount: 0 });

    mockedExecute.mockRejectedValueOnce(new Error("down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(listOutboxEntries("PENDING")).resolves.toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("backs off exponentially (5, 10, 20, … minutes)", () => {
    expect(outboxRetryDelayMinutes(0)).toBe(5);
    expect(outboxRetryDelayMinutes(1)).toBe(10);
    expect(outboxRetryDelayMinutes(2)).toBe(20);
  });
});
