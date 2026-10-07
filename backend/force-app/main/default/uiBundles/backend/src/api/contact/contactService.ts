/**
 * Contact data access (live Salesforce data via uiapi GraphQL).
 *
 * A Contact is the person; a Participant__c is their role in the academy
 * (ADR-001). This service is the only place the UI may read a person's name
 * and email from, which is why `createParticipant` resolves the contact here
 * instead of taking a name from the caller.
 *
 * Lookups of *related* records are not resolved per contact: one lightweight
 * query returns every participant's contact link, and the page joins it. That
 * is cheaper than `listParticipants`, which also pulls program and coach name
 * maps that the contacts area does not display.
 */
import { executeGraphQL } from '../graphqlClient';
import type { Contact } from '@/types/contact';
import LIST_CONTACTS from './query/ListContacts.graphql?raw';
import GET_CONTACT from './query/GetContact.graphql?raw';
import LIST_CONTACT_PARTICIPANT_LINKS from './query/ListContactParticipantLinks.graphql?raw';

type ScalarValue<T = string> = { value?: T | null } | null | undefined;

interface ContactNode {
  Id: string;
  FirstName?: ScalarValue<string>;
  LastName?: ScalarValue<string>;
  Email?: ScalarValue<string>;
  Phone?: ScalarValue<string>;
  AccountId?: ScalarValue<string>;
  Account?: { Name?: ScalarValue<string> } | null;
  Freigeschaltet__c?: ScalarValue<boolean>;
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
  const firstName = node.FirstName?.value ?? '';
  const lastName = node.LastName?.value ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    id: node.Id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName || node.Email?.value || 'Unnamed Contact',
    email: node.Email?.value ?? undefined,
    phone: node.Phone?.value ?? undefined,
    accountId: node.AccountId?.value ?? undefined,
    accountName: node.Account?.Name?.value ?? undefined,
    freigeschaltet: node.Freigeschaltet__c?.value ?? false,
  };
}

/**
 * Nur freigeschaltete Kontakte.
 *
 * Der Filter sitzt in `ListContacts.graphql` auf `Freigeschaltet__c: { eq: true }`
 * und damit serverseitig: ein Kontakt ohne Haken wird nie uebertragen, also auch
 * nicht kurzzeitig im Browser sichtbar. `eq: false` waere die falsche Richtung —
 * die orgweite Zahl der Kontakte steht im Setup unter Kontakte.
 */
export async function listContacts(): Promise<Contact[]> {
  const data = await executeGraphQL<ContactsResponse>(LIST_CONTACTS);
  const edges = data.uiapi?.query?.Contact?.edges ?? [];
  return edges
    .map(edge => edge?.node)
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
  if (needle === '') return contacts;

  return contacts.filter(contact =>
    [contact.name, contact.email, contact.accountName]
      .filter((value): value is string => Boolean(value))
      .some(value => value.toLowerCase().includes(needle))
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  const data = await executeGraphQL<ContactsResponse, { id: string }>(
    GET_CONTACT,
    { id }
  );
  const node = data.uiapi?.query?.Contact?.edges?.[0]?.node ?? null;
  return node ? mapContact(node) : null;
}

/** A contact's participant role, if it has one (ADR-001: at most one). */
export interface ParticipantLink {
  id: string;
  name: string;
  status?: string;
}

interface ParticipantLinkNode {
  Id: string;
  Name?: ScalarValue<string>;
  Status__c?: ScalarValue<string>;
  Contact__c?: ScalarValue<string>;
}

/**
 * Contact id -> participant, for every participant that has a contact.
 *
 * A contact missing from the map has no participant, which is what drives the
 * action area: "Als Teilnehmer anlegen" versus "Teilnehmer öffnen".
 */
export async function listParticipantLinks(): Promise<
  Map<string, ParticipantLink>
> {
  const data = await executeGraphQL<{
    uiapi?: {
      query?: {
        Participant__c?: {
          edges?: Array<{ node?: ParticipantLinkNode | null } | null> | null;
        } | null;
      } | null;
    } | null;
  }>(LIST_CONTACT_PARTICIPANT_LINKS);

  const edges = data.uiapi?.query?.Participant__c?.edges ?? [];
  const links = new Map<string, ParticipantLink>();
  for (const edge of edges) {
    const node = edge?.node;
    const contactId = node?.Contact__c?.value;
    if (!node || !contactId) continue;
    links.set(contactId, {
      id: node.Id,
      name: node.Name?.value ?? 'Unnamed Participant',
      status: node.Status__c?.value ?? undefined,
    });
  }
  return links;
}
