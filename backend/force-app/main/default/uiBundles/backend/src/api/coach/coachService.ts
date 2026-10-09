/**
 * Coach data access (live Salesforce data via uiapi GraphQL).
 *
 * `User__c` verknuepft das Profil mit dem Salesforce-Login. Es ist optional, und
 * das ist der Normalfall, kein Fehlerfall: Ghaith Saidani hat ein Profil ohne
 * Account, und ohne eigenes Contact-Datum hatte das Profil ueberhaupt keinen
 * zweiten Anker — die Zuordnung lief nur ueber den Namen. Ein leeres Feld heisst
 * also "kein Login bekannt", nicht "unbekannter Coach".
 *
 * Zu unterscheiden von `Appointment__c.Coach__c`, das auf User zeigt und nicht
 * auf Coach_Profile__c (siehe src/api/user/userService.ts). Der Termin-Picker
 * nutzt deshalb weiterhin User-Ids, nicht Coach-Profile__c-Ids.
 */
import { executeGraphQL } from "../graphqlClient";
import type { ProgramCoachSummary } from "@/types/program";
import LIST_COACHES from "./query/ListCoaches.graphql?raw";

interface CoachNode {
  Id: string;
  Name?: { value?: string | null } | null;
  User__c?: { value?: string | null } | null;
}

interface CoachesResponse {
  uiapi?: {
    query?: {
      Coach_Profile__c?: {
        edges?: Array<{ node?: CoachNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

export async function listCoaches(): Promise<ProgramCoachSummary[]> {
  const data = await executeGraphQL<CoachesResponse>(LIST_COACHES);
  const edges = data.uiapi?.query?.Coach_Profile__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is CoachNode => node != null)
    .map((node) => ({
      id: node.Id,
      name: node.Name?.value ?? "Unnamed Coach",
      userId: node.User__c?.value ?? undefined,
    }));
}
