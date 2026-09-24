/**
 * Coach data access (live Salesforce data via uiapi GraphQL).
 */
import { executeGraphQL } from "../graphqlClient";
import type { ProgramCoachSummary } from "@/types/program";
import LIST_COACHES from "./query/ListCoaches.graphql?raw";

interface CoachNode {
  Id: string;
  Name?: { value?: string | null } | null;
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
    }));
}
