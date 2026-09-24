/**
 * Program data access.
 *
 * Async service interface that components consume via `useAsyncData`. Today it
 * is backed by an in-memory mock store (seeded consistently with the
 * ParticipantPage mocks); when the Salesforce integration lands, only the
 * internals of these functions change to `executeGraphQL` calls — component
 * code stays untouched.
 *
 * Future mapping:
 *   Program__c        -> Program
 *   ProgramModule__c  -> ProgramModule (reusable templates, not mandatory)
 *   LearningPathItem__c -> LearningPathItem (per-participant curriculum)
 *   Participant__c.Program__c lookup -> participant assignment
 *   Program.coachIds  -> coach assignment (until a join object exists)
 */
import type {
  LearningPathItem,
  LearningPathItemInput,
  LearningPathItemStatus,
  LearningPathProgress,
  Program,
  ProgramCoachSummary,
  ProgramInput,
  ProgramModule,
  ProgramModuleInput,
  ProgramStatus,
} from "@/types/program";
import { executeGraphQL } from "../graphqlClient";
import { listCoaches } from "../coach/coachService";
import GET_PROGRAMS from "./query/GetPrograms.graphql?raw";
import GET_PROGRAM from "./query/GetProgram.graphql?raw";
import PROGRAM_COUNTS from "./query/ProgramCounts.graphql?raw";
import CREATE_PROGRAM from "./query/CreateProgram.graphql?raw";
import UPDATE_PROGRAM from "./query/UpdateProgram.graphql?raw";
import MODULES_BY_PROGRAM from "./query/ModulesByProgram.graphql?raw";
import MODULE_BY_ID from "./query/ModuleById.graphql?raw";
import CREATE_MODULE from "./query/CreateModule.graphql?raw";
import UPDATE_MODULE from "./query/UpdateModule.graphql?raw";
import DELETE_MODULE from "./query/DeleteModule.graphql?raw";
import LEARNING_PATHS_BY_PARTICIPANT from "./query/LearningPathsByParticipant.graphql?raw";
import LEARNING_PATH_BY_ID from "./query/LearningPathById.graphql?raw";
import CREATE_LEARNING_PATH_ITEM from "./query/CreateLearningPathItem.graphql?raw";
import UPDATE_LEARNING_PATH_ITEM from "./query/UpdateLearningPathItem.graphql?raw";
import DELETE_LEARNING_PATH_ITEM from "./query/DeleteLearningPathItem.graphql?raw";

export interface ProgramWithCounts extends Program {
  participantCount: number;
  coachCount: number;
  moduleCount: number;
}

// ---------------------------------------------------------------------------
// Programs (live Salesforce data via uiapi GraphQL)
// ---------------------------------------------------------------------------

type ScalarValue<T> = { value?: T | null } | null | undefined;

interface ProgramNode {
  Id: string;
  Name?: ScalarValue<string>;
  Description__c?: ScalarValue<string>;
  DurationWeeks__c?: ScalarValue<number>;
  Status__c?: ScalarValue<string>;
}

