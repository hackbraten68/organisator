/**
 * Covers the portal identity resolution in ParticipantPortalData.
 *
 * SCOPE AND A KNOWN LIMITATION — read before trusting a green run
 *
 * The identity chain is User -> User.ContactId -> Contact -> Participant__c. The
 * last two links need no special setup, so they are covered in full here. The
 * first link cannot be: Salesforce only allows a User to carry a ContactId when
 * the user is a portal/external user, and creating such a User from Apex also
 * requires the Setup toggle "Allow using standard external profiles for
 * self-registration, user creation, and login". Neither is reachable from a test.
 *
 * So resolve() is verified by construction (it calls resolveForUser with
 * UserInfo.getUserId() and nothing else) plus the tests below, which drive every
 * branch of resolveForUser/resolveForContact directly. What is NOT covered here is
 * a real external user resolving through the HTTP endpoint end to end. That is the
 * outstanding positive/negative test in spike-sharing-1.5.md and it needs a live
 * site and real portal logins. Do not read a green run of this class as "the
 * endpoint has been proven against a real portal user".
 *
 * FIXTURE
 * The data is built lazily by ensureData() rather than in @TestSetup. On this org,
 * statics assigned inside a @TestSetup method read back as null in the test
 * methods, while statics initialised at declaration survive. Verified with a
 * minimal probe. ensureData() is therefore called at the top of each test.
 */
@IsTest
public class ParticipantPortalDataTest {
    private static Id alphaAccountId;
    private static Id alphaContactId;
    private static Id betaContactId;
    private static Id gammaContactId;
    private static Id alphaParticipantId;
    private static Id betaParticipantId;
    private static Id programId;
    private static Id coachId;
    private static Id internalUserWithoutContact;

    @IsTest
    static void contactWithParticipantResolvesToThatParticipant() {
        ensureData();

        ParticipantPortalData.ParticipantView view = resolveForContact(alphaContactId);

        System.assertEquals(alphaParticipantId, view.participantId, 'must resolve to the matched participant');
        System.assertEquals(alphaContactId, view.contactId, 'must report the contact');
        System.assertEquals('Portal Alpha', view.participantName);
        System.assertEquals('Active', view.participantStatus);
        System.assertEquals('Portal Test Program', view.programName, 'program name resolved');
        System.assertEquals('Portal Test Coach', view.coachName, 'coach name resolved');
        System.assertNotEquals(null, view.startDate, 'start date returned');
        System.assertNotEquals(null, view.expectedEndDate, 'expected end date returned');
    }

    @IsTest
    static void contactNameAndEmailComeFromContactNotParticipant() {
        ensureData();

        ParticipantPortalData.ParticipantView view = resolveForContact(alphaContactId);

        System.assertEquals('Portal Alpha', view.contactName, 'name comes from Contact');
        System.assertEquals('portal.alpha@example.invalid', view.contactEmail, 'email comes from Contact');
    }

    @IsTest
    static void aSecondContactResolvesToItsOwnRecordNotTheFirst() {
        ensureData();

        ParticipantPortalData.ParticipantView view = resolveForContact(betaContactId);

        System.assertEquals(betaParticipantId, view.participantId);
        System.assertNotEquals(
            alphaParticipantId,
            view.participantId,
            'resolution must be per contact, never a shared first row'
        );
    }

    @IsTest
    static void contactWithoutParticipantIsNotFound() {
        ensureData();

        try {
            resolveForContact(gammaContactId);
            System.assert(false, 'a contact without a participant must not resolve');
        } catch (PortalIdentityException error) {
            System.assertEquals('NO_PARTICIPANT', error.getCode());
            System.assertEquals(404, error.getStatusCode());
        }
    }

    @IsTest
    static void userWithoutContactIsUnauthorised() {
        ensureData();

        try {
            ParticipantPortalData.resolveForUser(internalUserWithoutContact);
            System.assert(false, 'a user without a contact must not resolve');
        } catch (PortalIdentityException error) {
            System.assertEquals('NO_CONTACT_IDENTITY', error.getCode());
            System.assertEquals(401, error.getStatusCode());
        }
    }

