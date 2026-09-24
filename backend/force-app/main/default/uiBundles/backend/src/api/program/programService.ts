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
  LearningPathProgress,
  Program,
  ProgramCoachSummary,
  ProgramInput,
  ProgramModule,
  ProgramModuleInput,
  ProgramParticipantSummary,
} from "@/types/program";

export interface ProgramWithCounts extends Program {
  participantCount: number;
  coachCount: number;
  moduleCount: number;
}

interface SeedParticipant extends ProgramParticipantSummary {
  status: string;
  email: string;
  github: string;
  discord: string;
}

// ---------------------------------------------------------------------------
// Mock store (module-level, replaced by GraphQL later)
// ---------------------------------------------------------------------------

let programs: Program[] = [
  {
    id: "p1",
    name: "IT Pro",
    description: "DevOps and Cloud Engineer Program",
    durationWeeks: 24,
    status: "Active",
    coachIds: ["c1"],
  },
  {
    id: "p2",
    name: "Cloud Engineer",
    description: "Cloud infrastructure and platform engineering",
    durationWeeks: 18,
    status: "Active",
    coachIds: ["c2"],
  },
  {
    id: "p3",
    name: "DevOps Engineer",
    description: "CI/CD, automation and release engineering",
    durationWeeks: 12,
    status: "Draft",
    coachIds: [],
  },
];

let modules: ProgramModule[] = [
  { id: "m1", programId: "p1", name: "IT Fundamentals", order: 1, description: "Hardware, operating systems and troubleshooting basics" },
  { id: "m2", programId: "p1", name: "Windows Administration", order: 2, description: "Windows Server setup, users and group policies" },
  { id: "m3", programId: "p1", name: "Linux Administration", order: 3, description: "Shell, services and permissions on Linux" },
  { id: "m4", programId: "p1", name: "Networking", order: 4, description: "TCP/IP, DNS, DHCP and routing fundamentals" },
  { id: "m5", programId: "p1", name: "Azure Fundamentals", order: 5, description: "Core Azure services, identity and governance" },
  { id: "m6", programId: "p2", name: "Cloud Basics", order: 1, description: "Cloud concepts and shared responsibility" },
  { id: "m7", programId: "p2", name: "Infrastructure as Code", order: 2, description: "Terraform and Bicep essentials" },
];

let participants: SeedParticipant[] = [
  { id: "1", name: "Max Mustermann", programId: "p1", status: "Onboarding", email: "max@example.com", github: "maxmustermann", discord: "max#1234" },
  { id: "2", name: "Lisa Müller", programId: "p2", status: "Active", email: "lisa@example.com", github: "lisam", discord: "lisa#4321" },
  { id: "3", name: "Tom Schmidt", programId: undefined, status: "Onboarding", email: "tom@example.com", github: "tomschmidt", discord: "tom#9876" },
];

const coaches: ProgramCoachSummary[] = [
  { id: "c1", name: "Sam Dillenburg" },
  { id: "c2", name: "Sandra Krüger" },
  { id: "c3", name: "Ghaith Saidani" },
  { id: "c4", name: "Frank Blum" },
];

// Participant-specific curricula. A Program defines duration and framework;
// the actual learning path is assembled per participant and may differ
// significantly between participants of the same program.
let learningPathItems: LearningPathItem[] = [
  { id: "lp1", participantId: "1", programId: "p1", title: "CLP", order: 1, estimatedWeeks: 6, status: "Completed" },
  { id: "lp2", participantId: "1", programId: "p1", title: "AWS SAA", order: 2, estimatedWeeks: 8, status: "In Progress" },
  { id: "lp3", participantId: "1", programId: "p1", title: "KCNA", order: 3, estimatedWeeks: 10, status: "Planned" },
  { id: "lp4", participantId: "2", programId: "p2", title: "CLP", order: 1, estimatedWeeks: 6, status: "Completed" },
  { id: "lp5", participantId: "2", programId: "p2", title: "AZ-104", order: 2, estimatedWeeks: 8, status: "In Progress" },
  { id: "lp6", participantId: "2", programId: "p2", title: "Terraform Associate", order: 3, estimatedWeeks: 4, status: "Planned" },
];

function nextModuleOrder(programId: string): number {
  const orders = modules
    .filter((m) => m.programId === programId)
    .map((m) => m.order);
  return orders.length === 0 ? 1 : Math.max(...orders) + 1;
}

