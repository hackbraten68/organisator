import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { executeGraphQL } from "../graphqlClient";
import { recordSessionLogin, SESSION_LOGIN_DEDUPE_KEY } from "./sessionAudit";
import { useSessionLoginAudit } from "@/hooks/useSessionLoginAudit";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);
const value = (v: unknown) => ({ value: v });

function auditCreateResponse() {
  return {
    uiapi: {
      AuditEvent__cCreate: {
        Record: {
          Id: "a0AA000000000001AAA",
          OccurredAt__c: value(new Date("2026-09-27T10:00:00.000Z").toISOString()),
          CreatedDate: value(new Date("2026-09-27T10:00:01.000Z").toISOString()),
          EventType__c: value("authentication.created"),
          SchemaVersion__c: value(1),
          Domain__c: value("authentication"),
          Action__c: value("created"),
          ActorType__c: value("system"),
          ActorId__c: value("SYSTEM"),
          ActorDisplayName__c: value("System"),
          SubjectType__c: value("User"),
          SubjectId__c: value("SYSTEM"),
          ParticipantId__c: value(null),
          Source__c: value("web"),
          CorrelationId__c: value("corr-1"),
          Reason__c: value(null),
          ChangedFields__c: value("[]"),
          Changes__c: value("[]"),
          Metadata__c: value(JSON.stringify({ authMethod: "session" })),
          Visibility__c: value("restricted"),
          Sensitivity__c: value("restricted"),
        },
      },
    },
  };
}

describe("session login audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedExecute.mockResolvedValue(auditCreateResponse());
  });

  it("writes one restricted authentication.created event without identity", async () => {
    const event = await recordSessionLogin();

    expect(event.eventType).toBe("authentication.created");
    expect(event.domain).toBe("authentication");
    expect(event.action).toBe("created");
    expect(event.visibility).toBe("restricted");
    expect(event.participantId).toBeNull();
    expect(event.actorId).toBe("SYSTEM");
    expect(event.metadata).toEqual({ authMethod: "session" });
  });

  it("dedupes per browser session and never throws into the UI", async () => {
    const { unmount } = renderHook(() => useSessionLoginAudit());
    unmount();
    renderHook(() => useSessionLoginAudit());

    // Exactly one write despite two mounts in the same session.
    expect(mockedExecute).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SESSION_LOGIN_DEDUPE_KEY)).not.toBeNull();
  });

  it("swallows write failures (ADR-14)", async () => {
    mockedExecute.mockRejectedValueOnce(new Error("audit down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderHook(() => useSessionLoginAudit());
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to write audit event authentication.created",
        expect.anything(),
      );
    });
    errorSpy.mockRestore();
  });
});
