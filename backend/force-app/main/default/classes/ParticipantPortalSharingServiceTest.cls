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

    private static final String PORTAL_REASON = 'Portal_Access__c';

    @TestSetup
    static void makeUsers() {
        // Two distinct users to move the release target between. Sharing targets
        // only need to exist; they do not need portal profiles for this service.
        List<User> created = new List<User>();
        for (String suffix : new List<String>{ 'One', 'Two' }) {
            User user = new User(
                FirstName = 'Share',
                LastName = suffix,
                Username = 'share.' + suffix.toLowerCase() + '@sharing.invalid',
                Email = 'share.' + suffix.toLowerCase() + '@sharing.invalid',
                Alias = 'sh' + suffix.left(1),
                TimeZoneSidKey = 'Europe/Berlin',
                LocaleSidKey = 'de_DE',
                EmailEncodingKey = 'UTF-8',
                LanguageLocaleKey = 'de'
            );
            created.add(user);
        }
        insert created;
    }

    private static Id userOne() {
        return [SELECT Id FROM User WHERE Username = 'share.one@sharing.invalid'].Id;
    }

    private static Id userTwo() {
        return [SELECT Id FROM User WHERE Username = 'share.two@sharing.invalid'].Id;
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

    private static List<Participant__Share> portalShares(Id participantId) {
        return [
            SELECT Id, ParentId, UserOrGroupId, AccessLevel, RowCause
            FROM Participant__Share
            WHERE ParentId = :participantId AND RowCause = :PORTAL_REASON
        ];
    }

    @IsTest
    static void assigningAPortalUserCreatesExactlyOneReadShare() {
        Test.startTest();
        Id participantId = makeParticipant('AssignOne', userOne());
        Test.stopTest();

        List<Participant__Share> shares = portalShares(participantId);
        System.assertEquals(1, shares.size(), 'one release must yield exactly one share');
        System.assertEquals(userOne(), shares[0].UserOrGroupId, 'the share must go to the assigned user');
        System.assertEquals('Read', shares[0].AccessLevel, 'the portal never grants write access');
    }

    @IsTest
    static void repeatingTheSynchronisationDoesNotDuplicateTheShare() {
        Id participantId = makeParticipant('Idempotent', userOne());

        Test.startTest();
        ParticipantPortalSharingService.synchronise([
            SELECT Id, Portal_User__c FROM Participant__c WHERE Id = :participantId
        ]);
        Test.stopTest();

        System.assertEquals(1, portalShares(participantId).size(), 'a second run must not add a second share');
    }

    @IsTest
    static void movingToAnotherUserSwapsTheShare() {
        Id participantId = makeParticipant('Swap', userOne());

        Test.startTest();
        Participant__c participant = new Participant__c(Id = participantId, Portal_User__c = userTwo());
        update participant;
        Test.stopTest();

        List<Participant__Share> shares = portalShares(participantId);
        System.assertEquals(1, shares.size(), 'the old share must be removed, not accumulated');
        System.assertEquals(userTwo(), shares[0].UserOrGroupId, 'the share must follow the new user');
    }

    @IsTest
    static void clearingThePortalUserRemovesTheShare() {
        Id participantId = makeParticipant('Clear', userOne());

        Test.startTest();
        Participant__c participant = new Participant__c(Id = participantId, Portal_User__c = null);
        update participant;
        Test.stopTest();

        System.assertEquals(0, portalShares(participantId).size(), 'an unassigned participant must expose nothing');
    }

    @IsTest
    static void sharesOfOtherRowCausesAreLeftAlone() {
        Id participantId = makeParticipant('Foreign', userOne());

        Participant__Share manual = new Participant__Share(
            ParentId = participantId,
            UserOrGroupId = userTwo(),
            AccessLevel = 'Read',
            RowCause = Schema.Participant__Share.RowCause.Manual
        );
        insert manual;

        Test.startTest();
        Participant__c participant = new Participant__c(Id = participantId, Portal_User__c = null);
        update participant;
        Test.stopTest();

        System.assertEquals(0, portalShares(participantId).size(), 'the portal share must be gone');
        System.assertEquals(
            1,
            [SELECT COUNT() FROM Participant__Share WHERE Id = :manual.Id],
            'a manual share is not ours to delete'
        );
    }

    @IsTest
    static void bulkAssignmentCreatesOneShareEach() {
        Test.startTest();
        List<Participant__c> participants = new List<Participant__c>();
        for (String lastName : new List<String>{ 'BulkA', 'BulkB', 'BulkC' }) {
            participants.add(
                new Participant__c(
                    Name = lastName,
                    Status__c = 'Active',
                    Contact__c = makeContact(lastName).Id,
                    Portal_User__c = userOne()
                )
            );
        }
        insert participants;
        Test.stopTest();

        Integer expected = participants.size();
        System.assertEquals(
            expected,
            [SELECT COUNT() FROM Participant__Share WHERE RowCause = :PORTAL_REASON AND ParentId IN :participants],
            'every participant in the batch must get exactly one share'
        );
    }

    @IsTest
    static void unrelatedFieldChangeDoesNotTouchSharing() {
        Id participantId = makeParticipant('Untouched', userOne());
        List<Participant__Share> before = portalShares(participantId);

        Test.startTest();
        Participant__c participant = new Participant__c(Id = participantId, Status__c = 'Onboarding');
        update participant;
        Test.stopTest();

        List<Participant__Share> after = portalShares(participantId);
        System.assertEquals(before.size(), after.size(), 'a status change must not change who can read the row');
        System.assertEquals(before[0].Id, after[0].Id, 'the share must not even be replaced');
    }

    @IsTest
    static void synchroniseAllCleansUpRowsWhosePortalUserWasClearedOutOfBand() {
        Id participantId = makeParticipant('Orphan', userOne());

        // Simulate a release that exists without Portal_User__c being set — the
        // case the trigger cannot catch, and the reason synchroniseAll() exists.
        Participant__c participant = new Participant__c(Id = participantId, Portal_User__c = null);
        update participant;
        insert new Participant__Share(
            ParentId = participantId,
            UserOrGroupId = userOne(),
            AccessLevel = 'Read',
            RowCause = Schema.Participant__Share.RowCause.Portal_Access__c
        );

        Test.startTest();
        ParticipantPortalSharingService.synchroniseAll();
        Test.stopTest();

        System.assertEquals(0, portalShares(participantId).size(), 'an orphaned release must be reconciled away');
    }

    @IsTest
    static void twoUsersOnTheSameContactPathGetOnlyTheirOwnRelease() {
        // Isolation is per user, not per Account. Two participants, two users:
        // neither release may leak into the other row.
        Id participantA = makeParticipant('IsoA', userOne());
        Id participantB = makeParticipant('IsoB', userTwo());

        System.assertEquals(userOne(), portalShares(participantA)[0].UserOrGroupId);
        System.assertEquals(userTwo(), portalShares(participantB)[0].UserOrGroupId);
        System.assertEquals(
            0,
            [SELECT COUNT() FROM Participant__Share WHERE RowCause = :PORTAL_REASON AND ParentId = :participantA AND UserOrGroupId = :userTwo()],
            'user two must never be released on user one\'s row'
        );
    }
}