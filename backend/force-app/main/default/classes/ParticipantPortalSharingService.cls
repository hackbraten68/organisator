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

    /**
     * RowCause used for every share this service manages.
     *
     * The obvious choice would be a dedicated Apex Sharing Reason
     * (`Portal_Access__c`), which would make attribution trivial: the service
     * would simply filter on it. That is not available in this sandbox. The type
     * is missing from the @salesforce/cli registry, so it can be neither
     * deployed nor retrieved, and Setup does not offer the menu entry for it.
     * `Participant__Share` itself works — it is queryable, createable, and rows
     * inserted through it are effective — so only the label is unavailable.
     *
     * The cost is real and worth stating: with `Manual` the RowCause no longer
     * distinguishes our shares, so a share is recognised as ours by identity
     * instead — its `UserOrGroupId` must equal the row's previous or current
     * `Portal_User__c`. An administrator's manual share to some third user is
     * therefore never touched, but an administrator's manual share to the *same*
     * user the portal manages cannot be told apart from ours and would be
     * removed when the release target changes.
     *
     * Change this constant back to a real sharing reason as soon as one can be
     * created; the identity check in isOurs() then becomes redundant but stays
     * harmless.
     */
    public static final String PORTAL_ROW_CAUSE = 'Manual';

    /** The access level every portal share is granted at. */
    public static final String PORTAL_ACCESS_LEVEL = 'Read';

    /** Thrown when the desired access cannot be brought into the actual state. */
    public class SharingException extends Exception {
    }

    /**
     * What a synchronise call intends to do, before any of it is written.
     *
     * Split out from synchronise() because a test cannot insert a share row at
     * all: the test context applies the object's internal default access level
     * (Edit, from sharingModel = ReadWrite) and rejects anything at or below it
     * as trivial, including 'Edit' itself. The decision is the part with the
     * logic worth testing, so it is returned separately and can be asserted on
     * without touching the database.
     */
    public class SharePlan {
        /** Shares whose target is no longer the released user, and ours to remove. */
        public List<Participant__Share> remove = new List<Participant__Share>();
        /** Shares to create, at PORTAL_ACCESS_LEVEL. */
        public List<Participant__Share> grant = new List<Participant__Share>();
        /** Shares that could not be attributed to the portal and were left alone. */
        public List<Participant__Share> keptAsAmbiguous = new List<Participant__Share>();
    }

    /**
     * Brings the portal's Read shares for the given participants into line with
     * their Portal_User__c.
     *
     * @param participants rows to reconcile. Ids that do not exist are ignored.
     * @param previousPortalUsers the Portal_User__c value each row had before
     *        the change, keyed by row id. This is what identifies a share as
     *        ours once RowCause carries no distinguishing value — see
     *        PORTAL_ROW_CAUSE. Pass null for a full reconcile, which then may
     *        only add shares, never remove an ambiguous one.
     */
    public static void synchronise(
        List<Participant__c> participants,
        Map<Id, Id> previousPortalUsers
    ) {
        if (participants == null || participants.isEmpty()) {
            return;
        }

        SharePlan plan = planFor(participants, previousPortalUsers);

        for (Participant__Share share : plan.keptAsAmbiguous) {
            System.debug(
                LoggingLevel.WARN,
                'ParticipantPortalSharingService kept a share it cannot attribute to the portal '
                    + '(row ' + share.ParentId + ', user ' + share.UserOrGroupId
                    + '). Set Portal_User__c to the same user to adopt it, or remove it by hand.'
            );
        }

        report('removed', Database.delete(plan.remove, false));
        report('granted', Database.insert(plan.grant, false));
    }

    /**
     * Works out which shares should exist for the given participants. No DML.
     *
     * @param participants rows to reconcile. Rows without an Id are ignored.
     * @param previousPortalUsers the Portal_User__c value each row had before
     *        the change, keyed by row id. This is what identifies a share as
     *        ours once RowCause carries no distinguishing value. Pass null for a
     *        full reconcile, which then only ever grants.
     */
    public static SharePlan planFor(
        List<Participant__c> participants,
        Map<Id, Id> previousPortalUsers
    ) {
        SharePlan plan = new SharePlan();
        if (participants == null || participants.isEmpty()) {
            return plan;
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
            return plan;
        }

        Map<String, Participant__Share> byKey = new Map<String, Participant__Share>();
        for (Participant__Share share : [
            SELECT Id, ParentId, UserOrGroupId
            FROM Participant__Share
            WHERE ParentId IN :rowIds
                AND RowCause = :PORTAL_ROW_CAUSE
        ]) {
            byKey.put(key(share.ParentId, share.UserOrGroupId), share);
        }

        Map<Id, Map<Id, Participant__Share>> byRow = new Map<Id, Map<Id, Participant__Share>>();
        for (Participant__Share share : byKey.values()) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Participant__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }

        return planFor(participants, previousPortalUsers, byRow);
    }

    /**
     * The same decision, against a caller-supplied view of the existing shares.
     *
     * Exists because a share row cannot be inserted in an Apex test: the test
     * context applies the object's internal default access level (Edit, from
     * sharingModel = ReadWrite) and refuses anything at or below it as trivial,
     * 'Edit' included. Passing the current state in keeps the logic under test
     * without forcing the tests to manufacture rows the platform will not accept.
     *
     * @param existingShares the shares currently held for these rows, keyed by
     *        row id and then by user or group id. Rows absent from it are treated
     *        as having no share.
     */
    public static SharePlan planFor(
        List<Participant__c> participants,
        Map<Id, Id> previousPortalUsers,
        Map<Id, Map<Id, Participant__Share>> existingShares
    ) {
        SharePlan plan = new SharePlan();
        if (participants == null || participants.isEmpty()) {
            return plan;
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
            return plan;
        }

        Map<String, Participant__Share> existing = new Map<String, Participant__Share>();
        for (Map<Id, Participant__Share> perRow : existingShares.values()) {
            for (Participant__Share share : perRow.values()) {
                existing.put(key(share.ParentId, share.UserOrGroupId), share);
            }
        }

        // A share is ours to remove only if it points at the user we released
        // the row to — the previous one (supplied by the trigger) or the current
        // one. Anything else is somebody else's manual share and stays untouched.
        for (Participant__Share share : existing.values()) {
            if (desired.get(share.ParentId) == share.UserOrGroupId) {
                continue;
            }
            if (isOurs(share, previousPortalUsers)) {
                plan.remove.add(share);
            } else {
                plan.keptAsAmbiguous.add(share);
            }
        }

        for (Participant__c participant : participants) {
            Id portalUserId = participant.Portal_User__c;
            if (participant.Id == null || portalUserId == null) {
                continue;
            }
            if (!existing.containsKey(key(participant.Id, portalUserId))) {
                plan.grant.add(
                    new Participant__Share(
                        ParentId = participant.Id,
                        UserOrGroupId = portalUserId,
                        AccessLevel = PORTAL_ACCESS_LEVEL,
                        RowCause = Schema.Participant__Share.RowCause.Manual
                    )
                );
            }
        }

        return plan;
    }

    /** True when this share points at the user the row was released to before. */
    private static Boolean isOurs(Participant__Share share, Map<Id, Id> previousPortalUsers) {
        if (previousPortalUsers == null) {
            return false;
        }
        return previousPortalUsers.get(share.ParentId) == share.UserOrGroupId;
    }

    /** Convenience for callers that have no previous state to offer. */
    public static void synchronise(List<Participant__c> participants) {
        synchronise(participants, null);
    }

