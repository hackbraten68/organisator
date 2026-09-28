/**
 * Tests fuer die Systemkonto-Filterung in `listAssignableUsers`.
 *
 * Der Filter ist die einzige Barriere zwischen Salesforce-Systemusern und dem
 * Coach-Picker im Termin-Dialog. Er muss beide Filterwege abdecken:
 *   1. `UserType` (Security/Integration User sind auf Scratch Orgs "Standard")
 *   2. interne Salesforce-Adressen im Username
 *
 * Salesforce-IDs sind alphanumerisch — die OrgId kann Buchstaben wie das "g"
 * in "00d9b00000d4gsieae" enthalten. Ein reiner Hex-Regex erkennt sie nicht.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeGraphQL } from "../graphqlClient";
import { listAssignableUsers } from "./userService";

vi.mock("../graphqlClient", () => ({
  executeGraphQL: vi.fn(),
}));

const mockedExecute = vi.mocked(executeGraphQL);

interface UserNodeInput {
  Id: string;
  Name?: { value: string } | null;
  Username?: { value: string } | null;
  UserType?: { value: string } | null;
}

function respondWith(nodes: UserNodeInput[]) {
  mockedExecute.mockResolvedValue({
    uiapi: {
      query: {
        User: { edges: nodes.map((node) => ({ node })) },
      },
    },
  });
}

const COACH = {
  Id: "0059b00000gUfkFAAS",
  Name: { value: "Sam Dillenburg" },
  Username: { value: "test-wfcaih57il7r@example.com" },
  UserType: { value: "Standard" },
};

beforeEach(() => {
  mockedExecute.mockReset();
});

describe("listAssignableUsers", () => {
  it("liefert aktive Standard-User mit Name", async () => {
    respondWith([COACH]);

    await expect(listAssignableUsers()).resolves.toEqual([
      { id: "0059b00000gUfkFAAS", name: "Sam Dillenburg", username: "test-wfcaih57il7r@example.com" },
    ]);
  });

  it("filtert Nicht-Person-UserTypen raus", async () => {
    respondWith([
      { ...COACH, Id: "005x000000000001", UserType: { value: "AutomatedProcess" } },
      { ...COACH, Id: "005x000000000002", UserType: { value: "CsnOnly" } },
      { ...COACH, Id: "005x000000000003", UserType: { value: "GuestUser" } },
      COACH,
    ]);

    const users = await listAssignableUsers();
    expect(users.map((u) => u.id)).toEqual(["0059b00000gUfkFAAS"]);
  });

  it("filtert Systemkonten anhand interner Salesforce-Adressen", async () => {
    respondWith([
      {
        ...COACH,
        Id: "005D000000000001",
        Username: { value: "insightssecurity@00d9b00000d4gsieae.com" },
      },
      {
        ...COACH,
        Id: "005D000000000002",
        Username: { value: "integration@00d9b00000d4gsieae.com" },
      },
      COACH,
    ]);

    const users = await listAssignableUsers();
    expect(users.map((u) => u.id)).toEqual(["0059b00000gUfkFAAS"]);
  });

  it("erkennt Systemkonten auch bei nicht-hexadezimalen OrgIds", async () => {
    // Regression: die OrgId enthaelt 'g' und ist nicht hexadezimal.
    const username = "integration@00d9b00000g1hsieae.com.example.org";
    respondWith([{ ...COACH, Id: "005D000000000003", Username: { value: username } }]);

    await expect(listAssignableUsers()).resolves.toEqual([]);
  });

  it("behaelt normale Adressen mit Punkt, die keine OrgId sind", async () => {
    respondWith([
      { ...COACH, Id: "005x000000000010", Username: { value: "kontakt@beispiel.de" } },
      { ...COACH, Id: "005x000000000011", Username: { value: "info@organisation.org" } },
    ]);

    const users = await listAssignableUsers();
    expect(users.map((u) => u.id)).toEqual(["005x000000000010", "005x000000000011"]);
  });

  it("faellt auf den Username zurueck, wenn kein Name gesetzt ist", async () => {
    respondWith([{ ...COACH, Name: null, Username: { value: "nur.username@example.com" } }]);

    const users = await listAssignableUsers();
    expect(users[0].name).toBe("nur.username@example.com");
  });

  it("schliesst User ohne Username fail-closed aus", async () => {
    // Ohne Username laesst sich nicht belegen, dass es sich um einen
    // menschlichen Account handelt -> konservativ ausschliessen.
    respondWith([{ Id: "005x000000000099", Name: null, Username: null, UserType: { value: "Standard" } }]);

    await expect(listAssignableUsers()).resolves.toEqual([]);
  });

  it("filtert User ohne UserType", async () => {
    respondWith([{ ...COACH, Id: "005x000000000100", UserType: null }]);

    await expect(listAssignableUsers()).resolves.toEqual([]);
  });

  it("gibt bei leerer Antwort eine leere Liste zurueck", async () => {
    respondWith([]);

    await expect(listAssignableUsers()).resolves.toEqual([]);
  });

  it("traegt leere Namen auf, statt undefined zu liefern", async () => {
    respondWith([{ ...COACH, Name: { value: "" }, Username: { value: "leer@example.com" } }]);

    const users = await listAssignableUsers();
    expect(users[0]).toEqual({ id: "0059b00000gUfkFAAS", name: "leer@example.com", username: "leer@example.com" });
  });
});
