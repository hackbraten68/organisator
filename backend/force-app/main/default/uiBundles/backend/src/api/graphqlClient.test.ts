import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDataSDK } from "@salesforce/platform-sdk";
import { executeGraphQL } from "./graphqlClient";

vi.mock("@salesforce/platform-sdk", () => ({
  createDataSDK: vi.fn(),
}));

const queryMock = vi.fn();
const mutateMock = vi.fn();

/**
 * Locks the OneStore freshness contract: queries must bypass the SDK read
 * cache (mutations never invalidate it), mutations stay untouched.
 * Regression test for stale-after-mutation UI (status stayed Active until
 * a browser reload).
 */
describe("executeGraphQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDataSDK).mockResolvedValue({
      graphql: { query: queryMock, mutate: mutateMock },
    } as never);
  });

  it("sends queries with cacheControl no-cache", async () => {
    queryMock.mockResolvedValue({ data: { hello: "world" } });

    const data = await executeGraphQL<{ hello: string }>(
      "query Hello { hello }",
    );

    expect(data).toEqual({ hello: "world" });
    expect(queryMock).toHaveBeenCalledWith({
      query: "query Hello { hello }",
      variables: undefined,
      cacheControl: "no-cache",
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("routes mutations without cacheControl", async () => {
    mutateMock.mockResolvedValue({ data: { ok: true } });

    const data = await executeGraphQL<{ ok: boolean }, { id: string }>(
      "mutation Update($id: IdOrRef!) { uiapi { x } }",
      { id: "p1" },
    );

    expect(data).toEqual({ ok: true });
    expect(mutateMock).toHaveBeenCalledWith({
      mutation: "mutation Update($id: IdOrRef!) { uiapi { x } }",
      variables: { id: "p1" },
    });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("throws on GraphQL errors", async () => {
    queryMock.mockResolvedValue({ errors: [{ message: "boom" }] });

    await expect(executeGraphQL("query Q { x }")).rejects.toThrow(
      "GraphQL Error: boom",
    );
  });

  it("throws on null data", async () => {
    queryMock.mockResolvedValue({ data: null });

    await expect(executeGraphQL("query Q { x }")).rejects.toThrow(
      "GraphQL response data is null",
    );
  });
});
