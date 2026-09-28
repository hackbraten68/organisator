import { executeGraphQL } from "@/api/graphqlClient";
import type { Appointment, AppointmentInput, AppointmentPatch, AppointmentFilters } from "@/types/appointment";
import type { AvailabilitySlot, AvailabilitySlotInput, AvailabilitySlotPatch, AvailabilitySlotFilters } from "@/types/availabilitySlot";
import { getAuditActor } from "@/api/audit/actorContext";
import {
  recordAppointmentCreated,
  recordAppointmentRescheduled,
  recordAppointmentStatusChanged,
  recordAppointmentCancelled,
  recordAppointmentAttendanceChanged,
} from "@/api/audit/appointmentAuditIntegration";
import {
  recordAvailabilitySlotAdded,
  recordAvailabilitySlotUpdated,
  recordAvailabilitySlotDeleted,
  toSlotContext,
} from "@/api/audit/availabilityAuditIntegration";
import { generateUUID } from "@/api/audit/auditService";

import GET_APPOINTMENT_RAW from "@/api/appointment/query/GetAppointment.graphql?raw";
import LIST_APPOINTMENTS_RAW from "@/api/appointment/query/ListAppointments.graphql?raw";
import GET_APPOINTMENTS_BY_PARTICIPANT_RAW from "@/api/appointment/query/GetAppointmentsByParticipant.graphql?raw";
import CREATE_APPOINTMENT_RAW from "@/api/appointment/query/CreateAppointment.graphql?raw";
import UPDATE_APPOINTMENT_RAW from "@/api/appointment/query/UpdateAppointment.graphql?raw";
import CONFIRM_APPOINTMENT_RAW from "@/api/appointment/query/ConfirmAppointment.graphql?raw";
import COMPLETE_APPOINTMENT_RAW from "@/api/appointment/query/CompleteAppointment.graphql?raw";
import RESCHEDULE_APPOINTMENT_RAW from "@/api/appointment/query/RescheduleAppointment.graphql?raw";
import CANCEL_APPOINTMENT_RAW from "@/api/appointment/query/CancelAppointment.graphql?raw";
import UPDATE_APPOINTMENT_ATTENDANCE_RAW from "@/api/appointment/query/UpdateAppointmentAttendance.graphql?raw";

import GET_AVAILABILITY_SLOTS_RAW from "@/api/availabilitySlot/query/GetAvailabilitySlots.graphql?raw";
import GET_AVAILABILITY_SLOT_RAW from "@/api/availabilitySlot/query/GetAvailabilitySlot.graphql?raw";
import CREATE_AVAILABILITY_SLOT_RAW from "@/api/availabilitySlot/query/CreateAvailabilitySlot.graphql?raw";
import UPDATE_AVAILABILITY_SLOT_RAW from "@/api/availabilitySlot/query/UpdateAvailabilitySlot.graphql?raw";
import DELETE_AVAILABILITY_SLOT_RAW from "@/api/availabilitySlot/query/DeleteAvailabilitySlot.graphql?raw";

type ScalarValue<T = string> = { value?: T | null } | null | undefined;

interface AppointmentNode {
  Id: string;
  Name?: ScalarValue<string>;
  Participant__c?: ScalarValue<string>;
  Coach__c?: ScalarValue<string>;
  Type__c?: ScalarValue<string>;
  Status__c?: ScalarValue<string>;
  StartTime__c?: ScalarValue<string>;
  EndTime__c?: ScalarValue<string>;
  Location__c?: ScalarValue<string>;
  MeetingLink__c?: ScalarValue<string>;
  Notes__c?: ScalarValue<string>;
  CancellationReason__c?: ScalarValue<string>;
  CorrelationId__c?: ScalarValue<string>;
  ConfirmedAt__c?: ScalarValue<string>;
  CompletedAt__c?: ScalarValue<string>;
  CreatedDate?: ScalarValue<string>;
  LastModifiedDate?: ScalarValue<string>;
  Participant__r?: { Name?: ScalarValue<string> } | null;
  Coach__r?: { Name?: ScalarValue<string> } | null;
}

