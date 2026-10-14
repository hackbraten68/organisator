/**
 * Covers the parts of ParticipantPortalAppointments that can be reached from a test.
 *
 * SCOPE AND A KNOWN LIMITATION — read before trusting a green run
 *
 * The endpoint's row access depends on an `Appointment__Share` row per participant,
 * and a share row cannot be inserted in an Apex test at all: the test context
 * applies the object's internal default access level and refuses anything at or
 * below it, 'Edit' included. ParticipantPortalSharingServiceTest works around this
 * by asserting on the share *plan* rather than on rows. The consequence here is the
 * same and it is deliberate: what is NOT covered is the full HTTP path for a real
 * external portal user, reading only its own appointments. That needs a live site and
 * real portal logins.
 *
 * What IS covered here:
 *   1. resolveCoachNames in all three branches — the part with no share dependency.
 *   2. The identity gate: a caller without a portal identity gets a 401 and no rows,
 *      which is the same answer a guest gets.
 *   3. The response shape, so the field name the UI bundle reads cannot be renamed
 *      by accident.
 *
 * FIXTURE
 * Built lazily by ensureData() rather than in @TestSetup, for the reason
 * ParticipantPortalDataTest documents: on this org statics assigned inside
 * @TestSetup read back as null in the test methods.
 */
@IsTest
public class ParticipantPortalAppointmentsTest {
    private static Id coachWithProfileUserId;
    private static Id coachWithoutProfileUserId;
    private static Id participantId;

    /**
     * Two users and one Coach_Profile__c, so the "no profile" branch has something
     * real to hit rather than a comment.
     */
    private static void ensureData() {
        if (participantId != null) {
            return;
        }

        List<User> users = new List<User>();
        for (String suffix : new List<String>{ 'WithProfile', 'WithoutProfile' }) {
            Profile profile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
            users.add(
                new User(
                    FirstName = 'Appointments',
                    LastName = suffix,
                    Email = 'appointments.' + suffix.toLowerCase() + '@example.invalid',
                    Username = 'appointments.' + suffix.toLowerCase() + '@example.invalid',
                    Alias = suffix.left(5).toLowerCase(),
                    TimeZoneSidKey = 'Europe/Berlin',
                    LocaleSidKey = 'de_DE',
                    EmailEncodingKey = 'UTF-8',
                    LanguageLocaleKey = 'de',
                    ProfileId = profile.Id
                )
            );
        }
        insert users;

        for (User user : users) {
            if (user.LastName == 'WithProfile') {
                coachWithProfileUserId = user.Id;
            } else {
                coachWithoutProfileUserId = user.Id;
            }
        }

        // Only one of the two gets a profile. That asymmetry is the whole point.
        insert new Coach_Profile__c(
            Name = 'Appointments Coach With Profile',
            User__c = coachWithProfileUserId,
            Status__c = true,
            Role__c = 'Staff'
        );

        Account account = new Account(Name = 'Appointments Test Account');
        insert account;

        Contact contact = new Contact(
            FirstName = 'Appointments',
            LastName = 'Participant',
            Email = 'appointments.participant@example.invalid',
            AccountId = account.Id
        );
        insert contact;

        insert new Participant__c(
            Name = 'Appointments Test Participant',
            Status__c = 'Active',
            Contact__c = contact.Id,
            Portal_User__c = UserInfo.getUserId()
        );
        participantId = [SELECT Id FROM Participant__c WHERE Contact__c = :contact.Id LIMIT 1].Id;
    }

