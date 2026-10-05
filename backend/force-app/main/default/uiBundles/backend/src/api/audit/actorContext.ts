/**
 * Audit actor resolution: who performed the action?
 *
 * Identity model (no app login exists — the bundle inherits the ambient
 * Salesforce session via createDataSDK): the actor is the Salesforce User
 * behind the session. Resolution chain, first hit wins:
 *
 *   1. Server identity: GET /services/apexrest/staff-identity/me answers with
 *      `UserInfo`, so the actor is the signed-in User record itself — not a
 *      claim about one. No parameter, nothing the client can influence
 *      (AUDIT-SYSTEM-DESIGN.md § 2.7). This is what removed the picker.
 *   2. Platform identity: `globalThis.SFDC_ENV` (runtime-injected globals the
 *      platform-sdk itself derives the app identity from) may carry a user id
 *      or username — resolved to a `User` record via UIAPI, display name is
 *      the FIRST NAME ONLY (privacy decision 2026-09-27). Kept as a fallback
 *      only: the runtime is **verified to carry no user** on this surface (it
 *      has `orgUrl`, `apiPath`, `basePath`, `namespace`, `appName`), and the
 *      SDK's `AppIdentity` is the UIBundle, not a person.
 *   3. Remembered self-attestation: the user picks THEMSELF from the org's
 *      active Standard users once (ActorPicker). `actorType: staff`, display
 *      name first-name-only, but the id is the REAL Salesforce User id —
 *      verifiable, no typos, no duplicates. Still self-selected (no
 *      cryptographic proof), honestly so. Mirrored into localStorage so the
 *      question is not repeated in every new tab; "Benutzer wechseln" clears
 *      it (ADR-16). Only reached when the server cannot answer.
 *   4. Unambiguous org: exactly ONE active Standard user needs no question at
 *      all — the single candidate is taken over (ADR-16). Also only reached
 *      when the server cannot answer.
 *   5. Fallback `SYSTEM` — auditable absence of identity, never a guess.
 *      Ambiguity (several staff users, nothing remembered) opens the picker.
 *
 * Spike result 2026-09-27 (live, backendtest): `User` is exposed via UIAPI;
 * there is NO who-am-I root (`uiapi.user`), and neither `AuthSession` nor
 * `LoginHistory` is exposed. The platform-sdk exposes only the bundle
 * identity (bundleId), no user. `SFDC_ENV` contents are undocumented — probed
 * defensively below; key names (never values) go to console.debug so a live
 * run reveals the actual shape for finalizing the mapping.
 *
 * Services read the actor synchronously via `getAuditActor()` (SYSTEM until
 * resolution completes / override is picked). AppLayout kicks off
 * `resolveAuditActor()` once via `useAuditActorInit`.
 */

import { executeGraphQL } from "../graphqlClient";
import {
  fetchCurrentStaffIdentity,
  type StaffIdentity,
} from "../identity/staffIdentityService";
import type { ActorInfo } from "@/types/audit";
import GET_USER_BY_ID from "../user/query/GetUserById.graphql?raw";
import GET_USER_BY_USERNAME from "../user/query/GetUserByUsername.graphql?raw";
import LIST_STAFF_USERS from "../user/query/ListStaffUsers.graphql?raw";

export const SYSTEM_ACTOR: ActorInfo = {
  id: "SYSTEM",
  type: "system",
  displayName: "System",
};

export const SESSION_ACTOR_KEY = "organisator.actor-override";
/** Mirror of the self-attestation in localStorage: the picker must not greet
 * the same person again in every new tab. Same honesty caveat as the session
 * copy — self-attested, per browser profile, gone with "Benutzer wechseln". */
export const REMEMBERED_ACTOR_KEY = "organisator.actor-remembered";

// Candidate SFDC_ENV keys — undocumented runtime surface, hence the list.
// Matching is exact; values must be non-empty strings.
const USER_ID_KEYS = [
  "userId",
  "user_id",
  "userID",
  "sfdcUserId",
  "currentUserId",
  "currentUserID",
  "loggedInUserId",
  "user-id",
];
const USERNAME_KEYS = [
  "username",
  "userName",
  "user_name",
  "sfdcUsername",
  "currentUsername",
  "loggedInUsername",
  "loginName",
];
/** Identity may sit one level down (e.g. `SFDC_ENV.user.id`) — probed with the
 * same key lists, so the runtime's exact shape does not have to be guessed.
 * Only person-shaped containers: a `session`/`context` id would be validated
 * as a User id (Session records share the `005` prefix) and queried pointlessly. */
