import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import {
  addLearningPathItem,
  deleteLearningPathItem,
  reorderLearningPathItems,
  updateLearningPathItem,
} from "./programService";
import { filterForAudience } from "../audit/activityProjection";
import type { AuditEvent } from "@/types/audit";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);
const value = (v: unknown) => ({ value: v });

interface FakeItem {
  id: string;
  title: string;
  order: number;
  estimatedWeeks?: number;
  status: string;
}

let store: FakeItem[];
let auditShouldFail = false;

function nodeOf(item: FakeItem) {
  return {
    Id: item.id,
    Title__c: value(item.title),
    Order__c: value(item.order),
    Status__c: value(item.status),
    Estimated_Weeks__c: value(item.estimatedWeeks ?? null),
    Participant__c: value("p-1"),
    Program__c: value("prog-1"),
  };
}

function auditRecordFromVariables(variables: Record<string, unknown>) {
  // Mirrors createAuditEventRecord: values arrive serialized, keys use the
  // mutation's variable names (actorDisplayName, not ...Snapshot).
  return {
    uiapi: {
      AuditEvent__cCreate: {
        Record: {
          Id: "a0AA000000000001AAA",
          OccurredAt__c: value(variables.occurredAt),
          CreatedDate: value(new Date("2026-09-25T10:00:01.000Z").toISOString()),
          EventType__c: value(variables.eventType),
          SchemaVersion__c: value(variables.schemaVersion),
          Domain__c: value(variables.domain),
          Action__c: value(variables.action),
          ActorType__c: value(variables.actorType),
          ActorId__c: value(variables.actorId),
          ActorDisplayName__c: value(variables.actorDisplayName),
          SubjectType__c: value(variables.subjectType),
          SubjectId__c: value(variables.subjectId),
          ParticipantId__c: value(variables.participantId),
          Source__c: value(variables.source),
          CorrelationId__c: value(variables.correlationId ?? "corr-1"),
          Reason__c: value(variables.reason ?? null),
          ChangedFields__c: value(variables.changedFields),
          Changes__c: value(variables.changes),
          Metadata__c: value(variables.metadata),
          Visibility__c: value(variables.visibility),
          Sensitivity__c: value(variables.sensitivity),
        },
      },
    },
  };
}

function auditCalls() {
  return mockedExecute.mock.calls.filter(([op]) =>
    typeof op === "string" && op.includes("AuditEvent__cCreate"),
  ) as Array<[string, Record<string, unknown>]>;
}