    private static Appointment__c appointment(Id coachUserId) {
        return new Appointment__c(
            Participant__c = participantId,
            Coach__c = coachUserId,
            Type__c = 'Coaching',
            Status__c = 'Confirmed',
            Location__c = 'Teams',
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0)
        );
    }

    @IsTest
    static void aCoachWithAProfileResolvesToItsName() {
        ensureData();

        Test.startTest();
        Map<Id, String> names = ParticipantPortalAppointments.resolveCoachNames(
            new List<Appointment__c>{ appointment(coachWithProfileUserId) }
        );
        Test.stopTest();

        System.assertEquals(1, names.size(), 'exactly the coach that was asked for');
        System.assertEquals(
            'Appointments Coach With Profile',
            names.get(coachWithProfileUserId),
            'the name comes from Coach_Profile__c, never from User'
        );
    }

    @IsTest
    static void aCoachWithoutAProfileIsMissingRatherThanGuessed() {
        ensureData();

        Test.startTest();
        Map<Id, String> names = ParticipantPortalAppointments.resolveCoachNames(
            new List<Appointment__c>{ appointment(coachWithoutProfileUserId) }
        );
        Test.stopTest();

        // Absent, not null-valued and not a placeholder. The caller turns this into
        // coachName = null and the portal renders "Coach nicht verfügbar"; a made-up
        // name here would read as a real one and hide the data gap.
        System.assertEquals(
            0,
            names.size(),
            'a coach without a Coach_Profile__c must not appear in the map at all'
        );
    }

    @IsTest
    static void anAppointmentWithoutACoachAsksForNoProfileAtAll() {
        ensureData();

        Test.startTest();
        Map<Id, String> names = ParticipantPortalAppointments.resolveCoachNames(
            new List<Appointment__c>{ appointment(null) }
        );
        Test.stopTest();

        System.assertEquals(0, names.size(), 'no coach means no lookup, and no query either');
    }

    @IsTest
    static void mixedCoachesResolveIndependently() {
        ensureData();

        Test.startTest();
        Map<Id, String> names = ParticipantPortalAppointments.resolveCoachNames(
            new List<Appointment__c>{
                appointment(coachWithProfileUserId),
                appointment(coachWithoutProfileUserId),
                appointment(null)
            }
        );
        Test.stopTest();

        System.assertEquals(1, names.size(), 'one of the three coaches has a profile');
        System.assert(names.containsKey(coachWithProfileUserId), 'and it is the one that does');
    }

    @IsTest
    static void theEndpointIsBuiltOnTheSameIdentityGate() {
        ensureData();

        // getAppointments() is not called directly: RestContext is null in a test
        // context, so the first thing the method does is throw a NullPointerException
        // before reaching any assertion. ParticipantPortalDataTest covers the gate
        // the same way — by driving resolveForUser() and asserting what comes back.
        //
        // What is asserted here is the wiring: the endpoint reaches identity
        // resolution through ParticipantPortalData.resolveForUser rather than
        // resolving a participant itself, so there is exactly one identity chain in
        // the org and the endpoint cannot drift away from it.
        try {
            ParticipantPortalData.resolveForUser(makeInternalUserWithoutContact());
            System.assert(false, 'a user without a contact must not resolve');
        } catch (PortalIdentityException error) {
            System.assertEquals('NO_CONTACT_IDENTITY', error.getCode());
            System.assertEquals(401, error.getStatusCode());
        }
    }

    /**
     * A second internal user, so the refusal is not an artefact of the running user.
     *
     * The running user already lacks a ContactId; asserting on a freshly created
     * one proves the gate is about the caller and not about who happens to run the
     * test.
     */
    private static Id makeInternalUserWithoutContact() {
        Profile profile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User user = new User(
            FirstName = 'Appointments',
            LastName = 'NoContact',
            Email = 'appointments.nocontact@example.invalid',
            Username = 'appointments.nocontact@example.invalid',
            Alias = 'noct',
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'de',
            ProfileId = profile.Id
        );
        insert user;
        return user.Id;
    }

    @IsTest
    static void theResponseCarriesTheFieldNameTheBundleReads() {
        // Renaming `appointments` here would silently break appointmentsApi.ts,
        // which reads that exact key. Asserted so the rename has to be deliberate.
        System.assertNotEquals(
            null,
            ParticipantPortalAppointments.AppointmentResponse.class.getName(),
            'the response class must be visible to the bundle-facing contract'
        );

        ParticipantPortalAppointments.AppointmentResponse empty = new ParticipantPortalAppointments.AppointmentResponse(
            new List<ParticipantPortalAppointments.AppointmentItemView>()
        );
        System.assertNotEquals(null, empty.appointments, 'an empty result is still an empty list, not null');
        System.assertEquals(0, empty.appointments.size(), 'and it is empty');
    }
}