const NESTED_IDENTITY_PATHS = ["user", "currentUser", "loggedInUser", "identity"];
/** Nested objects tend to use short keys. */
const NESTED_USER_ID_KEYS = ["id", ...USER_ID_KEYS];
const NESTED_USERNAME_KEYS = ["username", "userName", "name", ...USERNAME_KEYS];

/** A Salesforce User id is 15 or 18 chars starting `005`. Anything else in
 * SFDC_ENV (bundleId, app ids) is not a person and must not be looked up. */
const SALESFORCE_USER_ID = /^005[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/;

interface UserNode {
  Id: string;
  FirstName?: { value?: string | null } | null;
  LastName?: { value?: string | null } | null;
  Name?: { value?: string | null } | null;
  Username?: { value?: string | null } | null;
  UserType?: { value?: string | null } | null;
  SmallPhotoUrl?: { value?: string | null } | null;
  Profile?: { Id?: string; Name?: { value?: string | null } | null } | null;
  UserRole?: { Id?: string; Name?: { value?: string | null } | null } | null;
}

interface UserQueryResponse {
  uiapi?: {
    query?: {
      User?: { edges?: Array<{ node?: UserNode | null } | null> | null } | null;
    } | null;
  } | null;
}

function readSfdcEnv(): Record<string, unknown> | null {
  const env = (globalThis as unknown as Record<string, unknown>).SFDC_ENV;
  if (!env || typeof env !== "object") return null;
  return env as Record<string, unknown>;
}

/** Platform identity hints from the runtime. Key NAMES are debug-logged so a
 * live run reveals the real shape; values never leave this module except as
 * a User lookup reference. */
export function readSfdcEnvIdentity(): { userId?: string; username?: string } {
  const env = readSfdcEnv();
  if (!env) return {};
  console.debug("[audit] SFDC_ENV keys:", Object.keys(env));
  const idCandidates: string[] = [];
  const nameCandidates: string[] = [];
  const collect = (source: Record<string, unknown>, idKeys: string[], nameKeys: string[]) => {
    for (const [keys, into] of [
      [idKeys, idCandidates],
      [nameKeys, nameCandidates],
    ] as const) {
      for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim() !== "") into.push(value.trim());
      }
    }
  };
  // Flat surface first (short aliases included — they simply miss when absent),
  // then nested person-shaped containers.
  collect(env, ["id", ...USER_ID_KEYS], ["name", ...USERNAME_KEYS]);
  for (const path of NESTED_IDENTITY_PATHS) {
    const nested = env[path];
    if (!nested || typeof nested !== "object") continue;
    console.debug(`[audit] SFDC_ENV.${path} keys:`, Object.keys(nested as object));
    collect(nested as Record<string, unknown>, NESTED_USER_ID_KEYS, NESTED_USERNAME_KEYS);
  }
  const identity: { userId?: string; username?: string } = {};
  // Every candidate is validated, not just the first one: a bundleId or app id
  // in a user-id slot must not shadow a real User id further down the list.
  const userId = idCandidates.find((value) => SALESFORCE_USER_ID.test(value));
  if (userId) identity.userId = userId;
  const username = nameCandidates[0];
  if (username) identity.username = username;
  return identity;
}

function firstToken(name: string | null | undefined): string | null {
  const token = name?.trim().split(/\s+/)[0];
  return token ? token : null;
}

/** Resolve a User reference to a staff actor. First name only; null when the
 * record or a usable name is missing (caller continues the chain). Never
 * throws — resolution failure is a normal fallback, not an error. */
export async function resolveUserActor(ref: {
  userId?: string;
  username?: string;
}): Promise<ActorInfo | null> {
  try {
    let data: UserQueryResponse | null = null;
    if (ref.userId) {
      data = await executeGraphQL<UserQueryResponse, { id: string }>(
        GET_USER_BY_ID,
        { id: ref.userId },
      );
    } else if (ref.username) {
      data = await executeGraphQL<UserQueryResponse, { username: string }>(
        GET_USER_BY_USERNAME,
        { username: ref.username },
      );
    } else {
      return null;
    }
    const node = data?.uiapi?.query?.User?.edges?.[0]?.node;
    const firstName =
      node?.FirstName?.value?.trim() || firstToken(node?.Name?.value);
    if (!node?.Id || !firstName) return null;
    return { id: node.Id, type: "staff", displayName: firstName };
  } catch (err) {
    console.debug("[audit] User actor resolution failed, continuing chain", err);
    return null;
  }
}

