/**
 * Audit fuer das Loeschen eines Programmmoduls.
 *
 * `deleteModule` hat ueber Jahre nichts protokolliert: ein versehentlich
 * geloeschtes Modul war danach weder in der Timeline noch im Protokoll
 * auffindbar. Diese Tests halten fest, dass wieder ein Ereignis entsteht — und
 * vor allem, dass es *ohne* `participantId` entsteht. Ein Modul ist eine Vorlage
 * des Programms; haengt man das Ereignis an jeden Teilnehmer des Programms,
 * behauptet man, bei jedem einzelnen sei etwas geloescht worden.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { deleteModule } from "./programService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);
const value = (v: unknown) => ({ value: v });

interface FakeModule {
  id: string;
  name: string;
  order: number;
  description?: string;
  programId: string;
}

let store: FakeModule[];
let auditShouldFail: boolean;

function nodeOf(m: FakeModule) {
  return {
    Id: m.id,
    Name: value(m.name),
    Order__c: value(m.order),
    Description__c: value(m.description ?? null),
    Program__c: value(m.programId),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  auditShouldFail = false;
  store = [
    { id: "m-1", name: "Einführung", order: 1, programId: "prog-1" },
    { id: "m-2", name: "Vertiefung", order: 2, programId: "prog-1" },
  ];
  mockedExecute.mockImplementation(async (op: string, variables?: unknown) => {
    const vars = (variables ?? {}) as Record<string, unknown>;
    if (op.includes("AuditEvent__cCreate")) {
      if (auditShouldFail) throw new Error("audit backend down");
      return {
        uiapi: {
          AuditEvent__cCreate: {
            Record: {
              Id: "a0AA000000000009AAA",
              EventType__c: value(vars.eventType),
              SubjectType__c: value(vars.subjectType),
              SubjectId__c: value(vars.subjectId),
              ParticipantId__c: value(vars.participantId),
              Metadata__c: value(vars.metadata),
            },
          },
        },
      };
    }
    if (op.includes("DeleteModule")) {
      store = store.filter((m) => m.id !== vars.id);
      return { uiapi: { Module__cDelete: { Id: vars.id } } };
    }
    if (op.includes("ModuleById")) {
      const found = store.find((m) => m.id === vars.id);
      return {
        uiapi: {
          query: { Module__c: { edges: found ? [{ node: nodeOf(found) }] : [] } },
        },
      };
    }
    throw new Error(`unerwartete Operation: ${op}`);
  });
});

function auditCalls() {
  return mockedExecute.mock.calls.filter(([op]) =>
    typeof op === "string" && op.includes("AuditEvent__cCreate"),
  ) as Array<[string, Record<string, unknown>]>;
}

describe("deleteModule — Audit", () => {
  it("protokolliert das Loeschen mit einem Vorher-Snapshot", async () => {
    await deleteModule("m-1");

    expect(auditCalls()).toHaveLength(1);
    const vars = auditCalls()[0][1];
    expect(vars.eventType).toBe("learning_path.module_deleted");
    expect(vars.subjectType).toBe("Module__c");
    expect(vars.subjectId).toBe("m-1");

    // Der Snapshot traegt alles, was zum Nachbauen des Moduls noetig ist.
    const metadata = JSON.parse(String(vars.metadata)) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      title: "Einführung",
      programId: "prog-1",
      previousPosition: 1,
    });
  });

  it("haengt das Ereignis an keinen Teilnehmer", async () => {
    await deleteModule("m-1");

    // Kern der Sache: das Modul gehoert dem Programm. Ein participantId hier
    // wuerde eine Teilnehmer-Historie verfaelschen.
    expect(auditCalls()[0][1].participantId ?? null).toBeNull();
  });

  it("liest den Snapshot vor der Mutation", async () => {
    const order: string[] = [];
    mockedExecute.mockImplementation(async (op: string) => {
      order.push(op.includes("ModuleById") ? "read" : op.includes("DeleteModule") ? "delete" : "audit");
      return {} as never;
    });

    await deleteModule("m-1").catch(() => undefined);

    // Ohne vorheriges Lesen waere der Snapshot nach dem Loeschen weg — genau
    // der Grund, warum deleteLearningPathItem genauso vorgeht.
    expect(order.slice(0, 2)).toEqual(["read", "delete"]);
  });

  it("protokolliert nichts, wenn das Modul schon weg war", async () => {
    await deleteModule("gibt-es-nicht");

    expect(auditCalls()).toHaveLength(0);
  });

  it("bricht die Loeschung nicht ab, wenn das Audit scheitert", async () => {
    auditShouldFail = true;

    await expect(deleteModule("m-1")).resolves.toBeUndefined();
    expect(store.map((m) => m.id)).toEqual(["m-2"]);
  });
});
