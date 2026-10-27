import { createDataSDK } from "@salesforce/platform-sdk";
import type {
  ScheduleDetailResponse,
  ScheduleEntry,
  ScheduleListResponse,
  ScheduleOptions,
  ScheduleTemplate,
  PlanInput,
  EntryInput,
  LearningPathPlanOptions,
  CreateIndividualPlanResult,
} from "@/types/schedule";

const EDIT_PATH = "/services/apexrest/schedule-editor";

export class ScheduleEditorError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ScheduleEditorError";
    this.code = code;
    this.status = status;
  }

  get isNotAssigned(): boolean {
    return this.code === "NOT_ASSIGNED";
  }

  get isDuplicate(): boolean {
    return this.code === "DUPLICATE_COURSE_SCHEDULE" || this.code === "DUPLICATE_SLOT";
  }

  get isNotFound(): boolean {
    return this.code === "SCHEDULE_NOT_FOUND" || this.code === "ENTRY_NOT_FOUND";
  }
}

interface RawProgram {
  id?: string | null;
  name?: string | null;
}

interface RawPlan {
  id?: string | null;
  name?: string | null;
  programWeekId?: string | null;
  scopeType?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  participantGroupId?: string | null;
  participantGroupName?: string | null;
  participantId?: string | null;
  participantName?: string | null;
  appliedTemplateId?: string | null;
  templateName?: string | null;
  entryCount?: number | null;
  notes?: string | null;
  deviationReason?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  coachName?: string | null;
}

interface RawWeek {
  programWeekId?: string | null;
  weekNumber?: number | null;
  name?: string | null;
  moduleName?: string | null;
  plans?: RawPlan[] | null;
}

interface RawEntry {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  entryKind?: string | null;
  type?: string | null;
  isRequired?: boolean | null;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  targetType?: string | null;
  participantGroupId?: string | null;
  participantId?: string | null;
  coachProfileId?: string | null;
  coachName?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  order?: number | null;
  deviationReason?: string | null;
  notes?: string | null;
  isCustomized?: boolean | null;
}

interface RawCoach {
  id?: string | null;
  name?: string | null;
  role?: string | null;
}

interface RawGroup {
  id?: string | null;
  name?: string | null;
}

interface RawParticipant {
  id?: string | null;
  name?: string | null;
}

interface RawTemplate {
  id?: string | null;
  name?: string | null;
  programId?: string | null;
  programWeekId?: string | null;
  entryCount?: number | null;
  status?: string | null;
}

interface RawOptions {
  coaches?: RawCoach[] | null;
  groups?: RawGroup[] | null;
  participants?: RawParticipant[] | null;
  templates?: RawTemplate[] | null;
  entryKinds?: string[] | null;
  types?: string[] | null;
  days?: string[] | null;
  locations?: string[] | null;
  targetTypes?: string[] | null;
}

interface RawListResponse {
  success?: boolean | null;
  code?: string | null;
  message?: string | null;
  programs?: RawProgram[] | null;
  weeks?: RawWeek[] | null;
}

interface RawDetailResponse {
  success?: boolean | null;
  code?: string | null;
  message?: string | null;
  plan?: RawPlan | null;
  entries?: RawEntry[] | null;
}

interface RawOptionsResponse {
  success?: boolean | null;
  code?: string | null;
  message?: string | null;
  options?: RawOptions | null;
}

interface RawLearningPathOptions {
  learningPathId?: string | null;
  learningPathTitle?: string | null;
  participantId?: string | null;
  participantName?: string | null;
  programId?: string | null;
  programName?: string | null;
  moduleId?: string | null;
  moduleName?: string | null;
  programWeeks?: { id?: string | null; name?: string | null; weekNumber?: number | null }[] | null;
  templates?: RawTemplate[] | null;
  resolutionStatus?: string | null;
}

interface RawLearningPathOptionsResponse {
  success?: boolean | null;
  code?: string | null;
  message?: string | null;
  learningPathOptions?: RawLearningPathOptions | null;
}

interface RawMutationResponse {
  success?: boolean | null;
  code?: string | null;
  message?: string | null;
  id?: string | null;
  status?: string | null;
}

function toPlan(raw: RawPlan): ScheduleDetailResponse["plan"] {
  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    programWeekId: raw.programWeekId ?? null,
    scopeType: (raw.scopeType ?? "Course") as ScheduleDetailResponse["plan"]["scopeType"],
    status: (raw.status ?? "Draft") as ScheduleDetailResponse["plan"]["status"],
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    participantGroupId: raw.participantGroupId ?? null,
    participantGroupName: raw.participantGroupName ?? null,
    participantId: raw.participantId ?? null,
    participantName: raw.participantName ?? null,
    appliedTemplateId: raw.appliedTemplateId ?? null,
    templateName: raw.templateName ?? null,
    entryCount: raw.entryCount ?? 0,
    notes: raw.notes ?? null,
    deviationReason: raw.deviationReason ?? null,
    publishedAt: raw.publishedAt ?? null,
    publishedBy: raw.publishedBy ?? null,
    coachName: raw.coachName ?? null,
  };
}