/** Full identity details for the sidebar user card. Everything except names
 * is optional: roles and photos are often missing (e.g. scratch orgs).
 * Null when unresolvable — the card degrades to actor basics. */
export interface ActorDetails {
  userId: string;
  firstName: string;
  fullName: string;
  username?: string;
  photoUrl?: string;
  profileName?: string;
  roleName?: string;
}

/** Resolve full details for a known User id. Never throws (null on failure). */
export async function resolveUserDetails(userId: string): Promise<ActorDetails | null> {
  try {
    const data = await executeGraphQL<UserQueryResponse, { id: string }>(
      GET_USER_BY_ID,
      { id: userId },
    );
    const node = data?.uiapi?.query?.User?.edges?.[0]?.node;
    const firstName =
      node?.FirstName?.value?.trim() || firstToken(node?.Name?.value);
    if (!node?.Id || !firstName) return null;
    const details: ActorDetails = {
      userId: node.Id,
      firstName,
      fullName: node.Name?.value?.trim() || firstName,
    };
    const username = node.Username?.value?.trim();
    if (username) details.username = username;
    const photoUrl = node.SmallPhotoUrl?.value?.trim();
    if (photoUrl) details.photoUrl = photoUrl;
    const profileName = node.Profile?.Name?.value?.trim();
    if (profileName) details.profileName = profileName;
    const roleName = node.UserRole?.Name?.value?.trim();
    if (roleName) details.roleName = roleName;
    return details;
  } catch (err) {
    console.debug("[audit] User details resolution failed", err);
    return null;
  }
}
/** Self-attested session actor. v2 shape carries the real Salesforce User id
 * (picked from the org user list); v1 shape (firstName only, no userId) is
 * still accepted so older sessions keep working. sessionStorage = gone with
 * the tab, localStorage mirror = gone with "Benutzer wechseln" (ADR-16). */
export interface StaffUserChoice {
  id: string;
  firstName: string;
  fullName: string;
  username?: string;
}

/** Storage access can throw outright (blocked cookies, private mode, sandboxed
 * iframe) — the in-memory actor carries on without persistence. */
function safeStorage(scope: "session" | "local"): Storage | null {
  try {
    return scope === "session" ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

function readActorFrom(storage: Storage | null): ActorInfo | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_ACTOR_KEY) ?? storage.getItem(REMEMBERED_ACTOR_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as {
      firstName?: unknown;
      userId?: unknown;
    } | null;
    const firstName = typeof stored?.firstName === "string" ? stored.firstName.trim() : "";
    if (!firstName) return null;
    const actor: ActorInfo = { type: "staff", displayName: firstName };
    if (typeof stored?.userId === "string" && stored.userId) actor.id = stored.userId;
    return actor;
  } catch {
    return null;
  }
}

/** Self-attested actor for this browser profile: the per-tab copy wins, then
 * the remembered one. Naming is kept for compatibility — the value now spans
 * the session AND the remembered browser profile. */
export function getSessionActorOverride(): ActorInfo | null {
  return readActorFrom(safeStorage("session")) ?? readActorFrom(safeStorage("local"));
}

export function setSessionActorOverride(firstName: string): ActorInfo;
export function setSessionActorOverride(choice: { userId: string; firstName: string }): ActorInfo;
export function setSessionActorOverride(
  firstNameOrChoice: string | { userId: string; firstName: string },
): ActorInfo {
  const firstName =
    typeof firstNameOrChoice === "string" ? firstNameOrChoice.trim() : firstNameOrChoice.firstName.trim();
  const userId = typeof firstNameOrChoice === "string" ? undefined : firstNameOrChoice.userId;
  const actor: ActorInfo = { type: "staff", displayName: firstName };
  if (userId) actor.id = userId;
  const payload = JSON.stringify(userId ? { userId, firstName } : { firstName });
  for (const storage of [safeStorage("session"), safeStorage("local")]) {
    if (!storage) continue;
    try {
      storage.setItem(SESSION_ACTOR_KEY, payload);
      storage.setItem(REMEMBERED_ACTOR_KEY, payload);
    } catch {
      // Storage unavailable/full — the returned actor still applies in memory.
    }
  }
  return actor;
}

