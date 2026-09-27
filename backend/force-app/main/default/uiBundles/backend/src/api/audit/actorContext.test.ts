import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import {
  getAuditActor,
  getSessionActorOverride,
  listStaffUsers,
  readSfdcEnvIdentity,
  resolveAuditActor,
  resolveUserActor,
  resolveUserDetails,
  resetAuditActorForTests,
  SESSION_ACTOR_KEY,
  setSessionActorOverride,
  SYSTEM_ACTOR,
} from "./actorContext";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

function userResponse(firstName: string | null, id = "0059b00000gUfkFAAS") {
  return {
    uiapi: {
      query: {
        User: {
          edges: [
            {
              node: {
                Id: id,
                FirstName: firstName ? { value: firstName } : null,
                LastName: { value: "Mustermann" },
                Name: { value: firstName ? `${firstName} Mustermann` : "Mustermann" },
                Username: { value: "max@example.com" },
              },
            },
          ],
        },
      },
    },
  };
}

describe("actorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuditActorForTests();
    sessionStorage.clear();
    delete (globalThis as Record<string, unknown>).SFDC_ENV;
  });

  it("starts at SYSTEM and reads no platform identity without SFDC_ENV", () => {
    expect(getAuditActor()).toEqual(SYSTEM_ACTOR);
    expect(readSfdcEnvIdentity()).toEqual({});
  });

  it("picks userId/username hints out of SFDC_ENV", () => {
    (globalThis as Record<string, unknown>).SFDC_ENV = {
      bundleId: "9YE...",
      userId: "0059b00000gUfkFAAS",
      unrelated: 42,
    };
    expect(readSfdcEnvIdentity()).toEqual({ userId: "0059b00000gUfkFAAS" });
  });

  it("resolves a platform user to a first-name-only staff actor", async () => {
    mockedExecute.mockResolvedValueOnce(userResponse("  Samuel  "));
    const actor = await resolveUserActor({ userId: "0059b00000gUfkFAAS" });

    expect(actor).toEqual({
      id: "0059b00000gUfkFAAS",
      type: "staff",
      displayName: "Samuel",
    });
    expect(mockedExecute).toHaveBeenCalledOnce();
  });

  it("resolves by username when no id is available", async () => {
    mockedExecute.mockResolvedValueOnce(userResponse("Lena"));
    const actor = await resolveUserActor({ username: "lena@example.com" });

    expect(actor?.displayName).toBe("Lena");
  });

  it("falls back to the first token of Name when FirstName is missing", async () => {
    mockedExecute.mockResolvedValueOnce(userResponse(null));
    const actor = await resolveUserActor({ userId: "0059b00000gUfkFAAS" });

    expect(actor?.displayName).toBe("Mustermann");
  });

  it("returns null (chain continues) when the user has no usable name", async () => {
    mockedExecute.mockResolvedValueOnce({
      uiapi: { query: { User: { edges: [{ node: { Id: "0059b00000gUfkFAAS" } }] } } },
    });
    await expect(resolveUserActor({ userId: "0059b00000gUfkFAAS" })).resolves.toBeNull();
  });

  it("returns null instead of throwing when the lookup fails", async () => {
    mockedExecute.mockRejectedValueOnce(new Error("GraphQL Error: boom"));
    await expect(resolveUserActor({ userId: "0059b00000gUfkFAAS" })).resolves.toBeNull();
  });

  it("round-trips the session self-attestation", () => {
    expect(getSessionActorOverride()).toBeNull();
    const actor = setSessionActorOverride("  Lena ");
    expect(actor).toEqual({ type: "staff", displayName: "Lena" });
    expect(getSessionActorOverride()).toEqual(actor);
    expect(sessionStorage.getItem(SESSION_ACTOR_KEY)).not.toBeNull();
  });

  it("stores the real org user id for list choices", () => {
    const actor = setSessionActorOverride({ userId: "0059b00000gUfkFAAS", firstName: "Samuel" });

    expect(actor).toEqual({ id: "0059b00000gUfkFAAS", type: "staff", displayName: "Samuel" });
    expect(getSessionActorOverride()).toEqual(actor);
    expect(getAuditActor()).toEqual(actor);
  });

  it("accepts legacy id-less overrides from older sessions", () => {
    sessionStorage.setItem(SESSION_ACTOR_KEY, JSON.stringify({ firstName: "Lena" }));

    expect(getSessionActorOverride()).toEqual({ type: "staff", displayName: "Lena" });
  });

  it("prefers a live session override over the resolved base actor", async () => {
    mockedExecute.mockResolvedValueOnce(userResponse("Samuel"));
    (globalThis as Record<string, unknown>).SFDC_ENV = { userId: "0059b00000gUfkFAAS" };
    await resolveAuditActor();
    expect(getAuditActor().displayName).toBe("Samuel");

    setSessionActorOverride("Lena");
    expect(getAuditActor()).toEqual({ type: "staff", displayName: "Lena" });
  });

  it("falls back to SYSTEM with no platform identity and no override", async () => {
    await expect(resolveAuditActor()).resolves.toEqual(SYSTEM_ACTOR);
    expect(getAuditActor()).toEqual(SYSTEM_ACTOR);
  });

  it("shares one resolution across concurrent callers", async () => {
    mockedExecute.mockResolvedValueOnce(userResponse("Samuel"));
    (globalThis as Record<string, unknown>).SFDC_ENV = { userId: "0059b00000gUfkFAAS" };
    const [a, b] = await Promise.all([resolveAuditActor(), resolveAuditActor()]);
    expect(a).toEqual(b);
    expect(mockedExecute).toHaveBeenCalledOnce();
  });
});