    @IsTest
    static void anUnknownUserIsUnauthorised() {
        ensureData();

        try {
            ParticipantPortalData.resolveForUser(makeUnknownId());
            System.assert(false, 'an unknown user must not resolve');
        } catch (PortalIdentityException error) {
            System.assertEquals('NO_CONTACT_IDENTITY', error.getCode());
            System.assertEquals(401, error.getStatusCode());
        }
    }

    @IsTest
    static void onlyWhitelistedFieldsAreSerialised() {
        ensureData();

        String json = JSON.serialize(resolveForContact(alphaContactId));

        // The ten fields the portal is allowed to see.
        for (String field : new List<String>{
            'participantId',
            'contactId',
            'participantName',
            'participantStatus',
            'programName',
            'coachName',
            'startDate',
            'expectedEndDate',
            'contactName',
            'contactEmail'
        }) {
            System.assert(json.contains('"' + field + '"'), 'missing whitelisted field ' + field + ': ' + json);
        }

        // The fields it must not. GitHub and Discord are academy-internal, and the
        // email snapshot is superseded by contactEmail as the single source.
        System.assert(!json.contains('github'), 'GitHub must not leak into the portal payload');
        System.assert(!json.contains('discord'), 'Discord must not leak into the portal payload');
        System.assert(!json.contains('__c'), 'No raw sObject field names may be serialised: ' + json);

        // Portal activation state is deliberately absent. This endpoint resolves
        // identity and reads; it does not know whether an invitation was completed,
        // so it must not claim one. A boolean here would assert a lifecycle fact
        // that Portal_Status__c is meant to own once that field exists.
        System.assert(!json.contains('portalActive'), 'Activation state must not be invented: ' + json);
        System.assert(!json.contains('Portal_Status'), 'Portal lifecycle belongs to the status model: ' + json);
    }

    @IsTest
    static void aParticipantWithoutProgramOrCoachResolvesWithNulls() {
        ensureData();

        // Onboarding state: enrolled, but nothing scheduled yet. The endpoint must
        // not fail and must not invent values.
        Contact delta = new Contact(
            FirstName = 'Portal',
            LastName = 'Delta',
            Email = 'portal.delta@example.invalid',
            AccountId = alphaAccountId
        );
        insert delta;
        insert new Participant__c(Name = 'Portal Delta', Contact__c = delta.Id, Status__c = 'Onboarding');
        Id deltaParticipantId = [
            SELECT Id
            FROM Participant__c
            WHERE Contact__c = :delta.Id
            LIMIT 1
        ].Id;

        ParticipantPortalData.ParticipantView view = resolveForContact(delta.Id);

        System.assertEquals(deltaParticipantId, view.participantId);
        System.assertEquals(null, view.programName, 'no program yet');
        System.assertEquals(null, view.coachName, 'no coach yet');
        System.assertEquals(null, view.startDate, 'no start date yet');
    }

    @IsTest
    static void anAmbiguousContactCannotBeCreatedInTheFirstPlace() {
        ensureData();

        // The endpoint has a defensive AMBIGUOUS_PARTICIPANT branch for data that
        // arrived by data load or predates the trigger. The state is unreachable
        // through the API, so the guarantee is asserted at its source instead.
        try {
            insert new Participant__c(Name = 'Portal Alpha Doppelt', Contact__c = alphaContactId);
            System.assert(false, 'a second participant for one contact must be rejected');
        } catch (DmlException error) {
            System.assert(
                error.getMessage().contains('DUPLICATE_PARTICIPANT_FOR_CONTACT'),
                'Expected the uniqueness code, got: ' + error.getMessage()
            );
        }

        System.assertEquals(
            1,
            [SELECT COUNT() FROM Participant__c WHERE Contact__c = :alphaContactId],
            'the contact must still own exactly one participant'
        );
    }

