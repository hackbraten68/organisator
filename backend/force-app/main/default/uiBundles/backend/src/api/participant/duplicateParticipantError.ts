/**
 * Raised when a contact already has a participant.
 *
 * The Apex trigger rejects the insert with a message that starts with
 * `DUPLICATE_PARTICIPANT_FOR_CONTACT`. A trigger exception reaches the caller
 * as a DmlException, and the UI API GraphQL layer forwards the message
 * verbatim — so the stable code is matched here and turned into a typed error
 * the UI can render. Matching on the code, not on prose, is the contract
 * (ADR-007).
 */
export const DUPLICATE_PARTICIPANT_FOR_CONTACT =
  'DUPLICATE_PARTICIPANT_FOR_CONTACT';

export class DuplicateParticipantForContactError extends Error {
  readonly contactId: string;

  constructor(contactId: string, message: string) {
    super(message);
    this.name = 'DuplicateParticipantForContactError';
    this.contactId = contactId;
  }
}

/**
 * True when a GraphQL error carries the duplicate-contact code anywhere in the
 * message. Salesforce wraps trigger errors a few layers deep, so a substring
 * test is the only reliable shape; the code is what makes it safe.
 */
export function isDuplicateParticipantError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(DUPLICATE_PARTICIPANT_FOR_CONTACT)
  );
}
