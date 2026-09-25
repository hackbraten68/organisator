import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { recordParticipantStatusChange } from "./participantAuditIntegration";
import { getParticipantActivity } from "./auditApiService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

function auditCreateResponse(overrides: Record<string, unknown> = {}) {
  const value = (v: unknown) => ({ value: v });
  return {
    uiapi: {
      AuditEvent__cCreate: {
        Record: {
          Id: "a0AA000000000001AAA",
          OccurredAt__c: value(new Date("2026-09-25T10:00:00.000Z").toISOString()),
          CreatedDate: value(new Date("2026-09-25T10:00:01.000Z").toISOString()),
          EventType__c: value("participant.status_changed"),
          SchemaVersion__c: value(1),
          Domain__c: value("participant"),
          Action__c: value("status_changed"),
          ActorType__c: value("staff"),
          ActorId__c: value("005000000000001AAA"),
          ActorDisplayName__c: value("Test Coach"),
          SubjectType__c: value("Participant__c"),
          SubjectId__c: value("a0PA000000000001AAA"),
          ParticipantId__c: value("a0PA000000000001AAA"),
          Source__c: value("web"),
          CorrelationId__c: value("corr-1"),
          Reason__c: value(null),
          ChangedFields__c: value(JSON.stringify(["Status__c"])),
          Changes__c: value(
            JSON.stringify([
              {
                field: "Status__c",
                oldValue: "Onboarding",
                newValue: "Active",
                displayType: "status",
                redacted: false,
              },
            ]),
          ),
          Metadata__c: value(
            JSON.stringify({ previousStatus: "Onboarding", newStatus: "Active" }),
          ),
          Visibility__c: value("staff"),
          Sensitivity__c: value("normal"),
          ...overrides,
        },
      },
    },
  };
}

describe("recordParticipantStatusChange (Option A slice)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExecute.mockResolvedValue(auditCreateResponse());
  });

  it("records participant.status_changed with canonical domain/action", async () => {
    const event = await recordParticipantStatusChange(
      "a0PA000000000001AAA",
      "Onboarding",
      "Active",
      {
        actor: { id: "005000000000001AAA", type: "staff", displayName: "Test Coach" },
      },
    );

    expect(event.eventType).toBe("participant.status_changed");
    expect(event.domain).toBe("participant");
    expect(event.action).toBe("status_changed");
    expect(event.subjectType).toBe("Participant__c");
    expect(event.subjectId).toBe("a0PA000000000001AAA");
    expect(event.participantId).toBe("a0PA000000000001AAA");
    expect(event.changedFields).toEqual(["Status__c"]);
    expect(event.changes[0]).toMatchObject({
      field: "Status__c",
      oldValue: "Onboarding",
      newValue: "Active",
      redacted: false,
    });
  });

  it("sends canonical restricted-picklist values to CreateAuditEvent", async () => {
    await recordParticipantStatusChange("a0PA000000000001AAA", "Onboarding", "Active", {
      actor: { id: "005000000000001AAA", type: "staff", displayName: "Test Coach" },
    });

    expect(mockedExecute).toHaveBeenCalledOnce();
    const [_op, variables] = mockedExecute.mock.calls[0] as [string, Record<string, unknown>];

    // These exact strings must exist in Salesforce restricted picklists,
    // otherwise UIAPI returns INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST.
    expect(variables.domain).toBe("participant");
    expect(variables.action).toBe("status_changed");
    expect(variables.actorType).toBe("staff");
    expect(variables.source).toBe("web");
    expect(variables.visibility).toBe("staff");
    expect(variables.sensitivity).toBe("normal");
    expect(variables.eventType).toBe("participant.status_changed");
    expect(variables.subjectType).toBe("Participant__c");
  });

  it("maps GetParticipantActivityTimeline nodes for ActivityTimeline", async () => {
    const value = (v: unknown) => ({ value: v });
    mockedExecute.mockResolvedValueOnce({
      uiapi: {
        query: {
          AuditEvent__c: {
            edges: [
              {
                node: {
                  Id: "a0AA000000000001AAA",
                  OccurredAt__c: value("2026-09-25T10:00:00.000Z"),
                  CreatedDate: value("2026-09-25T10:00:01.000Z"),
                  EventType__c: value("participant.status_changed"),
                  SchemaVersion__c: value(1),
                  Domain__c: value("participant"),
                  Action__c: value("status_changed"),
                  ActorType__c: value("staff"),
                  ActorId__c: value("005000000000001AAA"),
                  ActorDisplayName__c: value("Test Coach"),
                  SubjectType__c: value("Participant__c"),
                  SubjectId__c: value("a0PA000000000001AAA"),
                  ParticipantId__c: value("a0PA000000000001AAA"),
                  Source__c: value("web"),
                  CorrelationId__c: value("corr-1"),
                  Reason__c: value(null),
                  ChangedFields__c: value(JSON.stringify(["Status__c"])),
                  Changes__c: value(
                    JSON.stringify([
                      {
                        field: "Status__c",
                        oldValue: "Onboarding",
                        newValue: "Active",
                        displayType: "status",
                        redacted: false,
                      },
                    ]),
                  ),
                  Metadata__c: value("{}"),
                  Visibility__c: value("staff"),
                  Sensitivity__c: value("normal"),
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: "cursor-1" },
          },
        },
      },
    });

    const result = await getParticipantActivity("a0PA000000000001AAA", 50);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventType: "participant.status_changed",
      domain: "participant",
      action: "status_changed",
    });
    expect(result.hasNextPage).toBe(false);
  });

  it("propagates UIAPI restricted-picklist errors without masking", async () => {
    mockedExecute.mockRejectedValueOnce(
      new Error("GraphQL Error: INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST: Action"),
    );

    await expect(
      recordParticipantStatusChange("a0PA000000000001AAA", "Onboarding", "Active", {
        actor: { id: "005000000000001AAA", type: "staff", displayName: "Test Coach" },
      }),
    ).rejects.toThrow("INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST");
  });
});