interface AvailabilitySlotNode {
  Id: string;
  Name?: ScalarValue<string>;
  User__c?: ScalarValue<string>;
  DayOfWeek__c?: ScalarValue<string>;
  StartTime__c?: ScalarValue<string>;
  EndTime__c?: ScalarValue<string>;
  Type__c?: ScalarValue<string>;
  IsActive__c?: ScalarValue<boolean>;
  ValidFrom__c?: ScalarValue<string>;
  ValidTo__c?: ScalarValue<string>;
  CreatedDate?: ScalarValue<string>;
  LastModifiedDate?: ScalarValue<string>;
  User__r?: { Name?: ScalarValue<string> } | null;
}

interface GetAppointmentResponse {
  uiapi?: { query?: { Appointment__c?: { edges?: Array<{ node?: AppointmentNode | null } | null> | null } | null } | null };
}

interface ListAppointmentsResponse {
  uiapi?: {
    query?: {
      Appointment__c?: {
        edges?: Array<{ node?: AppointmentNode | null } | null> | null;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string } | null;
      } | null;
    } | null;
  } | null;
}

interface GetAppointmentsByParticipantResponse {
  uiapi?: { query?: { Appointment__c?: { edges?: Array<{ node?: AppointmentNode | null } | null> | null } | null } | null };
}

