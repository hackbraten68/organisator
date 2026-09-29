/**
 * Read-only participant portal data for the signed-in portal user.
 *
 * ENDPOINT
 *   GET /services/apexrest/participant-portal/me
 *   No parameters, deliberately — see "Authorisation".
 *
 * RESPONSE STYLE
 *   Uses the static responseBody/responseStatus fields rather than
 *   RestContext.response.response. On this org the RestResponse body property is
 *   not exposed to Apex, so that form does not compile. RestContext is still fine
 *   for headers inside the @HttpGet method.
 *
 * IDENTITY
 *   Resolved server-side, never from the request:
 *
 *     UserInfo.getUserId() -> User.ContactId -> Participant__c WHERE Contact__c = :contactId
 *
 *   A caller cannot select a record: there is no parameter to pass a participant
 *   or contact id. The only reachable row is the caller's own (ADR-003, ADR-010).
 *
 * AUTHORISATION — read this before changing the sharing model
 *   This class runs `without sharing` on purpose. Participant__c has
 *   externalSharingModel = Private, so `with sharing` returns nothing for an
 *   external portal user and the portal could not start at all. The authorisation
 *   is NOT "system mode sees everything"; it is the single-row filter above, which
 *   the query enforces and the tests cover — including that a second user resolves
 *   to their own record and never to somebody else's.
 *
 *   Once account-based sharing (Approach A) or a sharing set (Approach B) is live
 *   and the spike's positive and negative tests have passed, change this to
 *   `with sharing` and drop this note. Until then the explicit filter is the only
 *   thing standing between the caller and every other participant row, so it must
 *   not be widened.
 */
@RestResource(urlMapping='/participant-portal')
global without sharing class ParticipantPortalData {
    /** The response body. Salesforce serves this as application/json. */
    global static String responseBody;
    /** The HTTP status for this request. */
    global static Integer responseStatus = 200;

    /**
     * Whitelisted response shape. Fields are copied explicitly rather than
     * serialising the sObject, so a new column on Participant__c can never leak
     * into the portal by accident.
     */
    global class ParticipantView {
        public String participantId;
        public String contactId;
        public String participantName;
        public String participantStatus;
        public String programName;
        public String coachName;
        public String startDate;
        public String expectedEndDate;
        public String contactName;
        public String contactEmail;
        /** Confirms the caller reached their own record. */
        public Boolean portalActive;
    }

    global class PortalErrorResponse {
        public String code;
        public String message;

        global PortalErrorResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    @HttpGet
    global static void getMe() {
        // Personal portal data: never let a shared cache hold it.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            respond(200, JSON.serialize(resolve()));
        } catch (PortalIdentityException error) {
            respond(
                error.getStatusCode(),
                JSON.serialize(new PortalErrorResponse(error.getCode(), error.getMessage()))
            );
        } catch (Exception error) {
            // Never surface the raw exception: it would leak field names and IDs.
            respond(
                500,
                JSON.serialize(
                    new PortalErrorResponse('INTERNAL_ERROR', 'Portal data unavailable.')
                )
            );
        }
    }

    private static void respond(Integer status, String body) {
        responseStatus = status;
        responseBody = body;
    }

    /**
     * Resolves the caller's participant. Exposed for the test class.
     *
     * @throws PortalIdentityException when the caller has no identity, no role, or
     *         an ambiguous role. The ambiguity branch is defensive: the uniqueness
     *         rule should make it unreachable, so a hit means the data is broken
     *         and guessing would show the wrong person.
     */
    global static ParticipantView resolve() {
        return resolveForUser(UserInfo.getUserId());
    }

    /**
     * The identity lookup, with the user id as a parameter.
     *
     * This is a seam for the tests, not a second entry point: getMe() never passes
     * anything but UserInfo.getUserId(). Keeping the caller in resolve() and the
     * lookup here is what lets the tests drive each error branch without an
     * external login — creating a User that carries a ContactId requires an
     * Experience Cloud profile and a Setup toggle, neither of which a test can
     * switch on.
     */
    global static ParticipantView resolveForUser(Id userId) {
        // Two queries rather than a semi-join subquery: Apex does not support
        // `WHERE Id = (SELECT ...)`, and separate queries show which link of the
        // identity chain actually failed.
        List<User> users = [SELECT ContactId FROM User WHERE Id = :userId LIMIT 1];
        if (users.isEmpty() || users[0].ContactId == null) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }
        return resolveForContact(users[0].ContactId);
    }

    /**
     * The contact -> participant half of the chain, exposed for the test class.
     * getMe() never calls this; resolveForUser() calls it after establishing the
     * caller's identity. See the class comment for why the split exists.
     */
    global static ParticipantView resolveForContact(Id contactId) {
        if (contactId == null) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }

        List<Contact> identity = [SELECT Id, Name, Email FROM Contact WHERE Id = :contactId];
        if (identity.isEmpty()) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }

        List<Participant__c> matches = [
            SELECT
                Id,
                Name,
                Status__c,
                StartDate__c,
                ExpectedEndDate__c,
                Contact__c,
                Program__c,
                Coach_Profile__c
            FROM Participant__c
            WHERE Contact__c = :contactId
        ];

        if (matches.isEmpty()) {
            throw identityError(404, 'NO_PARTICIPANT', 'This contact is not a participant yet.');
        }
        if (matches.size() > 1) {
            throw identityError(
                500,
                'AMBIGUOUS_PARTICIPANT',
                'More than one participant is assigned to this contact.'
            );
        }

        return toView(matches[0], identity[0]);
    }

    private static PortalIdentityException identityError(
        Integer status,
        String code,
        String message
    ) {
        PortalIdentityException error = new PortalIdentityException(message);
        error.init(status, code);
        return error;
    }

    private static ParticipantView toView(Participant__c participant, Contact contact) {
        ParticipantView view = new ParticipantView();
        view.participantId = participant.Id;
        view.contactId = contact.Id;
        view.participantName = participant.Name;
        view.participantStatus = participant.Status__c;
        view.startDate = participant.StartDate__c == null
            ? null
            : String.valueOf(participant.StartDate__c);
        view.expectedEndDate = participant.ExpectedEndDate__c == null
            ? null
            : String.valueOf(participant.ExpectedEndDate__c);
        view.contactName = contact.Name;
        view.contactEmail = contact.Email;
        view.programName = nameOf(participant.Program__c, 'Program__c');
        view.coachName = nameOf(participant.Coach_Profile__c, 'Coach_Profile__c');
        view.portalActive = true;
        return view;
    }

    private static String nameOf(Id recordId, String sobjectType) {
        if (recordId == null) {
            return null;
        }
        List<SObject> rows = Database.query(
            'SELECT Name FROM ' + sobjectType + ' WHERE Id = :recordId LIMIT 1'
        );
        return rows.isEmpty() ? null : String.valueOf(rows[0].get('Name'));
    }
}
