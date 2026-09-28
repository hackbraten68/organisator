/**
 * Regressionstests fuer die Entfernung von `Appointment__c.Staff__c`.
 *
 * `Coach__c` ist die einzige Zuordnung eines Betreuers zu einem Termin.
 * Diese Tests sichern ab, dass kein Staff-Feld und keine Staff-Variable
 * mehr in Filter, Variablen oder das gemappte Ergebnis gelangen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import {
  createAppointment,
  deleteAvailabilitySlot,
  getAppointment,
  listAppointments,
  updateAppointment,
} from "./appointmentService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

function node(overrides: Record<string, unknown> = {}) {
  return {
    Id: "a0C9b0000Kx5LFtEQM",
    Name: { value: "TERM-0000" },
    Participant__c: { value: "a059b00000gdNKkAAM" },
    Coach__c: { value: "0059b00000gUfkFAAS" },
    Type__c: { value: "Coaching" },
    Status__c: { value: "Draft" },
    StartTime__c: { value: "2026-09-30T10:00:00.000Z" },
    EndTime__c: { value: "2026-09-30T11:00:00.000Z" },
    CreatedDate: { value: "2026-09-28T10:00:00.000Z" },
    LastModifiedDate: { value: "2026-09-28T10:00:00.000Z" },
    Coach__r: { Name: { value: "Sam Dillenburg" } },
    ...overrides,
  };
}

function listResponse(nodes: unknown[] = [node()]) {
  return {
    uiapi: {
      query: {
        Appointment__c: {
          edges: nodes.map((n) => ({ node: n })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  };
}

beforeEach(() => {
  mockedExecute.mockReset();
});

describe("listAppointments – Filter ohne Staff", () => {
  it("baut keinen Staff__c-Filter, selbst wenn eine fremde Property gesetzt wird", async () => {
    mockedExecute.mockResolvedValue(listResponse());

    await listAppointments({
      participantId: "a059b00000gdNKkAAM",
      coachId: "0059b00000gUfkFAAS",
    } as never);

    const [, variables] = mockedExecute.mock.calls[0] as [string, { where: unknown }];
    const serialised = JSON.stringify(variables.where);

    expect(serialised).not.toContain("Staff__c");
    expect(serialised).not.toContain("Staff__r");
    expect(serialised).toContain("Coach__c");
  });

  it("nutzt Coach__c als einzigen Betreuerfilter", async () => {
    mockedExecute.mockResolvedValue(listResponse());

    await listAppointments({ coachId: "0059b00000gUfkFAAS" });

    const [, variables] = mockedExecute.mock.calls[0] as [string, { where: unknown }];
    expect(variables.where).toEqual({ Coach__c: { eq: "0059b00000gUfkFAAS" } });
  });

  it("kapselt Datumsgrenzen als DateTimeInput mit value", async () => {
    mockedExecute.mockResolvedValue(listResponse());

    await listAppointments({
      startTimeFrom: "2026-09-28T00:00:00.000Z",
      startTimeTo: "2026-10-04T23:59:59.000Z",
    });

    const [, variables] = mockedExecute.mock.calls[0] as [string, { where: unknown }];
    expect(variables.where).toEqual({
      and: [
        { StartTime__c: { gte: { value: "2026-09-28T00:00:00.000Z" } } },
        { StartTime__c: { lte: { value: "2026-10-04T23:59:59.000Z" } } },
      ],
    });
  });

  it("liefert undefined als where, wenn kein Filter gesetzt ist", async () => {
    mockedExecute.mockResolvedValue(listResponse());

    await listAppointments();

    const [, variables] = mockedExecute.mock.calls[0] as [string, { where: unknown }];
    expect(variables.where).toBeUndefined();
  });
});

describe("mapGqlToAppointment – kein Staff im Ergebnis", () => {
  it("mappt coachId und coachName, aber kein staffId/staffName", async () => {
    mockedExecute.mockResolvedValue(listResponse());

    const { appointments } = await listAppointments();
    const appointment = appointments[0];

    expect(appointment.coachId).toBe("0059b00000gUfkFAAS");
    expect(appointment.coachName).toBe("Sam Dillenburg");
    expect(appointment).not.toHaveProperty("staffId");
    expect(appointment).not.toHaveProperty("staffName");
  });

  it("mappt getAppointment ohne Staff-Eigenschaften", async () => {
    mockedExecute.mockResolvedValue({
      uiapi: { query: { Appointment__c: { edges: [{ node: node() }] } } },
    });

    const appointment = await getAppointment("a0C9b0000Kx5LFtEQM");

    expect(appointment).not.toBeNull();
    expect(appointment).not.toHaveProperty("staffId");
    expect(appointment).not.toHaveProperty("staffName");
  });
});

describe("createAppointment – keine Staff-Variable", () => {
  it("sendet keine staffId-Variable", async () => {
    mockedExecute.mockResolvedValue({
      uiapi: { Appointment__cCreate: { Record: { Id: "a0C9b0000Kx5LFtEQM" } } },
    });

    const id = await createAppointment({
      participantId: "a059b00000gdNKkAAM",
      coachId: "0059b00000gUfkFAAS",
      staffId: "0059b00000gUfkFAAS",
      type: "Coaching",
      startTime: "2026-09-30T10:00:00.000Z",
      endTime: "2026-09-30T11:00:00.000Z",
    } as never);

    const [document, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];

    expect(id).toBe("a0C9b0000Kx5LFtEQM");
    expect(variables).not.toHaveProperty("staffId");
    expect(document).not.toContain("Staff__c");
    expect(variables.coachId).toBe("0059b00000gUfkFAAS");
  });

  it("setzt den Default-Status Draft", async () => {
    mockedExecute.mockResolvedValue({
      uiapi: { Appointment__cCreate: { Record: { Id: "a0C9b0000Kx5LFtEQM" } } },
    });

    await createAppointment({
      participantId: "a059b00000gdNKkAAM",
      type: "Coaching",
      startTime: "2026-09-30T10:00:00.000Z",
      endTime: "2026-09-30T11:00:00.000Z",
    });

    const [, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];
    expect(variables.status).toBe("Draft");
  });
});

describe("updateAppointment – keine Staff-Variable", () => {
  it("ignoriert eine uebergebene staffId und sendet sie nicht", async () => {
    mockedExecute
      .mockResolvedValueOnce({
        uiapi: { query: { Appointment__c: { edges: [{ node: { Id: "a0C9b0000Kx5LFtEQM", Participant__c: { value: "p-1" } } }] } } },
      })
      .mockResolvedValueOnce({ uiapi: { Appointment__cUpdate: { Record: { Id: "a0C9b0000Kx5LFtEQM" } } } });

    await updateAppointment("a0C9b0000Kx5LFtEQM", {
      staffId: "0059b00000gUfkFAAS",
      status: "Confirmed",
    } as never);

    const [document, variables] = mockedExecute.mock.calls[1] as [string, Record<string, unknown>];

    expect(variables).not.toHaveProperty("staffId");
    expect(document).not.toContain("Staff__c");
    expect(variables.status).toBe("Confirmed");
  });
});

describe("deleteAvailabilitySlot", () => {
  it("ruft die Delete-Mutation mit der Slot-Id auf", async () => {
    mockedExecute.mockResolvedValue({ uiapi: { AvailabilitySlot__cDelete: { Id: "a0C9b0000Kx5LFtEQM" } } });

    await deleteAvailabilitySlot("a0C9b0000Kx5LFtEQM");

    // Vor dem Loeschen wird der Slot gelesen (fuer das Audit-Event), also
    // gezielt die Delete-Mutation suchen statt calls[0] zu nehmen.
    const deleteCall = mockedExecute.mock.calls.find((call) =>
      (call[0] as string).includes("AvailabilitySlot__cDelete"),
    );
    expect(deleteCall).toBeDefined();

    const [document, variables] = deleteCall as [string, Record<string, unknown>];
    expect(document).toContain("AvailabilitySlot__cDelete");
    expect(variables).toEqual({ id: "a0C9b0000Kx5LFtEQM" });
  });
});
