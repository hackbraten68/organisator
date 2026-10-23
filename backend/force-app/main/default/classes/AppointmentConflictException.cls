/**
 * Raised when a write to Appointment__c conflicts with the data model.
 *
 * Two codes, two meanings, two answers:
 *
 * - `APPOINTMENT_TIME_CONFLICT` — the requested time window is already taken
 *   for this coach. The named write entry point answers 409.
 * - `INVALID_INTERVAL` — the appointment's own start and end are not a valid
 *   interval. The answer is 400. The code is the same one the named entry
 *   point has always used, so both ways make the same statement.
 *
 * The message starts with a stable, machine-readable code because the UI API
 * GraphQL error path hands the Apex message through verbatim (see
 * `src/api/graphqlClient.ts`) — that prefix is the contract. It is the same
 * arrangement as `DuplicateParticipantForContactException`.
 *
 * The text itself is deliberately sparse: it names no participant, no coach,
 * no appointment id and no record. The detail belongs in the log, not in the
 * answer to the browser (ADR-016, "datensparsame Fehlermeldung").
 *
 * There is deliberately no custom constructor. On API 67 the inherited
 * `Exception(String)` cannot be redeclared and `super(message)` is not
 * callable from a subclass — the same constraint that shaped
 * `DuplicateParticipantForContactException`.
 */
public class AppointmentConflictException extends Exception {
    public static final String CODE_TIME_CONFLICT = 'APPOINTMENT_TIME_CONFLICT';
    public static final String CODE_INVALID_INTERVAL = 'INVALID_INTERVAL';

    /**
     * The message for a time conflict on a coach's calendar.
     */
    public static String messageForTimeConflict() {
        return CODE_TIME_CONFLICT + ': Der Zeitraum ist beim Coach bereits belegt.';
    }

    /**
     * The message for an interval that is not a valid one.
     */
    public static String messageForInvalidInterval() {
        return CODE_INVALID_INTERVAL + ': Die Startzeit muss vor der Endzeit liegen.';
    }
}
