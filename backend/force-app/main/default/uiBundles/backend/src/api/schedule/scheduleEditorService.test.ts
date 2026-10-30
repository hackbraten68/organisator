import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@salesforce/platform-sdk", () => ({
  createDataSDK: async () => ({ fetch: fetchMock }),
}));

import {
  applyScheduleTemplate,
  getSchedulePlan,
  importScheduleTemplate,
  saveScheduleGrid,
  saveSchedulePlan,
} from "./scheduleEditorService";
import type { GridConfig } from "@/types/schedule";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
});

describe("scheduleEditorService – MergeMode", () => {
  it("reicht Scope, Teilnehmer und MergeMode an applyTemplate weiter", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, id: "a01", status: "Draft" }));

    await applyScheduleTemplate({
      templateId: "tpl",
      programWeekId: "week",
      startDate: "2027-03-01",
      name: "Individuell",
      scopeType: "Individual",
      participantId: "participant",
      participantGroupId: null,
      mergeMode: "Replace",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      action: "applyTemplate",
      templateId: "tpl",
      programWeekId: "week",
      startDate: "2027-03-01",
      name: "Individuell",
      scopeType: "Individual",
      participantId: "participant",
      participantGroupId: null,
      mergeMode: "Replace",
    });
  });

  it("sendet den MergeMode beim Speichern eines Plans", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, id: "a01", status: "Draft" }));

    await saveSchedulePlan({
      name: "Ergänzen",
      programWeekId: "week",
      scopeType: "Individual",
      startDate: "2027-03-01",
      participantId: "participant",
      mergeMode: "Overlay",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      action: "savePlan",
      scopeType: "Individual",
      mergeMode: "Overlay",
    });
  });

  it("liest den MergeMode aus der Plan-Antwort und defaultet auf Overlay", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          plan: { id: "a01", name: "Individuell", mergeMode: "Replace" },
          entries: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          plan: { id: "a02", name: "Alt" },
          entries: [],
        }),
      );

    await expect(getSchedulePlan("a01")).resolves.toMatchObject({
      plan: { mergeMode: "Replace" },
    });
    await expect(getSchedulePlan("a02")).resolves.toMatchObject({
      plan: { mergeMode: "Overlay" },
    });
  });

  it("sendet das versionierte GridConfig beim Zeitblocke speichern", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, id: "a01", status: "Draft" }));
    const gridConfig: GridConfig = { version: 1, slots: [{ id: "slot-0830", start: "08:30", end: "10:00", durationMinutes: 90 }] };

    await saveScheduleGrid({ weeklyScheduleId: "a01", gridConfig });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      action: "saveGrid",
      weeklyScheduleId: "a01",
      scheduleTemplateId: undefined,
      gridConfig: JSON.stringify(gridConfig),
    });
  });

  it("importiert die Beispielvorlage ueber den Backend-Import", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, id: "tpl-1", status: "Active" }));

    await importScheduleTemplate({
      name: "AWS Cloud & DevOps – Musterwoche",
      description: "Beispielwoche",
      status: "Active",
      gridConfig: JSON.stringify({ version: 1, slots: [] }),
      entries: [
        {
          title: "Live-Unterricht",
          entryKind: "Aktivität",
          type: "Workshop",
          dayOfWeek: "Monday",
          startTime: "08:30",
          endTime: "10:00",
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      action: "importTemplate",
      name: "AWS Cloud & DevOps – Musterwoche",
      status: "Active",
      gridConfig: JSON.stringify({ version: 1, slots: [] }),
      entries: [
        expect.objectContaining({ title: "Live-Unterricht" }),
      ],
    });
  });
});