function toEntry(raw: RawEntry): ScheduleEntry {
  return {
    id: raw.id ?? "",
    title: raw.title ?? "",
    description: raw.description ?? null,
    entryKind: (raw.entryKind ?? "Aktivität") as ScheduleEntry["entryKind"],
    type: raw.type ?? "",
    isRequired: raw.isRequired ?? false,
    dayOfWeek: raw.dayOfWeek ?? "Monday",
    startTime: raw.startTime ?? null,
    endTime: raw.endTime ?? null,
    durationMinutes: raw.durationMinutes ?? null,
    targetType: (raw.targetType ?? "Course") as ScheduleEntry["targetType"],
    participantGroupId: raw.participantGroupId ?? null,
    participantId: raw.participantId ?? null,
    coachProfileId: raw.coachProfileId ?? null,
    coachName: raw.coachName ?? null,
    location: raw.location ?? null,
    meetingLink: raw.meetingLink ?? null,
    order: raw.order ?? null,
    deviationReason: raw.deviationReason ?? null,
    notes: raw.notes ?? null,
    isCustomized: raw.isCustomized ?? false,
  };
}

function toWeek(raw: RawWeek): ScheduleListResponse["weeks"][number] {
  return {
    programWeekId: raw.programWeekId ?? "",
    weekNumber: raw.weekNumber ?? null,
    name: raw.name ?? null,
    moduleName: raw.moduleName ?? null,
    plans: (raw.plans ?? []).map(toPlan),
  };
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const sdk = await createDataSDK();
  if (!sdk.fetch) {
    throw new ScheduleEditorError("UNAVAILABLE", "Die Verbindung zum Server steht nicht zur Verfuegung.", 0);
  }
  let response: Response;
  try {
    response = await sdk.fetch(path, init);
  } catch (_error) {
    throw new ScheduleEditorError("NETWORK", "Die Anfrage konnte nicht gesendet werden.", 0);
  }
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const body = (parsed as { code?: string; message?: string } | null) ?? {};
    throw new ScheduleEditorError(
      body.code ?? "HTTP_ERROR",
      body.message ?? "Die Anfrage wurde abgelehnt.",
      response.status,
    );
  }
  return parsed as T;
}

export async function listScheduleBoard(programId?: string): Promise<ScheduleListResponse> {
  const params = new URLSearchParams();
  params.set("action", "list");
  if (programId) params.set("programId", programId);
  const raw = await request<RawListResponse>(`${EDIT_PATH}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!raw.success) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return {
    programs: (raw.programs ?? []).map((p) => ({ id: p.id ?? "", name: p.name ?? "" })),
    weeks: (raw.weeks ?? []).map(toWeek),
  };
}

export async function getSchedulePlan(planId: string): Promise<ScheduleDetailResponse> {
  const params = new URLSearchParams();
  params.set("action", "get");
  params.set("planId", planId);
  const raw = await request<RawDetailResponse>(`${EDIT_PATH}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!raw.success || !raw.plan) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return {
    plan: toPlan(raw.plan),
    entries: (raw.entries ?? []).map(toEntry),
  };
}

