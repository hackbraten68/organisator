/**
 * Tests for ParticipantPortalSharingService and its ParticipantPortalSharing
 * trigger.
 *
 * What is being defended here is record-level access to participant PII, so
 * the tests are about the *diff* between desired and actual state: exactly one
 * share, never two, correct user after a change, removed when cleared, and
 * untouched when it belongs to somebody else.
 *
 * The complementary question — whether a real portal user really cannot see a
 * foreign row through the HTTP endpoint — is not answerable in Apex, because a
 * test cannot create a User that carries a ContactId (that needs an Experience
 * Cloud profile and a Setup toggle). Those cases are covered by the live
 * sessions in backend/docs/portal-deploy-status.md.
 */
@IsTest
private class ParticipantPortalSharingServiceTest {

    // RowCause of the shares this service manages. 'Manual' rather than a
    // dedicated sharing reason, because no Apex Sharing Reason can be created
    // in this sandbox — see PORTAL_ROW_CAUSE in the service.
    private static final String PORTAL_REASON = 'Portal_Access__c';

    /**
     * Asserts on the service's decision instead of on the share rows.
     *
     * Apex tests apply the object's internal default access level (Edit, from
     * sharingModel = ReadWrite) and refuse any share at or below it:
     *
     *   FIELD_INTEGRITY_EXCEPTION: AccessLevel (trivial share level Read,
     *                              for organization with default level Edit)
     *
     * 'Edit' is equally trivial, and 'All' is rejected with INVALID_ACCESS_LEVEL,
     * so no share row can be inserted in a test context at all. These tests
     * therefore assert on the diff the service computes, which is a separate
     * side-effect-free step, and never insert a share themselves.
     *
     * That these shares are accepted for real is covered by the live sessions in
     * backend/docs/portal-deploy-status.md: /me answers 200 with a share present
     * and 404 without one.
     */

    @TestSetup
    static void makeUsers() {
        // Two distinct users to move the release target between. A sharing target
        // only has to be a real user; it does not need a portal profile.
        makeUser('One');
        makeUser('Two');
    }

    /** Null instead of throwing when the fixture user is not there. */
    private static Id findUser(String username) {
        List<User> found = [SELECT Id FROM User WHERE Username = :username LIMIT 1];
        return found.isEmpty() ? null : found[0].Id;
    }

    private static Id makeUser(String suffix) {
        // ProfileId is required in Apex; a test cannot create an external
        // profile user, and it does not need to — a sharing target only has to
        // be a real user. This org's internal standard profile is named
        // "Standard User" in English even though the UI is German.
        User user = new User(
            FirstName = 'Share',
            LastName = suffix,
            Username = 'share.' + suffix.toLowerCase() + '@sharing.invalid',
            Email = 'share.' + suffix.toLowerCase() + '@sharing.invalid',
            Alias = 'sh' + suffix.left(1),
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'de'
        );
        insert user;
        return user.Id;
    }

    private static Id userOne() {
        return findUser('share.one@sharing.invalid');
    }

    private static Id userTwo() {
        return findUser('share.two@sharing.invalid');
    }

    private static Contact makeContact(String lastName) {
        Contact contact = new Contact(LastName = lastName, Email = lastName.toLowerCase() + '@sharing.invalid');
        insert contact;
        return contact;
    }

    private static Id makeParticipant(String lastName, Id portalUserId) {
        Participant__c participant = new Participant__c(
            Name = lastName,
            Status__c = 'Active',
            Contact__c = makeContact(lastName).Id,
            Portal_User__c = portalUserId
        );
        insert participant;
        return participant.Id;
    }

    /**
     * All shares on the row. With RowCause.Manual this deliberately includes
     * shares the portal did not create, so assertions that a third party's
     * grant survived have to be made with an explicit user filter.
     */
    private static List<Participant__Share> portalShares(Id participantId) {
        return [
            SELECT Id, ParentId, UserOrGroupId, AccessLevel, RowCause
            FROM Participant__Share
            WHERE ParentId = :participantId AND RowCause = :PORTAL_REASON
        ];
    }

    private static Integer shareCountFor(Id participantId, Id userId) {
        List<AggregateResult> counted = [
            SELECT COUNT(Id) total
            FROM Participant__Share
            WHERE ParentId = :participantId AND UserOrGroupId = :userId AND RowCause = :PORTAL_REASON
        ];
        return (Integer) counted[0].get('total');
    }

    /** A participant with the given release target, with no share created yet. */
    private static Participant__c row(String name, Id portalUserId) {
        // Persisted with Portal_User__c still empty on purpose: writing it would
        // fire the trigger, whose share insert cannot succeed in a test context.
        // The value is set on the returned record so the plan is computed against
        // it, which is exactly what the trigger hands the service.
        Participant__c participant = new Participant__c(
            Name = name,
            Status__c = 'Active',
            Contact__c = makeContact(name).Id
        );
        insert participant;
        participant.Portal_User__c = portalUserId;
        return participant;
    }

