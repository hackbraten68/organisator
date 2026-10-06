import { auditService } from "./auditService";
import { EVENT_TYPES } from "@/types/audit";
import type { ActorInfo } from "@/types/audit";
import { ABSENCE_AUDIT_FIELDS as F } from "./emittedFields";

export interface RecordAbsenceReportedOptions {
  absence: {
    id: string;
    participantId: string;
    type: string;
    startDate: string;
    endDate: string;
    reason?: string;
  };
  actor: ActorInfo;
  correlationId?: string;
}

export interface RecordAbsenceApprovedOptions {
  absence: {
    id: string;
    participantId: string;
    type: string;
    startDate: string;
    endDate: string;
  };
  approver: ActorInfo;
  correlationId?: string;
}

export interface RecordAbsenceRejectedOptions {
  absence: {
    id: string;
    participantId: string;
    type: string;
    startDate: string;
    endDate: string;
  };
  rejector: ActorInfo;
  reason: string;
  correlationId?: string;
}

export interface RecordAbsenceUpdatedOptions {
  absence: {
    id: string;
    participantId: string;
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    reason?: string;
  };
  changes: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
    redacted: boolean;
  }>;
  actor: ActorInfo;
  correlationId?: string;
}

export interface RecordAbsenceCancelledOptions {
  absence: {
    id: string;
    participantId: string;
    type: string;
  };
  actor: ActorInfo;
  correlationId?: string;
}

export interface RecordAbsenceDocumentAddedOptions {
  absence: {
    id: string;
    participantId: string;
  };
  document: {
    id: string;
    fileName: string;
    fileSize: number;
    contentDocumentId: string;
  };
  actor: ActorInfo;
  correlationId?: string;
}

export async function recordAbsenceReported(options: RecordAbsenceReportedOptions): Promise<string | void> {
  const { absence, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_REPORTED,
      domain: "absence",
      action: "submitted",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Abwesenheit gemeldet",
      changes: [
        { field: F.status, oldValue: null, newValue: "Submitted", redacted: false },
        { field: F.type, oldValue: null, newValue: absence.type, redacted: false },
        { field: F.startDate, oldValue: null, newValue: absence.startDate, redacted: false },
        { field: F.endDate, oldValue: null, newValue: absence.endDate, redacted: false },
        ...(absence.reason ? [{ field: F.reason, oldValue: null, newValue: absence.reason, redacted: true }] : []),
      ],
      metadata: {
        absenceType: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence reported", err);
  }
}

export async function recordAbsenceApproved(options: RecordAbsenceApprovedOptions): Promise<string | void> {
  const { absence, approver, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_APPROVED,
      domain: "absence",
      action: "approved",
      actorType: approver.type,
      actorId: approver.id,
      actorDisplayNameSnapshot: approver.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Abwesenheit genehmigt",
      changes: [
        { field: F.status, oldValue: "Submitted", newValue: "Approved", redacted: false },
        { field: F.approvedBy, oldValue: null, newValue: approver.id, redacted: false },
        { field: F.approvedAt, oldValue: null, newValue: new Date().toISOString(), redacted: false },
      ],
      metadata: {
        absenceType: absence.type,
        approvedBy: approver.id,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence approved", err);
  }
}

export async function recordAbsenceRejected(options: RecordAbsenceRejectedOptions): Promise<string | void> {
  const { absence, rejector, reason, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_REJECTED,
      domain: "absence",
      action: "rejected",
      actorType: rejector.type,
      actorId: rejector.id,
      actorDisplayNameSnapshot: rejector.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Abwesenheit abgelehnt",
      changes: [
        { field: F.status, oldValue: "Submitted", newValue: "Rejected", redacted: false },
        { field: F.rejectedAt, oldValue: null, newValue: new Date().toISOString(), redacted: false },
        { field: F.coachComment, oldValue: null, newValue: reason, redacted: true },
      ],
      metadata: {
        absenceType: absence.type,
        rejectedBy: rejector.id,
        rejectionReason: reason,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence rejected", err);
  }
}

export async function recordAbsenceUpdated(options: RecordAbsenceUpdatedOptions): Promise<string | void> {
  const { absence, changes, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_UPDATED,
      domain: "absence",
      action: "updated",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Abwesenheit aktualisiert",
      changes,
      metadata: {
        absenceType: absence.type,
        status: absence.status,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence updated", err);
  }
}

export async function recordAbsenceCancelled(options: RecordAbsenceCancelledOptions): Promise<string | void> {
  const { absence, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_CANCELLED,
      domain: "absence",
      action: "cancelled",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Abwesenheit storniert",
      changes: [
        { field: F.status, oldValue: "Submitted", newValue: "Cancelled", redacted: false },
      ],
      metadata: {
        absenceType: absence.type,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence cancelled", err);
  }
}

export async function recordAbsenceDocumentAdded(options: RecordAbsenceDocumentAddedOptions): Promise<string | void> {
  const { absence, document, actor, correlationId } = options;

  try {
    await auditService.record({
      eventType: EVENT_TYPES.ABSENCE_DOCUMENT_ADDED,
      domain: "absence",
      action: "document_added",
      actorType: actor.type,
      actorId: actor.id,
      actorDisplayNameSnapshot: actor.displayName,
      subjectType: "Absence__c",
      subjectId: absence.id,
      participantId: absence.participantId,
      source: "web",
      reason: "Dokument zur Abwesenheit hinzugefügt",
      changes: [
        { field: F.documents, oldValue: null, newValue: document.fileName, redacted: false },
      ],
      metadata: {
        documentId: document.id,
        fileName: document.fileName,
        fileSize: document.fileSize,
        contentDocumentId: document.contentDocumentId,
      },
      correlationId,
    });
  } catch (err) {
    console.error("[audit] Failed to record absence document added", err);
  }
}