interface GetAvailabilitySlotsResponse {
  uiapi?: {
    query?: {
      AvailabilitySlot__c?: {
        edges?: Array<{ node?: AvailabilitySlotNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface GetAvailabilitySlotResponse {
  uiapi?: {
    query?: {
      AvailabilitySlot__c?: {
        edges?: Array<{ node?: AvailabilitySlotNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

interface MutationResponse {
  uiapi?: Record<string, { Record?: { Id?: string } | null } | null>;
}

function mapGqlToAppointment(node: any): Appointment {
  return {
    id: node.Id,
    name: node.Name?.value || "",
    participantId: node.Participant__c?.value || "",
    participantName: node.Participant__r?.Name?.value,
    coachId: node.Coach__c?.value,
    coachName: node.Coach__r?.Name?.value,
    type: node.Type__c?.value as Appointment["type"],
    status: node.Status__c?.value as Appointment["status"],
    startTime: node.StartTime__c?.value || "",
    endTime: node.EndTime__c?.value || "",
    location: node.Location__c?.value as Appointment["location"],
    meetingLink: node.MeetingLink__c?.value,
    notes: node.Notes__c?.value,
    cancellationReason: node.CancellationReason__c?.value,
    correlationId: node.CorrelationId__c?.value,
    confirmedAt: node.ConfirmedAt__c?.value,
    completedAt: node.CompletedAt__c?.value,
    createdAt: node.CreatedDate?.value || "",
    updatedAt: node.LastModifiedDate?.value || "",
  };
}

function mapGqlToAvailabilitySlot(node: any): AvailabilitySlot {
  return {
    id: node.Id,
    name: node.Name?.value || "",
    userId: node.User__c?.value || "",
    userName: node.User__r?.Name?.value,
    dayOfWeek: node.DayOfWeek__c?.value as AvailabilitySlot["dayOfWeek"],
    startTime: node.StartTime__c?.value || "",
    endTime: node.EndTime__c?.value || "",
    type: node.Type__c?.value as AvailabilitySlot["type"],
    isActive: node.IsActive__c?.value ?? true,
    validFrom: node.ValidFrom__c?.value,
    validTo: node.ValidTo__c?.value,
    createdAt: node.CreatedDate?.value || "",
    updatedAt: node.LastModifiedDate?.value || "",
  };
}

function buildAppointmentWhereFilter(filters: AppointmentFilters): any {
  const conditions: any[] = [];

  if (filters.participantId) conditions.push({ Participant__c: { eq: filters.participantId } });
  if (filters.coachId) conditions.push({ Coach__c: { eq: filters.coachId } });
  if (filters.status) conditions.push({ Status__c: { eq: filters.status } });
  if (filters.type) conditions.push({ Type__c: { eq: filters.type } });
  if (filters.startTimeFrom) conditions.push({ StartTime__c: { gte: { value: filters.startTimeFrom } } });
  if (filters.startTimeTo) conditions.push({ StartTime__c: { lte: { value: filters.startTimeTo } } });

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { and: conditions };
}

function buildAvailabilitySlotWhereFilter(filters: AvailabilitySlotFilters): any {
  const conditions: any[] = [];

  if (filters.userId) conditions.push({ User__c: { eq: filters.userId } });
  if (filters.dayOfWeek) conditions.push({ DayOfWeek__c: { eq: filters.dayOfWeek } });
  if (filters.type) conditions.push({ Type__c: { eq: filters.type } });
  if (filters.isActive !== undefined) conditions.push({ IsActive__c: { eq: filters.isActive } });

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { and: conditions };
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const response = await executeGraphQL<GetAppointmentResponse, { id: string }>(GET_APPOINTMENT_RAW, { id });
  const node = response?.uiapi?.query?.Appointment__c?.edges?.[0]?.node;
  return node ? mapGqlToAppointment(node) : null;
}

export async function listAppointments(
  filters: AppointmentFilters = {},
  first = 50,
  after?: string
): Promise<{ appointments: Appointment[]; hasNextPage: boolean; endCursor?: string }> {
  const where = buildAppointmentWhereFilter(filters);
  const response = await executeGraphQL<ListAppointmentsResponse, { where: any; first: number; after?: string }>(
    LIST_APPOINTMENTS_RAW,
    { where, first, after }
  );
  const edges = response?.uiapi?.query?.Appointment__c?.edges || [];
  const pageInfo = response?.uiapi?.query?.Appointment__c?.pageInfo;

  return {
    appointments: edges.map((e: any) => mapGqlToAppointment(e.node)),
    hasNextPage: pageInfo?.hasNextPage || false,
    endCursor: pageInfo?.endCursor,
  };
}

export async function getAppointmentsByParticipant(participantId: string, first = 50): Promise<Appointment[]> {
  const response = await executeGraphQL<GetAppointmentsByParticipantResponse, { participantId: string; first: number }>(
    GET_APPOINTMENTS_BY_PARTICIPANT_RAW,
    { participantId, first }
  );
  const edges = response?.uiapi?.query?.Appointment__c?.edges || [];
  return edges.map((e: any) => mapGqlToAppointment(e.node));
}

export async function createAppointment(input: AppointmentInput): Promise<string> {
  const response = await executeGraphQL<MutationResponse, {
    participantId: string;
    coachId?: string;
    type: string;
    status: string;
    startTime: string;
    endTime: string;
    location?: string;
    meetingLink?: string;
    notes?: string;
    correlationId?: string;
  }>(CREATE_APPOINTMENT_RAW, {
    participantId: input.participantId,
    coachId: input.coachId,
    type: input.type,
    status: input.status || "Draft",
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    meetingLink: input.meetingLink,
    notes: input.notes,
    correlationId: input.correlationId,
  });
  const id = response?.uiapi?.Appointment__cCreate?.Record?.Id ?? "";
  if (id) {
    const actor = getAuditActor();
    await recordAppointmentCreated({
      appointment: {
        id,
        name: "",
        participantId: input.participantId,
        participantName: "",
        coachId: input.coachId,
        coachName: "",
        type: input.type,
        status: input.status || "Draft",
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        meetingLink: input.meetingLink,
        notes: input.notes,
        cancellationReason: "",
        correlationId: input.correlationId,
        confirmedAt: "",
        completedAt: "",
        createdAt: "",
        updatedAt: "",
      },
      actor,
      // Die fachliche Correlation-Id des Datensatzes weiterverwenden: sonst
      // trennt ein spaeteres Reschedule (liest CorrelationId__c vom Record)
      // das Event vom Anlegen, obwohl beide dieselbe fachliche Aktion sind.
      correlationId: input.correlationId ?? generateUUID(),
    });
  }
  return id;
}

export async function updateAppointment(id: string, patch: AppointmentPatch): Promise<void> {
  const vars: Record<string, any> = { id };
  if (patch.coachId !== undefined) vars.coachId = patch.coachId;
  if (patch.type !== undefined) vars.type = patch.type;
  if (patch.status !== undefined) vars.status = patch.status;
  if (patch.startTime !== undefined) vars.startTime = patch.startTime;
  if (patch.endTime !== undefined) vars.endTime = patch.endTime;
  if (patch.location !== undefined) vars.location = patch.location;
  if (patch.meetingLink !== undefined) vars.meetingLink = patch.meetingLink;
  if (patch.notes !== undefined) vars.notes = patch.notes;
  if (patch.cancellationReason !== undefined) vars.cancellationReason = patch.cancellationReason;
  if (patch.correlationId !== undefined) vars.correlationId = patch.correlationId;
  if (patch.confirmedAt !== undefined) vars.confirmedAt = patch.confirmedAt;
  if (patch.completedAt !== undefined) vars.completedAt = patch.completedAt;

  const existing = await getAppointment(id);

  await executeGraphQL<MutationResponse, Record<string, any>>(UPDATE_APPOINTMENT_RAW, vars);

  if (patch.status !== undefined) {
    const actor = getAuditActor();
    await recordAppointmentStatusChanged({
      appointment: {
        id,
        name: "",
        participantId: existing?.participantId ?? "",
        participantName: "",
        coachId: patch.coachId,
        coachName: "",
        type: patch.type ?? "Sonstiges",
        status: patch.status,
        startTime: patch.startTime ?? "",
        endTime: patch.endTime ?? "",
        location: patch.location,
        meetingLink: patch.meetingLink,
        notes: patch.notes,
        cancellationReason: patch.cancellationReason,
        correlationId: patch.correlationId,
        confirmedAt: patch.confirmedAt ?? "",
        completedAt: patch.completedAt ?? "",
        createdAt: "",
        updatedAt: "",
      },
      oldStatus: "",
      newStatus: patch.status,
      actor,
      // Wie beim Anlegen: Record und Event teilen sich die Correlation-Id.
      correlationId: patch.correlationId ?? generateUUID(),
    });
  }
}

export async function confirmAppointment(id: string): Promise<void> {
  const existing = await getAppointment(id);
  const confirmedAt = new Date().toISOString();
  await executeGraphQL<MutationResponse, { id: string; confirmedAt: string }>(CONFIRM_APPOINTMENT_RAW, { id, confirmedAt });
  const actor = getAuditActor();
  await recordAppointmentStatusChanged({
    appointment: {
      id,
      name: "",
      participantId: existing?.participantId ?? "",
      participantName: "",
      coachId: "",
      coachName: "",
      type: "Sonstiges",
      status: "Confirmed",
      startTime: "",
      endTime: "",
      location: undefined,
      meetingLink: undefined,
      notes: undefined,
      cancellationReason: "",
      correlationId: undefined,
      confirmedAt,
      completedAt: "",
      createdAt: "",
      updatedAt: "",
    },
    oldStatus: "Draft",
    newStatus: "Confirmed",
    actor,
    correlationId: generateUUID(),
  });
}

export async function completeAppointment(id: string): Promise<void> {
  const existing = await getAppointment(id);
  const completedAt = new Date().toISOString();
  await executeGraphQL<MutationResponse, { id: string; completedAt: string }>(COMPLETE_APPOINTMENT_RAW, { id, completedAt });
  const actor = getAuditActor();
  await recordAppointmentStatusChanged({
    appointment: {
      id,
      name: "",
      participantId: existing?.participantId ?? "",
      participantName: "",
      coachId: "",
      coachName: "",
      type: "Sonstiges",
      status: "Completed",
      startTime: "",
      endTime: "",
      location: undefined,
      meetingLink: undefined,
      notes: undefined,
      cancellationReason: "",
      correlationId: undefined,
      confirmedAt: "",
      completedAt,
      createdAt: "",
      updatedAt: "",
    },
    oldStatus: "Confirmed",
    newStatus: "Completed",
    actor,
    correlationId: generateUUID(),
  });
}

export async function rescheduleAppointment(
  id: string,
  startTime: string,
  endTime: string,
  correlationId?: string
): Promise<void> {
  const existing = await getAppointment(id);
  await executeGraphQL<MutationResponse, { id: string; startTime: string; endTime: string; correlationId?: string }>(
    RESCHEDULE_APPOINTMENT_RAW,
    { id, startTime, endTime, correlationId }
  );
  const actor = getAuditActor();
  await recordAppointmentRescheduled({
    appointment: {
      id,
      name: "",
      participantId: existing?.participantId ?? "",
      participantName: "",
      coachId: "",
      coachName: "",
      type: "Sonstiges",
      status: "Finding",
      startTime,
      endTime,
      location: undefined,
      meetingLink: undefined,
      notes: undefined,
      cancellationReason: "",
      correlationId,
      confirmedAt: "",
      completedAt: "",
      createdAt: "",
      updatedAt: "",
    },
    oldStartTime: "",
    oldEndTime: "",
    actor,
    correlationId: correlationId ?? generateUUID(),
  });
}

export async function cancelAppointment(id: string, cancellationReason?: string): Promise<void> {
  const existing = await getAppointment(id);
  await executeGraphQL<MutationResponse, { id: string; cancellationReason?: string }>(CANCEL_APPOINTMENT_RAW, { id, cancellationReason });
  const actor = getAuditActor();
  await recordAppointmentCancelled({
    appointment: {
      id,
      name: "",
      participantId: existing?.participantId ?? "",
      participantName: "",
      coachId: "",
      coachName: "",
      type: "Sonstiges",
      status: "Cancelled",
      startTime: "",
      endTime: "",
      location: undefined,
      meetingLink: undefined,
      notes: undefined,
      cancellationReason: cancellationReason ?? "",
      correlationId: undefined,
      confirmedAt: "",
      completedAt: "",
      createdAt: "",
      updatedAt: "",
    },
    actor,
    reason: cancellationReason,
    correlationId: generateUUID(),
  });
}

export async function updateAppointmentAttendance(id: string, status: "Completed" | "NoShow"): Promise<void> {
  const existing = await getAppointment(id);
  await executeGraphQL<MutationResponse, { id: string; status: string }>(UPDATE_APPOINTMENT_ATTENDANCE_RAW, { id, status });
  const actor = getAuditActor();
  await recordAppointmentAttendanceChanged({
    appointment: {
      id,
      name: "",
      participantId: existing?.participantId ?? "",
      participantName: "",
      coachId: "",
      coachName: "",
      type: "Sonstiges",
      status,
      startTime: "",
      endTime: "",
      location: undefined,
      meetingLink: undefined,
      notes: undefined,
      cancellationReason: "",
      correlationId: undefined,
      confirmedAt: "",
      completedAt: "",
      createdAt: "",
      updatedAt: "",
    },
    oldStatus: "",
    newStatus: status,
    actor,
    correlationId: generateUUID(),
  });
}

export async function getAvailabilitySlots(filters: AvailabilitySlotFilters = {}, first = 100): Promise<AvailabilitySlot[]> {
  const where = buildAvailabilitySlotWhereFilter(filters);
  const response = await executeGraphQL<GetAvailabilitySlotsResponse, { where: any; first: number }>(
    GET_AVAILABILITY_SLOTS_RAW,
    { where, first }
  );
  const edges = response?.uiapi?.query?.AvailabilitySlot__c?.edges || [];
  return edges.map((e: any) => mapGqlToAvailabilitySlot(e.node));
}

export async function getAvailabilitySlot(id: string): Promise<AvailabilitySlot | null> {
  const response = await executeGraphQL<GetAvailabilitySlotResponse, { id: string }>(
    GET_AVAILABILITY_SLOT_RAW,
    { id },
  );
  const node = response?.uiapi?.query?.AvailabilitySlot__c?.edges?.[0]?.node;
  return node ? mapGqlToAvailabilitySlot(node) : null;
}

export async function createAvailabilitySlot(input: AvailabilitySlotInput): Promise<string> {
  const response = await executeGraphQL<MutationResponse, {
    userId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    type?: string;
    isActive?: boolean;
    validFrom?: string;
    validTo?: string;
  }>(CREATE_AVAILABILITY_SLOT_RAW, {
    userId: input.userId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    type: input.type || "General",
    isActive: input.isActive ?? true,
    validFrom: input.validFrom,
    validTo: input.validTo,
  });
  const id = response?.uiapi?.AvailabilitySlot__cCreate?.Record?.Id ?? "";
  if (id) {
    await recordAvailabilitySlotAdded({
      slot: {
        id,
        userId: input.userId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        type: input.type || "General",
        isActive: input.isActive ?? true,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
      actor: getAuditActor(),
      correlationId: generateUUID(),
    });
  }
  return id;
}

export async function updateAvailabilitySlot(id: string, patch: AvailabilitySlotPatch): Promise<void> {
  // Vorher lesen: das Update-Event braucht den Ist-Zustand fuer die
  // before/after-Aenderung, und das Loeschen den Slot selbst.
  const existing = await getAvailabilitySlot(id);

  const vars: Record<string, any> = { id };
  if (patch.dayOfWeek !== undefined) vars.dayOfWeek = patch.dayOfWeek;
  if (patch.startTime !== undefined) vars.startTime = patch.startTime;
  if (patch.endTime !== undefined) vars.endTime = patch.endTime;
  if (patch.type !== undefined) vars.type = patch.type;
  if (patch.isActive !== undefined) vars.isActive = patch.isActive;
  if (patch.validFrom !== undefined) vars.validFrom = patch.validFrom;
  if (patch.validTo !== undefined) vars.validTo = patch.validTo;

  await executeGraphQL<MutationResponse, Record<string, any>>(UPDATE_AVAILABILITY_SLOT_RAW, vars);

  const changes: Array<{ field: string; oldValue?: unknown; newValue?: unknown; redacted: boolean }> = [];
  const push = (field: string, oldValue: unknown, newValue: unknown) => {
    if (newValue !== undefined && oldValue !== newValue) {
      changes.push({ field, oldValue, newValue, redacted: false });
    }
  };
  push("DayOfWeek__c", existing?.dayOfWeek, patch.dayOfWeek);
  push("StartTime__c", existing?.startTime, patch.startTime);
  push("EndTime__c", existing?.endTime, patch.endTime);
  push("Type__c", existing?.type, patch.type);
  push("IsActive__c", existing?.isActive, patch.isActive);
  push("ValidFrom__c", existing?.validFrom, patch.validFrom);
  push("ValidTo__c", existing?.validTo, patch.validTo);

  if (changes.length > 0) {
    await recordAvailabilitySlotUpdated({
      slot: {
        id,
        userId: existing?.userId ?? "",
        dayOfWeek: patch.dayOfWeek ?? existing?.dayOfWeek ?? "",
        startTime: patch.startTime ?? existing?.startTime ?? "",
        endTime: patch.endTime ?? existing?.endTime ?? "",
        type: patch.type ?? existing?.type ?? "",
        isActive: patch.isActive ?? existing?.isActive ?? true,
        validFrom: patch.validFrom ?? existing?.validFrom,
        validTo: patch.validTo ?? existing?.validTo,
      },
      changes,
      actor: getAuditActor(),
      correlationId: generateUUID(),
    });
  }
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const existing = await getAvailabilitySlot(id);

  await executeGraphQL<MutationResponse, { id: string }>(DELETE_AVAILABILITY_SLOT_RAW, { id });

  if (existing) {
    await recordAvailabilitySlotDeleted({
      slot: toSlotContext(existing),
      actor: getAuditActor(),
      correlationId: generateUUID(),
    });
  }
}