describe("listStaffUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuditActorForTests();
    sessionStorage.clear();
  });

  function staffListResponse() {
    return {
      uiapi: {
        query: {
          User: {
            edges: [
              { node: { Id: "0051", FirstName: { value: "Samuel" }, LastName: { value: "D." }, Name: { value: "Samuel D." }, Username: { value: "sam@example.com" }, UserType: { value: "Standard" } } },
              { node: { Id: "0052", FirstName: null, LastName: { value: "Chatter Expert" }, Name: { value: "Chatter Expert" }, Username: { value: "chatty@x" }, UserType: { value: "CsnOnly" } } },
              { node: { Id: "0053", FirstName: { value: "Automated" }, LastName: { value: "Process" }, Name: { value: "Automated Process" }, Username: { value: "auto@x" }, UserType: { value: "AutomatedProcess" } } },
              { node: { Id: "0054", FirstName: null, LastName: null, Name: null, Username: { value: "noname@x" }, UserType: { value: "Standard" } } },
            ],
          },
        },
      },
    };
  }

  it("returns active Standard users with first names, excluding system users", async () => {
    mockedExecute.mockResolvedValueOnce(staffListResponse());

    const users = await listStaffUsers();

    expect(users).toEqual([
      { id: "0051", firstName: "Samuel", fullName: "Samuel D.", username: "sam@example.com" },
    ]);
  });

  it("returns an empty list (picker falls back to freetext) on failure", async () => {
    mockedExecute.mockRejectedValueOnce(new Error("down"));

    await expect(listStaffUsers()).resolves.toEqual([]);
  });
});

describe("resolveUserDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function detailsResponse() {
    return {
      uiapi: {
        query: {
          User: {
            edges: [
              {
                node: {
                  Id: "0059b00000gUfkFAAS",
                  FirstName: { value: "Samuel" },
                  LastName: { value: "Dillenburg" },
                  Name: { value: "Samuel Dillenburg" },
                  Username: { value: "sam@example.com" },
                  SmallPhotoUrl: { value: "https://example.com/photo.jpg" },
                  Profile: { Id: "00e1", Name: { value: "System Administrator" } },
                  UserRole: null,
                },
              },
            ],
          },
        },
      },
    };
  }

  it("maps profile, missing role, and photo", async () => {
    mockedExecute.mockResolvedValueOnce(detailsResponse());

    const details = await resolveUserDetails("0059b00000gUfkFAAS");

    expect(details).toEqual({
      userId: "0059b00000gUfkFAAS",
      firstName: "Samuel",
      fullName: "Samuel Dillenburg",
      username: "sam@example.com",
      photoUrl: "https://example.com/photo.jpg",
      profileName: "System Administrator",
    });
    expect(details).not.toHaveProperty("roleName");
  });

  it("returns null when the user cannot be resolved", async () => {
    mockedExecute.mockResolvedValueOnce({ uiapi: { query: { User: { edges: [] } } } });
    await expect(resolveUserDetails("0059b00000gUfkFAAS")).resolves.toBeNull();

    mockedExecute.mockRejectedValueOnce(new Error("down"));
    await expect(resolveUserDetails("0059b00000gUfkFAAS")).resolves.toBeNull();
  });
});
