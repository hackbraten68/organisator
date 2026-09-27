/**
 * Session login audit: one `authentication.created` event per browser session.
 *
 * Privacy: the event carries no IP, no device data — only the fact that a
 * session started, for access traceability in this internal tool. The actor
 * is the resolved session actor (first name only; SYSTEM until actor
 * resolution completes — callers gate on actor readiness so the login event
 * carries the real actor whenever one is available). Domain visibility
 * defaults to `restricted`, so these events never reach participant
 * timelines; they surface only in the audit explorer and the
 * supervisor/auditor security view.
 */

import type { ActorInfo, AuditEvent } from "@/types/audit";
import { EVENT_TYPES } from "@/types/audit";
import { SYSTEM_ACTOR } from "./actorContext";
import { auditService } from "./auditService";

export const SESSION_LOGIN_DEDUPE_KEY = "organisator.login-audited";

/**
 * Record a session start. Callers dedupe per session (see
 * useSessionLoginAudit) — the writer itself stays unconditional so tests
 * and future callers control repetition explicitly.
 */
export async function recordSessionLogin(
  actor: ActorInfo = SYSTEM_ACTOR,
): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.AUTHENTICATION_LOGIN,
    domain: "authentication",
    action: "created",
    actorType: actor.type,
    actorId: actor.id,
    actorDisplayNameSnapshot: actor.displayName,
    subjectType: "User",
    subjectId: actor.id ?? "SYSTEM",
    source: "web",
    changes: [],
    metadata: { authMethod: "session" },
  });
}
