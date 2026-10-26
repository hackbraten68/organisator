/**
 * Record-level access for the schedule objects, for portal participants.
 *
 * WHY THIS EXISTS
 *   WeeklySchedule__c, ProgramWeek__c, ScheduleEntry__c, ParticipantGroup__c
 *   and ParticipantGroupMember__c are `externalSharingModel = Private`. In
 *   this org `without sharing` does NOT bypass record sharing for portal
 *   users (measured, see backend/docs/portal-deploy-status.md and ADR-013).
 *   Without a share row the participant endpoint returns an empty week, even
 *   though the data exists.
 *
 * WHAT IT SHARES
 *   For a published plan:
 *     - the plan,
 *     - its ProgramWeek__c (the endpoint resolves the week name),
 *     - every ScheduleEntry__c of the plan,
 *     - every Coach_Profile__c referenced by an entry,
 *   each with a Read share for the plan's audience:
 *     Course      -> every participant of the program with a portal user
 *     Group       -> every member of the plan's group with a portal user
 *     Individual  -> the plan's participant, if they have a portal user
 *
 *   Additionally, a participant's own ParticipantGroupMember__c rows and the
 *   ParticipantGroup__c rows behind them are shared with that participant, so
 *   the endpoint can resolve the group ids used for Group overrides inside a
 *   Course plan.
 *
 * ROW CAUSE
 *   The plan objects have no Apex Sharing Reason. `ApexSharingReason` is a
 *   manual Classic Setup step and not deployable (backend/docs/AGENTS.md), so
 *   this service writes `RowCause = Manual`. It only ever inserts; it never
 *   deletes a share. A stale share therefore still exists at the row level,
 *   but the endpoint additionally filters `Status__c = 'Published'` and the
 *   participant's current scope, so it cannot surface an unpublished or
 *   foreign plan.
 *
 * FAIL-CLOSED
 *   A failed share insert is logged at ERROR level. The caller can decide
 *   whether the transaction should abort; `synchronisePlan` is called from the
 *   publish path, which does abort on an exception.
 */