interface ProgramsResponse {
  uiapi?: {
    query?: {
      Program__c?: {
        edges?: Array<{ node?: ProgramNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface CountsResponse {
  uiapi?: {
    query?: {
      participants?: {
        edges?: Array<{
          node?: { Id: string; Program__c?: ScalarValue<string> } | null;
        } | null> | null;
      } | null;
      modules?: {
        edges?: Array<{
          node?: { Id: string; Program__c?: ScalarValue<string> } | null;
        } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface MutationResponse {
  uiapi?: Record<string, { Record?: { Id?: string } | null } | null>;
}

function toProgramStatus(value: string | null | undefined): ProgramStatus {
  if (value === "Draft" || value === "Active" || value === "Archived") {
    return value;
  }
  console.warn(`Unknown Program Status__c "${value}", falling back to Draft.`);
  return "Draft";
}

function mapProgram(node: ProgramNode, coachIds: string[]): Program {
  return {
    id: node.Id,
    name: node.Name?.value ?? "Untitled Program",
    description: node.Description__c?.value ?? undefined,
    durationWeeks:
      node.DurationWeeks__c?.value != null
        ? Math.round(node.DurationWeeks__c.value)
        : undefined,
    status: toProgramStatus(node.Status__c?.value),
    coachIds: [...coachIds],
  };
}

// Transitional program↔coach assignment: no junction object exists yet, so
// assignments live session-local, keyed by live program ID and seeded from
// known org data by program name.
const programCoachSeed: Record<string, string[]> = {};

function coachNamesFor(programId: string, programName: string): string[] {
  if (!(programId in programCoachSeed)) {
    seedCoachNames(programId, programName);
  }
  return programCoachSeed[programId];
}

function seedCoachNames(programId: string, programName: string): void {
  programCoachSeed[programId] =
    programName === "IT Pro" ? ["Sam Dillenburg"] : [];
}

async function resolveCoachIds(names: string[]): Promise<string[]> {
  const coaches = await listCoaches();
  return coaches
    .filter((coach) => names.includes(coach.name))
    .map((coach) => coach.id);
}

async function coachNameForId(id: string): Promise<string | undefined> {
  const coaches = await listCoaches();
  return coaches.find((coach) => coach.id === id)?.name;
}

export async function listPrograms(): Promise<Program[]> {
  const data = await executeGraphQL<ProgramsResponse>(GET_PROGRAMS);
  const edges = data.uiapi?.query?.Program__c?.edges ?? [];
  const nodes = edges
    .map((edge) => edge?.node)
    .filter((node): node is ProgramNode => node != null);
  return Promise.all(
    nodes.map(async (node) =>
      mapProgram(
        node,
        await resolveCoachIds(
          coachNamesFor(node.Id, node.Name?.value ?? ""),
        ),
      ),
    ),
  );
}

export async function listProgramsWithCounts(): Promise<ProgramWithCounts[]> {
  const [programsList, counts] = await Promise.all([
    listPrograms(),
    executeGraphQL<CountsResponse>(PROGRAM_COUNTS),
  ]);
  const participantLinks =
    counts.uiapi?.query?.participants?.edges ?? [];
  const moduleLinks = counts.uiapi?.query?.modules?.edges ?? [];

  const participantCountByProgram = new Map<string, number>();
  for (const edge of participantLinks) {
    const programId = edge?.node?.Program__c?.value;
    if (programId) {
      participantCountByProgram.set(
        programId,
        (participantCountByProgram.get(programId) ?? 0) + 1,
      );
    }
  }
  const moduleCountByProgram = new Map<string, number>();
  for (const edge of moduleLinks) {
    const programId = edge?.node?.Program__c?.value;
    if (programId) {
      moduleCountByProgram.set(
        programId,
        (moduleCountByProgram.get(programId) ?? 0) + 1,
      );
    }
  }

  return programsList.map((program) => ({
    ...program,
    participantCount: participantCountByProgram.get(program.id) ?? 0,
    coachCount: program.coachIds.length,
    moduleCount: moduleCountByProgram.get(program.id) ?? 0,
  }));
}

export async function getProgram(id: string): Promise<Program | null> {
  const data = await executeGraphQL<ProgramsResponse, { id: string }>(
    GET_PROGRAM,
    { id },
  );
  const node = data.uiapi?.query?.Program__c?.edges?.[0]?.node ?? null;
  if (!node) return null;
  return mapProgram(
    node,
    await resolveCoachIds(coachNamesFor(node.Id, node.Name?.value ?? "")),
  );
}

export async function createProgram(input: ProgramInput): Promise<Program> {
  const data = await executeGraphQL<
    MutationResponse,
    {
      name: string;
      description?: string | null;
      durationWeeks?: number | null;
      status: string;
    }
  >(CREATE_PROGRAM, {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    durationWeeks: input.durationWeeks ?? null,
    status: input.status,
  });
  const id = (Object.values(data.uiapi ?? {})[0]?.Record?.Id ?? null) as
    | string
    | null;
  if (!id) throw new Error("Program creation returned no record Id.");
  const created = await getProgram(id);
  if (!created) throw new Error("Created program could not be reloaded.");
  return created;
}

export async function updateProgram(
  id: string,
  patch: Partial<ProgramInput>,
): Promise<Program | null> {
  const existing = await getProgram(id);
  if (!existing) return null;

  await executeGraphQL<
    MutationResponse,
    {
      id: string;
      name?: string;
      description?: string | null;
      durationWeeks?: number | null;
      status?: string;
    }
  >(UPDATE_PROGRAM, {
    id,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description.trim() || null }
      : {}),
    ...(patch.durationWeeks !== undefined
      ? { durationWeeks: patch.durationWeeks }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  });

  return getProgram(id);
}

// ---------------------------------------------------------------------------
// Modules (live Salesforce data via uiapi GraphQL)
// ---------------------------------------------------------------------------

interface ModuleNode {
  Id: string;
  Name?: ScalarValue<string>;
  Order__c?: ScalarValue<number>;
  Description__c?: ScalarValue<string>;
  Program__c?: ScalarValue<string>;
}

interface ModulesResponse {
  uiapi?: {
    query?: {
      Module__c?: {
        edges?: Array<{ node?: ModuleNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

function mapModule(node: ModuleNode): ProgramModule {
  return {
    id: node.Id,
    programId: node.Program__c?.value ?? "",
    name: node.Name?.value ?? "Untitled Module",
    order:
      node.Order__c?.value != null ? Math.round(node.Order__c.value) : 0,
    description: node.Description__c?.value ?? undefined,
  };
}

export async function listModules(programId: string): Promise<ProgramModule[]> {
  const data = await executeGraphQL<ModulesResponse, { programId: string }>(
    MODULES_BY_PROGRAM,
    { programId },
  );
  const edges = data.uiapi?.query?.Module__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is ModuleNode => node != null)
    .map(mapModule);
}

async function getModuleById(id: string): Promise<ProgramModule | null> {
  const data = await executeGraphQL<ModulesResponse, { id: string }>(
    MODULE_BY_ID,
    { id },
  );
  const node = data.uiapi?.query?.Module__c?.edges?.[0]?.node ?? null;
  return node ? mapModule(node) : null;
}

export async function createModule(
  programId: string,
  input: ProgramModuleInput,
): Promise<ProgramModule> {
  const existing = await listModules(programId);
  const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), 0);
  const data = await executeGraphQL<
    MutationResponse,
    {
      programId: string;
      name: string;
      order?: number | null;
      description?: string | null;
    }
  >(CREATE_MODULE, {
    programId,
    name: input.name.trim(),
    order: maxOrder + 1,
    description: input.description?.trim() || null,
  });
  const id = (Object.values(data.uiapi ?? {})[0]?.Record?.Id ?? null) as
    | string
    | null;
  if (!id) throw new Error("Module creation returned no record Id.");
  const created = await getModuleById(id);
  if (!created) throw new Error("Created module could not be reloaded.");
  return created;
}

export async function updateModule(
  id: string,
  patch: Partial<ProgramModuleInput>,
): Promise<ProgramModule | null> {
  const existing = await getModuleById(id);
  if (!existing) return null;

  await executeGraphQL<
    MutationResponse,
    {
      id: string;
      name?: string;
      description?: string | null;
    }
  >(UPDATE_MODULE, {
    id,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description.trim() || null }
      : {}),
  });

  return getModuleById(id);
}

export async function deleteModule(id: string): Promise<void> {
  await executeGraphQL<MutationResponse, { id: string }>(DELETE_MODULE, {
    id,
  });
  // Order gaps after delete are harmless: lists sort by Order__c and new
  // modules use max(order) + 1.
}

export async function reorderModules(
  programId: string,
  orderedIds: string[],
): Promise<ProgramModule[]> {
  for (const [index, id] of orderedIds.entries()) {
    await executeGraphQL<
      MutationResponse,
      { id: string; order?: number | null }
    >(UPDATE_MODULE, { id, order: index + 1 });
  }
  return listModules(programId);
}

// ---------------------------------------------------------------------------
// Coach assignment (transitional session-local overlay; participant
// assignment moved to participantService)
// ---------------------------------------------------------------------------

async function coachesForNames(
  names: string[],
): Promise<ProgramCoachSummary[]> {
  const coaches = await listCoaches();
  return coaches
    .filter((coach) => names.includes(coach.name))
    .map((coach) => ({ ...coach }));
}

export async function listProgramCoaches(
  programId: string,
): Promise<ProgramCoachSummary[]> {
  const program = await getProgram(programId);
  if (!program) return [];
  return coachesForNames(coachNamesFor(programId, program.name));
}

export async function listAvailableCoaches(
  programId: string,
): Promise<ProgramCoachSummary[]> {
  const [assigned, coaches] = await Promise.all([
    listProgramCoaches(programId),
    listCoaches(),
  ]);
  const assignedIds = new Set(assigned.map((coach) => coach.id));
  return coaches
    .filter((coach) => !assignedIds.has(coach.id))
    .map((coach) => ({ ...coach }));
}

export async function assignCoach(
  programId: string,
  coachId: string,
): Promise<void> {
  const name = await coachNameForId(coachId);
  if (!name) return;
  const program = await getProgram(programId);
  if (!program) return;
  const names = coachNamesFor(programId, program.name);
  if (!names.includes(name)) {
    programCoachSeed[programId] = [...names, name];
  }
}

export async function unassignCoach(
  programId: string,
  coachId: string,
): Promise<void> {
  const name = await coachNameForId(coachId);
  const program = await getProgram(programId);
  if (!name || !program) return;
  programCoachSeed[programId] = coachNamesFor(programId, program.name).filter(
    (entry) => entry !== name,
  );
}

// ---------------------------------------------------------------------------
// Learning path (per-participant curriculum, live Salesforce data)
// ---------------------------------------------------------------------------

interface LearningPathNode {
  Id: string;
  Title__c?: ScalarValue<string>;
  Order__c?: ScalarValue<number>;
  Status__c?: ScalarValue<string>;
  Estimated_Weeks__c?: ScalarValue<number>;
  Participant__c?: ScalarValue<string>;
  Program__c?: ScalarValue<string>;
}

interface LearningPathResponse {
  uiapi?: {
    query?: {
      Learning_Path__c?: {
        edges?: Array<{ node?: LearningPathNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

function toLearningPathStatus(
  value: string | null | undefined,
): LearningPathItemStatus {
  if (
    value === "Planned" ||
    value === "In Progress" ||
    value === "Completed"
  ) {
    return value;
  }
  console.warn(
    `Unknown Learning Path Status__c "${value}", falling back to Planned.`,
  );
  return "Planned";
}

function mapLearningPathItem(node: LearningPathNode): LearningPathItem {
  return {
    id: node.Id,
    participantId: node.Participant__c?.value ?? "",
    programId: node.Program__c?.value ?? "",
    title: node.Title__c?.value ?? "Untitled Item",
    order: node.Order__c?.value != null ? Math.round(node.Order__c.value) : 0,
    estimatedWeeks:
      node.Estimated_Weeks__c?.value != null
        ? Math.round(node.Estimated_Weeks__c.value)
        : undefined,
    status: toLearningPathStatus(node.Status__c?.value),
  };
}

export async function listLearningPath(
  participantId: string,
): Promise<LearningPathItem[]> {
  const data = await executeGraphQL<LearningPathResponse, { participantId: string }>(
    LEARNING_PATHS_BY_PARTICIPANT,
    { participantId },
  );
  const edges = data.uiapi?.query?.Learning_Path__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is LearningPathNode => node != null)
    .map(mapLearningPathItem);
}

async function getLearningPathItemById(
  id: string,
): Promise<LearningPathItem | null> {
  const data = await executeGraphQL<LearningPathResponse, { id: string }>(
    LEARNING_PATH_BY_ID,
    { id },
  );
  const node = data.uiapi?.query?.Learning_Path__c?.edges?.[0]?.node ?? null;
  return node ? mapLearningPathItem(node) : null;
}

export async function getLearningPathProgress(
  participantId: string,
): Promise<LearningPathProgress> {
  const items = await listLearningPath(participantId);
  const completed = items.filter(
    (item) => item.status === "Completed",
  ).length;
  const total = items.length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export async function getLearningPathWeeks(
  participantId: string,
): Promise<number> {
  const items = await listLearningPath(participantId);
  return items.reduce((sum, item) => sum + (item.estimatedWeeks ?? 0), 0);
}

export async function addLearningPathItem(
  participantId: string,
  programId: string,
  input: LearningPathItemInput,
): Promise<LearningPathItem> {
  const existing = await listLearningPath(participantId);
  const maxOrder = existing.reduce((max, item) => Math.max(max, item.order), 0);
  const data = await executeGraphQL<
    MutationResponse,
    {
      participantId: string;
      programId: string;
      title: string;
      order?: number | null;
      status?: string | null;
      estimatedWeeks?: number | null;
    }
  >(CREATE_LEARNING_PATH_ITEM, {
    participantId,
    programId,
    title: input.title.trim(),
    order: maxOrder + 1,
    status: input.status,
    estimatedWeeks: input.estimatedWeeks ?? null,
  });
  const id = (Object.values(data.uiapi ?? {})[0]?.Record?.Id ?? null) as
    | string
    | null;
  if (!id) throw new Error("Learning path item creation returned no Id.");
  const created = await getLearningPathItemById(id);
  if (!created) throw new Error("Created learning path item not found.");
  return created;
}

export async function updateLearningPathItem(
  id: string,
  patch: Partial<LearningPathItemInput>,
): Promise<LearningPathItem | null> {
  const existing = await getLearningPathItemById(id);
  if (!existing) return null;

  await executeGraphQL<
    MutationResponse,
    {
      id: string;
      title?: string;
      order?: number | null;
      status?: string | null;
      estimatedWeeks?: number | null;
    }
  >(UPDATE_LEARNING_PATH_ITEM, {
    id,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.estimatedWeeks !== undefined
      ? { estimatedWeeks: patch.estimatedWeeks }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  });

  return getLearningPathItemById(id);
}

export async function deleteLearningPathItem(id: string): Promise<void> {
  await executeGraphQL<MutationResponse, { id: string }>(
    DELETE_LEARNING_PATH_ITEM,
    { id },
  );
  // Order gaps after delete are harmless: lists sort by Order__c and new
  // items use max(order) + 1.
}

export async function reorderLearningPathItems(
  participantId: string,
  orderedIds: string[],
): Promise<LearningPathItem[]> {
  for (const [index, id] of orderedIds.entries()) {
    await executeGraphQL<
      MutationResponse,
      { id: string; order?: number | null }
    >(UPDATE_LEARNING_PATH_ITEM, { id, order: index + 1 });
  }
  return listLearningPath(participantId);
}
