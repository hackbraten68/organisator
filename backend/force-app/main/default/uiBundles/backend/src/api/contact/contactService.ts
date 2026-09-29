/**
 * Contact data access (live Salesforce data via uiapi GraphQL).
 *
 * A Contact is the person; a Participant__c is their role in the academy
 * (ADR-001). This service is the only place the UI may read a person's name
 * and email from, which is why `createParticipant` resolves the contact here
 * instead of taking a name from the caller.
 *
 * Lookups of *related* records (the participant a contact already owns) are
 * deliberately not done here: `listParticipants` is a separate service and the
 * join happens in the page, same as programs and coaches for participants.
 */
import { executeGraphQL } from "../graphqlClient";
import type { Contact } from "@/types/contact";
import LIST_CONTACTS from "./query/ListContacts.graphql?raw";
import GET_CONTACT from "./query/GetContact.graphql?raw";

type ScalarValue<T = string> = { value?: T | null } | null | undefined;

interface ContactNode {
  Id: string;
  FirstName?: ScalarValue<string>;
  LastName?: ScalarValue<string>;
  Email?: ScalarValue<string>;
  Phone?: ScalarValue<string>;
  AccountId?: ScalarValue<string>;
  Account?: { Name?: ScalarValue<string> } | null;
}

interface ContactsResponse {
  uiapi?: {
    query?: {
      Contact?: {
        edges?: Array<{ node?: ContactNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

function mapContact(node: ContactNode): Contact {
  const firstName = node.FirstName?.value ?? "";
  const lastName = node.LastName?.value ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    id: node.Id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName || node.Email?.value || "Unnamed Contact",
    email: node.Email?.value ?? undefined,
    phone: node.Phone?.value ?? undefined,
    accountId: node.AccountId?.value ?? undefined,
    accountName: node.Account?.Name?.value ?? undefined,
  };
}

export async function listContacts(): Promise<Contact[]> {
  const data = await executeGraphQL<ContactsResponse>(LIST_CONTACTS);
  const edges = data.uiapi?.query?.Contact?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is ContactNode => node != null)
    .map(mapContact);
}

/**
 * Client-side filter, mirroring searchParticipants: a server-side `where` with
 * a null search term would filter everything out rather than nothing.
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  const needle = query.trim().toLowerCase();
  const contacts = await listContacts();
  if (needle === "") return contacts;

  return contacts.filter((contact) =>
    [contact.name, contact.email, contact.accountName]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(needle)),
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  const data = await executeGraphQL<ContactsResponse, { id: string }>(
    GET_CONTACT,
    { id },
  );
  const node = data.uiapi?.query?.Contact?.edges?.[0]?.node ?? null;
  return node ? mapContact(node) : null;
}