public without sharing class SchedulePortalSharingService {

    public static final String ACCESS_LEVEL = 'Read';
    public static final String ROW_CAUSE = 'Manual';

    /** The rows a synchronise call intends to write, before any DML. */
    public class SharePlan {
        public List<WeeklySchedule__Share> plans = new List<WeeklySchedule__Share>();
        public List<ProgramWeek__Share> weeks = new List<ProgramWeek__Share>();
        public List<ScheduleEntry__Share> entries = new List<ScheduleEntry__Share>();
        public List<Coach_Profile__Share> coaches = new List<Coach_Profile__Share>();
        public List<ParticipantGroup__Share> groups = new List<ParticipantGroup__Share>();
        public List<ParticipantGroupMember__Share> groupMembers = new List<ParticipantGroupMember__Share>();

        public Boolean isEmpty() {
            return plans.isEmpty()
                && weeks.isEmpty()
                && entries.isEmpty()
                && coaches.isEmpty()
                && groups.isEmpty()
                && groupMembers.isEmpty();
        }
    }

    /**
     * Grants the shares a published plan needs. Safe to call more than once:
     * existing Manual shares are skipped.
     */
    public static void synchronisePlan(Id planId) {
        if (planId == null) {
            return;
        }
        List<WeeklySchedule__c> plans = [
            SELECT Id, Status__c, ScopeType__c, Participant__c, ParticipantGroup__c,
                   ProgramWeek__c, ProgramWeek__r.Program__c
            FROM WeeklySchedule__c
            WHERE Id = :planId
            LIMIT 1
        ];
        if (plans.isEmpty()) {
            return;
        }
        WeeklySchedule__c plan = plans[0];
        SharePlan desired = planFor(planId);
        prunePlan(plan, desired);
        write(desired);
    }

    /**
     * Grants the shares for every published plan of a program. Used when a
     * participant is assigned to a program after plans were already published.
     */
    public static void synchroniseProgram(Id programId) {
        if (programId == null) {
            return;
        }
        for (WeeklySchedule__c plan : [
            SELECT Id
            FROM WeeklySchedule__c
            WHERE Status__c = 'Published'
              AND ProgramWeek__r.Program__c = :programId
        ]) {
            synchronisePlan(plan.Id);
        }
    }

    /**
     * Grants the shares for a participant's group memberships, then for every
     * published plan of the participant's program.
     */
    public static void synchroniseParticipants(List<Participant__c> participants) {
        if (participants == null || participants.isEmpty()) {
            return;
        }
        Set<Id> participantIds = new Set<Id>();
        Set<Id> programIds = new Set<Id>();
        for (Participant__c participant : participants) {
            if (participant.Id == null) {
                continue;
            }
            participantIds.add(participant.Id);
            if (participant.Program__c != null) {
                programIds.add(participant.Program__c);
            }
        }
        synchroniseGroupMembershipsForParticipants(participantIds);
        for (Id programId : programIds) {
            synchroniseProgram(programId);
        }
    }

    /**
     * Grants the shares for the given group membership rows. Called from the
     * ParticipantGroupMember__c trigger on insert and update.
     */
    public static void synchroniseGroupMemberships(List<ParticipantGroupMember__c> members) {
        if (members == null || members.isEmpty()) {
            return;
        }
        Set<Id> participantIds = new Set<Id>();
        for (ParticipantGroupMember__c member : members) {
            if (member.Participant__c != null) {
                participantIds.add(member.Participant__c);
            }
        }
        synchroniseGroupMembershipsForParticipants(participantIds);
    }

    public static void synchroniseGroupMembershipsForParticipants(Set<Id> participantIds) {
        if (participantIds == null || participantIds.isEmpty()) {
            return;
        }
        for (Id participantId : participantIds) {
            List<Participant__c> participants = [
                SELECT Id, Portal_User__c
                FROM Participant__c
                WHERE Id = :participantId
                LIMIT 1
            ];
            if (participants.isEmpty() || participants[0].Portal_User__c == null) {
                continue;
            }
            reconcileGroupMemberships(participants[0].Id, participants[0].Portal_User__c);
        }
    }

    /**
     * Works out which shares a plan needs, without writing them.
     *
     * Split out so the decision can be asserted in a test. A test cannot insert
     * a share row at all: the internal default access level makes a Read share
     * trivial, and the platform rejects it.
     */
    public static SharePlan planFor(Id planId) {
        SharePlan result = new SharePlan();
        if (planId == null) {
            return result;
        }
        List<WeeklySchedule__c> plans = [
            SELECT Id, Status__c, ScopeType__c, Participant__c, ParticipantGroup__c,
                   ProgramWeek__c, ProgramWeek__r.Program__c
            FROM WeeklySchedule__c
            WHERE Id = :planId
            LIMIT 1
        ];
        if (plans.isEmpty()) {
            return result;
        }
        WeeklySchedule__c plan = plans[0];
        if (plan.Status__c != 'Published') {
            return result;
        }
        if (plan.ProgramWeek__c == null || plan.ProgramWeek__r.Program__c == null) {
            return result;
        }

        Set<Id> userIds = audience(plan);
        if (userIds.isEmpty()) {
            return result;
        }

        Set<Id> existingPlanUsers = new Set<Id>();
        for (WeeklySchedule__Share share : [
            SELECT UserOrGroupId
            FROM WeeklySchedule__Share
            WHERE ParentId = :plan.Id
              AND RowCause = :ROW_CAUSE
              AND UserOrGroupId IN :userIds
        ]) {
            existingPlanUsers.add(share.UserOrGroupId);
        }
        for (Id userId : userIds) {
            if (!existingPlanUsers.contains(userId)) {
                result.plans.add(new WeeklySchedule__Share(
                    ParentId = plan.Id,
                    UserOrGroupId = userId,
                    AccessLevel = ACCESS_LEVEL,
                    RowCause = Schema.WeeklySchedule__Share.RowCause.Manual
                ));
            }
        }

        Set<Id> existingWeekUsers = new Set<Id>();
        for (ProgramWeek__Share share : [
            SELECT UserOrGroupId
            FROM ProgramWeek__Share
            WHERE ParentId = :plan.ProgramWeek__c
              AND RowCause = :ROW_CAUSE
              AND UserOrGroupId IN :userIds
        ]) {
            existingWeekUsers.add(share.UserOrGroupId);
        }
        for (Id userId : userIds) {
            if (!existingWeekUsers.contains(userId)) {
                result.weeks.add(new ProgramWeek__Share(
                    ParentId = plan.ProgramWeek__c,
                    UserOrGroupId = userId,
                    AccessLevel = ACCESS_LEVEL,
                    RowCause = Schema.ProgramWeek__Share.RowCause.Manual
                ));
            }
        }

        List<ScheduleEntry__c> entries = [
            SELECT Id, Coach_Profile__c
            FROM ScheduleEntry__c
            WHERE WeeklySchedule__c = :plan.Id
        ];
        if (!entries.isEmpty()) {
            Set<Id> entryIds = new Set<Id>();
            Set<Id> coachIds = new Set<Id>();
            for (ScheduleEntry__c entry : entries) {
                entryIds.add(entry.Id);
                if (entry.Coach_Profile__c != null) {
                    coachIds.add(entry.Coach_Profile__c);
                }
            }

            Set<String> existingEntryKeys = new Set<String>();
            for (ScheduleEntry__Share share : [
                SELECT ParentId, UserOrGroupId
                FROM ScheduleEntry__Share
                WHERE ParentId IN :entryIds
                  AND RowCause = :ROW_CAUSE
                  AND UserOrGroupId IN :userIds
            ]) {
                existingEntryKeys.add(key(share.ParentId, share.UserOrGroupId));
            }
            for (Id entryId : entryIds) {
                for (Id userId : userIds) {
                    if (!existingEntryKeys.contains(key(entryId, userId))) {
                        result.entries.add(new ScheduleEntry__Share(
                            ParentId = entryId,
                            UserOrGroupId = userId,
                            AccessLevel = ACCESS_LEVEL,
                            RowCause = Schema.ScheduleEntry__Share.RowCause.Manual
                        ));
                    }
                }
            }

            if (!coachIds.isEmpty()) {
                Set<String> existingCoachKeys = new Set<String>();
                for (Coach_Profile__Share share : [
                    SELECT ParentId, UserOrGroupId
                    FROM Coach_Profile__Share
                    WHERE ParentId IN :coachIds
                      AND RowCause = :ROW_CAUSE
                      AND UserOrGroupId IN :userIds
                ]) {
                    existingCoachKeys.add(key(share.ParentId, share.UserOrGroupId));
                }
                for (Id coachId : coachIds) {
                    for (Id userId : userIds) {
                        if (!existingCoachKeys.contains(key(coachId, userId))) {
                            result.coaches.add(new Coach_Profile__Share(
                                ParentId = coachId,
                                UserOrGroupId = userId,
                                AccessLevel = ACCESS_LEVEL,
                                RowCause = Schema.Coach_Profile__Share.RowCause.Manual
                            ));
                        }
                    }
                }
            }
        }

        return result;
    }

    private static void prunePlan(WeeklySchedule__c plan, SharePlan desired) {
        if (plan == null) {
            return;
        }
        Set<Id> audience = audience(plan);
        deleteStaleShares(plan.Id, 'WeeklySchedule__Share', audience);

        Set<Id> entryIds = new Set<Id>();
        Set<Id> coachIds = new Set<Id>();
        for (ScheduleEntry__c entry : [
            SELECT Id, Coach_Profile__c
            FROM ScheduleEntry__c
            WHERE WeeklySchedule__c = :plan.Id
        ]) {
            entryIds.add(entry.Id);
            if (entry.Coach_Profile__c != null) {
                coachIds.add(entry.Coach_Profile__c);
            }
        }
        for (Id entryId : entryIds) {
            deleteStaleShares(entryId, 'ScheduleEntry__Share', audience);
        }

        Set<Id> weekAud = weekAudience(plan.ProgramWeek__c);
        deleteStaleShares(plan.ProgramWeek__c, 'ProgramWeek__Share', weekAud);

        for (Id coachId : coachIds) {
            Set<Id> coachAud = coachAudience(coachId);
            deleteStaleShares(coachId, 'Coach_Profile__Share', coachAud);
        }
    }

    private static void deleteStaleShares(Id parentId, String shareObjectName, Set<Id> desiredUsers) {
        if (parentId == null) {
            return;
        }
        if (desiredUsers == null) {
            desiredUsers = new Set<Id>();
        }
        String soql = 'SELECT Id, UserOrGroupId FROM ' + shareObjectName +
            ' WHERE ParentId = :parentId AND RowCause = \'' + ROW_CAUSE + '\'' ;
        List<SObject> shares = Database.query(soql);
        List<SObject> toDelete = new List<SObject>();
        for (SObject share : shares) {
            Id userId = (Id) share.get('UserOrGroupId');
            if (!desiredUsers.contains(userId)) {
                toDelete.add(share);
            }
        }
        if (toDelete.isEmpty()) {
            return;
        }
        List<Database.DeleteResult> results = Database.delete(toDelete, false);
        for (Database.DeleteResult result : results) {
            if (!result.isSuccess()) {
                for (Database.Error error : result.getErrors()) {
                    System.debug(LoggingLevel.ERROR,
                        'SchedulePortalSharingService prune failed: ' + error.getMessage());
                }
            }
        }
    }

    private static Set<Id> weekAudience(Id programWeekId) {
        Set<Id> users = new Set<Id>();
        if (programWeekId == null) {
            return users;
        }
        for (WeeklySchedule__c plan : [
            SELECT Id, Status__c, ScopeType__c, Participant__c, ParticipantGroup__c,
                   ProgramWeek__r.Program__c
            FROM WeeklySchedule__c
            WHERE ProgramWeek__c = :programWeekId
              AND Status__c = 'Published'
        ]) {
            users.addAll(audience(plan));
        }
        return users;
    }

    private static Set<Id> coachAudience(Id coachId) {
        Set<Id> users = new Set<Id>();
        if (coachId == null) {
            return users;
        }
        Set<Id> planIds = new Set<Id>();
        for (ScheduleEntry__c entry : [
            SELECT WeeklySchedule__c
            FROM ScheduleEntry__c
            WHERE Coach_Profile__c = :coachId
        ]) {
            if (entry.WeeklySchedule__c != null) {
                planIds.add(entry.WeeklySchedule__c);
            }
        }
        if (planIds.isEmpty()) {
            return users;
        }
        for (WeeklySchedule__c plan : [
            SELECT Id, Status__c, ScopeType__c, Participant__c, ParticipantGroup__c,
                   ProgramWeek__r.Program__c
            FROM WeeklySchedule__c
            WHERE Id IN :planIds
              AND Status__c = 'Published'
        ]) {
            users.addAll(audience(plan));
        }
        return users;
    }

    private static void reconcileGroupMemberships(Id participantId, Id portalUserId) {
        if (participantId == null || portalUserId == null) {
            return;
        }
        List<ParticipantGroupMember__c> currentMembers = [
            SELECT Id, ParticipantGroup__c
            FROM ParticipantGroupMember__c
            WHERE Participant__c = :participantId
        ];
        Set<Id> currentMemberIds = new Set<Id>();
        Set<Id> currentGroupIds = new Set<Id>();
        for (ParticipantGroupMember__c member : currentMembers) {
            currentMemberIds.add(member.Id);
            if (member.ParticipantGroup__c != null) {
                currentGroupIds.add(member.ParticipantGroup__c);
            }
        }

        List<ParticipantGroupMember__Share> existingMemberShares = [
            SELECT Id, ParentId
            FROM ParticipantGroupMember__Share
            WHERE UserOrGroupId = :portalUserId
              AND RowCause = :ROW_CAUSE
        ];
        List<ParticipantGroupMember__Share> toDeleteMember = new List<ParticipantGroupMember__Share>();
        Set<Id> existingMemberParentIds = new Set<Id>();
        for (ParticipantGroupMember__Share share : existingMemberShares) {
            existingMemberParentIds.add(share.ParentId);
            if (!currentMemberIds.contains(share.ParentId)) {
                toDeleteMember.add(share);
            }
        }
        if (!toDeleteMember.isEmpty()) {
            Database.delete(toDeleteMember, false);
        }

        List<ParticipantGroup__Share> existingGroupShares = [
            SELECT Id, ParentId
            FROM ParticipantGroup__Share
            WHERE UserOrGroupId = :portalUserId
              AND RowCause = :ROW_CAUSE
        ];
        List<ParticipantGroup__Share> toDeleteGroup = new List<ParticipantGroup__Share>();
        Set<Id> existingGroupParentIds = new Set<Id>();
        for (ParticipantGroup__Share share : existingGroupShares) {
            existingGroupParentIds.add(share.ParentId);
            if (!currentGroupIds.contains(share.ParentId)) {
                toDeleteGroup.add(share);
            }
        }
        if (!toDeleteGroup.isEmpty()) {
            Database.delete(toDeleteGroup, false);
        }

        SharePlan plan = new SharePlan();
        for (ParticipantGroupMember__c member : currentMembers) {
            if (member.ParticipantGroup__c == null) {
                continue;
            }
            if (!existingMemberParentIds.contains(member.Id)) {
                plan.groupMembers.add(new ParticipantGroupMember__Share(
                    ParentId = member.Id,
                    UserOrGroupId = portalUserId,
                    AccessLevel = ACCESS_LEVEL,
                    RowCause = Schema.ParticipantGroupMember__Share.RowCause.Manual
                ));
            }
            if (!existingGroupParentIds.contains(member.ParticipantGroup__c)) {
                plan.groups.add(new ParticipantGroup__Share(
                    ParentId = member.ParticipantGroup__c,
                    UserOrGroupId = portalUserId,
                    AccessLevel = ACCESS_LEVEL,
                    RowCause = Schema.ParticipantGroup__Share.RowCause.Manual
                ));
            }
        }
        write(plan);
    }

    public static void revokePlan(Id planId) {
        revokePlan(planId, null);
    }

    public static void revokePlan(Id planId, Set<Id> coachIds) {
        if (planId == null) {
            return;
        }
        List<WeeklySchedule__c> plans = [
            SELECT Id, ProgramWeek__c
            FROM WeeklySchedule__c
            WHERE Id = :planId
            LIMIT 1
        ];
        if (plans.isEmpty()) {
            return;
        }
        WeeklySchedule__c plan = plans[0];
        deleteStaleShares(plan.Id, 'WeeklySchedule__Share', new Set<Id>());
        Set<Id> weekAud = weekAudience(plan.ProgramWeek__c);
        deleteStaleShares(plan.ProgramWeek__c, 'ProgramWeek__Share', weekAud);
        if (coachIds != null) {
            for (Id coachId : coachIds) {
                Set<Id> coachAud = coachAudience(coachId);
                deleteStaleShares(coachId, 'Coach_Profile__Share', coachAud);
            }
        }
    }

    private static void write(SharePlan plan) {
        if (plan == null || plan.isEmpty()) {
            return;
        }
        report('plan', Database.insert(plan.plans, false));
        report('week', Database.insert(plan.weeks, false));
        report('entry', Database.insert(plan.entries, false));
        report('coach', Database.insert(plan.coaches, false));
        report('group', Database.insert(plan.groups, false));
        report('groupMember', Database.insert(plan.groupMembers, false));
    }

    private static Set<Id> audience(WeeklySchedule__c plan) {
        Set<Id> userIds = new Set<Id>();
        if (plan.ScopeType__c == 'Course') {
            Id programId = plan.ProgramWeek__r.Program__c;
            for (Participant__c participant : [
                SELECT Portal_User__c
                FROM Participant__c
                WHERE Program__c = :programId
                  AND Portal_User__c != null
            ]) {
                userIds.add(participant.Portal_User__c);
            }
        } else if (plan.ScopeType__c == 'Group') {
            if (plan.ParticipantGroup__c == null) {
                return userIds;
            }
            for (ParticipantGroupMember__c member : [
                SELECT Participant__r.Portal_User__c
                FROM ParticipantGroupMember__c
                WHERE ParticipantGroup__c = :plan.ParticipantGroup__c
            ]) {
                if (member.Participant__r != null && member.Participant__r.Portal_User__c != null) {
                    userIds.add(member.Participant__r.Portal_User__c);
                }
            }
        } else if (plan.ScopeType__c == 'Individual') {
            if (plan.Participant__c == null) {
                return userIds;
            }
            List<Participant__c> participants = [
                SELECT Portal_User__c
                FROM Participant__c
                WHERE Id = :plan.Participant__c
                LIMIT 1
            ];
            if (!participants.isEmpty() && participants[0].Portal_User__c != null) {
                userIds.add(participants[0].Portal_User__c);
            }
        }
        return userIds;
    }

    private static void addGroupMembershipShares(SharePlan plan, Id participantId, Id portalUserId) {
        for (ParticipantGroupMember__c member : [
            SELECT Id, ParticipantGroup__c
            FROM ParticipantGroupMember__c
            WHERE Participant__c = :participantId
        ]) {
            if (member.ParticipantGroup__c != null) {
                addGroupMemberShare(plan, member.Id, member.ParticipantGroup__c, portalUserId);
            }
        }
    }

    private static void addGroupMemberShare(SharePlan plan, Id memberId, Id groupId, Id portalUserId) {
        Integer memberCount = [
            SELECT COUNT()
            FROM ParticipantGroupMember__Share
            WHERE ParentId = :memberId
              AND RowCause = :ROW_CAUSE
              AND UserOrGroupId = :portalUserId
        ];
        if (memberCount == 0) {
            plan.groupMembers.add(new ParticipantGroupMember__Share(
                ParentId = memberId,
                UserOrGroupId = portalUserId,
                AccessLevel = ACCESS_LEVEL,
                RowCause = Schema.ParticipantGroupMember__Share.RowCause.Manual
            ));
        }
        Integer groupCount = [
            SELECT COUNT()
            FROM ParticipantGroup__Share
            WHERE ParentId = :groupId
              AND RowCause = :ROW_CAUSE
              AND UserOrGroupId = :portalUserId
        ];
        if (groupCount == 0) {
            plan.groups.add(new ParticipantGroup__Share(
                ParentId = groupId,
                UserOrGroupId = portalUserId,
                AccessLevel = ACCESS_LEVEL,
                RowCause = Schema.ParticipantGroup__Share.RowCause.Manual
            ));
        }
    }

    private static String key(Id parentId, Id userId) {
        return String.valueOf(parentId) + '|' + String.valueOf(userId);
    }

    private static void report(String label, List<Database.SaveResult> results) {
        for (Database.SaveResult result : results) {
            if (!result.isSuccess()) {
                for (Database.Error error : result.getErrors()) {
                    System.debug(LoggingLevel.ERROR,
                        'SchedulePortalSharingService ' + label + ' share failed: ' + error.getMessage());
                }
            }
        }
    }
}
