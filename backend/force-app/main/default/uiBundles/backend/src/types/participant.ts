/**
 * Participant domain types (mirror Participant__c).
 *
 * Status values match the org picklist: Onboarding (default), Active, Paused,
 * Graduated, Placed, Dropped.
 */

export const PARTICIPANT_STATUSES = [
  'Onboarding',
  'Active',
  'Paused',
  'Graduated',
  'Placed',
  'Dropped',
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/**
 * The person behind the participant role (ADR-001).
 *
 * Every participant has a contact — `Participant__c.Contact__c` is required —
 * but the object is queried as `@optional` so a partially wired record does not
 * take the whole list down. The display helpers below fall back to the
 * participant's own snapshot fields when it is missing.
 */
export interface ParticipantContact {
  id: string;
  name?: string;
  email?: string;
}

export interface Participant {
  id: string;
  name: string;
  status: string;
  /** The person this participant role belongs to (ADR-001). Read-only here. */
  contactId?: string;
  contact?: ParticipantContact;
  createdAt?: string;
  email?: string;
  github?: string;
  discord?: string;
  startDate?: string;
  expectedEndDate?: string;
  programId?: string;
  programName?: string;
  coachId?: string;
  coachName?: string;
}

export interface ParticipantPatch {
  name?: string;
  status?: string;
  email?: string | null;
  github?: string | null;
  discord?: string | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
  programId?: string | null;
  coachId?: string | null;
}
