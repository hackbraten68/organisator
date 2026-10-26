export type ScheduleScope = 'Course' | 'Group' | 'Individual';
export type ScheduleStatus = 'Draft' | 'Published';
export type EntryKind = 'Aktivität' | 'Aufgabe';

export interface ScheduleProgram {
  id: string;
  name: string;
}

export interface SchedulePlan {
  id: string;
  name: string;
  programWeekId: string | null;
  scopeType: ScheduleScope;
  status: ScheduleStatus;
  startDate: string | null;
  endDate: string | null;
  participantGroupId: string | null;
  participantGroupName: string | null;
  participantId: string | null;
  participantName: string | null;
  appliedTemplateId: string | null;
  templateName: string | null;
  entryCount: number;
  notes: string | null;
  deviationReason: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  coachName: string | null;
}

export interface ScheduleWeek {
  programWeekId: string;
  weekNumber: number | null;
  name: string | null;
  moduleName: string | null;
  plans: SchedulePlan[];
}

export interface ScheduleEntry {
  id: string;
  title: string;
  description: string | null;
  entryKind: EntryKind;
  type: string;
  isRequired: boolean;
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  targetType: ScheduleScope;
  participantGroupId: string | null;
  participantId: string | null;
  coachProfileId: string | null;
  coachName: string | null;
  location: string | null;
  meetingLink: string | null;
  order: number | null;
  deviationReason: string | null;
  notes: string | null;
  isCustomized: boolean;
}

export interface ScheduleCoach {
  id: string;
  name: string;
  role: string | null;
}

export interface ScheduleGroup {
  id: string;
  name: string;
}

export interface ScheduleParticipant {
  id: string;
  name: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  programId: string | null;
  programWeekId: string | null;
  entryCount: number;
  status: string | null;
}

export interface ScheduleOptions {
  coaches: ScheduleCoach[];
  groups: ScheduleGroup[];
  participants: ScheduleParticipant[];
  templates: ScheduleTemplate[];
  entryKinds: string[];
  types: string[];
  days: string[];
  locations: string[];
  targetTypes: string[];
}

export interface ScheduleListResponse {
  programs: ScheduleProgram[];
  weeks: ScheduleWeek[];
}

export interface ScheduleDetailResponse {
  plan: SchedulePlan;
  entries: ScheduleEntry[];
}

export interface ScheduleOptionsResponse {
  options: ScheduleOptions;
}

export interface LearningPathPlanOptions {
  learningPathId: string;
  learningPathTitle: string | null;
  participantId: string | null;
  participantName: string | null;
  programId: string | null;
  programName: string | null;
  moduleId: string | null;
  moduleName: string | null;
  programWeeks: { id: string; name: string | null; weekNumber: number | null }[];
  templates: ScheduleTemplate[];
  resolutionStatus: string;
}

export interface CreateIndividualPlanResult {
  planId: string;
  created: boolean;
  status: string;
  code: string | null;
  message: string | null;
}

export interface PlanInput {
  id?: string;
  name: string;
  programWeekId: string;
  scopeType: ScheduleScope;
  participantGroupId?: string | null;
  participantId?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: ScheduleStatus;
  deviationReason?: string | null;
  notes?: string | null;
}

export interface EntryInput {
  id?: string;
  weeklyScheduleId: string;
  scheduleTemplateId?: string;
  title: string;
  description?: string | null;
  entryKind: EntryKind;
  type: string;
  isRequired?: boolean;
  dayOfWeek: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  targetType: ScheduleScope;
  participantGroupId?: string | null;
  participantId?: string | null;
  coachProfileId?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  order?: number | null;
  deviationReason?: string | null;
  notes?: string | null;
  isCustomized?: boolean;
}
