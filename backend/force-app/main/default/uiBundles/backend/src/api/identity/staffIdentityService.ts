/**
 * Server-side identity of the signed-in staff user (Apex `StaffIdentity`).
 *
 * WHY A SEPARATE REST CALL AND NOT GRAPHQL
 *   The question is "who am I", and the runtime cannot answer it. Measured:
 *   `SFDC_ENV` carries `orgUrl`, `apiPath`, `basePath`, `namespace` and
 *   `appName` — no user, no username. The platform-sdk's `AppIdentity` is the
 *   *UIBundle* identity, not a person, and UI API has no `uiapi.user` root. The
 *   "Logged in as …" bar above this app is rendered by Salesforce on the server
 *   and says nothing about what the bundle can read.
 *
 *   So the answer has to come from a server that runs in the user's session.
 *   `UserInfo.getUserId()` is that answer, and it is not influenceable from here:
 *   the endpoint takes no parameters.
 *
 * TRANSPORT
 *   `sdk.fetch`, not a bare `fetch`: the Data SDK prefixes `SFDC_ENV.apiPath`,
 *   which a raw call would miss (a wrong prefix answers 200 with the SPA shell —
 *   the same trap the portal documents for its own endpoints), and it attaches
 *   the CSRF header. `services/apexrest` is in the SDK's always-protected list,
 *   so even this GET gets a token.
 *
 * FAILURE IS NORMAL, NOT EXCEPTIONAL
 *   Every failure answers the same way: `null`, and the caller falls through to
 *   the next identity source. That covers the endpoint not being deployed yet
 *   (404), a profile without the class grant (403), no session (401) and a
 *   network or parse error. Nothing here may throw: an exception would abort the
 *   whole resolution chain and lose the remembered actor as well.
 */

import { createDataSDK } from "@salesforce/platform-sdk";

/** Path as the SDK wants it: `sdk.fetch` prefixes `SFDC_ENV.apiPath` itself. */
const IDENTITY_PATH = "/services/apexrest/staff-identity/me";

export interface StaffIdentity {
  /** The real Salesforce User id — the actor is a verifiable record, not a name. */
  userId: string;
  /** First name only. This is what lands in an audit event. */
  firstName: string;
  /** Full name for the sidebar card. Never written to an audit event. */
  fullName: string;
  username?: string;
  profileName?: string;
  roleName?: string;
  photoUrl?: string;
}

/** Raw endpoint shape: identity fields, or `code`/`message` on a failure. */
interface MeResponse {
  userId?: string | null;
  firstName?: string | null;
  fullName?: string | null;
  username?: string | null;
  profileName?: string | null;
  roleName?: string | null;
  photoUrl?: string | null;
  code?: string | null;
  message?: string | null;
}

/**
 * The signed-in user, or null when that cannot be established.
 *
 * A response without a user id or without a display name is treated as no
 * answer: an actor with an empty name would be written into the audit trail,
 * which is worse than asking the picker.
 */
export async function fetchCurrentStaffIdentity(): Promise<StaffIdentity | null> {
  try {
    const sdk = await createDataSDK();
    if (!sdk.fetch) {
      console.debug("[audit] Data SDK surface has no fetch; server identity unavailable");
      return null;
    }
    const response = await sdk.fetch(IDENTITY_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      // 404 = not deployed, 403 = no class grant, 401 = no session. All three
      // mean the same thing here, and none of them is worth a louder log.
      console.debug(`[audit] Staff identity unavailable (HTTP ${response.status})`);
      return null;
    }
    const body = (await response.json()) as MeResponse | null;
    return toStaffIdentity(body);
  } catch (err) {
    console.debug("[audit] Staff identity request failed", err);
    return null;
  }
}

function toStaffIdentity(body: MeResponse | null): StaffIdentity | null {
  if (body?.code) {
    console.debug(`[audit] Staff identity rejected: ${body.code}`);
    return null;
  }
  const userId = trimmed(body?.userId);
  const firstName = trimmed(body?.firstName);
  if (!userId || !firstName) return null;
  const identity: StaffIdentity = { userId, firstName, fullName: trimmed(body?.fullName) || firstName };
  const username = trimmed(body?.username);
  if (username) identity.username = username;
  const profileName = trimmed(body?.profileName);
  if (profileName) identity.profileName = profileName;
  const roleName = trimmed(body?.roleName);
  if (roleName) identity.roleName = roleName;
  const photoUrl = trimmed(body?.photoUrl);
  if (photoUrl) identity.photoUrl = photoUrl;
  return identity;
}

function trimmed(value: string | null | undefined): string {
  return value?.trim() ?? "";
}