export function clearSessionActorOverride(): void {
  for (const storage of [safeStorage("session"), safeStorage("local")]) {
    if (!storage) continue;
    try {
      storage.removeItem(SESSION_ACTOR_KEY);
      storage.removeItem(REMEMBERED_ACTOR_KEY);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }
}

interface StaffUserListResponse {
  uiapi?: {
    query?: {
      User?: { edges?: Array<{ node?: UserNode | null } | null> | null } | null;
    } | null;
  } | null;
}

/**
 * Active human users of the org for the ActorPicker. Filtered to
 * `UserType = Standard` (no AutomatedProcess/CsnOnly/integration users),
 * display name is first-name-only per privacy decision. Never throws —
 * an empty list makes the picker fall back to freetext.
 */
export async function listStaffUsers(limit = 50): Promise<StaffUserChoice[]> {
  try {
    const data = await executeGraphQL<StaffUserListResponse, { limit: number }>(
      LIST_STAFF_USERS,
      { limit },
    );
    const edges = data?.uiapi?.query?.User?.edges ?? [];
    const users: StaffUserChoice[] = [];
    for (const edge of edges) {
      const node = edge?.node;
      if (!node?.Id || node.UserType?.value !== "Standard") continue;
      const firstName =
        node.FirstName?.value?.trim() || firstToken(node.Name?.value);
      if (!firstName) continue;
      users.push({
        id: node.Id,
        firstName,
        fullName: node.Name?.value?.trim() || firstName,
        username: node.Username?.value ?? undefined,
      });
    }
    return users;
  } catch (err) {
    console.debug("[audit] Staff user list failed, picker falls back to freetext", err);
    return [];
  }
}

// Module state: base actor (SYSTEM until platform resolution lands).
// getAuditActor always prefers a live session override so a late picker
// choice takes effect for subsequent writes without re-resolution.
let baseActor: ActorInfo = SYSTEM_ACTOR;
let baseSource: ActorSource = "system";
let pending: Promise<ActorInfo> | null = null;

/**
 * Where the current actor came from. The sidebar needs this to know whether
 * "Benutzer wechseln" can mean anything: when the server named the user, the
 * answer is not a choice, so offering a switch would be a dead menu entry.
 */
export type ActorSource = "server" | "self" | "system";

/**
 * Adopts a server-resolved identity and drops a contradicting self-attestation.
 *
 * This is the part that makes the shared-browser case correct rather than
 * merely unlikely: if someone used this browser before, their remembered actor
 * would otherwise win over the signed-in user forever. The server outranks it,
 * so the stale entry goes — silently, because it is not the current user's
 * memory to preserve.
 */
function adoptServerIdentity(identity: StaffIdentity): ActorInfo {
  const remembered = getSessionActorOverride();
  if (remembered && remembered.id !== identity.userId) {
    clearSessionActorOverride();
  }
  return { id: identity.userId, type: "staff", displayName: identity.firstName };
}

async function doResolve(): Promise<ActorInfo> {
  const server = await fetchCurrentStaffIdentity();
  if (server) {
    baseSource = "server";
    return adoptServerIdentity(server);
  }
  const platform = await resolveUserActor(readSfdcEnvIdentity());
  if (platform) {
    baseSource = "self";
    return platform;
  }
  const override = getSessionActorOverride();
  if (override) {
    baseSource = "self";
    return override;
  }
  // An org with exactly ONE active Standard user has nothing to ask about —
  // taking that candidate removes the picker for single-coach orgs without
  // weakening the ambiguous case, which still asks (ADR-16).
  const staff = await listStaffUsers();
  if (staff.length === 1) {
    baseSource = "self";
    return setSessionActorOverride({ userId: staff[0].id, firstName: staff[0].firstName });
  }
  baseSource = "system";
  return SYSTEM_ACTOR;
}

/** Synchronous read for services. SYSTEM until resolved — the documented,
 * auditable fallback (ADR-14). */
export function getAuditActor(): ActorInfo {
  return getSessionActorOverride() ?? baseActor;
}

/** Where {@link getAuditActor} came from. "system" until resolution completes. */
export function getAuditActorSource(): ActorSource {
  return baseSource;
}

/** Kick off async resolution once per session; concurrent callers share it. */
export function resolveAuditActor(): Promise<ActorInfo> {
  if (!pending) {
    pending = doResolve().then((actor) => {
      baseActor = actor;
      return actor;
    });
  }
  return pending;
}

/** Test-only reset of module state. */
export function resetAuditActorForTests(): void {
  baseActor = SYSTEM_ACTOR;
  baseSource = "system";
  pending = null;
}

/**
 * Re-run resolution (e.g. after the session override changed via "Benutzer
 * wechseln"): drops the cached promise so the next resolveAuditActor()
 * re-reads server identity, platform identity and the override.
 */
export function refreshAuditActor(): Promise<ActorInfo> {
  pending = null;
  return resolveAuditActor();
}
