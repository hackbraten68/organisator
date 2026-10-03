/**
 * Read-only learning paths for the signed-in portal user.
 *
 * ENDPOINT
 *   GET /services/apexrest/participant-portal/me/learning-path
 *   No parameters, deliberately — see "Authorisation".
 *
 * WHY THIS IS A SEPARATE @RestResource
 *   This was briefly a second method inside ParticipantPortalData. Apex allows
 *   only one @HttpGet per class, and that method cannot return Object, so both
 *   endpoints had to share one flat response class and a dispatcher that
 *   string-matched the request URI. That produced two things worth avoiding:
 *
 *   1. Every response carried the other endpoint's fields as null, so the two
 *      shapes could never be changed independently without breaking the other.
 *   2. The dispatcher's fallback returned /me data for any unrecognised
 *      sub-path, because the urlMapping wildcard '/participant-portal/*' matches
 *      '/me/anything'. Not a security hole — identity is still resolved
 *      server-side — but it answers 200 with the wrong body for a URL that does
 *      not exist.
 *
 *   One endpoint per class removes both. Salesforce resolves the more specific
 *   urlMapping for '/participant-portal/me/learning-path', and this class has a
 *   wildcard-free mapping so it cannot claim any other path.
 *
 * AUTHORISATION — read this before changing the sharing model
 *   This class runs `with sharing`, for the same reason ParticipantPortalData
 *   does, and on top of the same two independent layers:
 *
 *   1. Record-level sharing — Learning_Path__c is Private and
 *      ParticipantPortalSharingService releases exactly one Read share per
 *      learning path to the owning portal user, via the Portal_Access__c sharing
 *      reason. The query below therefore cannot see another participant's rows.
 *   2. The identity filter — resolveForUser() asserts the caller resolves to a
 *      portal identity before anything is queried. It is reached through
 *      ParticipantPortalData so there is exactly one identity chain in the org.
 *
 *   A learning path whose Participant__c has no Portal_User__c, or whose share
 *   was revoked, is simply invisible: the query returns no row for it. That is
 *   the correct fail-closed behaviour — absence, not an error.
 *
 * OBJECT PERMISSION IS A THIRD, SEPARATE GATE
 *   Record sharing alone is not enough. The portal user's profile grants no
 *   object access at all, so the query also needs Read on Learning_Path__c plus
 *   field access to everything selected here. Participant_Portal_Access carries
 *   that, and omitting it produces a QueryException that surfaces as a 500 for
 *   every signed-in member while a guest still gets a clean 401 — the endpoint
 *   looks healthy from outside the browser. Note that Learning_Path__c.Title__c
 *   is required and must therefore NOT get a fieldPermissions entry. See the
 *   note in Participant_Portal_Access.permissionset-meta.xml.
 *
 * SIDE EFFECTS
 *   None. This is a read and must not write.
 */
@RestResource(urlMapping='/participant-portal/me/learning-path')
global with sharing class ParticipantPortalLearningPath {
    /**
     * Whitelisted response shape for a single learning path item.
     *
     * Copied field by field rather than serialising the sObject, so a new column
     * on Learning_Path__c can never leak into the portal by accident.
     */
    global class LearningPathItemView {
        public String learningPathId;
        public String title;
        public String status;
        public Integer order;
        public Integer estimatedWeeks;
    }

    /**
     * The HTTP boundary shape: items on success, code/message on failure.
     *
     * Salesforce serialises the returned object to JSON; RestContext.response
     * is not writable on this org's API version, so the status code is the only
     * part set through RestContext. `learningPaths` is the field name the UI
     * bundle reads (learningPathApi.ts) — renaming it here breaks that client.
     */
    global class LearningPathResponse {
        public List<LearningPathItemView> learningPaths;
        public String code;
        public String message;

        global LearningPathResponse(List<LearningPathItemView> items) {
            this.learningPaths = items;
        }

        global LearningPathResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    /**
     * GET /services/apexrest/participant-portal/me/learning-path
     *
     * Returns the caller's learning paths, ordered by Order__c.
     */
    @HttpGet
    global static LearningPathResponse getLearningPath() {
        // Personal portal data: never let a shared cache hold it.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            ParticipantPortalData.ParticipantView participant =
                ParticipantPortalData.resolveForUser(UserInfo.getUserId());
            return new LearningPathResponse(queryLearningPaths(participant.participantId));
        } catch (PortalIdentityException error) {
            RestContext.response.statusCode = error.getStatusCode();
            return new LearningPathResponse(error.getCode(), error.getMessage());
        } catch (Exception error) {
            // Never surface the raw exception: it would leak field names and ids.
            // The log is where the cause belongs — see reportInternalError().
            reportInternalError(error);
            RestContext.response.statusCode = 500;
            return new LearningPathResponse('INTERNAL_ERROR', 'Learning path data unavailable.');
        }
    }

    /**
     * Logs a caught exception at ERROR level.
     *
     * A silent catch-all is how this endpoint answered 500 for every signed-in
     * member for a while: the QueryException that named the missing CRUD was
     * discarded, ApexLog stayed empty, and a guest could not reproduce it. Any
     * new endpoint on this data needs its own copy of this, or it inherits the
     * same blindness.
     */
    private static void reportInternalError(Exception error) {
        System.debug(
            LoggingLevel.ERROR,
            'ParticipantPortalLearningPath failed: ' + error.getTypeName() + ': ' + error.getMessage()
        );
    }

    /**
     * Reads the participant's learning paths and maps them to the view.
     *
     * Private on purpose: the only caller is getLearningPath(), and the id comes
     * from the resolved identity rather than from a parameter. The unit tests
     * cover the mapping at the service level; there is no seam to expose here
     * because a share row cannot be created in a test at all.
     */
    private static List<LearningPathItemView> queryLearningPaths(Id participantId) {
        List<Learning_Path__c> rows = [
            SELECT Id, Title__c, Status__c, Order__c, Estimated_Weeks__c
            FROM Learning_Path__c
            WHERE Participant__c = :participantId
            ORDER BY Order__c ASC
        ];

        List<LearningPathItemView> items = new List<LearningPathItemView>();
        for (Learning_Path__c lp : rows) {
            LearningPathItemView item = new LearningPathItemView();
            item.learningPathId = lp.Id;
            item.title = lp.Title__c;
            item.status = lp.Status__c;
            item.order = lp.Order__c == null ? null : Integer.valueOf(lp.Order__c);
            item.estimatedWeeks = lp.Estimated_Weeks__c == null
                ? null
                : Integer.valueOf(lp.Estimated_Weeks__c);
            items.add(item);
        }
        return items;
    }
}