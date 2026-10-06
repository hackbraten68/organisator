/**
 * Registry der Feldnamen, die der Audit tatsaechlich emittiert.
 *
 * Warum eine eigene Datei und nicht nur ein Test: applyFieldRedaction schlaegt
 * `policies[field]` **exakt** nach. Ein Tippfehler im Suffix faellt still auf
 * `FULL` zurueck — kein Fehler, kein leeres Feld, sondern Klartext im
 * Audit-Log (Befund S1). Ein Test gegen die Policy allein haette den Fehler
 * gefunden, aber nur, solange jemand die Soll-Menge pflegt.
 *
 * Deshalb sind die Namen hier einmal deklariert und werden von allen Emittern
 * benutzt — auch von denen **ausserhalb** dieses Ordners. `ValidFrom__c` und
 * `ValidTo__c` werden ausschliesslich in `appointmentService.updateAvailabilitySlot`
 * emittiert, `CoachComment__c` zusaetzlich in `absenceService.updateAbsence`.
 * Eine Konstante allein in der Integration waere unvollstaendig und trotzdem
 * gruen.
 *
 * Drei Tests in `fieldPolicyCoverage.test.ts` haengen an dieser Datei:
 *   1. Abdeckung   — jedes emittierte Feld hat eine Policy
 *   2. Suffix      — Policy-Schluessel enden auf __c (mit benannten Ausnahmen)
 *   3. Org-Schema  — jedes emittierte Feld existiert als Feld in der Org
 */

import type { AuditDomain } from "@/types/audit";

/**
 * `Name` ist das Standard-`nameField` jedes Salesforce-Objekts und traegt
 * deshalb kein __c. Auf `Participant__c` heisst es laut object-meta.xml
 * "Participant-Name".
 */
export const PARTICIPANT_AUDIT_FIELDS = {
  name: "Name",
  status: "Status__c",
  email: "Email__c",
  gitHub: "GitHub__c",
  discord: "Discord__c",
  startDate: "StartDate__c",
  expectedEndDate: "ExpectedEndDate__c",
  program: "Program__c",
  coachProfile: "Coach_Profile__c",
} as const;

export const ABSENCE_AUDIT_FIELDS = {
  status: "Status__c",
  type: "Type__c",
  startDate: "StartDate__c",
  endDate: "EndDate__c",
  // Gesundheitsdaten — vom Teilnehmer begruendet.
  reason: "Reason__c",
  // Ablehnungsbegruendung des Coach, im Beispiel eine Health-Krise.
  coachComment: "CoachComment__c",
  approvedBy: "ApprovedBy__c",
  approvedAt: "ApprovedAt__c",
  rejectedAt: "RejectedAt__c",
  /**
   * Bewusst kein Salesforce-Feld: der Audit-Event traegt bei
   * `absence.document_added` nur den Dateinamen. Ein Org-Feld gibt es nicht,
   * deshalb steht der Name ohne __c und ohne Org-Gegenstueck.
   */
  documents: "Documents",
} as const;

export const APPOINTMENT_AUDIT_FIELDS = {
  status: "Status__c",
  type: "Type__c",
  startTime: "StartTime__c",
  endTime: "EndTime__c",
  coach: "Coach__c",
  correlationId: "CorrelationId__c",
  // Freitext, den der Coach beim Absagen mitgibt.
  cancellationReason: "CancellationReason__c",
  /**
   * Offene Entscheidung E9: der Name traegt kein __c und ein Feld dieses
   * Namens existiert in der Org nicht — es ist ein reines Audit-Label. Wird
   * umbenannt oder aus `changes` gestrichen, faellt dieser Kommentar weg.
   */
  rescheduleReason: "RescheduleReason",
} as const;

export const AVAILABILITY_AUDIT_FIELDS = {
  user: "User__c",
  dayOfWeek: "DayOfWeek__c",
  startTime: "StartTime__c",
  endTime: "EndTime__c",
  type: "Type__c",
  isActive: "IsActive__c",
  validFrom: "ValidFrom__c",
  validTo: "ValidTo__c",
} as const;

export const LEARNING_PATH_AUDIT_FIELDS = {
  title: "Title__c",
  estimatedWeeks: "Estimated_Weeks__c",
  status: "Status__c",
  order: "Order__c",
} as const;

/**
 * Zuordnung Domain -> emittierte Felder.
 *
 * Bewusst nur die Domains mit einem echten Emitter. `workbook`, `classbook`,
 * `daily_checkin` und `time_tracking` haben Policies, aber keine Integration
 * und keinen Service, der sie befuellt — ihre Policies sind aspirational. Der
 * Abdeckungstest laesst sie deshalb durch, und genau in dem Moment, in dem
 * jemand den ersten Emitter schreibt, greift er.
 */
export const EMITTED_AUDIT_FIELDS: Partial<Record<AuditDomain, Readonly<Record<string, string>>>> = {
  participant: PARTICIPANT_AUDIT_FIELDS,
  absence: ABSENCE_AUDIT_FIELDS,
  appointment: APPOINTMENT_AUDIT_FIELDS,
  availability: AVAILABILITY_AUDIT_FIELDS,
  learning_path: LEARNING_PATH_AUDIT_FIELDS,
};

/** Alle emittierten Feldnamen einer Domain. */
export function emittedFieldNames(domain: AuditDomain): string[] {
  return Object.values(EMITTED_AUDIT_FIELDS[domain] ?? {});
}