/**
 * User data access (live Salesforce data via uiapi GraphQL).
 *
 * `Appointment__c.Coach__c` is a lookup to `User` — not to `Coach_Profile__c` —
 * so the appointment picker must be fed from real `User` records. The ids of
 * the `Coach_Profile__c` records returned by `listCoaches()` are rejected by
 * Salesforce for that field.
 */
import { executeGraphQL } from "../graphqlClient";
import type { AssignableUser } from "@/types/user";
import LIST_ASSIGNABLE_USERS from "./query/ListAssignableUsers.graphql?raw";

interface UserNode {
  Id: string;
  Name?: { value?: string | null } | null;
  Username?: { value?: string | null } | null;
  UserType?: { value?: string | null } | null;
}

interface AssignableUsersResponse {
  uiapi?: {
    query?: {
      User?: {
        edges?: Array<{ node?: UserNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

/**
 * UserTypes that never represent a person a coach session can be booked with.
 * Everything else has to pass the username check below.
 */
const NON_PERSON_USER_TYPES = new Set([
  "AutomatedProcess",
  "CsnOnly",
  "CloudIntegrationUser",
  "GuestUser",
  "PowerCustomerSuccess",
  "CustomerSuccess",
]);

/**
 * System accounts that are still typed `Standard` (Security User, Integration
 * User, ...) all use an org-scoped internal address containing the 15/18-char
 * Salesforce id as their domain. Real users have a normal mail domain.
 *
 * Salesforce ids are alphanumeric, not hexadecimal — a scratch org id can
 * contain e.g. `g`, so this must not be restricted to `[0-9a-f]`.
 */
const SYSTEM_USERNAME = /@[a-z0-9]{15,18}[.@]/i;

export async function listAssignableUsers(limit = 200): Promise<AssignableUser[]> {
  const data = await executeGraphQL<AssignableUsersResponse, { limit: number }>(
    LIST_ASSIGNABLE_USERS,
    { limit }
  );
  const edges = data.uiapi?.query?.User?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is UserNode => node != null)
    .filter(
      (node) =>
        isPersonUserType(node.UserType?.value) && !isSystemUsername(node.Username?.value)
    )
    .map((node) => {
      // Salesforce liefert bei leeren Feldern `""` statt `null`. Ohne
      // Normalisierung wuerde ein User ohne Namen als leerer Eintrag im
      // Coach-Picker erscheinen.
      const name = trimmed(node.Name?.value);
      const username = trimmed(node.Username?.value);
      return {
        id: node.Id,
        name: name || username || node.Id,
        username: username || undefined,
      };
    });
}

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function isPersonUserType(userType: string | null | undefined): boolean {
  if (!userType) return false;
  return !NON_PERSON_USER_TYPES.has(userType);
}

function isSystemUsername(username: string | null | undefined): boolean {
  if (!username) return true;
  return SYSTEM_USERNAME.test(username);
}
