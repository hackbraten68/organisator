/**
 * Server-side identity of the signed-in internal staff user.
 *
 * ENDPOINT
 *   GET /services/apexrest/staff-identity/me
 *   No parameters, deliberately — see "IDENTITY".
 *
 * WHY THIS EXISTS
 *   The internal backoffice UI Bundle has to name the actor behind every audit
 *   event, and it could not learn who that is from the client. Measured:
 *
 *   - `SFDC_ENV` carries `orgUrl`, `apiPath`, `basePath`, `namespace` and
 *     `appName`. No user, no username. See frontend/AGENTS.md, "Login and logout
 *     paths".
 *   - The platform-sdk's own "identity" is the *UIBundle* identity
 *     (`AppIdentity` = namespace / appName / qualifiedName / bundleId), not a
 *     person. There is no `uiapi.user` root either, and neither `AuthSession`
 *     nor `LoginHistory` is exposed over UI API.
 *   - The "Logged in as <username>" bar at the top of the backoffice page is
 *     rendered by Salesforce on the server. Its presence says nothing about
 *     what the bundle can read.
 *
 *   So the actor had to be self-attested through a picker, which asked on every
 *   new tab. This endpoint is the fix the design asked for from the start
 *   (AUDIT-SYSTEM-DESIGN.md § 2.7 "Server-Side Actor Extraction"): the platform
 *   answers with `UserInfo`, the client cannot influence the answer at all.
 *
 * IDENTITY
 *   Resolved server-side, never from the request:
 *
 *     UserInfo.getUserId() -> that single User row
 *
 *   There is no parameter to pass a user id, so no caller can ask to be someone
 *   else. The only reachable row is the caller's own.
 *
 * WHAT IS RETURNED
 *   `firstName` is the audit display name and is deliberately first-name-only
 *   (privacy decision 2026-09-27). `fullName`, `username`, `profileName`,
 *   `roleName` and `photoUrl` exist for the sidebar user card and are never
 *   written into an audit event.
 *
 *   A user with no FirstName falls back to the first token of Name, so a
 *   single-word or last-name-only user still yields a usable actor instead of an
 *   empty one.
 *
 * AUTHORISATION
 *   There is nothing to authorise: the response describes the caller. It is
 *   still `with sharing` and still reads exactly one row, and it exposes no
 *   record other than the caller's own User. Class access is granted through
 *   `backend_Access` / `backend_Coach` — the same way the portal permission set
 *   grants it for ParticipantPortalData. Without that grant a limited internal
 *   profile answers 403 and the bundle falls back to the picker.
 *
 * SIDE EFFECTS
 *   None. This is a read: it must not write.
 */
