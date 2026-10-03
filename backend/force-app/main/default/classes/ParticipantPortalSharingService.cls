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
 *     - Portal_User__c set     -> exactly one Read share for that user
 *     - Portal_User__c changed -> the old user's share is removed
 *     - Portal_User__c cleared -> the share is removed
 *     - unchanged              -> nothing happens
 *
 *   It never touches shares of other row causes, so an administrator's manual
 *   grant or a sharing rule on this object is left alone. That separation is
 *   what the dedicated Portal_Access__c reason exists for; see
 *   PORTAL_ROW_CAUSE.
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
     * A dedicated Apex Sharing Reason makes attribution trivial: this service
     * only ever touches shares carrying this reason, and every other share on
     * Participant__c — an administrator's manual grant, a sharing rule, a
     * territory rule — is by construction none of its business.
     *
     * The reason lives at
     *
     *   Setup → (Switch to Salesforce Classic) → Build → Create → Objects →
     *   Participant → Apex Sharing Reasons → New
     *
     * It is absent from the Lightning Object Manager, which is why a search there
     * comes up empty, and `ApexSharingReason` is missing from the @salesforce/cli
     * registry, so it can be neither deployed nor retrieved — it is a manual step.
     *
     * RowCause is not a writable field (`Field is not writeable:
     * Participant__Share.RowCause`), so shares created under an earlier reason
     * cannot be migrated in place. Run synchroniseAll() after changing this
     * constant: it deletes shares under the old reason and re-grants under the
     * new one.
     */
    public static final String PORTAL_ROW_CAUSE = 'Portal_Access__c';

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
        /** Shares to remove: they carry our reason but no longer match the target. */
        public List<Participant__Share> remove = new List<Participant__Share>();
        /** Shares to create, at PORTAL_ACCESS_LEVEL. */
        public List<Participant__Share> grant = new List<Participant__Share>();
    }

    /**
     * Brings the portal's Read shares for the given participants into line with
     * their Portal_User__c.
     *
     * @param participants rows to reconcile. Ids that do not exist are ignored.
     */
    public static void synchronise(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return;
        }

        SharePlan plan = planFor(participants);

        report('removed', Database.delete(plan.remove, false));
        report('granted', Database.insert(plan.grant, false));
    }

    /**
     * Works out which shares should exist for the given participants. No DML.
     *
     * @param participants rows to reconcile. Rows without an Id are ignored.
     */
    public static SharePlan planFor(List<Participant__c> participants) {
        Set<Id> rowIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Id != null) {
                rowIds.add(participant.Id);
            }
        }
        if (rowIds.isEmpty()) {
            return new SharePlan();
        }

        Map<Id, Map<Id, Participant__Share>> byRow = new Map<Id, Map<Id, Participant__Share>>();
        for (Participant__Share share : [
            SELECT Id, ParentId, UserOrGroupId
            FROM Participant__Share
            WHERE ParentId IN :rowIds
                AND RowCause = :PORTAL_ROW_CAUSE
        ]) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Participant__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }

        return planFor(participants, byRow);
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
     * @param existingShares the portal shares currently held for these rows, keyed
     *        by row id and then by user or group id. Rows absent from it are
     *        treated as having no share.
     */
    public static SharePlan planFor(
        List<Participant__c> participants,
        Map<Id, Map<Id, Participant__Share>> existingShares
    ) {
        SharePlan plan = new SharePlan();
        if (participants == null || participants.isEmpty()) {
            return plan;
        }

        Map<Id, Participant__c> participantsById = new Map<Id, Participant__c>();
        for (Participant__c participant : participants) {
            if (participant.Id != null) {
                participantsById.put(participant.Id, participant);
            }
        }

        Map<String, Participant__Share> existing = new Map<String, Participant__Share>();
        for (Map<Id, Participant__Share> perRow : existingShares.values()) {
            for (Participant__Share share : perRow.values()) {
                existing.put(key(share.ParentId, share.UserOrGroupId), share);
            }
        }

        // Everything in `existing` already carries PORTAL_ROW_CAUSE, so there is
        // nothing else to check: a share that no longer points at the row's
        // release target is ours to remove. Shares under any other reason were
        // never in this collection and cannot be touched.
        for (Participant__Share share : existing.values()) {
            Participant__c participant = participantsById.get(share.ParentId);
            if (participant == null) {
                continue;
            }
            if (participant.Portal_User__c != share.UserOrGroupId) {
                plan.remove.add(share);
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
                        RowCause = Schema.Participant__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        return plan;
    }

    /**
     * Brings every portal share in the org into line with Portal_User__c.
     *
     * Complete, in both directions: rows that gained a portal user get a share,
     * rows whose release target was cleared lose theirs. The trigger handles the
     * single-row case; this entry point is for everything the trigger could not
     * see — rows imported through Setup or the data loader, a target changed
     * while the trigger was inactive, and shares left behind when
     * PORTAL_ROW_CAUSE was changed (RowCause cannot be updated, so shares created
     * under an earlier reason have to be replaced rather than converted).
     *
     * Only shares carrying PORTAL_ROW_CAUSE are considered, so an administrator's
     * manual grant on a participant is never removed by a reconcile.
     */
    public static void synchroniseAll() {
        // Two queries rather than `Portal_User__c != null OR Id IN (...)`: Apex
        // does not allow a semi-join sub-select combined with OR.
        Set<Id> releasedRows = new Set<Id>();
        for (Participant__Share share : [
            SELECT ParentId
            FROM Participant__Share
            WHERE RowCause = :PORTAL_ROW_CAUSE
        ]) {
            releasedRows.add(share.ParentId);
        }

        List<Participant__c> participants = [
            SELECT Id, Portal_User__c
            FROM Participant__c
            WHERE Portal_User__c != null
        ];
        for (Participant__c participant : [
            SELECT Id, Portal_User__c
            FROM Participant__c
            WHERE Id IN :releasedRows
        ]) {
            if (participant.Portal_User__c == null) {
                participants.add(participant);
            }
        }

        synchronise(participants);
    }

    // --- Learning_Path__c sharing ---

    /**
     * RowCause used for every Learning_Path__c share this service manages.
     *
     * The same dedicated Apex Sharing Reason as on Participant__c, reused here
     * so that portal-managed shares are attributable across both objects.
     */
    public static final String LEARNING_PATH_ROW_CAUSE = 'Portal_Access__c';

    /**
     * What a Learning_Path__c synchronise call intends to do, before any of it
     * is written. Mirrors SharePlan for the child object.
     */
    public class LearningPathSharePlan {
        /** Shares to remove: they carry our reason but no longer match the target. */
        public List<Learning_Path__Share> remove = new List<Learning_Path__Share>();
        /** Shares to create, at PORTAL_ACCESS_LEVEL. */
        public List<Learning_Path__Share> grant = new List<Learning_Path__Share>();
    }

    /**
     * Brings the portal's Read shares for the given learning paths into line with
     * their parent Participant__c.Portal_User__c.
     *
     * The grant target is indirect: Learning_Path__c → Participant__c →
     * Portal_User__c. The query loads the parent participants to resolve it.
     *
     * @param learningPaths rows to reconcile. Ids that do not exist are ignored.
     */
    public static void synchroniseLearningPaths(List<Learning_Path__c> learningPaths) {
        if (learningPaths == null || learningPaths.isEmpty()) {
            return;
        }

        LearningPathSharePlan plan = planForLearningPaths(learningPaths);

        report('removed', Database.delete(plan.remove, false));
        report('granted', Database.insert(plan.grant, false));
    }

    /**
     * Works out which shares should exist for the given learning paths. No DML.
     *
     * @param learningPaths rows to reconcile. Rows without an Id are ignored.
     */
    public static LearningPathSharePlan planForLearningPaths(List<Learning_Path__c> learningPaths) {
        Set<Id> rowIds = new Set<Id>();
        Set<Id> participantIds = new Set<Id>();
        for (Learning_Path__c lp : learningPaths) {
            if (lp.Id != null) {
                rowIds.add(lp.Id);
            }
            if (lp.Participant__c != null) {
                participantIds.add(lp.Participant__c);
            }
        }
        if (rowIds.isEmpty()) {
            return new LearningPathSharePlan();
        }

        Map<Id, Map<Id, Learning_Path__Share>> byRow = new Map<Id, Map<Id, Learning_Path__Share>>();
        for (Learning_Path__Share share : [
            SELECT Id, ParentId, UserOrGroupId
            FROM Learning_Path__Share
            WHERE ParentId IN :rowIds
                AND RowCause = :LEARNING_PATH_ROW_CAUSE
        ]) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Learning_Path__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }

        Map<Id, Participant__c> participantsById = new Map<Id, Participant__c>();
        for (Participant__c p : [
            SELECT Id, Portal_User__c
            FROM Participant__c
            WHERE Id IN :participantIds
        ]) {
            participantsById.put(p.Id, p);
        }

        return planForLearningPaths(learningPaths, byRow, participantsById);
    }

    /**
     * The same decision, against a caller-supplied view of the existing shares
     * and parent participants.
     *
     * Exists because a share row cannot be inserted in an Apex test: the test
     * context applies the object's internal default access level (Edit, from
     * sharingModel = ReadWrite) and refuses anything at or below it as trivial,
     * 'Edit' included. Passing the current state in keeps the logic under test
     * without forcing the tests to manufacture rows the platform will not accept.
     *
     * @param existingShares the portal shares currently held for these rows, keyed
     *        by row id and then by user or group id. Rows absent from it are
     *        treated as having no share.
     * @param participantsById the parent participants by id, used to resolve the
     *        grant target. Participants absent from it are treated as having no
     *        portal user.
     */
    public static LearningPathSharePlan planForLearningPaths(
        List<Learning_Path__c> learningPaths,
        Map<Id, Map<Id, Learning_Path__Share>> existingShares,
        Map<Id, Participant__c> participantsById
    ) {
        LearningPathSharePlan plan = new LearningPathSharePlan();
        if (learningPaths == null || learningPaths.isEmpty()) {
            return plan;
        }

        Map<Id, Learning_Path__c> learningPathsById = new Map<Id, Learning_Path__c>();
        for (Learning_Path__c lp : learningPaths) {
            if (lp.Id != null) {
                learningPathsById.put(lp.Id, lp);
            }
        }

        Map<String, Learning_Path__Share> existing = new Map<String, Learning_Path__Share>();
        for (Map<Id, Learning_Path__Share> perRow : existingShares.values()) {
            for (Learning_Path__Share share : perRow.values()) {
                existing.put(lpKey(share.ParentId, share.UserOrGroupId), share);
            }
        }

        // Everything in `existing` already carries LEARNING_PATH_ROW_CAUSE, so there
        // is nothing else to check: a share that no longer points at the row's
        // release target is ours to remove. Shares under any other reason were
        // never in this collection and cannot be touched.
        for (Learning_Path__Share share : existing.values()) {
            Learning_Path__c lp = learningPathsById.get(share.ParentId);
            if (lp == null) {
                continue;
            }
            Participant__c participant = participantsById.get(lp.Participant__c);
            Id portalUserId = participant != null ? participant.Portal_User__c : null;
            if (portalUserId != share.UserOrGroupId) {
                plan.remove.add(share);
            }
        }

        for (Learning_Path__c lp : learningPaths) {
            if (lp.Id == null || lp.Participant__c == null) {
                continue;
            }
            Participant__c participant = participantsById.get(lp.Participant__c);
            if (participant == null || participant.Portal_User__c == null) {
                continue;
            }
            Id portalUserId = participant.Portal_User__c;
            if (!existing.containsKey(lpKey(lp.Id, portalUserId))) {
                plan.grant.add(
                    new Learning_Path__Share(
                        ParentId = lp.Id,
                        UserOrGroupId = portalUserId,
                        AccessLevel = PORTAL_ACCESS_LEVEL,
                        RowCause = Schema.Learning_Path__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        return plan;
    }

    private static String key(Id parentId, Id userOrGroupId) {
        return String.valueOf(parentId) + ':' + String.valueOf(userOrGroupId);
    }

    private static String lpKey(Id parentId, Id userOrGroupId) {
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