import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import {
  recordParticipantCreation,
  recordParticipantArchived,
  recordParticipantRestored,
} from "./participantAuditIntegration";
import type { Participant } from "@/types/participant";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

const participant: Participant = {
  id: "a059b00000gdNKkAAM",
  name: "Max Mustermann",
  status: "Onboarding",
  email: "max@example.com",
  programId: "a0P000000000001AAA",
  coachId: "a0C000000000001AAA",
};

function createdRecordResponse(eventType: string, domain: string, action: string) {
  const value = (v: unknown) => ({ value: v });
  return {
    uiapi: {
      AuditEvent__cCreate: {
        Record: {
          Id: "a0AA000000000001AAA",
          OccurredAt__c: value("2026-09-25T10:00:00.000Z"),
          CreatedDate: value("2026-09-25T10:00:01.000Z"),
          EventType__c: value(eventType),
          SchemaVersion__c: value(1),
          Domain__c: value(domain),
          Action__c: value(action),
          ActorType__c: value("staff"),
          ActorId__c: value("005000000000001AAA"),
          ActorDisplayName__c: value("Test Coach"),
          SubjectType__c: value("Participant__c"),
          SubjectId__c: value(participant.id),
          ParticipantId__c: value(participant.id),
          Source__c: value("web"),
          CorrelationId__c: value("corr-1"),
          Reason__c: value(null),
          ChangedFields__c: value("[]"),
          Changes__c: value("[]"),
          Metadata__c: value("{}"),
          Visibility__c: value("staff"),
          Sensitivity__c: value("normal"),
        },
      },
    },
  };
}

const actor = { id: "005000000000001AAA", type: "staff" as const, displayName: "Test Coach" };

describe("participant lifecycle audit events (test coverage only, no production wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records participant.created with canonical types", async () => {
    mockedExecute.mockResolvedValueOnce(
      createdRecordResponse("participant.created", "participant", "created"),
    );

    const event = await recordParticipantCreation(participant.id, participant, { actor });

    expect(event.eventType).toBe("participant.created");
    expect(event.domain).toBe("participant");
    expect(event.action).toBe("created");
    const [, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];
    expect(variables.domain).toBe("participant");
    expect(variables.action).toBe("created");
  });

  it("records participant.archived with canonical types", async () => {
    mockedExecute.mockResolvedValueOnce(
      createdRecordResponse("participant.archived", "participant", "archived"),
    );

    const event = await recordParticipantArchived(participant.id, participant, { actor });

    expect(event.eventType).toBe("participant.archived");
    expect(event.domain).toBe("participant");
    expect(event.action).toBe("archived");
  });

  it("records participant.restored with canonical types", async () => {
    mockedExecute.mockResolvedValueOnce(
      createdRecordResponse("participant.restored", "participant", "restored"),
    );

    const event = await recordParticipantRestored(participant.id, participant, { actor });

    expect(event.eventType).toBe("participant.restored");
    expect(event.domain).toBe("participant");
    expect(event.action).toBe("restored");
  });
});