export async function getScheduleOptions(programId: string, planId?: string): Promise<ScheduleOptions> {
  const params = new URLSearchParams();
  params.set("action", "options");
  if (programId) params.set("programId", programId);
  if (planId) params.set("planId", planId);
  const raw = await request<RawOptionsResponse>(`${EDIT_PATH}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!raw.success || !raw.options) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  const o = raw.options;
  return {
    coaches: (o.coaches ?? []).map((c) => ({ id: c.id ?? "", name: c.name ?? "", role: c.role ?? null })),
    groups: (o.groups ?? []).map((g) => ({ id: g.id ?? "", name: g.name ?? "" })),
    participants: (o.participants ?? []).map((p) => ({ id: p.id ?? "", name: p.name ?? "" })),
    templates: (o.templates ?? []).map((t) => ({
      id: t.id ?? "",
      name: t.name ?? "",
      programId: t.programId ?? null,
      programWeekId: t.programWeekId ?? null,
      entryCount: t.entryCount ?? 0,
      status: t.status ?? null,
    })),
    entryKinds: o.entryKinds ?? [],
    types: o.types ?? [],
    days: o.days ?? [],
    locations: o.locations ?? [],
    targetTypes: o.targetTypes ?? [],
  };
}

export async function saveSchedulePlan(input: PlanInput): Promise<{ id: string; status: string }> {
  const body: Record<string, unknown> = { action: "savePlan", ...input };
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Draft" };
}

export async function saveScheduleEntry(input: EntryInput): Promise<{ id: string }> {
  const body: Record<string, unknown> = { action: "saveEntry", ...input };
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id };
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "deleteEntry", id }),
  });
  if (!raw.success) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
}

export async function deleteSchedulePlan(id: string): Promise<void> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "deletePlan", id }),
  });
  if (!raw.success) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
}

export async function publishSchedulePlan(id: string): Promise<{ id: string; status: string }> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "publish", id }),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Published" };
}

export async function unpublishSchedulePlan(id: string): Promise<{ id: string; status: string }> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "unpublish", id }),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Draft" };
}

export async function getLearningPathOptions(learningPathId: string): Promise<LearningPathPlanOptions> {
  const params = new URLSearchParams();
  params.set("action", "learningPathOptions");
  params.set("learningPathId", learningPathId);
  const raw = await request<RawLearningPathOptionsResponse>(`${EDIT_PATH}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!raw.success || !raw.learningPathOptions) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  const lpo = raw.learningPathOptions;
  return {
    learningPathId: lpo.learningPathId ?? "",
    learningPathTitle: lpo.learningPathTitle ?? null,
    participantId: lpo.participantId ?? null,
    participantName: lpo.participantName ?? null,
    programId: lpo.programId ?? null,
    programName: lpo.programName ?? null,
    moduleId: lpo.moduleId ?? null,
    moduleName: lpo.moduleName ?? null,
    programWeeks: (lpo.programWeeks ?? []).map((pw) => ({
      id: pw.id ?? "",
      name: pw.name ?? null,
      weekNumber: pw.weekNumber ?? null,
    })),
    templates: (lpo.templates ?? []).map((t) => ({
      id: t.id ?? "",
      name: t.name ?? "",
      programId: t.programId ?? null,
      programWeekId: t.programWeekId ?? null,
      entryCount: t.entryCount ?? 0,
      status: t.status ?? null,
    })),
    resolutionStatus: lpo.resolutionStatus ?? "UNKNOWN",
  };
}

export async function createIndividualPlanFromLearningPath(input: {
  learningPathId: string;
  templateId: string;
  startDate: string;
  name?: string;
  programWeekId?: string;
}): Promise<CreateIndividualPlanResult> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "createIndividualPlanFromLearningPath", ...input }),
  });
  return {
    planId: raw.id ?? "",
    created: raw.code !== "EXISTING_SCHEDULE_OPENED",
    status: raw.status ?? "Draft",
    code: raw.code ?? null,
    message: raw.message ?? null,
  };
}

export async function listScheduleTemplates(programId?: string): Promise<ScheduleTemplate[]> {
  const params = new URLSearchParams();
  params.set("action", "templates");
  if (programId) params.set("programId", programId);
  const raw = await request<{ success?: boolean; code?: string; message?: string; options?: { templates?: RawTemplate[] } }>(
    `${EDIT_PATH}?${params.toString()}`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  if (!raw.success) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return (raw.options?.templates ?? []).map((t) => ({
    id: t.id ?? "",
    name: t.name ?? "",
    programId: t.programId ?? null,
    programWeekId: t.programWeekId ?? null,
    entryCount: t.entryCount ?? 0,
    status: t.status ?? null,
  }));
}

export async function saveAsTemplate(input: {
  weeklyScheduleId: string;
  name: string;
  description?: string;
}): Promise<{ id: string; status: string }> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "saveAsTemplate", ...input }),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Active" };
}

export async function duplicateScheduleTemplate(id: string, name?: string): Promise<{ id: string; status: string }> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "duplicateTemplate", templateId: id, name }),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Active" };
}

export async function deleteScheduleTemplate(id: string): Promise<void> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "deleteTemplate", id }),
  });
  if (!raw.success) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
}

export async function getScheduleTemplate(templateId: string): Promise<{ plan: { id: string; name: string; status: string | null; notes: string | null }; entries: ScheduleEntry[] }> {
  const params = new URLSearchParams();
  params.set("action", "getTemplate");
  params.set("templateId", templateId);
  const raw = await request<RawDetailResponse>(`${EDIT_PATH}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!raw.success || !raw.plan) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return {
    plan: {
      id: raw.plan.id ?? "",
      name: raw.plan.name ?? "",
      status: raw.plan.status ?? null,
      notes: raw.plan.notes ?? null,
    },
    entries: (raw.entries ?? []).map(toEntry),
  };
}

export async function applyScheduleTemplate(input: {
  templateId: string;
  programWeekId: string;
  startDate: string;
  name?: string;
}): Promise<{ id: string; status: string }> {
  const raw = await request<RawMutationResponse>(EDIT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "applyTemplate", ...input }),
  });
  if (!raw.success || !raw.id) {
    throw new ScheduleEditorError(raw.code ?? "ERROR", raw.message ?? "Fehler", 400);
  }
  return { id: raw.id, status: raw.status ?? "Draft" };
}
