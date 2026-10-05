import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentStaffIdentity } from "./staffIdentityService";

const { mockCreateDataSDK } = vi.hoisted(() => ({ mockCreateDataSDK: vi.fn() }));
vi.mock("@salesforce/platform-sdk", () => ({
  createDataSDK: mockCreateDataSDK,
}));

interface FetchArgs {
  url: string;
  init?: RequestInit;
}

/** Records what the service asked for, and answers with `response`. */
function givenResponse(response: unknown, status = 200): FetchArgs[] {
  const calls: FetchArgs[] = [];
  mockCreateDataSDK.mockResolvedValue({
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => response,
      };
    }),
  });
  return calls;
}

describe("staffIdentityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the signed-in user from the Apex endpoint", async () => {
    const calls = givenResponse({
      userId: "0059b00000gUfkFAAS",
      firstName: "Samuel",
      fullName: "Samuel Dillenburg",
      username: "samuel.dillenburg@codingschule.de",
      profileName: "System Administrator",
      roleName: "Coach",
      photoUrl: "https://example.com/photo.jpg",
    });

    const identity = await fetchCurrentStaffIdentity();

    expect(identity).toEqual({
      userId: "0059b00000gUfkFAAS",
      firstName: "Samuel",
      fullName: "Samuel Dillenburg",
      username: "samuel.dillenburg@codingschule.de",
      profileName: "System Administrator",
      roleName: "Coach",
      photoUrl: "https://example.com/photo.jpg",
    });
    // Relative on purpose: sdk.fetch prefixes SFDC_ENV.apiPath, and a raw absolute
    // path is the trap that answers 200 with the SPA shell.
    expect(calls[0].url).toBe("/services/apexrest/staff-identity/me");
    expect(calls[0].init?.method).toBe("GET");
  });

  it("omits the optional fields Salesforce leaves empty", async () => {
    // Profile and role are routinely absent; a scratch org is the normal case.
    givenResponse({
      userId: "0051",
      firstName: "Lena",
      fullName: "Lena M.",
      profileName: null,
      roleName: "",
      photoUrl: null,
      username: "   ",
    });

    const identity = await fetchCurrentStaffIdentity();

    expect(identity).toEqual({
      userId: "0051",
      firstName: "Lena",
      fullName: "Lena M.",
    });
    expect(identity).not.toHaveProperty("roleName");
    expect(identity).not.toHaveProperty("username");
  });

  it("falls back to the first name when the org sends no full name", async () => {
    givenResponse({ userId: "0051", firstName: "Lena" });

    await expect(fetchCurrentStaffIdentity()).resolves.toEqual({
      userId: "0051",
      firstName: "Lena",
      fullName: "Lena",
    });
  });

  it.each([
    ["not deployed", 404, {}],
    ["no class grant", 403, {}],
    ["no session", 401, {}],
  ])("returns null when the endpoint is unavailable (%s)", async (_label, status) => {
    givenResponse({}, status);
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();
  });

  it("returns null when the endpoint answers with an error code", async () => {
    givenResponse({ code: "NO_SESSION_IDENTITY", message: "There is no signed-in staff user." });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();
  });

  it("returns null for an answer without a user id or without a name", async () => {
    // Either gap would put an actor into the audit trail that cannot be
    // attributed, which is worse than asking.
    givenResponse({ firstName: "Samuel" });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();

    givenResponse({ userId: "0051" });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();

    givenResponse({ userId: "  ", firstName: "Samuel" });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();
  });

  it("returns null instead of throwing when the SDK surface has no fetch", async () => {
    mockCreateDataSDK.mockResolvedValue({});
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();
  });

  it("returns null instead of throwing when the request or the parse fails", async () => {
    mockCreateDataSDK.mockRejectedValue(new Error("SDK unavailable"));
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();

    mockCreateDataSDK.mockResolvedValue({
      fetch: vi.fn(async () => {
        throw new Error("network down");
      }),
    });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();

    mockCreateDataSDK.mockResolvedValue({
      fetch: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("not json");
        },
      })),
    });
    await expect(fetchCurrentStaffIdentity()).resolves.toBeNull();
  });
});