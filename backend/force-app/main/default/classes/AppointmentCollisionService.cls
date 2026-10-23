/**
 * The rules of the collision guard on Appointment__c (ADR-016).
 *
 * The rules live here rather than in the trigger, because a trigger cannot
 * declare methods and because the rules are worth testing without a DML
 * round trip. The trigger collects the candidates, asks the database once and
 * asks this class whether something collides.
 *
 * WHY THE RULES ARE SHAPED THIS WAY
 *
 * - A conflict is about a *coach's* time, not about a participant: the same
 *   coach cannot be in two appointments at once, whatever the participants are.
 *   `Appointment__c.Coach__c` points at `User`, so the key is the user id.
 * - `Cancelled` frees a time. Every other status occupies it — including
 *   `NoShow`, where the slot really was taken and the coach was not there.
 * - A conflict is a *change* in the occupied time, so only some fields can
 *   create one. `Participant__c` is not among them: a different participant on
 *   the same coach at the same time is exactly the conflict this class is
 *   meant to find, and a change of participant alone does not move the coach's
 *   calendar.
 *
 * The class performs no DML. Its one query is deliberately run `without
 * sharing`: the guard has to see every appointment of a coach, whoever
 * writes. In the trigger's own sharing context a writer without
 * `viewAllRecords` on `Appointment__c` would see only part of the calendar —
 * and the conflict would be missed without any visible sign. The same
 * pattern `ParticipantPortalSharingService` uses for the same reason.
 */
public without sharing class AppointmentCollisionService {
    /**
     * The statuses that occupy a coach's time.
     *
     * `Cancelled` is the only status that does not. A cancelled appointment
     * freed its slot, so it can never be the reason for a conflict — and a
     * cancelled appointment may stay in the past next to a live one.
     */
    public static final Set<String> BLOCKING_STATUSES = new Set<String>{
        'Draft',
        'Finding',
        'Confirmed',
        'Completed',
        'NoShow'
    };

    /**
     * The fields whose change can create a new conflict.
     *
     * `Status__c` counts only insofar as the change moves the record into or
     * out of a blocking status — see `isCollisionRelevantChange`. The list is
     * the contract ADR-016 names; the comparisons in
     * `isCollisionRelevantChange` are its implementation, and the test pins
     * the two together.
     */
    public static final List<String> COLLISION_RELEVANT_FIELDS = new List<String>{
        'Coach__c',
        'StartTime__c',
        'EndTime__c',
        'Status__c'
    };

    /**
     * The stored appointments of the given coaches that could collide.
     *
     * The window is a coarse pre-filter: the exact overlap is decided per
     * record afterwards, because the batch can hold several windows. Only the
     * blocking statuses are read — a cancelled appointment occupies nothing.
     */
    public static List<Appointment__c> findStoredAppointments(
        Set<Id> coachIds,
        Datetime earliest,
        Datetime latest
    ) {
        if (coachIds.isEmpty() || earliest == null || latest == null) {
            return new List<Appointment__c>();
        }
        Set<String> blocking = BLOCKING_STATUSES;
        return [
            SELECT Id, Coach__c, StartTime__c, EndTime__c, Status__c
            FROM Appointment__c
            WHERE Coach__c IN :coachIds
            AND Status__c IN :blocking
            AND StartTime__c < :latest
            AND EndTime__c > :earliest
        ];
    }

    /**
     * Whether a status occupies a coach's time.
     */
    public static Boolean isBlocking(String status) {
        return status != null && BLOCKING_STATUSES.contains(status);
    }

    /**
     * Whether a write touches the start or the end time.
     *
     * `before` is null on insert. On update, a record whose times did not
     * change is not re-validated: a historically broken interval stays as it is
     * and must not block an unrelated correction.
     */
    public static Boolean writesTimes(Appointment__c before, Appointment__c after) {
        if (before == null) {
            return true;
        }
        return before.StartTime__c != after.StartTime__c || before.EndTime__c != after.EndTime__c;
    }

    /**
     * Whether the change between two versions of a record can create a new
     * conflict.
     *
     * A change of coach moves the record to another calendar. A change of
     * time moves it to another slot. A change of status only matters when it
     * moves the record into or out of a blocking status: between two blocking
     * statuses the slot was occupied before and after, so no new conflict can
     * arise from it.
     */
    public static Boolean isCollisionRelevantChange(Appointment__c before, Appointment__c after) {
        if (before == null) {
            // Ohne den Vorzustand laesst sich nichts beurteilen — dann wird
            // geprueft. Fail closed.
            return true;
        }
        if (before.Coach__c != after.Coach__c) {
            return true;
        }
        if (before.StartTime__c != after.StartTime__c) {
            return true;
        }
        if (before.EndTime__c != after.EndTime__c) {
            return true;
        }
        return isBlocking(before.Status__c) != isBlocking(after.Status__c);
    }

    /**
     * Whether two time windows overlap.
     *
     * `existingStart < candidateEnd AND existingEnd > candidateStart`. Windows
     * that only touch — one ends exactly when the other begins — do not
     * overlap: a coach can start the next appointment right after the last one.
     *
     * The comparison is on `Datetime` values, which Salesforce stores in UTC.
     * No time zone is shifted here, because nothing has to be: the stored
     * values are already the same instant in the same frame of reference.
     */
    public static Boolean overlaps(
        Datetime candidateStart,
        Datetime candidateEnd,
        Datetime existingStart,
        Datetime existingEnd
    ) {
        if (candidateStart == null || candidateEnd == null || existingStart == null || existingEnd == null) {
            return false;
        }
        return candidateStart < existingEnd && candidateEnd > existingStart;
    }
}
