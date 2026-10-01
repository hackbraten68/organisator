/**
 * Keeps record-level access for Participant__c in sync with Portal__User__c.
 *
 * WHY THIS EXISTS INSTEAD OF A SHARING RULE
 *   A Criteria-Based Sharing Rule on Participant__c.Portal_User__c =
 *   $User.UserRecord.Id (or $User.Id) is the obvious declarative answer, and the
 *   org accepts the value in the UI and displays it back. It does not evaluate
 *   it. Both variants were measured and stored as literals, so the rule matched
 *   no row and every portal user got NO_PARTICIPANT — see
 *   backend/docs/portal-deploy-status.md.
 *
 *   Managed sharing is the supported way to express "this row belongs to
 *   exactly this portal user". It also expresses it better than a rule would:
 *   isolation is per user, not per Account, so two portal users on the same
 *   Account still only ever see their own row.
 *
 * WHAT IT GUARANTEES
 *   For the given participants it makes the set of Portal_Access__c shares
 *   match Participant__c.Portal_User__c exactly:
 *     - Portal_User__c set    -> exactly one Read share for that user
 *     - Portal_User__c changed-> the old user's share is removed
 *     - Portal_User__c cleared-> the share is removed
 *     - unchanged             -> nothing happens
 *
 *   It never touches shares of other row causes, so manual or other automated
 *   sharing on this object is left alone.
 *
 * FAIL-CLOSED
 *   A share that cannot be granted aborts the transaction. Partial access is
 *   worse than none: the caller would see a participant who is not really
 *   provisioned. Errors are logged at ERROR level and re-thrown.
 *
 * CONCURRENCY
 *   Read-then-write on the share rows, so two simultaneous transactions can in
 *   principle both insert the same share; the second fails with a duplicate
 *   error and the transaction is rolled back rather than silently diverging.
 *   That window is accepted and documented, mirroring ParticipantContactUniqueness.
 *
 * Runs `without sharing` on purpose: this is administrative infrastructure. It
 * has to be able to grant access to a row the calling user cannot see.
 */
public without sharing class ParticipantPortalSharingService {

    /** Thrown when the desired access cannot be brought into the actual state. */
    public class SharingException extends Exception {
    }

    /**
     * Brings Portal_Access__c shares for the given participants into line with
     * their Portal_User__c.
     *
     * @param participants rows to reconcile. Ids that do not exist are ignored.
     */
    public static void synchronise(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return;
        }

        Map<Id, Id> desired = new Map<Id, Id>();
        Set<Id> rowIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Id == null) {
                continue;
            }
            rowIds.add(participant.Id);
            if (participant.Portal_User__c != null) {
                desired.put(participant.Id, participant.Portal_User__c);
            }
        }
        if (rowIds.isEmpty()) {
            return;
        }

        Map<String, Participant__Share> existing = new Map<String, Participant__Share>();
        for (Participant__Share share : [
            SELECT Id, ParentId, UserOrGroupId
            FROM Participant__Share
            WHERE ParentId IN :rowIds
                AND RowCause = 'Portal_Access__c'
        ]) {
            existing.put(key(share.ParentId, share.UserOrGroupId), share);
        }

        List<Participant__Share> toDelete = new List<Participant__Share>();
        for (Participant__Share share : existing.values()) {
            if (desired.get(share.ParentId) != share.UserOrGroupId) {
                toDelete.add(share);
            }
        }

        List<Participant__Share> toInsert = new List<Participant__Share>();
        for (Participant__c participant : participants) {
            Id portalUserId = participant.Portal_User__c;
            if (participant.Id == null || portalUserId == null) {
                continue;
            }
            if (!existing.containsKey(key(participant.Id, portalUserId))) {
                toInsert.add(
                    new Participant__Share(
                        ParentId = participant.Id,
                        UserOrGroupId = portalUserId,
                        AccessLevel = 'Read',
                        RowCause = Schema.Participant__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        report('removed', Database.delete(toDelete, false));
        report('granted', Database.insert(toInsert, false));
    }

    /**
     * Reconciles every participant that is linked to a portal user, plus every
     * participant that still carries a portal share. The second half matters:
     * clearing Portal_User__c must clean up, and that path has no row to read
     * Portal_User__c from.
     */
    public static void synchroniseAll() {
        synchronise(
            [
                SELECT Id, Portal_User__c
                FROM Participant__c
                WHERE Portal_User__c != null
            ]
        );
        synchronise(
            [
                SELECT Id, Portal_User__c
                FROM Participant__c
                WHERE Id IN (SELECT ParentId FROM Participant__Share WHERE RowCause = 'Portal_Access__c')
            ]
        );
    }

    private static String key(Id parentId, Id userOrGroupId) {
        return String.valueOf(parentId) + ':' + String.valueOf(userOrGroupId);
    }

    private static void report(String action, List<Database.SaveResult> results) {
        List<String> failures = new List<String>();
        for (Database.SaveResult result : results) {
            if (result.isSuccess()) {
                continue;
            }
            for (Database.Error error : result.getErrors()) {
                failures.add(error.getStatusCode() + ': ' + error.getMessage());
            }
        }
        if (failures.isEmpty()) {
            return;
        }
        System.debug(
            LoggingLevel.ERROR,
            'ParticipantPortalSharingService could not be ' + action + ': ' + String.join(failures, '; ')
        );
        throw new SharingException(
            'ParticipantPortalSharingService could not be ' + action + ' access: ' + String.join(failures, '; ')
        );
    }
}