@RestResource(urlMapping='/staff-identity/*')
global with sharing class StaffIdentity {

    /**
     * The HTTP boundary shape: identity fields on success, code/message on failure.
     *
     * Salesforce serialises the returned object to application/json.
     * `RestContext.response.response` does not exist on this API version, so the
     * body cannot be written explicitly — see ParticipantPortalData for the same
     * constraint. The status code is still set through RestContext.
     *
     * @HttpGet rejects Object as a return type, which is why this is one flat
     * class carrying both the identity fields and code/message rather than two
     * response classes.
     */
    global class MeResponse {
        public String userId;
        public String firstName;
        public String fullName;
        public String username;
        public String profileName;
        public String roleName;
        public String photoUrl;
        public String code;
        public String message;

        global MeResponse(Identity identity) {
            this.userId = identity.userId;
            this.firstName = identity.firstName;
            this.fullName = identity.fullName;
            this.username = identity.username;
            this.profileName = identity.profileName;
            this.roleName = identity.roleName;
            this.photoUrl = identity.photoUrl;
        }

        global MeResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    /**
     * The row itself, so the response shape and the data stay separable.
     *
     * @see MeResponse
     */
    global class Identity {
        public String userId;
        public String firstName;
        public String fullName;
        public String username;
        public String profileName;
        public String roleName;
        public String photoUrl;
    }

    /**
     * GET /services/apexrest/staff-identity/me
     *
     * The only endpoint on this resource. The urlMapping needs its '/*' wildcard
     * because a wildcard-free mapping does not match '/me' — the same trap
     * ParticipantPortalData documents.
     */
    @HttpGet
    global static MeResponse getMe() {
        // Who is logged in is not cacheable, not by anyone.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            return new MeResponse(resolve());
        } catch (StaffIdentityException error) {
            RestContext.response.statusCode = error.getStatusCode();
            return new MeResponse(error.getCode(), error.getMessage());
        } catch (Exception error) {
            // Never surface the raw exception: it would leak field names and ids.
            // This exists because the alternative was a failure nobody could see —
            // the catch-all in ParticipantPortalData discarded the QueryException
            // that named the cause, and ApexLog was empty.
            System.debug(
                LoggingLevel.ERROR,
                'StaffIdentity /me failed: ' + error.getTypeName() + ': ' + error.getMessage()
            );
            RestContext.response.statusCode = 500;
            return new MeResponse('INTERNAL_ERROR', 'Staff identity unavailable.');
        }
    }

    /**
     * Resolves the caller's own identity. Exposed for the test class.
     *
     * @throws StaffIdentityException when there is no session or the running user
     *         cannot be read.
     */
    global static Identity resolve() {
        return resolveForUser(UserInfo.getUserId());
    }

    /**
     * The identity lookup, with the user id as a parameter.
     *
     * This is a seam for the tests, not a second entry point: getMe() never
     * passes anything but UserInfo.getUserId(). Without it the only way to test
     * the "no FirstName" branch would be to create a User, which needs a profile
     * and makes the test brittle for a branch that is three lines of string work.
     */
    global static Identity resolveForUser(Id userId) {
        if (userId == null) {
            throw identityError(401, 'NO_SESSION_IDENTITY');
        }

        List<User> users;
        try {
            // Explicit field list: a new column on User can never leak into the
            // backoffice by accident.
            users = [
                SELECT
                    Id,
                    FirstName,
                    Name,
                    Username,
                    SmallPhotoUrl,
                    Profile.Name,
                    UserRole.Name
                FROM User
                WHERE Id = :userId
                LIMIT 1
            ];
        } catch (QueryException noUserAccess) {
            // A caller without a session runs as the site guest user, which
            // cannot read the User table at all. That is exactly one thing: there
            // is no identity to resolve. Mapped to 401 so it does not read as a
            // 500, which would tell the caller "something is broken" for what is
            // simply "not logged in".
            throw identityError(401, 'NO_SESSION_IDENTITY');
        }

        if (users.isEmpty()) {
            throw identityError(401, 'NO_SESSION_IDENTITY');
        }

        return toIdentity(users[0]);
    }

    /**
     * Builds the one exception this class throws.
     *
     * The status code and the code travel together so a caller can branch on
     * either; the message stays generic because it is the only part that reaches
     * an unauthenticated caller.
     */
    private static StaffIdentityException identityError(Integer status, String code) {
        StaffIdentityException error = new StaffIdentityException(
            'There is no signed-in staff user to identify.'
        );
        error.init(status, code);
        return error;
    }

    /**
     * First name, or the first token of the full name when there is none.
     *
     * @VisibleForTesting so the fallback is covered without creating a User.
     */
    @VisibleForTesting
    global static String displayName(String firstName, String fullName) {
        if (firstName != null && firstName.trim() != '') {
            return firstName.trim();
        }
        if (fullName == null) {
            return null;
        }
        List<String> tokens = fullName.trim().split('\\s+');
        for (String token : tokens) {
            if (token != '') {
                return token;
            }
        }
        return null;
    }

    private static Identity toIdentity(User user) {
        Identity identity = new Identity();
        identity.userId = user.Id;
        identity.firstName = displayName(user.FirstName, user.Name);
        identity.fullName = user.Name;
        identity.username = user.Username;
        // Profile and role are frequently absent (scratch orgs, unlicensed roles);
        // the sidebar degrades, it does not break.
        if (user.Profile != null) {
            identity.profileName = user.Profile.Name;
        }
        if (user.UserRole != null) {
            identity.roleName = user.UserRole.Name;
        }
        if (user.SmallPhotoUrl != null) {
            identity.photoUrl = String.valueOf(user.SmallPhotoUrl);
        }
        return identity;
    }
}
