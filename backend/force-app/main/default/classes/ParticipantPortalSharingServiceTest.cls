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
}
