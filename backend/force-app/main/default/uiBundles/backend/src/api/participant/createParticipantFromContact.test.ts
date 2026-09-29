import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { getContact } from "../contact/contactService";
import { createParticipant } from "./participantService";
import { DuplicateParticipantForContactError } from "./duplicateParticipantError";

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

const CONTACT_ID = "a01b00000contact01AAA";

const participantQueryResponse = (id: string) => ({
  uiapi: {
    query: {
      Participant__c: {
        edges: [
          {
            node: {
              Id: id,
              Name: { value: "Aylin Yilmaz" },
              Status__c: { value: "Onboarding" },
              Email__c: { value: "aylin@example.com" },
              GitHub__c: { value: null },
              Discord__c: { value: null },
              StartDate__c: { value: null },
              ExpectedEndDate__c: { value: null },
              Program__c: { value: null },
              Coach_Profile__c: { value: null },
            },
          },
        ],
      },
    },
  },
});

describe("createParticipant from a contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetContact.mockResolvedValue({
      id: CONTACT_ID,
      firstName: "Aylin",
      lastName: "Yilmaz",
      name: "Aylin Yilmaz",
      email: "aylin@example.com",
    });
    mockedExecute.mockImplementation(async (operation: string) => {
      if (operation.includes("Participant__cCreate")) {
        return { uiapi: { Participant__cCreate: { Record: { Id: "a059b0000001AAA" } } } };
      }
      return participantQueryResponse("a059b0000001AAA");
    });
  });

  const createVariables = () => {
    const [, variables] = mockedExecute.mock.calls.find(([op]) =>
      (op as string).includes("Participant__cCreate"),
    ) as [string, Record<string, unknown>];
    return variables;
  };

  it("takes name and email from the contact, not from the caller", async () => {
    await createParticipant({ contactId: CONTACT_ID });

    const variables = createVariables();
    expect(variables.name).toBe("Aylin Yilmaz");
    expect(variables.email).toBe("aylin@example.com");
    expect(variables.contactId).toBe(CONTACT_ID);
  });

  it("refuses to run when the contact cannot be resolved", async () => {
    mockedGetContact.mockResolvedValueOnce(null);

    await expect(createParticipant({ contactId: "a01b000missing" })).rejects.toThrow(
      /not found/,
    );
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it("translates the Apex duplicate code into a typed error", async () => {
    mockedExecute.mockRejectedValueOnce(
      new Error(
        "GraphQL Error: CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY, ParticipantContactUniqueness: execution of BeforeInsert; DUPLICATE_PARTICIPANT_FOR_CONTACT: Contact 003a is already assigned to participant a059b0000099AAA.",
      ),
    );

    const error = await createParticipant({ contactId: CONTACT_ID }).catch((e) => e);

    expect(error).toBeInstanceOf(DuplicateParticipantForContactError);
    expect((error as DuplicateParticipantForContactError).contactId).toBe(CONTACT_ID);
  });

  it("lets unrelated GraphQL errors through unchanged", async () => {
    const original = new Error("GraphQL Error: INSUFFICIENT_ACCESS");
    mockedExecute.mockRejectedValueOnce(original);

    await expect(createParticipant({ contactId: CONTACT_ID })).rejects.toBe(original);
  });
});
