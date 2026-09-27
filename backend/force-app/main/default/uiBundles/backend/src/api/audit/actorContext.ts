/**
 * Audit actor resolution: who performed the action?
 *
 * Identity model (no app login exists — the bundle inherits the ambient
 * Salesforce session via createDataSDK): the actor is the Salesforce User
 * behind the session. Resolution chain, first hit wins:
 *
 *   1. Platform identity: `globalThis.SFDC_ENV` (runtime-injected globals the
 *      platform-sdk itself derives the app identity from) may carry a user id
 *      or username — resolved to a `User` record via UIAPI, display name is
 *      the FIRST NAME ONLY (privacy decision 2026-09-27).
 *   2. Session self-attestation: the user picks their first name once per
 *      browser session (ActorPicker). `actorType: staff`, no id — honest
 *      about being unverified.
 *   3. Fallback `SYSTEM` — auditable absence of identity, never a guess.
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
import type { ActorInfo } from "@/types/audit";
import GET_USER_BY_ID from "../user/query/GetUserById.graphql?raw";
import GET_USER_BY_USERNAME from "../user/query/GetUserByUsername.graphql?raw";

export const SYSTEM_ACTOR: ActorInfo = {
  id: "SYSTEM",
  type: "system",
  displayName: "System",
};

export const SESSION_ACTOR_KEY = "organisator.actor-override";

// Candidate SFDC_ENV keys — undocumented runtime surface, hence the list.
// Matching is exact; values must be non-empty strings.
const USER_ID_KEYS = [
  "userId",
  "user_id",
  "userID",
  "sfdcUserId",
  "currentUserId",
  "user-id",
];
const USERNAME_KEYS = [
  "username",
  "userName",
  "user_name",
  "sfdcUsername",
  "currentUsername",
];

interface UserNode {
  Id: string;
  FirstName?: { value?: string | null } | null;
  LastName?: { value?: string | null } | null;
  Name?: { value?: string | null } | null;
  Username?: { value?: string | null } | null;
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
  const pick = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = env[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return undefined;
  };
  const identity: { userId?: string; username?: string } = {};
  const userId = pick(USER_ID_KEYS);
  const username = pick(USERNAME_KEYS);
  if (userId) identity.userId = userId;
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

/** Self-attested first name for this browser session (ActorPicker). No id by
 * design: unverified, but honest. sessionStorage = gone with the tab. */
export function getSessionActorOverride(): ActorInfo | null {
  try {
    const raw = sessionStorage.getItem(SESSION_ACTOR_KEY);
    if (!raw) return null;
    const firstName = (
      JSON.parse(raw) as { firstName?: unknown } | null
    )?.firstName;
    if (typeof firstName !== "string" || firstName.trim() === "") return null;
    return { type: "staff", displayName: firstName.trim() };
  } catch {
    return null;
  }
}

export function setSessionActorOverride(firstName: string): ActorInfo {
  const actor: ActorInfo = { type: "staff", displayName: firstName.trim() };
  sessionStorage.setItem(SESSION_ACTOR_KEY, JSON.stringify({ firstName: actor.displayName }));
  return actor;
}

export function clearSessionActorOverride(): void {
  sessionStorage.removeItem(SESSION_ACTOR_KEY);
}

// Module state: base actor (SYSTEM until platform resolution lands).
// getAuditActor always prefers a live session override so a late picker
// choice takes effect for subsequent writes without re-resolution.
let baseActor: ActorInfo = SYSTEM_ACTOR;
let pending: Promise<ActorInfo> | null = null;

async function doResolve(): Promise<ActorInfo> {
  const platform = await resolveUserActor(readSfdcEnvIdentity());
  if (platform) return platform;
  return getSessionActorOverride() ?? SYSTEM_ACTOR;
}

/** Synchronous read for services. SYSTEM until resolved — the documented,
 * auditable fallback (ADR-14). */
export function getAuditActor(): ActorInfo {
  return getSessionActorOverride() ?? baseActor;
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
  pending = null;
}
