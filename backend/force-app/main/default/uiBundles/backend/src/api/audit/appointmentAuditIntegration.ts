import { auditService } from "./auditService";
import { EVENT_TYPES } from "@/types/audit";
import type { ActorInfo } from "@/types/audit";
import type { Appointment } from "@/types/appointment";

export interface RecordAppointmentCreatedOptions {
  appointment: Appointment;
  actor: ActorInfo;
  correlationId?: string;
}

export interface RecordAppointmentRescheduledOptions {
  appointment: Appointment;
  oldStartTime: string;
  oldEndTime: string;
  actor: ActorInfo;
  reason?: string;
  correlationId?: string;
}

export interface RecordAppointmentStatusChangedOptions {
  appointment: Appointment;
  oldStatus: string;
  newStatus: string;
  actor: ActorInfo;
  correlationId?: string;
}

export interface RecordAppointmentCancelledOptions {
  appointment: Appointment;
  actor: ActorInfo;
  reason?: string;
  correlationId?: string;
}

export interface RecordAppointmentAttendanceChangedOptions {
  appointment: Appointment;
  oldStatus: string;
  newStatus: string;
  actor: ActorInfo;
  correlationId?: string;
}

export async function recordAppointmentCreated(options: RecordAppointmentCreatedOptions): Promise<string | void> {
  const { appointment, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.APPOINTMENT_CREATED,
      domain: "appointment",
      action: "created",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Appointment__c",
      subjectId: appointment.id,
      participantId: appointment.participantId,
      source: "web",
      reason: "Termin erstellt",
      changes: [
        { field: "Status__c", oldValue: null, newValue: appointment.status, redacted: false },
        { field: "Type__c", oldValue: null, newValue: appointment.type, redacted: false },
        { field: "StartTime__c", oldValue: null, newValue: appointment.startTime, redacted: false },
        { field: "EndTime__c", oldValue: null, newValue: appointment.endTime, redacted: false },
        ...(appointment.coachId ? [{ field: "Coach__c", oldValue: null, newValue: appointment.coachId, redacted: false }] : []),
        ...(appointment.correlationId ? [{ field: "CorrelationId__c", oldValue: null, newValue: appointment.correlationId, redacted: false }] : []),
      ],
      metadata: {
        appointmentType: appointment.type,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        coachId: appointment.coachId,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record appointment created", err);
  }
}

export async function recordAppointmentRescheduled(options: RecordAppointmentRescheduledOptions): Promise<string | void> {
  const { appointment, oldStartTime, oldEndTime, actor, reason, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.APPOINTMENT_RESCHEDULED,
      domain: "appointment",
      action: "rescheduled",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Appointment__c",
      subjectId: appointment.id,
      participantId: appointment.participantId,
      source: "web",
      reason: "Termin verschoben",
      changes: [
        { field: "StartTime__c", oldValue: oldStartTime, newValue: appointment.startTime, redacted: false },
        { field: "EndTime__c", oldValue: oldEndTime, newValue: appointment.endTime, redacted: false },
        { field: "Status__c", oldValue: "Confirmed", newValue: "Finding", redacted: false },
        ...(reason ? [{ field: "RescheduleReason", oldValue: null, newValue: reason, redacted: false }] : []),
      ],
      metadata: {
        oldStartTime,
        oldEndTime,
        newStartTime: appointment.startTime,
        newEndTime: appointment.endTime,
        rescheduleReason: reason,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record appointment rescheduled", err);
  }
}

export async function recordAppointmentStatusChanged(options: RecordAppointmentStatusChangedOptions): Promise<string | void> {
  const { appointment, oldStatus, newStatus, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: "appointment.status_changed",
      domain: "appointment",
      action: "status_changed",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Appointment__c",
      subjectId: appointment.id,
      participantId: appointment.participantId,
      source: "web",
      reason: `Termin-Status geändert: ${oldStatus} → ${newStatus}`,
      changes: [
        { field: "Status__c", oldValue: oldStatus, newValue: newStatus, redacted: false },
      ],
      metadata: {
        oldStatus,
        newStatus,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record appointment status changed", err);
  }
}

export async function recordAppointmentCancelled(options: RecordAppointmentCancelledOptions): Promise<string | void> {
  const { appointment, actor, reason, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.APPOINTMENT_CANCELLED,
      domain: "appointment",
      action: "cancelled",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Appointment__c",
      subjectId: appointment.id,
      participantId: appointment.participantId,
      source: "web",
      reason: "Termin abgesagt",
      changes: [
        { field: "Status__c", oldValue: appointment.status, newValue: "Cancelled", redacted: false },
        ...(reason ? [{ field: "CancellationReason__c", oldValue: null, newValue: reason, redacted: false }] : []),
      ],
      metadata: {
        cancellationReason: reason,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record appointment cancelled", err);
  }
}

export async function recordAppointmentAttendanceChanged(options: RecordAppointmentAttendanceChangedOptions): Promise<string | void> {
  const { appointment, oldStatus, newStatus, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.APPOINTMENT_ATTENDANCE_CHANGED,
      domain: "appointment",
      action: "attendance_changed",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Appointment__c",
      subjectId: appointment.id,
      participantId: appointment.participantId,
      source: "web",
      reason: `Teilnahme geändert: ${oldStatus} → ${newStatus}`,
      changes: [
        { field: "Status__c", oldValue: oldStatus, newValue: newStatus, redacted: false },
      ],
      metadata: {
        oldStatus,
        newStatus,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record appointment attendance changed", err);
  }
}