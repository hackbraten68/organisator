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

    // --- Appointment__c sharing ---

    /**
     * RowCause used for every Appointment__c share this service manages.
     *
     * The same dedicated Apex Sharing Reason as on Participant__c and
     * Learning_Path__c, so portal-managed shares stay attributable across all
     * three objects.
     */
    public static final String APPOINTMENT_ROW_CAUSE = 'Portal_Access__c';

    /**
     * What an Appointment__c synchronise call intends to do, before any of it is
     * written. Mirrors SharePlan for the parent object.
     */
    public class AppointmentSharePlan {
        /** Shares to remove: they carry our reason but no longer match the target. */
        public List<Appointment__Share> remove = new List<Appointment__Share>();
        /** Shares to create, at PORTAL_ACCESS_LEVEL. */
        public List<Appointment__Share> grant = new List<Appointment__Share>();
    }

    /**
     * Brings the portal's Read shares for the given appointments into line with
     * their Participant__c.Portal_User__c.
     *
     * Same indirect grant target as the learning paths: Appointment__c →
     * Participant__c → Portal_User__c.
     *
     * WHY THIS EXISTS
     *   Appointment__c carries externalSharingModel = Private. A portal user is
     *   an external user, so without a share row they see nothing at all — a
     *   "Meine Termine" page would not be empty, it would be unable to run.
     *   Criteria-based sharing rules are not an option: in this org they do not
     *   evaluate $User (see sharing-spike-ergebnis.md), which is why the same
     *   pattern as Participant__c and Learning_Path__c is used.
     *
     * @param appointments rows to reconcile. Ids that do not exist are ignored.
     */
    public static void synchroniseAppointments(List<Appointment__c> appointments) {
        if (appointments == null || appointments.isEmpty()) {
            return;
        }

        AppointmentSharePlan plan = planForAppointments(appointments);

        report('removed', Database.delete(plan.remove, false));
        report('granted', Database.insert(plan.grant, false));
    }

    /**
     * Works out which shares should exist for the given appointments. No DML.
     *
     * @param appointments rows to reconcile. Rows without an Id are ignored.
     */
    public static AppointmentSharePlan planForAppointments(List<Appointment__c> appointments) {
        Set<Id> rowIds = new Set<Id>();
        Set<Id> participantIds = new Set<Id>();
        for (Appointment__c appointment : appointments) {
            if (appointment.Id != null) {
                rowIds.add(appointment.Id);
            }
            if (appointment.Participant__c != null) {
                participantIds.add(appointment.Participant__c);
            }
        }
        if (rowIds.isEmpty()) {
            return new AppointmentSharePlan();
        }

        Map<Id, Map<Id, Appointment__Share>> byRow = new Map<Id, Map<Id, Appointment__Share>>();
        for (Appointment__Share share : [
            SELECT Id, ParentId, UserOrGroupId
            FROM Appointment__Share
            WHERE ParentId IN :rowIds
                AND RowCause = :APPOINTMENT_ROW_CAUSE
        ]) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Appointment__Share>());
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

        return planForAppointments(appointments, byRow, participantsById);
    }

    /**
     * The same decision, against a caller-supplied view of the existing shares
     * and parent participants.
     *
     * Exists for the same reason as the learning-path overload: an Appointment__c
     * share row cannot be inserted in an Apex test, because the test context
     * applies the object's internal default access level (Edit, from
     * sharingModel = ReadWrite) and refuses anything at or below it as trivial.
     *
     * @param existingShares the portal shares currently held for these rows, keyed
     *        by row id and then by user or group id. Rows absent from it are
     *        treated as having no share.
     * @param participantsById the parent participants by id, used to resolve the
     *        grant target. Participants absent from it are treated as having no
     *        portal user.
     */
    public static AppointmentSharePlan planForAppointments(
        List<Appointment__c> appointments,
        Map<Id, Map<Id, Appointment__Share>> existingShares,
        Map<Id, Participant__c> participantsById
    ) {
        AppointmentSharePlan plan = new AppointmentSharePlan();
        if (appointments == null || appointments.isEmpty()) {
            return plan;
        }

        Map<Id, Appointment__c> appointmentsById = new Map<Id, Appointment__c>();
        for (Appointment__c appointment : appointments) {
            if (appointment.Id != null) {
                appointmentsById.put(appointment.Id, appointment);
            }
        }

        Map<String, Appointment__Share> existing = new Map<String, Appointment__Share>();
        for (Map<Id, Appointment__Share> perRow : existingShares.values()) {
            for (Appointment__Share share : perRow.values()) {
                existing.put(key(share.ParentId, share.UserOrGroupId), share);
            }
        }

        // Everything in `existing` already carries APPOINTMENT_ROW_CAUSE, so a
        // share that no longer points at the row's release target is ours to
        // remove. Shares under any other reason were never in this collection and
        // cannot be touched.
        for (Appointment__Share share : existing.values()) {
            Appointment__c appointment = appointmentsById.get(share.ParentId);
            if (appointment == null) {
                continue;
            }
            Participant__c participant = participantsById.get(appointment.Participant__c);
            Id portalUserId = participant != null ? participant.Portal_User__c : null;
            if (portalUserId != share.UserOrGroupId) {
                plan.remove.add(share);
            }
        }

        for (Appointment__c appointment : appointments) {
            if (appointment.Id == null || appointment.Participant__c == null) {
                continue;
            }
            Participant__c participant = participantsById.get(appointment.Participant__c);
            if (participant == null || participant.Portal_User__c == null) {
                continue;
            }
            Id portalUserId = participant.Portal_User__c;
            if (!existing.containsKey(key(appointment.Id, portalUserId))) {
                plan.grant.add(
                    new Appointment__Share(
                        ParentId = appointment.Id,
                        UserOrGroupId = portalUserId,
                        AccessLevel = PORTAL_ACCESS_LEVEL,
                        RowCause = Schema.Appointment__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        return plan;
    }

    // --- Coach_Profile__c and Program__c sharing ---

    /**
     * RowCause for the Coach_Profile__c shares this service manages.
     *
     * The same dedicated Apex Sharing Reason as on the other three objects, so a
     * portal-managed share is attributable across all of them and an
     * administrator's manual grant is never mistaken for ours. It has to be
     * created in Salesforce Classic — `ApexSharingReason` is not in the
     * @salesforce/cli registry — and without it this class does not compile,
     * because `Schema.Coach_Profile__Share.RowCause.Portal_Access__c` does not
     * exist yet.
     */
    public static final String COACH_PROFILE_ROW_CAUSE = 'Portal_Access__c';

    /** RowCause for the Program__c shares this service manages. Same manual step. */
    public static final String PROGRAM_ROW_CAUSE = 'Portal_Access__c';

    /**
     * What a Coach_Profile__c synchronise intends to do, before any of it is written.
     *
     * Separate from the Program plan on purpose: the two are released for different
     * reasons and a share row should be traceable to the relationship that earned
     * it.
     */
    public class CoachProfileSharePlan {
        /** Shares to remove: ours, for a portal user in scope, no longer wanted. */
        public List<Coach_Profile__Share> remove = new List<Coach_Profile__Share>();
        /** Shares to create, at PORTAL_ACCESS_LEVEL. */
        public List<Coach_Profile__Share> grant = new List<Coach_Profile__Share>();
    }

    /** The same, for Program__c. */
    public class ProgramSharePlan {
        public List<Program__Share> remove = new List<Program__Share>();
        public List<Program__Share> grant = new List<Program__Share>();
    }

    /**
     * Which Coach_Profile__c rows a participant's portal user may read, per participant.
     *
     * Two relationships justify a release, and they are merged:
     *
     *   1. Participant__c.Coach_Profile__c — the participant's own coach, which is
     *      what `/me` prints as coachName.
     *   2. Coach_Profile__c of every coach on an Appointment__c that belongs to the
     *      participant — which is what the appointments page prints.
     *
     * Nothing else. A coach the participant has no appointment with, and a coach
     * belonging to a different participant, are both out of scope.
     *
     * A coach with no Coach_Profile__c contributes nothing and is not an error:
     * `coachName` stays null and the page says so. That fallback is meant to mean
     * "no master data for this coach", which is only true once the sharing gap
     * below is closed.
     */
    public static Map<Id, Set<Id>> desiredCoachProfileIds(List<Participant__c> participants) {
        Map<Id, Set<Id>> desired = new Map<Id, Set<Id>>();
        if (participants == null || participants.isEmpty()) {
            return desired;
        }

        Set<Id> participantIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Id != null) {
                participantIds.add(participant.Id);
                desired.put(participant.Id, new Set<Id>());
            }
        }
        if (participantIds.isEmpty()) {
            return desired;
        }

        Map<Id, Id> ownCoachProfileByParticipant = new Map<Id, Id>();
        for (Participant__c participant : [
            SELECT Id, Coach_Profile__c
            FROM Participant__c
            WHERE Id IN :participantIds
        ]) {
            if (participant.Coach_Profile__c != null) {
                ownCoachProfileByParticipant.put(participant.Id, participant.Coach_Profile__c);
                desired.get(participant.Id).add(participant.Coach_Profile__c);
            }
        }

        // Coaches of the participant's own appointments. Taken from Appointment__c
        // rather than from the trigger's context, so the result is the same whether
        // the call came from a participant change, an appointment change, or the
        // entry point that reconciles everything.
        Set<Id> coachUserIds = new Set<Id>();
        Map<Id, Set<Id>> coachUserIdsByParticipant = new Map<Id, Set<Id>>();
        for (Appointment__c appointment : [
            SELECT Participant__c, Coach__c
            FROM Appointment__c
            WHERE Participant__c IN :participantIds
        ]) {
            if (appointment.Coach__c == null) {
                continue;
            }
            if (!coachUserIdsByParticipant.containsKey(appointment.Participant__c)) {
                coachUserIdsByParticipant.put(appointment.Participant__c, new Set<Id>());
            }
            coachUserIdsByParticipant.get(appointment.Participant__c).add(appointment.Coach__c);
            coachUserIds.add(appointment.Coach__c);
        }

        if (coachUserIds.isEmpty()) {
            return desired;
        }

        Map<Id, Id> profileIdByUserId = new Map<Id, Id>();
        for (Coach_Profile__c profile : [
            SELECT Id, User__c
            FROM Coach_Profile__c
            WHERE User__c IN :coachUserIds
        ]) {
            profileIdByUserId.put(profile.User__c, profile.Id);
        }

        for (Id participantId : coachUserIdsByParticipant.keySet()) {
            for (Id coachUserId : coachUserIdsByParticipant.get(participantId)) {
                Id profileId = profileIdByUserId.get(coachUserId);
                if (profileId != null) {
                    desired.get(participantId).add(profileId);
                }
            }
        }

        return desired;
    }

    /**
     * Which Program__c rows a participant's portal user may read, per participant.
     *
     * One relationship only: Participant__c.Program__c, the same field `/me`
     * already reads its programName from. No second lookup chain exists for
     * sharing alone.
     */
    public static Map<Id, Set<Id>> desiredProgramIds(List<Participant__c> participants) {
        Map<Id, Set<Id>> desired = new Map<Id, Set<Id>>();
        if (participants == null || participants.isEmpty()) {
            return desired;
        }

        Set<Id> participantIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Id != null) {
                participantIds.add(participant.Id);
            }
        }
        if (participantIds.isEmpty()) {
            return desired;
        }

        for (Participant__c participant : [
            SELECT Id, Program__c
            FROM Participant__c
            WHERE Id IN :participantIds
        ]) {
            Set<Id> programs = new Set<Id>();
            if (participant.Program__c != null) {
                programs.add(participant.Program__c);
            }
            desired.put(participant.Id, programs);
        }
        return desired;
    }

    /**
     * Reconciles both reference objects for the given participants.
     *
     * The whole desired state is recomputed for every participant in scope rather
     * than patched per event. That is what keeps a share alive while one of
     * several qualifying relationships is dropped: losing one appointment does not
     * remove a coach profile that another appointment still justifies, and it does
     * remove one that nothing justifies any more.
     *
     * The two plans stay separate objects — see CoachProfileSharePlan and
     * ProgramSharePlan — so a share row remains traceable to the relationship
     * that earned it.
     */
    public static void synchroniseReferences(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return;
        }

        CoachProfileSharePlan coachPlan = planForCoachProfiles(participants);
        report('removed', Database.delete(coachPlan.remove, false));
        report('granted', Database.insert(coachPlan.grant, false));

        ProgramSharePlan programPlan = planForPrograms(participants);
        report('removed', Database.delete(programPlan.remove, false));
        report('granted', Database.insert(programPlan.grant, false));
    }

    /**
     * Works out the Coach_Profile__c shares for the given participants. No DML.
     *
     * @param participants rows to reconcile. Ids that do not exist are ignored.
     */
    public static CoachProfileSharePlan planForCoachProfiles(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return new CoachProfileSharePlan();
        }

        Set<Id> portalUserIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Portal_User__c != null) {
                portalUserIds.add(participant.Portal_User__c);
            }
        }

        Map<String, Coach_Profile__Share> held = new Map<String, Coach_Profile__Share>();
        if (!portalUserIds.isEmpty()) {
            for (Coach_Profile__Share share : [
                SELECT Id, ParentId, UserOrGroupId
                FROM Coach_Profile__Share
                WHERE UserOrGroupId IN :portalUserIds
                    AND RowCause = :COACH_PROFILE_ROW_CAUSE
            ]) {
                held.put(key(share.ParentId, share.UserOrGroupId), share);
            }
        }

        return planForCoachProfiles(participants, desiredCoachProfileIds(participants), held);
    }

    /**
     * The same decision, against caller-supplied state.
     *
     * Split for the reason every other plan in this class is: a share row cannot
     * be inserted in an Apex test at all — the test context applies the object's
     * internal default access level and refuses anything at or below it, 'Edit'
     * included. The decision is the part with the logic, so it is returned
     * separately and asserted on without touching the database.
     *
     * @param desiredProfileIdsByParticipant the Coach_Profile__c ids each
     *        participant's portal user should hold, keyed by participant id.
     * @param held the portal-managed shares these users currently hold, keyed by
     *        parent id and user id. Only rows under COACH_PROFILE_ROW_CAUSE belong
     *        here; an administrator's Manual grant is invisible to this method and
     *        therefore cannot be removed by it.
     */
    public static CoachProfileSharePlan planForCoachProfiles(
        List<Participant__c> participants,
        Map<Id, Set<Id>> desiredProfileIdsByParticipant,
        Map<String, Coach_Profile__Share> held
    ) {
        CoachProfileSharePlan plan = new CoachProfileSharePlan();
        if (participants == null || participants.isEmpty()) {
            return plan;
        }

        // Every (profile, portal user) pair that should exist, built as share
        // objects while the ids are still typed. Two participants can share a
        // portal user only in test data, but the merge keeps a profile wanted by
        // either of them — and a profile wanted by BOTH is one share, not two.
        Set<String> wanted = new Set<String>();
        List<Coach_Profile__Share> wantedShares = new List<Coach_Profile__Share>();
        for (Participant__c participant : participants) {
            if (participant.Id == null || participant.Portal_User__c == null) {
                continue;
            }
            Set<Id> profileIds = desiredProfileIdsByParticipant.get(participant.Id);
            if (profileIds == null) {
                continue;
            }
            for (Id profileId : profileIds) {
                if (profileId == null) {
                    continue;
                }
                if (!wanted.add(key(profileId, participant.Portal_User__c))) {
                    continue;
                }
                wantedShares.add(
                    new Coach_Profile__Share(
                        ParentId = profileId,
                        UserOrGroupId = participant.Portal_User__c,
                        AccessLevel = PORTAL_ACCESS_LEVEL,
                        RowCause = Schema.Coach_Profile__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        for (Coach_Profile__Share share : held.values()) {
            if (!wanted.contains(key(share.ParentId, share.UserOrGroupId))) {
                plan.remove.add(share);
            }
        }

        for (Coach_Profile__Share wantedShare : wantedShares) {
            if (!held.containsKey(key(wantedShare.ParentId, wantedShare.UserOrGroupId))) {
                plan.grant.add(wantedShare);
            }
        }

        return plan;
    }

    /** Works out the Program__c shares for the given participants. No DML. */
    public static ProgramSharePlan planForPrograms(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return new ProgramSharePlan();
        }

        Set<Id> portalUserIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Portal_User__c != null) {
                portalUserIds.add(participant.Portal_User__c);
            }
        }

        Map<String, Program__Share> held = new Map<String, Program__Share>();
        if (!portalUserIds.isEmpty()) {
            for (Program__Share share : [
                SELECT Id, ParentId, UserOrGroupId
                FROM Program__Share
                WHERE UserOrGroupId IN :portalUserIds
                    AND RowCause = :PROGRAM_ROW_CAUSE
            ]) {
                held.put(key(share.ParentId, share.UserOrGroupId), share);
            }
        }

        return planForPrograms(participants, desiredProgramIds(participants), held);
    }

    /**
     * The same decision, against caller-supplied state. See planForCoachProfiles.
     */
    public static ProgramSharePlan planForPrograms(
        List<Participant__c> participants,
        Map<Id, Set<Id>> desiredProgramIdsByParticipant,
        Map<String, Program__Share> held
    ) {
        ProgramSharePlan plan = new ProgramSharePlan();
        if (participants == null || participants.isEmpty()) {
            return plan;
        }

        Set<String> wanted = new Set<String>();
        List<Program__Share> wantedShares = new List<Program__Share>();
        for (Participant__c participant : participants) {
            if (participant.Id == null || participant.Portal_User__c == null) {
                continue;
            }
            Set<Id> programIds = desiredProgramIdsByParticipant.get(participant.Id);
            if (programIds == null) {
                continue;
            }
            for (Id programId : programIds) {
                if (programId == null) {
                    continue;
                }
                if (!wanted.add(key(programId, participant.Portal_User__c))) {
                    continue;
                }
                wantedShares.add(
                    new Program__Share(
                        ParentId = programId,
                        UserOrGroupId = participant.Portal_User__c,
                        AccessLevel = PORTAL_ACCESS_LEVEL,
                        RowCause = Schema.Program__Share.RowCause.Portal_Access__c
                    )
                );
            }
        }

        for (Program__Share share : held.values()) {
            if (!wanted.contains(key(share.ParentId, share.UserOrGroupId))) {
                plan.remove.add(share);
            }
        }

        for (Program__Share wantedShare : wantedShares) {
            if (!held.containsKey(key(wantedShare.ParentId, wantedShare.UserOrGroupId))) {
                plan.grant.add(wantedShare);
            }
        }

        return plan;
    }

    /**
     * Reconciles Coach_Profile__c and Program__c for every participant in the org.
     *
     * Complete, in both directions. Participants whose portal user was cleared are
     * included even though they no longer appear in `Portal_User__c != null`, so
     * a revoked participant loses the reference shares too. See synchroniseAll()
     * for the same reasoning applied to the participant row itself.
     */
    public static void synchroniseReferencesAll() {
        Set<Id> withPortalUser = new Set<Id>();
        for (Participant__c participant : [
            SELECT Id
            FROM Participant__c
            WHERE Portal_User__c != null
        ]) {
            withPortalUser.add(participant.Id);
        }

        Set<Id> sharingUsers = new Set<Id>();
        for (Coach_Profile__Share share : [
            SELECT UserOrGroupId
            FROM Coach_Profile__Share
            WHERE RowCause = :COACH_PROFILE_ROW_CAUSE
        ]) {
            sharingUsers.add(share.UserOrGroupId);
        }
        for (Program__Share share : [
            SELECT UserOrGroupId
            FROM Program__Share
            WHERE RowCause = :PROGRAM_ROW_CAUSE
        ]) {
            sharingUsers.add(share.UserOrGroupId);
        }
        if (sharingUsers.isEmpty()) {
            return;
        }

        List<Participant__c> participants = [
            SELECT Id, Portal_User__c
            FROM Participant__c
            WHERE Id IN :withPortalUser OR Portal_User__c IN :sharingUsers
        ];
        synchroniseReferences(participants);
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