function parsedChanges(variables: Record<string, unknown>) {
  return JSON.parse(String(variables.changes)) as Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

function parsedMetadata(variables: Record<string, unknown>) {
  return JSON.parse(String(variables.metadata)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  auditShouldFail = false;
  store = [
    { id: "lp-1", title: "Einführung", order: 1, estimatedWeeks: 2, status: "Planned" },
    { id: "lp-2", title: "Vertiefung", order: 2, estimatedWeeks: 3, status: "Planned" },
  ];
  mockedExecute.mockImplementation(async (op: string, variables?: unknown) => {
    const vars = (variables ?? {}) as Record<string, unknown>;
    if (op.includes("AuditEvent__cCreate")) {
      if (auditShouldFail) throw new Error("audit backend down");
      return auditRecordFromVariables(vars);
    }
    if (op.includes("CreateLearningPathItem")) {
      const created: FakeItem = {
        id: "lp-new",
        title: String(vars.title ?? "Untitled"),
        order: Number(vars.order ?? 99),
        estimatedWeeks: (vars.estimatedWeeks as number | null) ?? undefined,
        status: String(vars.status ?? "Planned"),
      };
      store.push(created);
      return { uiapi: { AnythingCreate: { Record: { Id: "lp-new" } } } };
    }
    if (op.includes("UpdateLearningPathItem")) {
      const item = store.find((i) => i.id === vars.id);
      if (item) {
        if (vars.title !== undefined) item.title = String(vars.title);
        if (vars.order !== undefined && vars.order !== null) {
          item.order = Number(vars.order);
        }
        if (vars.estimatedWeeks !== undefined) {
          item.estimatedWeeks = (vars.estimatedWeeks as number | null) ?? undefined;
        }
        if (vars.status !== undefined) item.status = String(vars.status);
      }
      return { uiapi: { AnythingUpdate: { Record: { Id: vars.id } } } };
    }
    if (op.includes("DeleteLearningPathItem")) {
      store = store.filter((i) => i.id !== vars.id);
      return { uiapi: { AnythingDelete: { Record: { Id: vars.id } } } };
    }
    if (op.includes("LearningPathById")) {
      const item = store.find((i) => i.id === vars.id);
      return {
        uiapi: { query: { Learning_Path__c: { edges: item ? [{ node: nodeOf(item) }] : [] } } },
      };
    }
    if (op.includes("LearningPathsByParticipant")) {
      return {
        uiapi: { query: { Learning_Path__c: { edges: store.map((i) => ({ node: nodeOf(i) })) } } },
      };
    }
    throw new Error(`unexpected operation: ${String(op).slice(0, 60)}`);
  });
});

describe("learning path audit", () => {
  it("1: successful create writes exactly one item_created event", async () => {
    const created = await addLearningPathItem("p-1", "prog-1", {
      title: "Einführung",
      estimatedWeeks: 2,
      status: "Planned",
    });

    expect(created.id).toBe("lp-new");
    const calls = auditCalls();
    expect(calls).toHaveLength(1);
    const [, variables] = calls[0];
    expect(variables.eventType).toBe("learning_path.item_created");
    expect(variables.domain).toBe("learning_path");
    expect(variables.action).toBe("created");
    expect(variables.subjectType).toBe("LearningPathItem__c");
    expect(variables.subjectId).toBe("lp-new");
    expect(variables.participantId).toBe("p-1");
  });

  it("2: successful mutation survives a failing audit write", async () => {
    auditShouldFail = true;
    const created = await addLearningPathItem("p-1", "prog-1", {
      title: "Einführung",
      status: "Planned",
    });
    expect(created.id).toBe("lp-new");
    expect(auditCalls()).toHaveLength(1);
  });

  it("3: failed mutation writes no audit event", async () => {
    mockedExecute.mockImplementationOnce(async () => {
      throw new Error("mutation rejected");
    });
    await expect(
      addLearningPathItem("p-1", "prog-1", { title: "X", status: "Planned" }),
    ).rejects.toThrow("mutation rejected");
    expect(auditCalls()).toHaveLength(0);
  });

  it("4: update without fachliche Änderung writes no event", async () => {
    const saved = await updateLearningPathItem("lp-1", { title: "Einführung" });
    expect(saved?.title).toBe("Einführung");
    expect(auditCalls()).toHaveLength(0);
  });

  it("4b: update with changes writes item_updated with before/after", async () => {
    const saved = await updateLearningPathItem("lp-1", { estimatedWeeks: 4 });
    expect(saved?.estimatedWeeks).toBe(4);
    const calls = auditCalls();
    expect(calls).toHaveLength(1);
    const [, variables] = calls[0];
    expect(variables.eventType).toBe("learning_path.item_updated");
    const changes = parsedChanges(variables);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      field: "EstimatedWeeks__c",
      oldValue: 2,
      newValue: 4,
    });
  });

  it("5: reorder to the same position writes no event", async () => {
    const items = await reorderLearningPathItems("p-1", ["lp-1", "lp-2"], "lp-1");
    expect(items.map((i) => i.id)).toEqual(["lp-1", "lp-2"]);
    expect(auditCalls()).toHaveLength(0);
  });

  it("5b: reorder writes exactly one item_reordered with positions", async () => {
    const items = await reorderLearningPathItems("p-1", ["lp-2", "lp-1"], "lp-1");
    expect(items.find((i) => i.id === "lp-1")?.order).toBe(2);
    const calls = auditCalls();
    expect(calls).toHaveLength(1);
    const [, variables] = calls[0];
    expect(variables.eventType).toBe("learning_path.item_reordered");
    expect(variables.action).toBe("reordered");
    expect(variables.subjectId).toBe("lp-1");
    const changes = parsedChanges(variables);
    expect(changes).toEqual([
      expect.objectContaining({ field: "Order__c", oldValue: 1, newValue: 2 }),
    ]);
    expect(parsedMetadata(variables)).toMatchObject({
      title: "Einführung",
      programId: "prog-1",
      previousPosition: 1,
      newPosition: 2,
    });
  });

  it("6: delete carries a snapshot of the removed item", async () => {
    await deleteLearningPathItem("lp-2");
    const calls = auditCalls();
    expect(calls).toHaveLength(1);
    const [, variables] = calls[0];
    expect(variables.eventType).toBe("learning_path.item_deleted");
    expect(variables.subjectId).toBe("lp-2");
    expect(parsedMetadata(variables)).toMatchObject({
      title: "Vertiefung",
      previousPosition: 2,
      estimatedWeeks: 3,
      status: "Planned",
      programId: "prog-1",
    });
  });

  it("7: ids and event type are stable, title is snapshot only", async () => {
    await deleteLearningPathItem("lp-1");
    const [, variables] = auditCalls()[0];
    expect(variables.participantId).toBe("p-1");
    expect(variables.subjectType).toBe("LearningPathItem__c");
    expect(variables.eventType).toBe("learning_path.item_deleted");
  });

  it("8: non-allowlisted metadata never reaches the event", async () => {
    const { recordLearningPathItemCreated } = await import(
      "../audit/learningPathAuditIntegration"
    );
    const event = await recordLearningPathItemCreated(
      {
        id: "lp-1",
        participantId: "p-1",
        programId: "prog-1",
        title: "Einführung",
        order: 1,
        estimatedWeeks: 2,
        status: "Planned",
      },
      {
        actor: { id: "s-1", type: "staff", displayName: "Coach" },
        metadata: {
          title: "Einführung",
          programId: "prog-1",
          // Deliberate: not on the allowlist, must be stripped at runtime.
          internalToken: "secret",
          lmsPayload: { deep: true },
        },
      },
    );
    expect(event.metadata).not.toHaveProperty("internalToken");
    expect(event.metadata).not.toHaveProperty("lmsPayload");
    expect(event.metadata).toMatchObject({ title: "Einführung", programId: "prog-1" });
  });

  it("9: projection shows learning-path events to coach/staff, not participant", async () => {
    const { recordLearningPathItemCreated } = await import(
      "../audit/learningPathAuditIntegration"
    );
    const event: AuditEvent = await recordLearningPathItemCreated(
      {
        id: "lp-1",
        participantId: "p-1",
        programId: "prog-1",
        title: "Einführung",
        order: 1,
        status: "Planned",
      },
      { actor: { id: "s-1", type: "staff", displayName: "Coach" } },
    );
    for (const type of [
      "learning_path.item_created",
      "learning_path.item_updated",
      "learning_path.item_deleted",
    ]) {
      const typed = { ...event, eventType: type };
      expect(
        filterForAudience([typed], "coach").map((e) => e.id),
        type,
      ).toEqual([event.id]);
      expect(filterForAudience([typed], "staff")).toHaveLength(1);
      expect(filterForAudience([typed], "participant")).toEqual([]);
    }
  });

  it("9b: item_reordered is backend-only, hidden from every timeline", async () => {
    const reordered: AuditEvent = {
      id: "a0AA000000000004AAA",
      recordedAt: "2026-09-25T10:00:01.000Z",
      occurredAt: "2026-09-25T10:00:00.000Z",
      schemaVersion: 1,
      eventType: "learning_path.item_reordered",
      domain: "learning_path",
      action: "reordered",
      actorType: "system",
      subjectType: "LearningPathItem__c",
      subjectId: "lp-1",
      participantId: "p-1",
      source: "web",
      changedFields: ["Order__c"],
      changes: [],
      metadata: {},
      visibility: "staff",
      sensitivity: "normal",
    };
    // Raw store keeps it; no audience timeline (not even with technical flag).
    expect([reordered]).toHaveLength(1);
    for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
      expect(filterForAudience([reordered], audience)).toEqual([]);
      expect(
        filterForAudience([reordered], audience, { includeTechnicalEvents: true }),
      ).toEqual([]);
    }
  });

  it("10: unknown types stay available raw but out of every audience timeline", async () => {
    const unknown: AuditEvent = {
      id: "a0AA000000000099AAA",
      recordedAt: "2026-09-25T10:00:01.000Z",
      occurredAt: "2026-09-25T10:00:00.000Z",
      schemaVersion: 1,
      eventType: "future_domain.something_new",
      domain: "system",
      action: "created",
      actorType: "system",
      subjectType: "LearningPathItem__c",
      subjectId: "lp-1",
      participantId: "p-1",
      source: "web",
      changedFields: [],
      changes: [],
      metadata: {},
      visibility: "staff",
      sensitivity: "normal",
    };
    // Raw store keeps it (audit explorer); timelines deny by default.
    expect([unknown]).toHaveLength(1);
    for (const audience of ["coach", "staff", "supervisor", "auditor", "participant"] as const) {
      expect(filterForAudience([unknown], audience)).toEqual([]);
    }
  });
});
