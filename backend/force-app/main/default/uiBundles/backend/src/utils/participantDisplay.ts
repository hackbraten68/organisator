/**
 * Display helpers for the participant views.
 *
 * The Contact is the person, the Participant__c is their role in the academy
 * (ADR-001, ADR-009). So wherever the UI shows *a person* — a name, an email
 * address — it reads the contact first and only falls back to the participant's
 * own snapshot fields.
 *
 * The fallback is deliberate and temporary. `Participant__c.Email__c` is
 * denormalised and can be edited in the detail page, so it can disagree with
 * the contact. It stays as a fallback until every record is verified to have a
 * contact, the reports are checked, and the automations are re-pointed — after
 * which the field is dropped rather than kept in sync.
 *
 * Both helpers live here so the precedence rule exists exactly once instead of
 * being re-implemented per component.
 */
import type { Participant } from "@/types/participant";

/** The name to show for a participant: the person's, falling back to the role's. */
export function participantDisplayName(participant: Participant): string {
  return participant.contact?.name?.trim() || participant.name;
}

/** The email to show for a participant: the person's, falling back to the snapshot. */
export function participantDisplayEmail(participant: Participant): string | undefined {
  return participant.contact?.email?.trim() || participant.email;
}