/**
     * Reconciles every participant that is linked to a portal user.
     *
     * Additive only. A row whose Portal_User__c was cleared out of band keeps its
     * share here, because there is no previous value to attribute it by and a
     * wrong deletion would revoke access somebody may depend on. The trigger
     * covers the normal clearing path; this entry point exists to *add* shares
     * for rows that were populated before the trigger existed, or whose portal
     * user was set while it was inactive. It logs what it cannot classify.
     */
    public static void synchroniseAll() {
        synchronise(
            [
                SELECT Id, Portal_User__c
                FROM Participant__c
                WHERE Portal_User__c != null
            ]
        );
    }

    private static String key(Id parentId, Id userOrGroupId) {
        return String.valueOf(parentId) + ':' + String.valueOf(userOrGroupId);
    }

    /** Overload for delete results; Database.delete returns its own result type. */
    private static void report(String action, List<Database.DeleteResult> results) {
        List<String> failures = new List<String>();
        for (Database.DeleteResult result : results) {
            if (result.isSuccess()) {
                continue;
            }
            for (Database.Error error : result.getErrors()) {
                failures.add(error.getStatusCode() + ': ' + error.getMessage());
            }
        }
        report(action, failures);
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
        report(action, failures);
    }

    private static void report(String action, List<String> failures) {
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