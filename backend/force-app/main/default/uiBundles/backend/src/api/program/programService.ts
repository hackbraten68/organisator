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
  ProgramWeek,
  ProgramWeekInput,
  ProgramStatus,
} from "@/types/program";
import { executeGraphQL } from "../graphqlClient";
import { listCoaches } from "../coach/coachService";
import { generateUUID } from "../audit/auditService";
import {
  recordLearningPathItemCreated,
  recordLearningPathItemDeleted,
  recordLearningPathModuleDeleted,
  recordLearningPathItemReordered,
  recordLearningPathItemUpdated,
} from "../audit/learningPathAuditIntegration";
import { getAuditActor } from "../audit/actorContext";
import GET_PROGRAMS from "./query/GetPrograms.graphql?raw";
import GET_PROGRAM from "./query/GetProgram.graphql?raw";
import PROGRAM_COUNTS from "./query/ProgramCounts.graphql?raw";
import CREATE_PROGRAM from "./query/CreateProgram.graphql?raw";
import UPDATE_PROGRAM from "./query/UpdateProgram.graphql?raw";
import MODULES_BY_PROGRAM from "./query/ModulesByProgram.graphql?raw";
import PROGRAM_WEEKS_BY_PROGRAM from "./query/ProgramWeeksByProgram.graphql?raw";
import PROGRAM_WEEK_BY_ID from "./query/ProgramWeekById.graphql?raw";
import CREATE_PROGRAM_WEEK from "./query/CreateProgramWeek.graphql?raw";
import UPDATE_PROGRAM_WEEK from "./query/UpdateProgramWeek.graphql?raw";
import DELETE_PROGRAM_WEEK from "./query/DeleteProgramWeek.graphql?raw";
import MODULE_BY_ID from "./query/ModuleById.graphql?raw";
import LIST_PROGRAM_COACHES from "./query/ListProgramCoaches.graphql?raw";
import ASSIGN_PROGRAM_COACH from "./query/AssignProgramCoach.graphql?raw";
import UNASSIGN_PROGRAM_COACH from "./query/UnassignProgramCoach.graphql?raw";
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

