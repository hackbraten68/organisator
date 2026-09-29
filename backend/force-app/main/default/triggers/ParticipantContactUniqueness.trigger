/**
 * Enforces one Participant__c per Contact (ADR-001, ADR-007).
 *
 * The domain rule is "a Contact is the person, a Participant__c is their role
 * in the academy". Two participants for the same contact would mean the same
 * person holds two roles, and the portal resolves identity through
 * `User.ContactId -> Participant__c WHERE Contact__c = :contactId` — that
 * lookup would become ambiguous.
 *
 * The check lives in a trigger rather than a before-save flow on purpose: two
 * nearly simultaneous transactions can both read "no participant exists yet"
 * and both pass. A single query inside the trigger narrows the window; the
 * residual race is accepted and documented rather than papered over.
 *
 * `required = true` on Participant__c.Contact__c already guarantees every
 * participant has a contact. This trigger guarantees the converse: no contact
 * is claimed twice.
 */
trigger ParticipantContactUniqueness on Participant__c(
  before insert,
  before update
) {
  Set<Id> candidateContacts = new Set<Id>();
  for (Participant__c participant : Trigger.new) {
    if (participant.Contact__c != null) {
      candidateContacts.add(participant.Contact__c);
    }
  }

  if (candidateContacts.isEmpty()) {
    return;
  }

  Map<Id, Id> contactToParticipant = new Map<Id, Id>();
  for (Participant__c existing : [
    SELECT Id, Contact__c
    FROM Participant__c
    WHERE Contact__c IN :candidateContacts
  ]) {
    contactToParticipant.put(existing.Contact__c, existing.Id);
  }

  for (Participant__c participant : Trigger.new) {
    if (participant.Contact__c == null) {
      continue;
    }

    Id owner = contactToParticipant.get(participant.Contact__c);
    if (owner == null) {
      continue;
    }

    // An update that leaves the contact untouched finds the record itself
    // in the map above. Without this the trigger would reject its own
    // no-op updates.
    if (participant.Id != null && owner == participant.Id) {
      continue;
    }

    throw new DuplicateParticipantForContactException(
      DuplicateParticipantForContactException.messageFor(
        participant.Contact__c,
        owner
      )
    );
  }
}