function renumber(programId: string): void {
  modules
    .filter((m) => m.programId === programId)
    .sort((a, b) => a.order - b.order)
    .forEach((m, index) => {
      m.order = index + 1;
    });
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function listPrograms(): Promise<Program[]> {
  return programs.map((p) => ({ ...p, coachIds: [...p.coachIds] }));
}

export async function listProgramsWithCounts(): Promise<ProgramWithCounts[]> {
  return programs.map((p) => ({
    ...p,
    coachIds: [...p.coachIds],
    participantCount: participants.filter((pt) => pt.programId === p.id).length,
    coachCount: p.coachIds.length,
    moduleCount: modules.filter((m) => m.programId === p.id).length,
  }));
}

export async function getProgram(id: string): Promise<Program | null> {
  const program = programs.find((p) => p.id === id);
  return program ? { ...program, coachIds: [...program.coachIds] } : null;
}

export async function createProgram(input: ProgramInput): Promise<Program> {
  const program: Program = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    durationWeeks: input.durationWeeks,
    status: input.status,
    coachIds: [],
  };
  programs = [...programs, program];
  return { ...program, coachIds: [] };
}

export async function updateProgram(
  id: string,
  patch: Partial<ProgramInput>,
): Promise<Program | null> {
  const index = programs.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const current = programs[index];
  const updated: Program = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    description:
      patch.description !== undefined
        ? patch.description.trim() || undefined
        : current.description,
    durationWeeks:
      patch.durationWeeks !== undefined
        ? patch.durationWeeks
        : current.durationWeeks,
    status: patch.status ?? current.status,
    coachIds: [...current.coachIds],
  };
  programs = programs.map((p) => (p.id === id ? updated : p));
  return { ...updated, coachIds: [...updated.coachIds] };
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export async function listModules(programId: string): Promise<ProgramModule[]> {
  return modules
    .filter((m) => m.programId === programId)
    .sort((a, b) => a.order - b.order)
    .map((m) => ({ ...m }));
}

export async function createModule(
  programId: string,
  input: ProgramModuleInput,
): Promise<ProgramModule> {
  const module: ProgramModule = {
    id: crypto.randomUUID(),
    programId,
    name: input.name.trim(),
    order: nextModuleOrder(programId),
    description: input.description?.trim() || undefined,
  };
  modules = [...modules, module];
  return { ...module };
}

export async function updateModule(
  id: string,
  patch: Partial<ProgramModuleInput>,
): Promise<ProgramModule | null> {
  const existing = modules.find((m) => m.id === id);
  if (!existing) return null;
  const updated: ProgramModule = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    description:
      patch.description !== undefined
        ? patch.description.trim() || undefined
        : existing.description,
  };
  modules = modules.map((m) => (m.id === id ? updated : m));
  return { ...updated };
}

export async function deleteModule(id: string): Promise<void> {
  const target = modules.find((m) => m.id === id);
  modules = modules.filter((m) => m.id !== id);
  if (target) renumber(target.programId);
}

export async function reorderModules(
  programId: string,
  orderedIds: string[],
): Promise<ProgramModule[]> {
  const byId = new Map(modules.map((m) => [m.id, m]));
  orderedIds.forEach((id, index) => {
    const module = byId.get(id);
    if (module && module.programId === programId) {
      module.order = index + 1;
    }
  });
  renumber(programId);
  return listModules(programId);
}

// ---------------------------------------------------------------------------
// Participant assignment (via Participant__c.Program__c lookup)
// ---------------------------------------------------------------------------

export async function listProgramParticipants(
  programId: string,
): Promise<ProgramParticipantSummary[]> {
  return participants
    .filter((p) => p.programId === programId)
    .map(({ id, name, programId: pid }) => ({ id, name, programId: pid }));
}

export async function searchParticipants(
  query: string,
): Promise<ProgramParticipantSummary[]> {
  const needle = query.trim().toLowerCase();
  return participants
    .filter(
      (p) => needle === "" || p.name.toLowerCase().includes(needle),
    )
    .map(({ id, name, programId }) => ({ id, name, programId }));
}

export async function assignParticipant(
  participantId: string,
  programId: string,
): Promise<void> {
  participants = participants.map((p) =>
    p.id === participantId ? { ...p, programId } : p,
  );
}

