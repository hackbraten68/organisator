/**
 * Participant data access (live Salesforce data via uiapi GraphQL).
 *
 * Parent names (program/coach) are joined client-side from the program and
 * coach services: uiapi lookup fields expose the related record Id, not its
 * name (displayValue is null for lookups).
 */
import { executeGraphQL } from "../graphqlClient";
import { listPrograms } from "../program/programService";
import { listCoaches } from "../coach/coachService";
import type {
  Participant,
  ParticipantPatch,
} from "@/types/participant";
import type { ProgramParticipantSummary } from "@/types/program";
import LIST_PARTICIPANTS from "./query/ListParticipants.graphql?raw";
import GET_PARTICIPANT from "./query/GetParticipant.graphql?raw";
import UPDATE_PARTICIPANT from "./query/UpdateParticipant.graphql?raw";

type ScalarValue<T = string> = { value?: T | null } | null | undefined;

interface ParticipantNode {
  Id: string;
  Name?: ScalarValue<string>;
  Status__c?: ScalarValue<string>;
  Email__c?: ScalarValue<string>;
  GitHub__c?: ScalarValue<string>;
  Discord__c?: ScalarValue<string>;
  StartDate__c?: ScalarValue<string>;
  ExpectedEndDate__c?: ScalarValue<string>;
  Program__c?: ScalarValue<string>;
  Coach_Profile__c?: ScalarValue<string>;
}

interface ParticipantsResponse {
  uiapi?: {
    query?: {
      Participant__c?: {
        edges?: Array<{ node?: ParticipantNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface MutationResponse {
  uiapi?: Record<string, { Record?: { Id?: string } | null } | null>;
}

function mapParticipant(
  node: ParticipantNode,
  programNames: Map<string, string>,
  coachNames: Map<string, string>,
): Participant {
  const programId = node.Program__c?.value ?? undefined;
  const coachId = node.Coach_Profile__c?.value ?? undefined;
  return {
    id: node.Id,
    name: node.Name?.value ?? "Unnamed Participant",
    status: node.Status__c?.value ?? "Onboarding",
    email: node.Email__c?.value ?? undefined,
    github: node.GitHub__c?.value ?? undefined,
    discord: node.Discord__c?.value ?? undefined,
    startDate: node.StartDate__c?.value ?? undefined,
    expectedEndDate: node.ExpectedEndDate__c?.value ?? undefined,
    programId,
    programName: programId ? programNames.get(programId) : undefined,
    coachId,
    coachName: coachId ? coachNames.get(coachId) : undefined,
  };
}

async function nameMaps(): Promise<{
  programs: Map<string, string>;
  coaches: Map<string, string>;
}> {
  const [programs, coaches] = await Promise.all([
    listPrograms(),
    listCoaches(),
  ]);
  return {
    programs: new Map(programs.map((p) => [p.id, p.name])),
    coaches: new Map(coaches.map((c) => [c.id, c.name])),
  };
}

export async function listParticipants(): Promise<Participant[]> {
  const [data, names] = await Promise.all([
    executeGraphQL<ParticipantsResponse>(LIST_PARTICIPANTS),
    nameMaps(),
  ]);
  const edges = data.uiapi?.query?.Participant__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is ParticipantNode => node != null)
    .map((node) => mapParticipant(node, names.programs, names.coaches));
}

export async function getParticipant(id: string): Promise<Participant | null> {
  const [data, names] = await Promise.all([
    executeGraphQL<ParticipantsResponse, { id: string }>(GET_PARTICIPANT, {
      id,
    }),
    nameMaps(),
  ]);
  const node = data.uiapi?.query?.Participant__c?.edges?.[0]?.node ?? null;
  return node ? mapParticipant(node, names.programs, names.coaches) : null;
}

export async function searchParticipants(
  query: string,
): Promise<ProgramParticipantSummary[]> {
  const needle = query.trim().toLowerCase();
  const participants = await listParticipants();
  return participants
    .filter(
      (participant) =>
        needle === "" || participant.name.toLowerCase().includes(needle),
    )
    .map(({ id, name, programId }) => ({ id, name, programId }));
}

export async function listProgramParticipants(
  programId: string,
): Promise<ProgramParticipantSummary[]> {
  const participants = await listParticipants();
  return participants
    .filter((participant) => participant.programId === programId)
    .map(({ id, name, programId: pid }) => ({ id, name, programId: pid }));
}

export async function updateParticipant(
  id: string,
  patch: ParticipantPatch,
): Promise<Participant | null> {
  const existing = await getParticipant(id);
  if (!existing) return null;

  const textOrNull = (value: string | null | undefined) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  await executeGraphQL<
    MutationResponse,
    {
      id: string;
      name?: string;
      status?: string;
      email?: string | null;
      github?: string | null;
      discord?: string | null;
      startDate?: string | null;
      expectedEndDate?: string | null;
      programId?: string | null;
      coachId?: string | null;
    }
  >(UPDATE_PARTICIPANT, {
    id,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.email !== undefined ? { email: textOrNull(patch.email) } : {}),
    ...(patch.github !== undefined
      ? { github: textOrNull(patch.github) }
      : {}),
    ...(patch.discord !== undefined
      ? { discord: textOrNull(patch.discord) }
      : {}),
    ...(patch.startDate !== undefined
      ? { startDate: patch.startDate || null }
      : {}),
    ...(patch.expectedEndDate !== undefined
      ? { expectedEndDate: patch.expectedEndDate || null }
      : {}),
    ...(patch.programId !== undefined ? { programId: patch.programId } : {}),
    ...(patch.coachId !== undefined ? { coachId: patch.coachId } : {}),
  });

  return getParticipant(id);
}

export async function assignParticipant(
  participantId: string,
  programId: string,
): Promise<void> {
  await updateParticipant(participantId, { programId });
}

export async function unassignParticipant(
  participantId: string,
): Promise<void> {
  await updateParticipant(participantId, { programId: null });
}