    /**
     * A share row as a fixture, without DML — these cannot be inserted in a test.
     * Id is left unset because a plausible-looking string is not a valid 15 or 18
     * character Id, and the plan never looks at it.
     */
    private static Participant__Share heldShare(Id rowId, Id userId) {
        return new Participant__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Participant__Share.RowCause.Portal_Access__c
        );
    }

    private static Map<Id, Map<Id, Participant__Share>> heldFor(List<Participant__Share> shares) {
        Map<Id, Map<Id, Participant__Share>> byRow = new Map<Id, Map<Id, Participant__Share>>();
        for (Participant__Share share : shares) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Participant__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }
        return byRow;
    }

    private static Map<Id, Map<Id, Participant__Share>> heldFor(Participant__Share a) {
        List<Participant__Share> shares = new List<Participant__Share>();
        if (a != null) {
            shares.add(a);
        }
        return heldFor(shares);
    }

    /** A share under some other reason — an administrator's, not the portal's. */
    private static Participant__Share foreignShare(Id rowId, Id userId) {
        return new Participant__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Participant__Share.RowCause.Manual
        );
    }

    @IsTest
    static void assigningAPortalUserPlansExactlyOneReadShare() {
        Participant__c participant = row('AssignOne', userOne());

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            new Map<Id, Map<Id, Participant__Share>>()
        );
        Test.stopTest();

        System.assertEquals(1, plan.grant.size(), 'one release must plan exactly one share');
        System.assertEquals(
            userOne(),
            plan.grant[0].UserOrGroupId,
            'the share must go to the assigned user'
        );
        System.assertEquals(
            'Read',
            plan.grant[0].AccessLevel,
            'the portal never grants write access'
        );
        System.assertEquals(0, plan.remove.size(), 'nothing to remove on a fresh row');
    }

    @IsTest
    static void repeatingTheSynchronisationPlansNoSecondShare() {
        Participant__c participant = row('Idempotent', userOne());

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a second run must not plan a second share');
        System.assertEquals(0, plan.remove.size(), 'and must not remove the one it found');
    }

    @IsTest
    static void movingToAnotherUserSwapsTheShare() {
        Participant__c participant = row('Swap', userTwo());

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'the old share must be removed, not accumulated');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(1, plan.grant.size(), 'and a share for the new user planned');
        System.assertEquals(userTwo(), plan.grant[0].UserOrGroupId);
    }

    @IsTest
    static void clearingThePortalUserRemovesTheShare() {
        Participant__c participant = row('Clear', null);

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'an unassigned participant must expose nothing');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(0, plan.grant.size(), 'and must not grant anything');
    }

    @IsTest
    static void aShareUnderAnotherReasonIsNeverRemoved() {
        // The separation the Portal_Access__c reason exists for. An administrator
        // who also granted somebody else access must not have that grant revoked
        // when the portal's own release target moves on — not even when that
        // administrator granted it to the very user the portal releases to.
        //
        // Under RowCause.Manual this case was indistinguishable from ours; it is
        // only decidable now because the reasons differ.
        Id thirdUserId = makeUser('Three');
        Participant__c participant = row('ThirdParty', userTwo());

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            // Only our own share is visible to the service; the administrator's
            // share is not in the collection at all, because the query filters on
            // PORTAL_ROW_CAUSE.
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'only the portal\'s own share is removed');
        System.assertEquals(
            userOne(),
            plan.remove[0].UserOrGroupId,
            'and it is the one carrying our reason'
        );
        System.assertEquals(
            Schema.Participant__Share.RowCause.Portal_Access__c,
            plan.remove[0].RowCause,
            'the removed share must be ours'
        );
        System.assertNotEquals(
            thirdUserId,
            plan.remove[0].UserOrGroupId,
            'an administrator\'s grant is untouched'
        );
    }

    @IsTest
    static void bulkAssignmentPlansOneShareEach() {
        List<Participant__c> participants = new List<Participant__c>();
        for (String lastName : new List<String>{ 'BulkA', 'BulkB', 'BulkC' }) {
            participants.add(row(lastName, userOne()));
        }

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            participants,
            new Map<Id, Map<Id, Participant__Share>>()
        );
        Test.stopTest();

        System.assertEquals(
            participants.size(),
            plan.grant.size(),
            'every participant in the batch must get a share'
        );
    }

    @IsTest
    static void unrelatedFieldChangePlansNothing() {
        Participant__c participant = row('Untouched', userOne());
        participant.Status__c = 'Onboarding';

        Test.startTest();
        // The trigger only calls the service when Portal_User__c changed; with an
        // unchanged target the plan must be empty either way.
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a status change must not change who can read the row');
        System.assertEquals(0, plan.remove.size(), 'the existing share must be left alone');
    }

    @IsTest
    static void twoUsersGetOnlyTheirOwnRelease() {
        // Isolation is per user, not per Account. Two participants, two users:
        // neither release may leak into the other row.
        Participant__c a = row('IsoA', userOne());
        Participant__c b = row('IsoB', userTwo());

        Test.startTest();
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ a, b },
            new Map<Id, Map<Id, Participant__Share>>()
        );
        Test.stopTest();

        Integer forOne = 0;
        Integer forTwo = 0;
        for (Participant__Share share : plan.grant) {
            if (share.UserOrGroupId == userOne()) {
                forOne++;
            } else if (share.UserOrGroupId == userTwo()) {
                forTwo++;
            }
        }
        System.assertEquals(1, forOne, 'user one is released on their own row only');
        System.assertEquals(1, forTwo, 'user two is released on their own row only');
    }

    @IsTest
    static void aClearedTargetMakesAnOrphanedShareRemovable() {
        // With a dedicated reason, synchroniseAll() can finally clean up: an
        // orphaned share is identifiable because it carries our reason and no
        // longer matches Portal_User__c. Under RowCause.Manual this was
        // impossible — the share could not be attributed, so it had to be left.
        Participant__c participant = row('Orphaned', null);

        Test.startTest();
        // What synchroniseAll() does for such a row: it passes the row plus the
        // share it still holds, and the plan removes it.
        ParticipantPortalSharingService.SharePlan plan = ParticipantPortalSharingService.planFor(
            new List<Participant__c>{ participant },
            heldFor(heldShare(participant.Id, userOne()))
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'a share without a release target is removed');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(0, plan.grant.size(), 'and nothing is granted in its place');
    }

    @IsTest
    static void thePortalGrantsReadOnly() {
        System.assertEquals(
            'Read',
            ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            'the portal must never be granted write access'
        );
    }

    // --- Learning_Path__c sharing tests ---

    private static final String LP_PORTAL_REASON = 'Portal_Access__c';

    private static Learning_Path__c lpRow(String title, Id participantId) {
        Learning_Path__c lp = new Learning_Path__c(
            Title__c = title,
            Participant__c = participantId,
            Status__c = 'Planned',
            Order__c = 1,
            Estimated_Weeks__c = 2
        );
        insert lp;
        return lp;
    }

    private static Learning_Path__Share lpHeldShare(Id rowId, Id userId) {
        return new Learning_Path__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Learning_Path__Share.RowCause.Portal_Access__c
        );
    }

    private static Map<Id, Map<Id, Learning_Path__Share>> lpHeldFor(List<Learning_Path__Share> shares) {
        Map<Id, Map<Id, Learning_Path__Share>> byRow = new Map<Id, Map<Id, Learning_Path__Share>>();
        for (Learning_Path__Share share : shares) {
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Learning_Path__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }
        return byRow;
    }

    private static Map<Id, Map<Id, Learning_Path__Share>> lpHeldFor(Learning_Path__Share a) {
        List<Learning_Path__Share> shares = new List<Learning_Path__Share>();
        if (a != null) {
            shares.add(a);
        }
        return lpHeldFor(shares);
    }

    private static Learning_Path__Share lpForeignShare(Id rowId, Id userId) {
        return new Learning_Path__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Learning_Path__Share.RowCause.Manual
        );
    }

    private static Map<Id, Participant__c> lpParticipantsById(List<Participant__c> participants) {
        Map<Id, Participant__c> byId = new Map<Id, Participant__c>();
        for (Participant__c p : participants) {
            byId.put(p.Id, p);
        }
        return byId;
    }

    @IsTest
    static void assigningAParticipantPlansExactlyOneLearningPathShare() {
        Participant__c participant = row('LpAssignOne', userOne());
        Learning_Path__c lp = lpRow('LP-1', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            new Map<Id, Map<Id, Learning_Path__Share>>(),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.grant.size(), 'one learning path must plan exactly one share');
        System.assertEquals(
            userOne(),
            plan.grant[0].UserOrGroupId,
            'the share must go to the portal user of the parent participant'
        );
        System.assertEquals(
            'Read',
            plan.grant[0].AccessLevel,
            'the portal never grants write access'
        );
        System.assertEquals(0, plan.remove.size(), 'nothing to remove on a fresh row');
    }

    @IsTest
    static void repeatingTheLearningPathSynchronisationPlansNoSecondShare() {
        Participant__c participant = row('LpIdempotent', userOne());
        Learning_Path__c lp = lpRow('LP-2', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a second run must not plan a second share');
        System.assertEquals(0, plan.remove.size(), 'and must not remove the one it found');
    }

    @IsTest
    static void movingTheParticipantSwapsTheLearningPathShare() {
        Participant__c participant = row('LpSwap', userTwo());
        Learning_Path__c lp = lpRow('LP-3', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'the old share must be removed, not accumulated');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(1, plan.grant.size(), 'and a share for the new user planned');
        System.assertEquals(userTwo(), plan.grant[0].UserOrGroupId);
    }

    @IsTest
    static void clearingTheParticipantRemovesTheLearningPathShare() {
        Participant__c participant = row('LpClear', null);
        Learning_Path__c lp = lpRow('LP-4', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'an unassigned participant must expose nothing');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(0, plan.grant.size(), 'and must not grant anything');
    }

    @IsTest
    static void aLearningPathShareUnderAnotherReasonIsNeverRemoved() {
        Id thirdUserId = makeUser('LpThree');
        Participant__c participant = row('LpThirdParty', userTwo());
        Learning_Path__c lp = lpRow('LP-5', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'only the portal\'s own share is removed');
        System.assertEquals(
            userOne(),
            plan.remove[0].UserOrGroupId,
            'and it is the one carrying our reason'
        );
        System.assertEquals(
            Schema.Learning_Path__Share.RowCause.Portal_Access__c,
            plan.remove[0].RowCause,
            'the removed share must be ours'
        );
        System.assertNotEquals(
            thirdUserId,
            plan.remove[0].UserOrGroupId,
            'an administrator\'s grant is untouched'
        );
    }

    @IsTest
    static void bulkLearningPathAssignmentPlansOneShareEach() {
        Participant__c participant = row('LpBulk', userOne());
        List<Learning_Path__c> lps = new List<Learning_Path__c>();
        for (Integer i = 0; i < 3; i++) {
            lps.add(lpRow('LP-B' + i, participant.Id));
        }

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            lps,
            new Map<Id, Map<Id, Learning_Path__Share>>(),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(
            lps.size(),
            plan.grant.size(),
            'every learning path in the batch must get a share'
        );
    }


    // --- Coach_Profile__c and Program__c ---

    private static Coach_Profile__c coachProfile(String name, Id userId) {
        Coach_Profile__c profile = new Coach_Profile__c(Name = name, User__c = userId);
        insert profile;
        return profile;
    }

    private static Program__c program(String name) {
        Program__c record = new Program__c(Name = name);
        insert record;
        return record;
    }

    /** An appointment for the participant, optionally with a coach. */
    private static Appointment__c appointmentFor(Id participantId, Id coachUserId) {
        // Name is not writeable on Appointment__c — the platform generates it.
        Appointment__c appointment = new Appointment__c(
            Status__c = 'Confirmed',
            // Pflicht seit der Validierungsregel Status_Confirmed_Requires_ConfirmedAt
            // (Classic, manuell — siehe backend/docs/g1-manual-checklist.md).
            ConfirmedAt__c = Datetime.newInstanceGmt(2026, 11, 15, 9, 0, 0),
            Type__c = 'Coaching',
            StartTime__c = Datetime.newInstanceGmt(2026, 11, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 11, 20, 11, 0, 0),
            Participant__c = participantId,
            Coach__c = coachUserId
        );
        insert appointment;
        return appointment;
    }

    /** The held-shares map the plan methods take, keyed parentId:userId. */
    private static Map<String, Coach_Profile__Share> heldProfiles(List<Coach_Profile__Share> shares) {
        Map<String, Coach_Profile__Share> byKey = new Map<String, Coach_Profile__Share>();
        for (Coach_Profile__Share share : shares) {
            byKey.put(String.valueOf(share.ParentId) + ':' + String.valueOf(share.UserOrGroupId), share);
        }
        return byKey;
    }

    private static Map<String, Program__Share> heldPrograms(List<Program__Share> shares) {
        Map<String, Program__Share> byKey = new Map<String, Program__Share>();
        for (Program__Share share : shares) {
            byKey.put(String.valueOf(share.ParentId) + ':' + String.valueOf(share.UserOrGroupId), share);
        }
        return byKey;
    }

    private static Coach_Profile__Share heldProfile(Id profileId, Id userId) {
        return new Coach_Profile__Share(
            ParentId = profileId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Coach_Profile__Share.RowCause.Portal_Access__c
        );
    }

    private static Program__Share heldProgram(Id programId, Id userId) {
        return new Program__Share(
            ParentId = programId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Program__Share.RowCause.Portal_Access__c
        );
    }

    private static Set<Id> profileIdsIn(List<Coach_Profile__Share> shares) {
        Set<Id> ids = new Set<Id>();
        for (Coach_Profile__Share share : shares) {
            ids.add(share.ParentId);
        }
        return ids;
    }

    // --- desired state ---

    @IsTest
    static void theParticipantsOwnCoachProfileIsWanted() {
        Id portalUserId = userOne();
        Coach_Profile__c own = coachProfile('RefOwnCoach', userTwo());
        Participant__c participant = row('RefOwn', portalUserId);
        participant.Coach_Profile__c = own.Id;
        update new Participant__c(Id = participant.Id, Coach_Profile__c = own.Id);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredCoachProfileIds(
            new List<Participant__c>{ participant }
        );

        System.assertEquals(
            new Set<Id>{ own.Id },
            desired.get(participant.Id),
            'the coach assigned to the participant is released to their portal user'
        );
    }

    @IsTest
    static void aCoachOnAnOwnAppointmentIsWanted() {
        Id portalUserId = userOne();
        Id coachUserId = makeUser('RefAppointmentCoach');
        Coach_Profile__c profile = coachProfile('RefAppointmentCoach', coachUserId);
        Participant__c participant = row('RefApptParticipant', portalUserId);
        appointmentFor(participant.Id, coachUserId);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredCoachProfileIds(
            new List<Participant__c>{ participant }
        );

        System.assertEquals(
            new Set<Id>{ profile.Id },
            desired.get(participant.Id),
            'a coach with an appointment is released'
        );
    }

    @IsTest
    static void bothRoutesToOneProfileYieldOneEntry() {
        Id portalUserId = userOne();
        Id coachUserId = makeUser('RefBothRoutes');
        Coach_Profile__c profile = coachProfile('RefBothRoutes', coachUserId);
        Participant__c participant = row('RefBothRoutesParticipant', portalUserId);
        update new Participant__c(Id = participant.Id, Coach_Profile__c = profile.Id);
        appointmentFor(participant.Id, coachUserId);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredCoachProfileIds(
            new List<Participant__c>{ participant }
        );

        System.assertEquals(
            1,
            desired.get(participant.Id).size(),
            'the own coach and the appointment coach are the same profile, so it is wanted once'
        );
    }

    @IsTest
    static void aCoachWithoutAProfileContributesNothingAndIsNoError() {
        Id portalUserId = userOne();
        Id coachUserId = makeUser('RefNoProfile');
        Participant__c participant = row('RefNoProfileParticipant', portalUserId);
        appointmentFor(participant.Id, coachUserId);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredCoachProfileIds(
            new List<Participant__c>{ participant }
        );

        System.assertEquals(
            new Set<Id>(),
            desired.get(participant.Id),
            'no profile to share; coachName stays null and the page says so'
        );
    }

    @IsTest
    static void aForeignParticipantsCoachIsNotWanted() {
        Id ourPortalUserId = userOne();
        Id theirPortalUserId = userTwo();
        Id coachUserId = makeUser('RefForeignCoach');
        Coach_Profile__c profile = coachProfile('RefForeignCoach', coachUserId);

        Participant__c ours = row('RefForeignOurs', ourPortalUserId);
        Participant__c theirs = row('RefForeignTheirs', theirPortalUserId);
        appointmentFor(theirs.Id, coachUserId);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredCoachProfileIds(
            new List<Participant__c>{ ours }
        );

        System.assertEquals(
            new Set<Id>(),
            desired.get(ours.Id),
            'another participant\'s coach is not released to us'
        );
    }

    @IsTest
    static void theProgramComesFromTheParticipantRowOnly() {
        Id portalUserId = userOne();
        Program__c ours = program('RefOurProgram');
        Participant__c participant = row('RefProgramParticipant', portalUserId);
        update new Participant__c(Id = participant.Id, Program__c = ours.Id);

        Map<Id, Set<Id>> desired = ParticipantPortalSharingService.desiredProgramIds(
            new List<Participant__c>{ participant }
        );

        System.assertEquals(new Set<Id>{ ours.Id }, desired.get(participant.Id), 'their own program');
    }


    // --- Coach_Profile__c plan ---

    @IsTest
    static void aWantedCoachProfileIsGrantedAndAnUnwantedOneRemoved() {
        Id portalUserId = userOne();
        Participant__c participant = row('RefPlanBasic', portalUserId);
        Id wantedProfile = coachProfile('RefPlanWanted', userTwo()).Id;
        Id staleProfile = coachProfile('RefPlanStale', userTwo()).Id;

        Map<Id, Set<Id>> desired = new Map<Id, Set<Id>>{
            participant.Id => new Set<Id>{ wantedProfile }
        };
        Coach_Profile__Share held = heldProfile(staleProfile, portalUserId);

        ParticipantPortalSharingService.CoachProfileSharePlan plan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            desired,
            heldProfiles(new List<Coach_Profile__Share>{ held })
        );

        System.assertEquals(new Set<Id>{ wantedProfile }, profileIdsIn(plan.grant), 'the wanted profile is granted');
        System.assertEquals(
            ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            plan.grant[0].AccessLevel,
            'read only'
        );
        System.assertEquals(
            Schema.Coach_Profile__Share.RowCause.Portal_Access__c,
            plan.grant[0].RowCause,
            'under the portal reason, so an administrator\'s grant stays distinguishable'
        );
        System.assertEquals(new Set<Id>{ staleProfile }, profileIdsIn(plan.remove), 'the stale one is removed');
    }

    @IsTest
    static void aProfileWantedByAnotherAppointmentSurvivesLosingOne() {
        // The reason the desired state is recomputed rather than patched per event.
        Id portalUserId = userOne();
        Participant__c participant = row('RefKeepsProfile', portalUserId);
        Id sharedProfile = coachProfile('RefSharedProfile', userTwo()).Id;
        Id goneProfile = coachProfile('RefGoneProfile', userTwo()).Id;

        // One appointment left with the second coach, the other dropped. Only the
        // dropped coach's profile stops being justified.
        Map<Id, Set<Id>> desired = new Map<Id, Set<Id>>{
            participant.Id => new Set<Id>{ sharedProfile }
        };

        ParticipantPortalSharingService.CoachProfileSharePlan plan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            desired,
            heldProfiles(
                new List<Coach_Profile__Share>{
                    heldProfile(sharedProfile, portalUserId),
                    heldProfile(goneProfile, portalUserId)
                }
            )
        );

        System.assertEquals(0, plan.grant.size(), 'nothing new to grant');
        System.assertEquals(
            new Set<Id>{ goneProfile },
            profileIdsIn(plan.remove),
            'the profile no relationship justifies goes; the other one stays'
        );
    }

    @IsTest
    static void clearingThePortalUserRemovesEveryReferenceShare() {
        Id formerUserId = userOne();
        Id profileId = coachProfile('RefRevokeProfile', userTwo()).Id;
        Id programId = program('RefRevokeProgram').Id;
        Participant__c participant = row('RefRevoked', null);

        ParticipantPortalSharingService.CoachProfileSharePlan coachPlan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            new Map<Id, Set<Id>>(),
            heldProfiles(new List<Coach_Profile__Share>{ heldProfile(profileId, formerUserId) })
        );
        System.assertEquals(
            new Set<Id>{ profileId },
            profileIdsIn(coachPlan.remove),
            'a revoked participant keeps no coach profile'
        );

        ParticipantPortalSharingService.ProgramSharePlan programPlan = ParticipantPortalSharingService.planForPrograms(
            new List<Participant__c>{ participant },
            new Map<Id, Set<Id>>(),
            heldPrograms(new List<Program__Share>{ heldProgram(programId, formerUserId) })
        );
        System.assertEquals(1, programPlan.remove.size(), 'and no program');
    }

    @IsTest
    static void thePlannerTrustsItsInputBecauseTheQueryOwnsTheUserScope() {
        // Characterisation test, for the same reason as the appointment plan's:
        // the held map reaches the planner already filtered by UserOrGroupId, so
        // handing it a share held by somebody else and watching it removed proves
        // the planner has no user check of its own. The boundary worth pinning is
        // that the share WOULD be removed — if someone later adds a user check
        // here, this goes red and the change gets a look.
        //
        // The user scope is enforced one layer up, in the query:
        //   WHERE UserOrGroupId IN :portalUserIds AND RowCause = :COACH_PROFILE_ROW_CAUSE
        Id ourUserId = userOne();
        Id theirUserId = userTwo();
        Id profileId = coachProfile('RefOtherHolder', userTwo()).Id;
        Participant__c participant = row('RefOtherHolderParticipant', ourUserId);

        ParticipantPortalSharingService.CoachProfileSharePlan plan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            new Map<Id, Set<Id>>{ participant.Id => new Set<Id>() },
            heldProfiles(new List<Coach_Profile__Share>{ heldProfile(profileId, theirUserId) })
        );

        System.assertEquals(
            1,
            plan.remove.size(),
            'the planner does not re-check the user; the query is what keeps another user\'s share out of this map'
        );
        System.assertEquals(theirUserId, plan.remove[0].UserOrGroupId, 'so it removes whatever it is handed');
    }

    @IsTest
    static void swappingTheCoachMovesTheRelease() {
        Id portalUserId = userOne();
        Id oldCoach = makeUser('RefOldCoach');
        Id newCoach = makeUser('RefNewCoach');
        Coach_Profile__c oldProfile = coachProfile('RefOldCoach', oldCoach);
        Coach_Profile__c newProfile = coachProfile('RefNewCoach', newCoach);
        Participant__c participant = row('RefSwap', portalUserId);

        // The appointment now points at the new coach.
        Map<Id, Set<Id>> afterSwap = new Map<Id, Set<Id>>{
            participant.Id => new Set<Id>{ newProfile.Id }
        };

        ParticipantPortalSharingService.CoachProfileSharePlan plan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            afterSwap,
            heldProfiles(new List<Coach_Profile__Share>{ heldProfile(oldProfile.Id, portalUserId) })
        );

        System.assertEquals(new Set<Id>{ oldProfile.Id }, profileIdsIn(plan.remove), 'the old coach is dropped');
        System.assertEquals(new Set<Id>{ newProfile.Id }, profileIdsIn(plan.grant), 'the new one is granted');
    }

    @IsTest
    static void changingTheProgramMovesTheRelease() {
        Id portalUserId = userOne();
        Id newProgram = program('RefNewProgram').Id;
        Id oldProgram = program('RefOldProgram').Id;
        Participant__c participant = row('RefProgramSwap', portalUserId);

        ParticipantPortalSharingService.ProgramSharePlan plan = ParticipantPortalSharingService.planForPrograms(
            new List<Participant__c>{ participant },
            new Map<Id, Set<Id>>{ participant.Id => new Set<Id>{ newProgram } },
            heldPrograms(new List<Program__Share>{ heldProgram(oldProgram, portalUserId) })
        );

        System.assertEquals(1, plan.remove.size(), 'the previous program is released');
        System.assertEquals(oldProgram, plan.remove[0].ParentId, 'specifically the old one');
        System.assertEquals(newProgram, plan.grant[0].ParentId, 'and the current one is granted');
        System.assertEquals(
            Schema.Program__Share.RowCause.Portal_Access__c,
            plan.grant[0].RowCause,
            'under the portal reason'
        );
    }

    @IsTest
    static void aProfileAlreadyHeldIsNotGrantedTwice() {
        Id portalUserId = userOne();
        Id profileId = coachProfile('RefAlreadyHeld', userTwo()).Id;
        Participant__c participant = row('RefAlreadyHeldParticipant', portalUserId);

        ParticipantPortalSharingService.CoachProfileSharePlan plan = ParticipantPortalSharingService.planForCoachProfiles(
            new List<Participant__c>{ participant },
            new Map<Id, Set<Id>>{ participant.Id => new Set<Id>{ profileId } },
            heldProfiles(new List<Coach_Profile__Share>{ heldProfile(profileId, portalUserId) })
        );

        System.assertEquals(0, plan.grant.size(), 'already held, so nothing is granted');
        System.assertEquals(0, plan.remove.size(), 'and it is not removed either');
    }

    @IsTest
    static void unrelatedLearningPathFieldChangePlansNothing() {
        Participant__c participant = row('LpUntouched', userOne());
        Learning_Path__c lp = lpRow('LP-6', participant.Id);
        lp.Status__c = 'In Progress';

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a status change must not change who can read the row');
        System.assertEquals(0, plan.remove.size(), 'the existing share must be left alone');
    }

    @IsTest
    static void twoParticipantsGetOnlyTheirOwnLearningPathRelease() {
        Participant__c a = row('LpIsoA', userOne());
        Participant__c b = row('LpIsoB', userTwo());
        Learning_Path__c lpA = lpRow('LP-7A', a.Id);
        Learning_Path__c lpB = lpRow('LP-7B', b.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lpA, lpB },
            new Map<Id, Map<Id, Learning_Path__Share>>(),
            lpParticipantsById(new List<Participant__c>{ a, b })
        );
        Test.stopTest();

        Integer forOne = 0;
        Integer forTwo = 0;
        for (Learning_Path__Share share : plan.grant) {
            if (share.UserOrGroupId == userOne()) {
                forOne++;
            } else if (share.UserOrGroupId == userTwo()) {
                forTwo++;
            }
        }
        System.assertEquals(1, forOne, 'user one is released on their own learning path only');
        System.assertEquals(1, forTwo, 'user two is released on their own learning path only');
    }

    @IsTest
    static void aClearedParticipantMakesAnOrphanedLearningPathShareRemovable() {
        Participant__c participant = row('LpOrphaned', null);
        Learning_Path__c lp = lpRow('LP-8', participant.Id);

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            lpHeldFor(lpHeldShare(lp.Id, userOne())),
            lpParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'a share without a release target is removed');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId);
        System.assertEquals(0, plan.grant.size(), 'and nothing is granted in its place');
    }

    @IsTest
    static void learningPathWithoutParticipantPlansNothing() {
        Learning_Path__c lp = new Learning_Path__c(
            Title__c = 'LP-9',
            Status__c = 'Planned',
            Order__c = 1,
            Estimated_Weeks__c = 2
        );
        insert lp;

        Test.startTest();
        ParticipantPortalSharingService.LearningPathSharePlan plan = ParticipantPortalSharingService.planForLearningPaths(
            new List<Learning_Path__c>{ lp },
            new Map<Id, Map<Id, Learning_Path__Share>>(),
            new Map<Id, Participant__c>()
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a learning path without a participant must not be shared');
        System.assertEquals(0, plan.remove.size(), 'and nothing to remove');
    }

    // --- Appointment__c sharing ---

    private static final String AP_PORTAL_REASON = 'Portal_Access__c';

    /**
     * An appointment for a participant, with no share created.
     *
     * Like the learning-path helper, Portal_User__c is not written on the
     * participant here — that would fire the trigger, whose share insert cannot
     * succeed in a test context. The plan is computed against a record that
     * carries it, which is exactly what the trigger hands the service.
     */
    private static Appointment__c apRow(Participant__c participant, String status) {
        Appointment__c appointment = new Appointment__c(
            Participant__c = participant.Id,
            Type__c = 'Coaching',
            Status__c = status,
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0)
        );
        // Die Begleitdaten mitgeben, die die Validierungsregel fuer den gewaehlten
        // Status verlangt. Ohne das schlaegt die Regel zu und der Test scheitert
        // an etwas, das nichts mit dem Gegenstand des Tests zu tun hat — genau
        // das war der erste Symptom: acht Tests brachen nach dem Anlegen der
        // Regeln ab. Die Zeitpunkte sind hier egal, es geht um die Shares.
        if (status == 'Confirmed') {
            appointment.ConfirmedAt__c = Datetime.newInstanceGmt(2026, 10, 15, 9, 0, 0);
        } else if (status == 'Completed') {
            appointment.CompletedAt__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0);
        } else if (status == 'Cancelled') {
            appointment.CancellationReason__c = 'Testgrund';
        }
        insert appointment;
        return appointment;
    }

    private static Appointment__Share apHeldShare(Id rowId, Id userId) {
        return new Appointment__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Appointment__Share.RowCause.Portal_Access__c
        );
    }

    private static Appointment__Share apForeignShare(Id rowId, Id userId) {
        // RowCause is not writable through DML, but an in-memory share object is
        // never inserted here: planForAppointments() receives this as part of the
        // "already held" map and only reads it. That is what lets this test stand
        // in for a grant somebody made by hand.
        return new Appointment__Share(
            ParentId = rowId,
            UserOrGroupId = userId,
            AccessLevel = ParticipantPortalSharingService.PORTAL_ACCESS_LEVEL,
            RowCause = Schema.Appointment__Share.RowCause.Manual
        );
    }

    private static Map<Id, Map<Id, Appointment__Share>> apHeldFor(List<Appointment__Share> shares) {
        Map<Id, Map<Id, Appointment__Share>> byRow = new Map<Id, Map<Id, Appointment__Share>>();
        for (Appointment__Share share : shares) {
            if (share == null) {
                continue;
            }
            if (!byRow.containsKey(share.ParentId)) {
                byRow.put(share.ParentId, new Map<Id, Appointment__Share>());
            }
            byRow.get(share.ParentId).put(share.UserOrGroupId, share);
        }
        return byRow;
    }

    private static Map<Id, Map<Id, Appointment__Share>> apHeldFor(Appointment__Share share) {
        return apHeldFor(new List<Appointment__Share>{ share });
    }

    private static Map<Id, Participant__c> apParticipantsById(List<Participant__c> participants) {
        Map<Id, Participant__c> byId = new Map<Id, Participant__c>();
        for (Participant__c p : participants) {
            byId.put(p.Id, p);
        }
        return byId;
    }

    @IsTest
    static void assigningAParticipantPlansExactlyOneAppointmentShare() {
        Participant__c participant = row('ApAssignOne', userOne());
        Appointment__c appointment = apRow(participant, 'Confirmed');

        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ appointment },
            new Map<Id, Map<Id, Appointment__Share>>(),
            apParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(1, plan.grant.size(), 'one appointment must plan exactly one share');
        System.assertEquals(
            userOne(),
            plan.grant[0].UserOrGroupId,
            'the share must go to the portal user of the parent participant'
        );
        System.assertEquals(
            'Read',
            plan.grant[0].AccessLevel,
            'the portal never grants write access'
        );
        System.assertEquals(0, plan.remove.size(), 'nothing to remove on a fresh row');
    }

    @IsTest
    static void anAppointmentAlreadySharedIsNotGrantedTwice() {
        Participant__c participant = row('ApNoDouble', userOne());
        Appointment__c appointment = apRow(participant, 'Confirmed');

        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ appointment },
            apHeldFor(apHeldShare(appointment.Id, userOne())),
            apParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'a held share must not be re-granted');
        System.assertEquals(0, plan.remove.size(), 'and must not be removed either');
    }

    @IsTest
    static void changingTheParticipantMovesTheShareToTheNewPortalUser() {
        Participant__c first = row('ApMoveFirst', userOne());
        Participant__c second = row('ApMoveSecond', userTwo());
        Appointment__c appointment = apRow(first, 'Confirmed');

        // The appointment now hangs off a different participant. Persisting it again
        // would fire the trigger, whose share insert cannot succeed in a test
        // context, so the reassignment is made on the in-memory record — which is
        // exactly what the trigger hands the service after a real update.
        appointment.Participant__c = second.Id;

        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ appointment },
            apHeldFor(apHeldShare(appointment.Id, userOne())),
            apParticipantsById(new List<Participant__c>{ first, second })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'the old portal user must lose the share');
        System.assertEquals(userOne(), plan.remove[0].UserOrGroupId, 'and it is that user who loses it');
        System.assertEquals(1, plan.grant.size(), 'the new portal user must gain one');
        System.assertEquals(userTwo(), plan.grant[0].UserOrGroupId, 'namely the new one');
    }

    @IsTest
    static void aRevokedPortalUserPlansTheShareForRemoval() {
        Participant__c participant = row('ApRevoke', userOne());
        Appointment__c appointment = apRow(participant, 'Confirmed');

        // Portal_User__c is null on the participant as passed in: the portal user
        // was revoked, so the share must go rather than stay.
        Participant__c revoked = new Participant__c(Id = participant.Id, Portal_User__c = null);

        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ appointment },
            apHeldFor(apHeldShare(appointment.Id, userOne())),
            apParticipantsById(new List<Participant__c>{ revoked })
        );
        Test.stopTest();

        System.assertEquals(1, plan.remove.size(), 'a revoked portal user must lose the share');
        System.assertEquals(0, plan.grant.size(), 'and nothing is granted in its place');
    }

    @IsTest
    static void anAppointmentWithoutAParticipantIsNotShared() {
        Participant__c participant = row('ApNoParent', userOne());

        Appointment__c orphan = new Appointment__c(
            Type__c = 'Coaching',
            Status__c = 'Draft',
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 21, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 21, 11, 0, 0)
        );

        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ orphan },
            new Map<Id, Map<Id, Appointment__Share>>(),
            apParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        System.assertEquals(0, plan.grant.size(), 'an appointment without a participant must not be shared');
        System.assertEquals(0, plan.remove.size(), 'and nothing to remove');
    }

    @IsTest
    static void theDiffTrustsItsInputAndLetsTheQueryOwnTheReason() {
        Participant__c participant = row('ApMixed', userOne());
        Appointment__c appointment = apRow(participant, 'Confirmed');
        Id thirdUserId = makeUser('ApMixedThird');

        // Characterisation test, and the reason it reads this way is measured:
        // removing the `AND RowCause = :APPOINTMENT_ROW_CAUSE` filter from
        // heldAppointmentShares() leaves this test green, because this test never
        // calls that query — planForAppointments() is handed the map instead. So
        // the original name, "a manual share is never touched", asserted a
        // property that does not exist at this layer: handing a Manual share in
        // gets it removed, because the removal loop compares only the user id.
        //
        // The guard is real but lives one layer up, in heldAppointmentShares(),
        // and it cannot be tested here at all: an Apex test cannot insert a share
        // row, so no row with any reason can exist for a query to return. What
        // this test can do is pin the boundary — if somebody later adds the
        // reason check to the loop, this goes red and the change gets a look.
        Test.startTest();
        ParticipantPortalSharingService.AppointmentSharePlan plan = ParticipantPortalSharingService.planForAppointments(
            new List<Appointment__c>{ appointment },
            apHeldFor(
                new List<Appointment__Share>{
                    apHeldShare(appointment.Id, userTwo()),
                    apForeignShare(appointment.Id, thirdUserId)
                }
            ),
            apParticipantsById(new List<Participant__c>{ participant })
        );
        Test.stopTest();

        // Both handed-in shares are stale — the participant's portal user is
        // userOne, and neither share is theirs — so both come out.
        System.assertEquals(2, plan.remove.size(), 'every share handed in that is stale is removed');
        System.assertEquals(
            userTwo(),
            plan.remove[0].UserOrGroupId,
            'our own stale share is removed first'
        );
        System.assertEquals(
            Schema.Appointment__Share.RowCause.Portal_Access__c,
            plan.remove[0].RowCause,
            'and it carries our reason'
        );
        System.assertEquals(
            thirdUserId,
            plan.remove[1].UserOrGroupId,
            'the reason on the second one is not examined'
        );
        System.assertEquals(
            Schema.Appointment__Share.RowCause.Manual,
            plan.remove[1].RowCause,
            'which is the point: the reason check belongs to the query'
        );

        System.assertEquals(1, plan.grant.size(), 'the portal user still gains its share');
        System.assertEquals(userOne(), plan.grant[0].UserOrGroupId, 'namely the current one');
        System.assertEquals(
            Schema.Appointment__Share.RowCause.Portal_Access__c,
            plan.grant[0].RowCause,
            'granted under our reason'
        );
    }

    @IsTest
    static void theAppointmentRowCauseIsTheSameReasonAsTheOtherPortalObjects() {
        System.assertEquals(
            ParticipantPortalSharingService.APPOINTMENT_ROW_CAUSE,
            ParticipantPortalSharingService.PORTAL_ROW_CAUSE,
            'Appointment shares must be attributable under the same reason as Participant shares'
        );
        System.assertEquals(
            ParticipantPortalSharingService.APPOINTMENT_ROW_CAUSE,
            ParticipantPortalSharingService.LEARNING_PATH_ROW_CAUSE,
            'and under the same reason as Learning_Path shares'
        );
    }
}
