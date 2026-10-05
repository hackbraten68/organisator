/**
 * Covers the server-side staff identity, which is what removed the "Wer arbeitet
 * hier?" picker from the normal case.
 *
 * WHAT IS COVERED
 *   - resolve() returns the running user's own row, from UserInfo and from
 *     nowhere else. There is no parameter to getMe(), so this is the only path
 *     that can name a person.
 *   - A user id that is not a User is answered as 401, not 500 — the same
 *     distinction ParticipantPortalData draws between "not logged in" and
 *     "something is broken".
 *   - displayName(): FirstName wins, the first token of Name is the fallback, and
 *     an empty name yields null so the client can fall through to the picker
 *     rather than record an actor with an empty display name.
 *
 * WHAT IS NOT COVERED
 *   - getMe() itself. It is not callable here: it touches RestContext.response,
 *     which does not exist outside a REST request. Same trade-off
 *     ParticipantPortalDataTest makes and for the same reason. The response
 *     shape is therefore covered only by the type existing and by resolve()
 *     being what getMe() wraps.
 *   - Whether the caller can reach the endpoint over HTTP. That needs a real
 *     browser session and a granted classAccesses entry; see
 *     backend/docs/AGENTS.md and the ADR in the UI bundle's
 *     docs/AUDIT-SYSTEM-DESIGN.md.
 */
@IsTest
public class StaffIdentityTest {

    @IsTest
    static void resolvesTheRunningUserFromUserInfo() {
        StaffIdentity.Identity identity = StaffIdentity.resolve();

        System.assertEquals(UserInfo.getUserId(), identity.userId, 'Must be the caller');
        System.assert(
            identity.firstName != null && identity.firstName != '',
            'Expected a usable display name, got: ' + identity.firstName
        );
        System.assertEquals(
            UserInfo.getName(),
            identity.fullName,
            'fullName must be the caller\'s own name'
        );
    }

    @IsTest
    static void unknownUserIdIsUnauthorisedRatherThanBroken() {
        try {
            StaffIdentity.resolveForUser(makeUnknownId());
            System.assert(false, 'Expected a StaffIdentityException');
        } catch (StaffIdentityException error) {
            System.assertEquals(401, error.getStatusCode(), 'Expected an auth failure');
            System.assertEquals('NO_SESSION_IDENTITY', error.getCode(), 'Expected the auth code');
        }
    }

    @IsTest
    static void nullUserIdIsUnauthorisedRatherThanBroken() {
        try {
            StaffIdentity.resolveForUser(null);
            System.assert(false, 'Expected a StaffIdentityException');
        } catch (StaffIdentityException error) {
            System.assertEquals(401, error.getStatusCode(), 'Expected an auth failure');
            System.assertEquals('NO_SESSION_IDENTITY', error.getCode(), 'Expected the auth code');
        }
    }

    @IsTest
    static void displayNamePrefersTheFirstName() {
        System.assertEquals(
            'Samuel',
            StaffIdentity.displayName('  Samuel  ', 'Samuel Dillenburg'),
            'FirstName must win, trimmed'
        );
    }

    @IsTest
    static void displayNameFallsBackToTheFirstTokenOfTheName() {
        // A user without a FirstName is common in a freshly seeded org, and an
        // empty actor name would be worse than a surname-derived one.
        System.assertEquals(
            'Dillenburg',
            StaffIdentity.displayName(null, '  Dillenburg  '),
            'Expected the first token of Name'
        );
        System.assertEquals(
            'Samuel',
            StaffIdentity.displayName('', 'Samuel Dillenburg'),
            'An empty FirstName must fall through, not win'
        );
    }

    @IsTest
    static void displayNameYieldsNullWhenThereIsNoNameAtAll() {
        // Null lets the client fall through to the picker. An empty string would
        // be recorded as an actor with a blank name.
        System.assertEquals(null, StaffIdentity.displayName(null, null), 'Expected null');
        System.assertEquals(null, StaffIdentity.displayName('   ', '   '), 'Expected null');
    }

    /** A syntactically valid Id that belongs to no User. */
    private static Id makeUnknownId() {
        return (Id) '005000000000000AAA';
    }
}