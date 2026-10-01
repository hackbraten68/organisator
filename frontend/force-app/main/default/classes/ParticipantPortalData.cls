/**
 * Read-only participant portal data for the signed-in portal user.
 *
 * ENDPOINT
 *   GET /services/apexrest/participant-portal/me
 *   No parameters, deliberately — see "Authorisation".
 *
 * RESPONSE STYLE
 *   getMe() returns the view (or an error) and lets Salesforce serialise it to
 *   application/json. RestContext.response.response is not available on this
 *   org's API version, so an explicit body write is not an option. The status
 *   code is still set through RestContext for the error branches.
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
 *   This class runs `with sharing`. That is only safe because
 *   ParticipantPortalSharingService releases exactly one Participant__c row per
 *   portal user (via the Portal_Access__c sharing reason), so the query below
 *   cannot see any other participant even though the org enforces record
 *   sharing and FLS for Apex.
 *
 *   Two independent layers, deliberately not collapsed into one:
 *   1. Record-level sharing — the caller can only ever read the one row that
 *      was explicitly released to them.
 *   2. The identity filter — resolveForPortalUser() additionally asserts
 *      `Portal_User__c = UserInfo.getUserId()` before serving anything.
 *
 *   Why not a declarative Criteria-Based Sharing Rule: this org accepts
 *   `$User.UserRecord.Id` and `$User.Id` as the criterion value but does not
 *   evaluate them — both were stored and displayed as literals, so the rule
 *   matched nothing (see portal-deploy-status.md). Managed sharing is the
 *   supported way to express "this row belongs to exactly this portal user".
 *
 *   Do NOT widen this. Removing `with sharing`, the single-row filter, or the
 *   Portal_User__c assertion would put every participant row one careless query
 *   away. ADR-003, ADR-010, ADR-012.
 *
 * SIDE EFFECTS
 *   None. This is a read: it must not write. In particular it does not activate a
 *   portal invitation, so it needs no compensating DML and stays safe to call from
 *   a refetch, a prefetch or a health check. The portal lifecycle belongs to
 *   Portal_Status__c / Portal_ActivatedAt__c once that model exists — see
 *   portal-access-plan.md phase 3.2.
 */
@RestResource(urlMapping='/participant-portal/*')
global with sharing class ParticipantPortalData {
    /** The HTTP status the endpoint answers with; kept for symmetry with the view. */
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
    }

    global class PortalErrorResponse {
        public String code;
        public String message;

        global PortalErrorResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    /**
     * The HTTP boundary shape.
     *
     * An @HttpGet method cannot return Object, so success and failure cannot be
     * two different types. MeResponse carries the participant fields flat — the
     * shape the UI reads — and the stable error code/message on top. The UI
     * branches on the HTTP status, so code/message are simply null on success.
     */
    global class MeResponse {
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
        public String code;
        public String message;

        global MeResponse(ParticipantView view) {
            this.participantId = view.participantId;
            this.contactId = view.contactId;
            this.participantName = view.participantName;
            this.participantStatus = view.participantStatus;
            this.programName = view.programName;
            this.coachName = view.coachName;
            this.startDate = view.startDate;
            this.expectedEndDate = view.expectedEndDate;
            this.contactName = view.contactName;
            this.contactEmail = view.contactEmail;
        }

        global MeResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    @HttpGet
    global static MeResponse getMe() {
        // Personal portal data: never let a shared cache hold it.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            return new MeResponse(resolve());
        } catch (PortalIdentityException error) {
            RestContext.response.statusCode = error.getStatusCode();
            return new MeResponse(error.getCode(), error.getMessage());
        } catch (Exception error) {
            // Never surface the raw exception: it would leak field names and IDs.
            RestContext.response.statusCode = 500;
            return new MeResponse('INTERNAL_ERROR', 'Portal data unavailable.');
        }
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
        // A caller without a portal session runs as the site guest user, which cannot
        // read the User table at all. That surfaces as a QueryException rather
        // than an empty list, and it means exactly one thing here: there is no
        // portal identity to resolve. Map it to the same 401 as a missing
        // contact instead of letting it fall through to a 500, which would tell
        // the caller "something is broken" for what is simply "not logged in".
        List<User> users;
        try {
            users = [SELECT ContactId FROM User WHERE Id = :userId LIMIT 1];
        } catch (QueryException noUserAccess) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }
        if (users.isEmpty() || users[0].ContactId == null) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }
        return resolveForPortalUser(users[0].ContactId, userId);
    }

    /**
     * Second, independent authorisation layer.
     *
     * Record-level sharing is the first one: ParticipantPortalSharingService
     * releases exactly one row per portal user, and this class runs `with
     * sharing`, so the query cannot see any other participant at all.
     *
     * This check is the second one and deliberately redundant. It states in
     * code what the caller must satisfy, so a row that becomes reachable for
     * some other reason still cannot be served to a user it was not released
     * to. Returning 403 rather than 404 here is intentional: the caller is a
     * legitimate, authenticated portal user, and the honest answer is "not
     * released to you", not "does not exist".
     */
    global static ParticipantView resolveForPortalUser(Id contactId, Id portalUserId) {
        if (contactId == null || portalUserId == null) {
            throw identityError(
                401,
                'NO_CONTACT_IDENTITY',
                'The signed-in user has no contact, so no portal data can be resolved.'
            );
        }

        List<Participant__c> released = [
            SELECT Id
            FROM Participant__c
            WHERE Contact__c = :contactId
                AND Portal_User__c = :portalUserId
            LIMIT 1
        ];
        if (released.isEmpty()) {
            throw identityError(
                403,
                'PORTAL_ACCESS_NOT_GRANTED',
                'This participant record is not released to the signed-in portal user.'
            );
        }

        return resolveForContact(contactId);
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
