/**
 * Raised when a Contact already has a Participant__c.
 *
 * The message starts with a stable, machine-readable code so the UI layer can
 * map it to a German message without string-matching on prose. The UI API
 * GraphQL error path hands the Apex message through verbatim (see
 * src/api/graphqlClient.ts), so that prefix is the contract.
 *
 * There is deliberately no custom constructor. On API 67 the inherited
 * `Exception(String)` cannot be redeclared ("System exception constructor
 * already defined") and `super(message)` is not callable from a subclass
 * ("Method is not visible: System.ApexBaseException.<init>(String)"). The
 * inherited constructor is the only option, so both ids travel in the
 * message where the UI and the log can read them.
 *
 * The check lives in ParticipantContactUniqueness rather than in a before-save
 * flow: two nearly simultaneous transactions can both observe "no participant
 * yet" and both pass (ADR-007).
 */
public class DuplicateParticipantForContactException extends Exception {
  public static final String CODE = 'DUPLICATE_PARTICIPANT_FOR_CONTACT';

  /**
   * Builds the message for a contact that is already claimed.
   */
  public static String messageFor(Id contactId, Id existingParticipantId) {
    return CODE +
      ': Contact ' +
      contactId +
      ' is already assigned to participant ' +
      existingParticipantId +
      '.';
  }
}