export async function unassignParticipant(
  participantId: string,
): Promise<void> {
  participants = participants.map((p) =>
    p.id === participantId ? { ...p, programId: undefined } : p,
  );
}

// ---------------------------------------------------------------------------
// Coach assignment
// ---------------------------------------------------------------------------

export async function listProgramCoaches(
  programId: string,
): Promise<ProgramCoachSummary[]> {
  const program = programs.find((p) => p.id === programId);
  if (!program) return [];
  return program.coachIds
    .map((id) => coaches.find((c) => c.id === id))
    .filter((c): c is ProgramCoachSummary => c !== undefined)
    .map((c) => ({ ...c }));
}

export async function listAvailableCoaches(
  programId: string,
): Promise<ProgramCoachSummary[]> {
  const program = programs.find((p) => p.id === programId);
  const assigned = new Set(program?.coachIds ?? []);
  return coaches
    .filter((c) => !assigned.has(c.id))
    .map((c) => ({ ...c }));
}

export async function assignCoach(
  programId: string,
  coachId: string,
): Promise<void> {
  programs = programs.map((p) =>
    p.id === programId && !p.coachIds.includes(coachId)
      ? { ...p, coachIds: [...p.coachIds, coachId] }
      : p,
  );
}

export async function unassignCoach(
  programId: string,
  coachId: string,
): Promise<void> {
  programs = programs.map((p) =>
    p.id === programId
      ? { ...p, coachIds: p.coachIds.filter((id) => id !== coachId) }
      : p,
  );
}

// ---------------------------------------------------------------------------
// Learning path (per-participant curriculum)
// ---------------------------------------------------------------------------

function nextLearningPathOrder(participantId: string): number {
  const orders = learningPathItems
    .filter((item) => item.participantId === participantId)
    .map((item) => item.order);
  return orders.length === 0 ? 1 : Math.max(...orders) + 1;
}

function renumberLearningPath(participantId: string): void {
  learningPathItems
    .filter((item) => item.participantId === participantId)
    .sort((a, b) => a.order - b.order)
    .forEach((item, index) => {
      item.order = index + 1;
    });
}

export async function listLearningPath(
  participantId: string,
): Promise<LearningPathItem[]> {
  return learningPathItems
    .filter((item) => item.participantId === participantId)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ ...item }));
}

export async function getLearningPathProgress(
  participantId: string,
): Promise<LearningPathProgress> {
  const items = learningPathItems.filter(
    (item) => item.participantId === participantId,
  );
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
  return learningPathItems
    .filter((item) => item.participantId === participantId)
    .reduce((sum, item) => sum + (item.estimatedWeeks ?? 0), 0);
}

export async function addLearningPathItem(
  participantId: string,
  programId: string,
  input: LearningPathItemInput,
): Promise<LearningPathItem> {
  const item: LearningPathItem = {
    id: crypto.randomUUID(),
    participantId,
    programId,
    title: input.title.trim(),
    order: nextLearningPathOrder(participantId),
    estimatedWeeks: input.estimatedWeeks,
    status: input.status,
  };
  learningPathItems = [...learningPathItems, item];
  return { ...item };
}

export async function updateLearningPathItem(
  id: string,
  patch: Partial<LearningPathItemInput>,
): Promise<LearningPathItem | null> {
  const existing = learningPathItems.find((item) => item.id === id);
  if (!existing) return null;
  const updated: LearningPathItem = {
    ...existing,
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    estimatedWeeks:
      patch.estimatedWeeks !== undefined
        ? patch.estimatedWeeks
        : existing.estimatedWeeks,
    status: patch.status ?? existing.status,
  };
  learningPathItems = learningPathItems.map((item) =>
    item.id === id ? updated : item,
  );
  return { ...updated };
}

export async function deleteLearningPathItem(id: string): Promise<void> {
  const target = learningPathItems.find((item) => item.id === id);
  learningPathItems = learningPathItems.filter((item) => item.id !== id);
  if (target) renumberLearningPath(target.participantId);
}

export async function reorderLearningPathItems(
  participantId: string,
  orderedIds: string[],
): Promise<LearningPathItem[]> {
  const byId = new Map(learningPathItems.map((item) => [item.id, item]));
  orderedIds.forEach((id, index) => {
    const item = byId.get(id);
    if (item && item.participantId === participantId) {
      item.order = index + 1;
    }
  });
  renumberLearningPath(participantId);
  return listLearningPath(participantId);
}
