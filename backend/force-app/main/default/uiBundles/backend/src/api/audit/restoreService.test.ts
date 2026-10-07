/**
 * Wiederherstellen aus dem Audit-Protokoll.
 *
 * Der Kern der Absicht: eine versehentliche Loeschung soll rueckgaengig zu
 * machen sein, ohne dass ein Coach die Werte aus dem Protokoll abschreiben
 * muss. Und umgekehrt: wo der Snapshot nicht vollstaendig ist, wird *nicht*
 * geraten — `describeRestore` liefert dann `null`, und es passiert nichts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { describeRestore, canRestore, restoreFromEvent } from "./restoreService";
import { addLearningPathItem, createModule } from "@/api/program/programService";
import { recordLearningPathRestored } from "./learningPathAuditIntegration";
import type { AuditEvent } from "@/types/audit";

vi.mock("@/api/program/programService", () => ({
  addLearningPathItem: vi.fn(),
  createModule: vi.fn(),
}));

vi.mock("./learningPathAuditIntegration", () => ({
  recordLearningPathRestored: vi.fn(),
}));

const mockedAddItem = vi.mocked(addLearningPathItem);
const mockedCreateModule = vi.mocked(createModule);
const mockedRecordRestored = vi.mocked(recordLearningPathRestored);

function deletedItem(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "evt-deleted",
    recordedAt: "2026-10-07T09:00:01.000Z",
    occurredAt: "2026-10-07T09:00:00.000Z",
    schemaVersion: 1,
    eventType: "learning_path.item_deleted",
    domain: "learning_path",
    action: "deleted",
    actorType: "coach",
    actorId: "005x",
    subjectType: "LearningPathItem__c",
    subjectId: "lp-1",
    participantId: "p-1",
    source: "web",
    changedFields: [],
    changes: [],
    metadata: {
      title: "Einführung",
      programId: "prog-1",
      previousPosition: 2,
      estimatedWeeks: 3,
      status: "In Progress",
    },
    visibility: "staff",
    sensitivity: "normal",
    ...overrides,
  } as AuditEvent;
}

function deletedModule(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return deletedItem({
    eventType: "learning_path.module_deleted",
    subjectType: "Module__c",
    subjectId: "m-1",
    participantId: undefined,
    metadata: { title: "Vertiefung", programId: "prog-1", previousPosition: 3 },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAddItem.mockResolvedValue({ id: "lp-new" } as never);
  mockedCreateModule.mockResolvedValue({ id: "m-new" } as never);
  mockedRecordRestored.mockResolvedValue({ id: "evt-restored" } as never);
});

describe("describeRestore", () => {
  it("erkennt einen geloeschten Lernpfad-Eintrag", () => {
    expect(describeRestore(deletedItem())).toMatchObject({
      kind: "learning_path_item",
      headline: 'Lernpfad-Eintrag „Einführung" wieder anlegen',
    });
  });

  it("erkennt ein geloeschtes Modul ohne Teilnehmerbezug", () => {
    expect(describeRestore(deletedModule())).toMatchObject({ kind: "program_module" });
  });

  it("sagt die abweichende Position offen", () => {
    expect(describeRestore(deletedItem())?.caveat).toMatch(/Position am Ende/);
  });

  it("lehnt Ereignisse ab, die keine Loeschung sind", () => {
    expect(canRestore(deletedItem({ action: "created" }))).toBe(false);
  });

  it("lehnt Ereignisse ohne wiederherstellbaren Snapshot ab", () => {
    for (const metadata of [
      {},
      { title: "Einführung" },
      { programId: "prog-1" },
      { title: "", programId: "prog-1" },
      { title: "   ", programId: "prog-1" },
      { title: "Einführung", programId: "" },
    ]) {
      expect(describeRestore(deletedItem({ metadata })), JSON.stringify(metadata)).toBeNull();
    }
  });

  it("verlangt fuer einen Lernpfad-Eintrag zwingend einen Teilnehmer", () => {
    expect(describeRestore(deletedItem({ participantId: undefined }))).toBeNull();
  });

  it("lässt fremde Ereignistypen unangetastet", () => {
    expect(canRestore(deletedItem({ eventType: "participant.status_changed" }))).toBe(false);
  });
});

describe("restoreFromEvent — Lernpfad-Eintrag", () => {
  it("legt den Eintrag mit den Snapshot-Werten neu an", async () => {
    const result = await restoreFromEvent(deletedItem());

    expect(result).toEqual({ kind: "learning_path_item", newId: "lp-new" });
    expect(mockedAddItem).toHaveBeenCalledWith("p-1", "prog-1", {
      title: "Einführung",
      estimatedWeeks: 3,
      status: "In Progress",
    });
  });

  it("verknuepft Wiederherstellung und Loeschung ueber die correlationId", async () => {
    await restoreFromEvent(deletedItem());

    expect(mockedRecordRestored).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-deleted", eventType: "learning_path.item_deleted" }),
      { id: "lp-new", title: "Einführung", programId: "prog-1", participantId: "p-1" },
      expect.anything(),
    );
  });

  it("verweigert einen heute unbekannten Status statt ihn zu erfinden", async () => {
    const event = deletedItem({
      metadata: { ...deletedItem().metadata, status: "Abgeschlossen" },
    });

    await expect(restoreFromEvent(event)).rejects.toThrow(/nicht mehr anlegbar/);
    expect(mockedAddItem).not.toHaveBeenCalled();
  });

  it("kommt ohne Dauer aus, wenn der Snapshot keine hatte", async () => {
    const event = deletedItem({
      metadata: { ...deletedItem().metadata, estimatedWeeks: null },
    });

    await restoreFromEvent(event);

    expect(mockedAddItem).toHaveBeenCalledWith(
      "p-1",
      "prog-1",
      expect.objectContaining({ estimatedWeeks: undefined }),
    );
  });
});

describe("restoreFromEvent — Modul", () => {
  it("legt das Modul im Programm neu an", async () => {
    const result = await restoreFromEvent(deletedModule());

    expect(result).toEqual({ kind: "program_module", newId: "m-new" });
    expect(mockedCreateModule).toHaveBeenCalledWith("prog-1", { name: "Vertiefung" });
    expect(mockedAddItem).not.toHaveBeenCalled();
  });

  it("haelt den Teilnehmerbezug leer", async () => {
    await restoreFromEvent(deletedModule());

    expect(mockedRecordRestored.mock.calls[0][1]).not.toHaveProperty("participantId");
  });
});

describe("restoreFromEvent — Fehler und Protokoll", () => {
  it("wirft bei einem nicht wiederherstellbaren Ereignis", async () => {
    await expect(restoreFromEvent(deletedItem({ action: "created" }))).rejects.toThrow(
      /laesst sich nicht wiederherstellen/,
    );
    expect(mockedAddItem).not.toHaveBeenCalled();
  });

  it("haelt einen wiederhergestellten Datensatz auch dann, wenn das Protokoll scheitert", async () => {
    mockedRecordRestored.mockRejectedValue(new Error("audit down"));

    // Ein Fehler im Protokoll darf den bereits angelegten Datensatz nicht
    // wieder wegnehmen — sonst behauptete die Meldung das Gegenteil.
    await expect(restoreFromEvent(deletedItem())).resolves.toEqual({
      kind: "learning_path_item",
      newId: "lp-new",
    });
  });

  it("gibt einen Fehler des Anlegens nach oben weiter", async () => {
    mockedAddItem.mockRejectedValue(new Error("Salesforce down"));

    await expect(restoreFromEvent(deletedItem())).rejects.toThrow("Salesforce down");
    expect(mockedRecordRestored).not.toHaveBeenCalled();
  });
});
