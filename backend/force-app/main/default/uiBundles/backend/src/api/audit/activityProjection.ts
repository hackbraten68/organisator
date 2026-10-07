/**
 * Activity Projection Layer
 *
 * Derives presentation-level views from the central, immutable AuditEvent
 * store. One store, filtered projections — never a second persistence model.
 *
 * SECURITY CONTRACT (binding order):
 * 1. Salesforce sharing, permissions and field-level security decide which
 *    events reach the client.
 * 2. visibility / sensitivity are enforced and values redacted.
 * 3. ONLY THEN audience + category are applied for display.
 *
 * Audience and category are presentation concepts. They NEVER widen access:
 * an event excluded by visibility/sensitivity must already be gone before
 * this layer runs. Unknown event types default to "no activity projection"
 * so new types stay auditor-only until deliberately classified.
 */

import type { AuditEvent } from "@/types/audit";
import { EVENT_TYPES } from "@/types/audit";

/**
 * Fachliche Kategorien für Activity Views.
 *
 * - attendance: Anwesenheit / Check-in / dokumentierte Anwesenheit
 * - absence:    Abmeldungen mit eigenem Prozess und höherer Sensitivität
 *               (Gründe, Dokumente) — bewusst getrennt von attendance
 */
export const ACTIVITY_CATEGORIES = [
  "participant_journey",
  "appointments",
  "attendance",
  "absence",
  "learning",
  "administration",
  "security",
  "audit",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_AUDIENCES = [
  "coach",
  "staff",
  "supervisor",
  "auditor",
  "participant",
] as const;

export type ActivityAudience = (typeof ACTIVITY_AUDIENCES)[number];

export interface ActivityProjectionRule {
  category: ActivityCategory;
  audiences: readonly ActivityAudience[];
  /** False → never rendered in any activity timeline (audit explorer only). */
  includeInActivity: boolean;
  /** True → hidden unless includeTechnicalEvents is set. */
  technical: boolean;
}

type KnownEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES] | AuditSystemEventType;

/**
 * Audit-meta events (reads/exports) produced by the audit layer itself.
 * Classified up-front as technical audit events.
 */
export const AUDIT_META_EVENT_TYPES = [
  "audit.viewed",
  "audit.exported",
] as const;

export type AuditSystemEventType = (typeof AUDIT_META_EVENT_TYPES)[number];

const STAFF_SUPERVISOR = ["staff", "supervisor"] as const;
const COACH_STAFF = ["coach", "staff"] as const;
const COACH_STAFF_PARTICIPANT = ["coach", "staff", "participant"] as const;
const AUDITOR_SUPERVISOR = ["auditor", "supervisor"] as const;

