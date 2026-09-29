import { describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { getContact, listContacts, searchContacts } from "./contactService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

const node = (
  id: string,
  firstName: string | null,
  lastName: string | null,
  email: string | null,
  accountName: string | null = null,
) => ({
  Id: id,
  FirstName: { value: firstName },
  LastName: { value: lastName },
  Email: { value: email },
  Phone: { value: null },
  AccountId: { value: accountName ? "a01b0000000001AAA" : null },
  Account: accountName ? { Name: { value: accountName } } : null,
});

const listResponse = (nodes: unknown[]) => ({
  uiapi: { query: { Contact: { edges: nodes.map((n) => ({ node: n })) } } },
});

describe("listContacts", () => {
  it("maps the name from first and last name", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([node("003a", "Aylin", "Yilmaz", "aylin@example.com")]),
    );

    const contacts = await listContacts();

    expect(contacts).toEqual([
      {
        id: "003a",
        firstName: "Aylin",
        lastName: "Yilmaz",
        name: "Aylin Yilmaz",
        email: "aylin@example.com",
        phone: undefined,
        accountId: undefined,
        accountName: undefined,
        participantId: undefined,
        participantName: undefined,
      },
    ]);
  });

  it("falls back to the email when the contact has no name", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([node("003a", null, null, "nur@example.com")]),
    );

    const [contact] = await listContacts();

    expect(contact.name).toBe("nur@example.com");
    expect(contact.firstName).toBeUndefined();
  });

  it("keeps a single name part without a stray space", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([node("003a", null, "Weber", "j@example.com")]),
    );

    const [contact] = await listContacts();

    expect(contact.name).toBe("Weber");
  });
});

describe("searchContacts", () => {
  it("returns everything for an empty query", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([
        node("003a", "Aylin", "Yilmaz", "a@example.com"),
        node("003b", "Jonas", "Weber", "j@example.com"),
      ]),
    );

    expect(await searchContacts("   ")).toHaveLength(2);
  });

  it("matches name, email and account name case-insensitively", async () => {
    mockedExecute.mockResolvedValue(
      listResponse([
        node("003a", "Aylin", "Yilmaz", "aylin@example.com", "Codingschule"),
        node("003b", "Jonas", "Weber", "jonas@example.com", "Andere GmbH"),
      ]),
    );

    expect(await searchContacts("aylin")).toHaveLength(1);
    expect(await searchContacts("WEBER")).toHaveLength(1);
    expect(await searchContacts("codingschule")).toHaveLength(1);
    expect(await searchContacts("gmbh")).toHaveLength(1);
  });
});

describe("getContact", () => {
  it("returns null when the contact does not exist", async () => {
    mockedExecute.mockResolvedValueOnce({ uiapi: { query: { Contact: { edges: [] } } } });

    expect(await getContact("003missing")).toBeNull();
  });

  it("passes the id as a GraphQL variable", async () => {
    mockedExecute.mockResolvedValueOnce(
      listResponse([node("003a", "Aylin", "Yilmaz", "a@example.com")]),
    );

    const contact = await getContact("003a");

    expect(mockedExecute).toHaveBeenCalledWith(expect.stringContaining("GetContact"), {
      id: "003a",
    });
    expect(contact?.id).toBe("003a");
  });
});
