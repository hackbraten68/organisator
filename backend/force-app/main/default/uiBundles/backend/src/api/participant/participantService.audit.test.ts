import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import {
  recordParticipantCreation,
  recordParticipantStatusChange,
  recordParticipantUpdate,
} from "../audit/participantAuditIntegration";
import { createParticipant, updateParticipant } from "./participantService";
import { getContact } from "../contact/contactService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

vi.mock("../contact/contactService", () => ({
  getContact: vi.fn(),
}));

vi.mock("../program/programService", () => ({
  listPrograms: vi.fn(async () => []),
}));

vi.mock("../coach/coachService", () => ({
  listCoaches: vi.fn(async () => []),
}));

vi.mock("../audit/participantAuditIntegration", () => ({
  recordParticipantCreation: vi.fn(async () => ({ id: "audit-0" })),
  recordParticipantStatusChange: vi.fn(async () => ({ id: "audit-1" })),
  recordParticipantUpdate: vi.fn(async () => ({ id: "audit-2" })),
}));

const mockedExecute = vi.mocked(executeGraphQL);
const mockedGetContact = vi.mocked(getContact);
const mockedRecordCreation = vi.mocked(recordParticipantCreation);
const mockedRecordStatus = vi.mocked(recordParticipantStatusChange);
const mockedRecordUpdate = vi.mocked(recordParticipantUpdate);

let currentStatus = "Onboarding";

function participantQueryResponse(status: string, id = "a059b00000gdNKkAAM") {
  return {
    uiapi: {
      query: {
        Participant__c: {
          edges: [
            {
              node: {
                Id: id,
                Name: { value: "Max Mustermann" },
                Status__c: { value: status },
              },
            },
          ],
        },
      },
    },
  };
}

describe("updateParticipant audit wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStatus = "Onboarding";
    mockedExecute.mockImplementation(async (operation: string, variables?: unknown) => {
      if (operation.includes("Participant__cUpdate")) {
        const status = (variables as { status?: string } | undefined)?.status;
        if (status !== undefined) currentStatus = status;
        return { uiapi: { Participant__cUpdate: { Record: { Id: "a059b00000gdNKkAAM" } } } };
      }
      return participantQueryResponse(currentStatus);
    });
  });

  it("records participant.status_changed when the status changed", async () => {
    const saved = await updateParticipant("a059b00000gdNKkAAM", { status: "Active" });

    expect(saved?.status).toBe("Active");
    expect(mockedRecordStatus).toHaveBeenCalledOnce();
    expect(mockedRecordStatus).toHaveBeenCalledWith(
      "a059b00000gdNKkAAM",
      "Onboarding",
      "Active",
      expect.objectContaining({ actor: expect.objectContaining({ type: "system" }) }),
    );
  });

  it("records participant.updated when profile fields change", async () => {
    const saved = await updateParticipant("a059b00000gdNKkAAM", {
      github: "sam-new",
    });

    expect(saved).not.toBeNull();
    expect(mockedRecordStatus).not.toHaveBeenCalled();
    expect(mockedRecordUpdate).toHaveBeenCalledOnce();
    expect(mockedRecordUpdate).toHaveBeenCalledWith(
      "a059b00000gdNKkAAM",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        actor: expect.objectContaining({ type: "system" }),
        correlationId: expect.any(String),
      }),
    );
  });

  it("records two events with one correlationId for status + profile change", async () => {
    await updateParticipant("a059b00000gdNKkAAM", {
      status: "Active",
      github: "sam-new",
    });

    expect(mockedRecordStatus).toHaveBeenCalledOnce();
    expect(mockedRecordUpdate).toHaveBeenCalledOnce();
    const statusCorrelation = (
      mockedRecordStatus.mock.calls[0] as Array<{ correlationId?: string }>
    )[3]?.correlationId;
    const updateCorrelation = (
      mockedRecordUpdate.mock.calls[0] as Array<{ correlationId?: string }>
    )[3]?.correlationId;
    expect(statusCorrelation).toBeDefined();
    expect(updateCorrelation).toBe(statusCorrelation);
    // status is excluded from the updated-event diff (no duplication)
    const updateBefore = mockedRecordUpdate.mock.calls[0]?.[1] as { status?: string };
    const updateAfter = mockedRecordUpdate.mock.calls[0]?.[2] as { status?: string };
    expect(updateBefore?.status).toBe(updateAfter?.status);
  });

  it("records no audit event when nothing changed", async () => {
    mockedRecordUpdate.mockRejectedValueOnce(
      new Error("No fields changed; no audit event recorded"),
    );
    const saved = await updateParticipant("a059b00000gdNKkAAM", { status: "Onboarding" });

    expect(saved?.status).toBe("Onboarding");
    expect(mockedRecordStatus).not.toHaveBeenCalled();
    expect(mockedRecordUpdate).toHaveBeenCalledOnce();
  });

  it("still saves when the audit write fails", async () => {
    mockedRecordStatus.mockRejectedValueOnce(new Error("GraphQL Error: boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const saved = await updateParticipant("a059b00000gdNKkAAM", { status: "Paused" });

      expect(saved?.status).toBe("Paused");
      expect(mockedRecordStatus).toHaveBeenCalledOnce();
      expect(errorSpy).toHaveBeenCalledWith("Failed to write audit event", expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("createParticipant audit wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetContact.mockResolvedValue({
      id: "a01b00000contact01AAA",
      firstName: "Lena",
      lastName: "Neu",
      name: "  Lena Neu  ",
      email: "lena.neu@example.com",
    });
    mockedExecute.mockImplementation(async (operation: string, variables?: unknown) => {
      if (operation.includes("Participant__cCreate")) {
        return { uiapi: { Participant__cCreate: { Record: { Id: "a059b00000new000AAA" } } } };
      }
      const id = (variables as { id?: string } | undefined)?.id ?? "a059b00000new000AAA";
      return participantQueryResponse("Onboarding", id);
    });
  });

  it("records participant.created after the confirmed read-back", async () => {
    const created = await createParticipant({ contactId: "a01b00000contact01AAA" });

    expect(created?.id).toBe("a059b00000new000AAA");
    expect(mockedRecordCreation).toHaveBeenCalledOnce();
    expect(mockedRecordCreation).toHaveBeenCalledWith(
      "a059b00000new000AAA",
      expect.objectContaining({ name: "Max Mustermann" }),
      expect.objectContaining({ actor: expect.objectContaining({ type: "system" }) }),
    );
    // Name comes from the contact, not from the caller (ADR-001).
    const [, variables] = mockedExecute.mock.calls.find(([op]) =>
      (op as string).includes("Participant__cCreate"),
    ) as [string, Record<string, unknown>];
    expect(variables.name).toBe("  Lena Neu  ");
    expect(variables.contactId).toBe("a01b00000contact01AAA");
    expect(variables.email).toBe("lena.neu@example.com");
  });

  it("still returns the participant when the audit write fails", async () => {
    mockedRecordCreation.mockRejectedValueOnce(new Error("GraphQL Error: boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const created = await createParticipant({ contactId: "a01b00000contact01AAA" });

      expect(created?.id).toBe("a059b00000new000AAA");
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to write audit event participant.created for a059b00000new000AAA",
        expect.anything(),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