export const ACTIVITY_PROJECTION_RULES = {
  // Participant journey
  "participant.created": { category: "participant_journey", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "participant.updated": { category: "participant_journey", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "participant.status_changed": { category: "participant_journey", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "participant.archived": { category: "participant_journey", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "participant.restored": { category: "participant_journey", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Learning
  "workbook.assigned": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "workbook.started": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "workbook.answer_updated": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "workbook.submitted": { category: "learning", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "workbook.reviewed": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Learning path (curriculum plan; staff visibility upstream).
  // item_reordered stays backend-only: tracked in the store/explorer, but
  // deliberately excluded from all frontend timelines (noise).
  "learning_path.item_created": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "learning_path.item_updated": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "learning_path.item_deleted": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "learning_path.item_reordered": { category: "learning", audiences: COACH_STAFF, includeInActivity: false, technical: false },
  // Modul = Programmtemplate, nicht teilnehmergebunden. includeInActivity true
  // heisst: erscheint, sobald eine programbezogene Sicht existiert. In einer
  // Teilnehmer-Timeline nie sichtbar, weil `participantId` leer ist — korrekt,
  // denn das Loeschen eines Moduls fasst keinen Lernpfad eines Teilnehmers an.
  "learning_path.module_deleted": { category: "learning", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Absence (eigene Kategorie: anderer Prozess, andere Sensitivität als attendance)
  "absence.reported": { category: "absence", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "absence.updated": { category: "absence", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "absence.approved": { category: "absence", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "absence.rejected": { category: "absence", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "absence.cancelled": { category: "absence", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "absence.document_added": { category: "absence", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Appointments
  "appointment.created": { category: "appointments", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "appointment.rescheduled": { category: "appointments", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "appointment.cancelled": { category: "appointments", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "appointment.attendance_changed": { category: "appointments", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Klassenbuch / Anwesenheit
  "classbook.entry_created": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "classbook.entry_updated": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "classbook.entry_deleted": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: true },
  "classbook.attendance_changed": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Daily Check-in
  "daily_checkin.submitted": { category: "attendance", audiences: COACH_STAFF_PARTICIPANT, includeInActivity: true, technical: false },
  "daily_checkin.updated": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "daily_checkin.flagged": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "daily_checkin.reviewed": { category: "attendance", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Time tracking: operativ, kein Verhaltensmonitoring
  "time_entry.started": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: true },
  "time_entry.stopped": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: true },
  "time_entry.created": { category: "administration", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "time_entry.corrected": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: false },
  "time_entry.deleted": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: true },
  "time_entry.approved": { category: "administration", audiences: COACH_STAFF, includeInActivity: true, technical: false },
  "time_entry.rejected": { category: "administration", audiences: COACH_STAFF, includeInActivity: true, technical: false },

  // Verfügbarkeits-Slots: Ressourcen-Daten (User__c), nicht teilnehmergebunden.
  // includeInActivity:false — Slot-Änderungen gehören fachlich nicht in die
  // Teilnehmer-Historie. Geplanter Betrachter ist ein Coach-Dashboard, das
  // direkt über Domain__c + ParentId__c abfragt, nicht über eine Timeline.
  // NICHT auf true setzen, um die Events in Teilnehmer-Timelines zu ziehen:
  // die Verfügbarkeit eines Coachs ist Betriebsdaten, keine Information über
  // den Teilnehmer. Details in docs/activity-coverage.md.
  "availability.slot_added": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: false, technical: false },
  "availability.slot_updated": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: false, technical: false },
  "availability.slot_deleted": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: false, technical: false },

  // System / Auth: Technik, nur für Staff/Supervisor bzw. Auditor
  "system.created": { category: "administration", audiences: STAFF_SUPERVISOR, includeInActivity: true, technical: true },
  "authentication.created": { category: "security", audiences: AUDITOR_SUPERVISOR, includeInActivity: true, technical: true },

  // Audit-meta: nie in Activity Timelines
  "audit.viewed": { category: "audit", audiences: AUDITOR_SUPERVISOR, includeInActivity: false, technical: true },
  "audit.exported": { category: "audit", audiences: AUDITOR_SUPERVISOR, includeInActivity: false, technical: true },
} satisfies Record<KnownEventType, ActivityProjectionRule>;

/**
 * Default-deny: unknown event types render nowhere. They remain available
 * through the authorized audit explorer until deliberately classified.
 */
export const UNKNOWN_EVENT_PROJECTION: ActivityProjectionRule = {
  category: "administration",
  audiences: [],
  includeInActivity: false,
  technical: true,
};

export function projectEvent(event: AuditEvent): ActivityProjectionRule {
  return (
    (ACTIVITY_PROJECTION_RULES as Record<string, ActivityProjectionRule>)[event.eventType] ??
    UNKNOWN_EVENT_PROJECTION
  );
}

export interface AudienceFilterOptions {
  categories?: ActivityCategory[];
  includeTechnicalEvents?: boolean;
}

/**
 * Filter an ALREADY AUTHORIZED event set for an audience view.
 *
 * Must only ever receive events the viewer is allowed to see
 * (sharing/visibility/sensitivity/redaction applied upstream).
 */
export function filterForAudience(
  events: AuditEvent[],
  audience: ActivityAudience,
  options: AudienceFilterOptions = {},
): AuditEvent[] {
  const { categories, includeTechnicalEvents = false } = options;
  return events.filter((event) => {
    const rule = projectEvent(event);
    if (!rule.includeInActivity) return false;
    if (rule.technical && !includeTechnicalEvents) return false;
    if (!rule.audiences.includes(audience)) return false;
    if (categories && categories.length > 0 && !categories.includes(rule.category)) return false;
    return true;
  });
}

/** Default participant view: fachliche Coach-Sicht ohne technische Events. */
export const DEFAULT_PARTICIPANT_AUDIENCE: ActivityAudience = "coach";

export function filterDefaultParticipantView(events: AuditEvent[]): AuditEvent[] {
  return filterForAudience(events, DEFAULT_PARTICIPANT_AUDIENCE);
}
