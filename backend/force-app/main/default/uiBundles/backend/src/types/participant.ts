/**
 * Participant domain types (mirror Participant__c).
 *
 * Status values match the org picklist: Onboarding (default), Active, Paused,
 * Graduated, Placed, Dropped.
 */

export const PARTICIPANT_STATUSES = [
  "Onboarding",
  "Active",
  "Paused",
  "Graduated",
  "Placed",
  "Dropped",
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export interface Participant {
  id: string;
  name: string;
  status: string;
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