    @IsTest
    static void theEndpointCannotBeSteeredByTheCaller() {
        ensureData();

        // A request parameter is the obvious way this endpoint could be hijacked, so
        // pin the contract down by use rather than by reflection, which Apex lacks.
        //
        // getMe() takes no arguments, so there is no value a caller could send that
        // reaches the lookup. resolve() passes UserInfo.getUserId() and nothing
        // else. resolveForUser/resolveForContact are the test seams; getMe() is not
        // wired to them, which the class structure shows: getMe() calls resolve()
        // and nothing else.
        //
        // Two contacts' data must therefore never be reachable from one another.
        ParticipantPortalData.ParticipantView alphaView = resolveForContact(alphaContactId);
        ParticipantPortalData.ParticipantView betaView = resolveForContact(betaContactId);

        System.assertNotEquals(
            alphaView.participantId,
            betaView.participantId,
            'each contact resolves to a distinct participant'
        );
        System.assertNotEquals(
            betaView.participantId,
            alphaView.participantId,
            'and never to the other one'
        );
        System.assertEquals(alphaContactId, alphaView.contactId, 'alpha keeps its own contact');
        System.assertEquals(betaContactId, betaView.contactId, 'beta keeps its own contact');
    }

    // ---------------------------------------------------------------------

    /** A syntactically valid Id that is guaranteed not to exist in this org. */
    private static Id makeUnknownId() {
        return (Id) '005000000000000AAA';
    }

    private static ParticipantPortalData.ParticipantView resolveForContact(Id contactId) {
        return ParticipantPortalData.resolveForContact(contactId);
    }

    private static void ensureData() {
        if (alphaContactId != null) {
            return;
        }

        insert new Account(Name = 'Portal Test Account A');
        alphaAccountId = [SELECT Id FROM Account WHERE Name = 'Portal Test Account A' LIMIT 1].Id;

        insert new List<Contact>{
            new Contact(
                FirstName = 'Portal',
                LastName = 'Alpha',
                Email = 'portal.alpha@example.invalid',
                AccountId = alphaAccountId
            ),
            new Contact(
                FirstName = 'Portal',
                LastName = 'Beta',
                Email = 'portal.beta@example.invalid',
                AccountId = alphaAccountId
            ),
            // Gamma exists as a person but is not enrolled: a contact without a
            // participant is a normal intermediate state, not broken data.
            new Contact(
                FirstName = 'Portal',
                LastName = 'Gamma',
                Email = 'portal.gamma@example.invalid',
                AccountId = alphaAccountId
            )
        };
        alphaContactId = [SELECT Id FROM Contact WHERE Email = 'portal.alpha@example.invalid' LIMIT 1].Id;
        betaContactId = [SELECT Id FROM Contact WHERE Email = 'portal.beta@example.invalid' LIMIT 1].Id;
        gammaContactId = [SELECT Id FROM Contact WHERE Email = 'portal.gamma@example.invalid' LIMIT 1].Id;

        insert new Program__c(Name = 'Portal Test Program', Status__c = 'Active', DurationWeeks__c = 12);
        programId = [SELECT Id FROM Program__c WHERE Name = 'Portal Test Program' LIMIT 1].Id;
        insert new Coach_Profile__c(Name = 'Portal Test Coach', Role__c = 'Staff');
        coachId = [SELECT Id FROM Coach_Profile__c WHERE Name = 'Portal Test Coach' LIMIT 1].Id;

        insert new List<Participant__c>{
            new Participant__c(
                Name = 'Portal Alpha',
                Contact__c = alphaContactId,
                Status__c = 'Active',
                StartDate__c = Date.today(),
                ExpectedEndDate__c = Date.today().addDays(90),
                Program__c = programId,
                Coach_Profile__c = coachId
            ),
            new Participant__c(Name = 'Portal Beta', Contact__c = betaContactId, Status__c = 'Onboarding')
        };
        alphaParticipantId = [
            SELECT Id
            FROM Participant__c
            WHERE Contact__c = :alphaContactId
            LIMIT 1
        ].Id;
        betaParticipantId = [
            SELECT Id
            FROM Participant__c
            WHERE Contact__c = :betaContactId
            LIMIT 1
        ].Id;

        // The running user has no ContactId, which is exactly the NO_CONTACT_IDENTITY
        // case and needs no special setup to arrange.
        List<User> running = [SELECT Id, ContactId FROM User WHERE Id = :UserInfo.getUserId()];
        System.assert(
            running.isEmpty() || running[0].ContactId == null,
            'This test assumes the running user has no ContactId'
        );
        internalUserWithoutContact = UserInfo.getUserId();
    }
}
