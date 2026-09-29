/**
 * Contact domain types.
 *
 * A Contact is the person (ADR-001). A Participant__c is that person's role
 * in the academy. Name and email live here and nowhere else — the
 * `Participant__c.Email__c` snapshot is derived, not an independent source.
 */

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  phone?: string;
  accountId?: string;
  accountName?: string;
  /** The participant this contact already holds, if any. Drives the action area. */
  participantId?: string | null;
  participantName?: string | null;
}

export interface ContactPatch {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

/** Fields a staff member may choose when turning a contact into a participant. */
export interface CreateParticipantFromContactInput {
  contactId: string;
  programId?: string | null;
  coachId?: string | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
}