interface ProgramCoachesResponse {
  uiapi?: {
    query?: {
      ProgramCoach__c?: {
        edges?: Array<{
          node?: {
            Id: string;
            Coach_Profile__c?: { value?: string | null } | null;
          } | null;
        } | null> | null;
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

async function resolveCoachProfileIds(programId: string): Promise<string[]> {
  const data = await executeGraphQL<ProgramCoachesResponse, { programId: string }>(
    LIST_PROGRAM_COACHES,
    { programId },
  );
  const edges = data.uiapi?.query?.ProgramCoach__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node?.Coach_Profile__c?.value ?? null)
    .filter((id): id is string => id != null);
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
        await resolveCoachProfileIds(node.Id),
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
    await resolveCoachProfileIds(node.Id),
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
  Module__c?: ScalarValue<string>;
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
  // Snapshot BEFORE the mutation: afterwards the module may be gone, and the
  // snapshot is what makes an accidental deletion recoverable by hand.
  const snapshot = await getModuleById(id);

  await executeGraphQL<MutationResponse, { id: string }>(DELETE_MODULE, {
    id,
  });

  if (snapshot) {
    try {
      await recordLearningPathModuleDeleted(
        {
          id: snapshot.id,
          programId: snapshot.programId,
          name: snapshot.name,
          order: snapshot.order,
        },
        { actor: getAuditActor() },
      );
    } catch (err) {
      logAuditFailure("learning_path.module_deleted", id, err);
    }
  }
  // Order gaps after delete are harmless: lists sort by Order__c and new
  // modules use max(order) + 1.
}

// ---------------------------------------------------------------------------
// Program weeks (per-program course weeks)
// ---------------------------------------------------------------------------

interface ProgramWeekNode {
  Id: string;
  Name?: ScalarValue<string>;
  Number__c?: ScalarValue<number>;
  Description__c?: ScalarValue<string>;
  Status__c?: ScalarValue<string>;
  Module__c?: ScalarValue<string>;
  Program__c?: ScalarValue<string>;
}

interface ProgramWeeksResponse {
  uiapi?: {
    query?: {
      ProgramWeek__c?: {
        edges?: Array<{ node?: ProgramWeekNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

function mapProgramWeek(node: ProgramWeekNode): ProgramWeek {
  return {
    id: node.Id,
    programId: node.Program__c?.value ?? "",
    moduleId: node.Module__c?.value ?? "",
    name: node.Name?.value ?? "Untitled Week",
    number: node.Number__c?.value != null ? Math.round(node.Number__c.value) : 0,
    status: node.Status__c?.value ?? "Draft",
    description: node.Description__c?.value ?? undefined,
  };
}

export async function listProgramWeeks(programId: string): Promise<ProgramWeek[]> {
  const data = await executeGraphQL<ProgramWeeksResponse, { programId: string }>(
    PROGRAM_WEEKS_BY_PROGRAM,
    { programId },
  );
  const edges = data.uiapi?.query?.ProgramWeek__c?.edges ?? [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is ProgramWeekNode => node != null)
    .map(mapProgramWeek);
}

export async function createProgramWeek(
  programId: string,
  input: ProgramWeekInput,
): Promise<ProgramWeek> {
  const data = await executeGraphQL<
    MutationResponse,
    {
      programId: string;
      moduleId: string;
      name: string;
      number: number;
      status?: string | null;
      description?: string | null;
    }
  >(CREATE_PROGRAM_WEEK, {
    programId,
    moduleId: input.moduleId,
    name: input.name.trim(),
    number: input.number,
    status: input.status,
    description: input.description?.trim() || null,
  });
  const id = (Object.values(data.uiapi ?? {})[0]?.Record?.Id ?? null) as
    | string
    | null;
  if (!id) throw new Error("Program week creation returned no record Id.");
  const created = await getProgramWeekById(id);
  if (!created) throw new Error("Created program week could not be reloaded.");
  return created;
}

async function getProgramWeekById(id: string): Promise<ProgramWeek | null> {
  const data = await executeGraphQL<ProgramWeeksResponse, { id: string }>(
    PROGRAM_WEEK_BY_ID,
    { id },
  );
  const node = data.uiapi?.query?.ProgramWeek__c?.edges?.[0]?.node ?? null;
  return node ? mapProgramWeek(node) : null;
}

export async function updateProgramWeek(
  id: string,
  patch: Partial<ProgramWeekInput>,
): Promise<ProgramWeek | null> {
  await executeGraphQL<
    MutationResponse,
    {
      id: string;
      name?: string;
      number?: number | null;
      status?: string | null;
      description?: string | null;
      moduleId?: string | null;
    }
  >(UPDATE_PROGRAM_WEEK, {
    id,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.number !== undefined ? { number: patch.number } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description.trim() || null }
      : {}),
    ...(patch.moduleId !== undefined ? { moduleId: patch.moduleId } : {}),
  });
  return getProgramWeekById(id);
}

export async function deleteProgramWeek(id: string): Promise<void> {
  await executeGraphQL<MutationResponse, { id: string }>(DELETE_PROGRAM_WEEK, {
    id,
  });
}

export async function reorderProgramWeeks(
  programId: string,
  orderedIds: string[],
): Promise<ProgramWeek[]> {
  for (const [index, id] of orderedIds.entries()) {
    await executeGraphQL<
      MutationResponse,
      { id: string; number?: number | null }
    >(UPDATE_PROGRAM_WEEK, { id, number: index + 1 });
  }
  return listProgramWeeks(programId);
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

export async function listProgramCoaches(
  programId: string,
): Promise<ProgramCoachSummary[]> {
  const data = await executeGraphQL<ProgramCoachesResponse, { programId: string }>(
    LIST_PROGRAM_COACHES,
    { programId },
  );
  const edges = data.uiapi?.query?.ProgramCoach__c?.edges ?? [];
  const assignedProfileIds = edges
    .map((edge) => edge?.node?.Coach_Profile__c?.value)
    .filter((id): id is string => id != null);

  const coaches = await listCoaches();
  return coaches
    .filter((coach) => assignedProfileIds.includes(coach.id))
    .map((coach) => ({ ...coach }));
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
  // coachId is a Coach_Profile__c.Id (see Program.coachIds).
  await executeGraphQL<MutationResponse, { programId: string; coachProfileId: string }>(
    ASSIGN_PROGRAM_COACH,
    { programId, coachProfileId: coachId },
  );
}

export async function unassignCoach(
  programId: string,
  coachId: string,
): Promise<void> {
  // Resolve the junction row id first.
  const data = await executeGraphQL<ProgramCoachesResponse, { programId: string }>(
    LIST_PROGRAM_COACHES,
    { programId },
  );
  const edges = data.uiapi?.query?.ProgramCoach__c?.edges ?? [];
  const row = edges.find((edge) => edge?.node?.Coach_Profile__c?.value === coachId);
  const rowId = row?.node?.Id;
  if (!rowId) return;
  await executeGraphQL<MutationResponse, { id: string }>(UNASSIGN_PROGRAM_COACH, { id: rowId });
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
  Module__c?: ScalarValue<string>;
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

/**
 * Pure progress computation over already loaded items: one fetch serves both
 * roadmap and progress (avoids a second Learning_Path__c query per
 * participant, e.g. in ProgramParticipantsTab).
 */
export function computeLearningPathProgress(
  items: LearningPathItem[],
): LearningPathProgress {
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

export async function getLearningPathProgress(
  participantId: string,
): Promise<LearningPathProgress> {
  const items = await listLearningPath(participantId);
  return computeLearningPathProgress(items);
}

export async function getLearningPathWeeks(
  participantId: string,
): Promise<number> {
  const items = await listLearningPath(participantId);
  return items.reduce((sum, item) => sum + (item.estimatedWeeks ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Learning path audit: side process per ADR-14. Events are recorded
// best-effort AFTER the confirmed mutation and never block it. The actor is
// the resolved session actor (SYSTEM until resolution, see actorContext).
// TODO: outbox/retry so sustained audit outages stay visible/replayable.

function logAuditFailure(eventType: string, subjectId: string, err: unknown) {
  // IDs only, never payloads: audit failures must not leak PII into logs.
  console.error(`Failed to write audit event ${eventType} for ${subjectId}`, err);
}

export async function addLearningPathItem(  participantId: string,
  programId: string,
  input: LearningPathItemInput,
  /**
   * `audit: false` unterdrueckt das `learning_path.item_created`-Ereignis.
   *
   * Nur die Wiederherstellung aus dem Audit-Protokoll braucht das: sie
   * schreibt stattdessen `learning_path.item_restored` mit der correlationId
   * des Loeschungsereignisses. Ohne die Unterdrueckung stuenden in der
   * Timeline zwei neue Zeilen fuer einen Klick — einmal "erstellt", einmal
   * "wiederhergestellt" — und die Timeline koennte nicht mehr unterscheiden,
   * welche davon welche ist.
   */
  options: { audit?: boolean } = {},
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
      moduleId?: string | null;
    }
  >(CREATE_LEARNING_PATH_ITEM, {
    participantId,
    programId,
    title: input.title.trim(),
    order: maxOrder + 1,
    status: input.status,
    estimatedWeeks: input.estimatedWeeks ?? null,
    moduleId: input.moduleId ?? null,
  });
  const id = (Object.values(data.uiapi ?? {})[0]?.Record?.Id ?? null) as
    | string
    | null;
  if (!id) throw new Error("Learning path item creation returned no Id.");
  const created = await getLearningPathItemById(id);
  if (!created) throw new Error("Created learning path item not found.");

  // Audit is a side process (ADR-14): best-effort after the confirmed
  // read-back, never blocking the mutation.
  if (options.audit !== false) {
    try {
      await recordLearningPathItemCreated(created, { actor: getAuditActor() });
    } catch (err) {
      logAuditFailure("learning_path.item_created", created.id, err);
    }
  }
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
      moduleId?: string | null;
    }
  >(UPDATE_LEARNING_PATH_ITEM, {
    id,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.estimatedWeeks !== undefined
      ? { estimatedWeeks: patch.estimatedWeeks }
      : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.moduleId !== undefined ? { moduleId: patch.moduleId } : {}),
  });

  const saved = await getLearningPathItemById(id);

  // Audit only when the patch carried a fachliche Änderung: the integration
  // throws on no-op diffs, which is expected, not an error worth logging.
  if (saved) {
    try {
      await recordLearningPathItemUpdated(existing, saved, {
        actor: getAuditActor(),
      });
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("No fields changed")
      ) {
        // no-op
      } else {
        logAuditFailure("learning_path.item_updated", id, err);
      }
    }
  }

  return saved;
}

export async function deleteLearningPathItem(id: string): Promise<void> {
  // Snapshot BEFORE the mutation: afterwards the item may be gone.
  const snapshot = await getLearningPathItemById(id);

  await executeGraphQL<MutationResponse, { id: string }>(
    DELETE_LEARNING_PATH_ITEM,
    { id },
  );

  if (snapshot) {
    try {
      await recordLearningPathItemDeleted(
        {
          id: snapshot.id,
          participantId: snapshot.participantId,
          programId: snapshot.programId,
          title: snapshot.title,
          order: snapshot.order,
          estimatedWeeks: snapshot.estimatedWeeks,
          status: snapshot.status,
        },
        { actor: getAuditActor() },
      );
    } catch (err) {
      logAuditFailure("learning_path.item_deleted", id, err);
    }
  }
  // Order gaps after delete are harmless: lists sort by Order__c and new
  // items use max(order) + 1.
}

/**
 * Reorder learning-path items. The caller passes the fachlich moved item;
 * exactly ONE `learning_path.item_reordered` is recorded for it, no matter
 * how many technical position updates run underneath. All updates share one
 * correlationId. Same position = no fachliche Änderung = no event.
 */
export async function reorderLearningPathItems(
  participantId: string,
  orderedIds: string[],
  movedId: string,
): Promise<LearningPathItem[]> {
  const before = await listLearningPath(participantId);
  const previousPosition = before.find((item) => item.id === movedId)?.order;

  const correlationId = generateUUID();
  for (const [index, id] of orderedIds.entries()) {
    await executeGraphQL<
      MutationResponse,
      { id: string; order?: number | null }
    >(UPDATE_LEARNING_PATH_ITEM, { id, order: index + 1 });
  }
  const after = await listLearningPath(participantId);
  const moved = after.find((item) => item.id === movedId);

  if (moved && previousPosition !== undefined && moved.order !== previousPosition) {
    try {
      await recordLearningPathItemReordered(
        {
          itemId: moved.id,
          participantId: moved.participantId,
          programId: moved.programId,
          title: moved.title,
          previousPosition,
          newPosition: moved.order,
        },
        { actor: getAuditActor(), correlationId },
      );
    } catch (err) {
      logAuditFailure("learning_path.item_reordered", movedId, err);
    }
  }

  return after;
}
