/**
 * Session login audit: one `authentication.created` event per browser session.
 *
 * Privacy: the event carries no user identity (actor is SYSTEM until the
 * authenticated SDK context lands), no IP, no device data — only the fact
 * that a session started, for access traceability in this internal tool.
 * Domain visibility defaults to `restricted`, so these events never reach
 * participant timelines; they surface only in the audit explorer and the
 * supervisor/auditor security view.
 */

import type { AuditEvent } from "@/types/audit";
import { EVENT_TYPES } from "@/types/audit";
import { auditService } from "./auditService";

export const SESSION_LOGIN_DEDUPE_KEY = "organisator.login-audited";

/**
 * Record a session start. Callers dedupe per session (see
 * useSessionLoginAudit) — the writer itself stays unconditional so tests
 * and future callers control repetition explicitly.
 */
export async function recordSessionLogin(): Promise<AuditEvent> {
  return auditService.record({
    eventType: EVENT_TYPES.AUTHENTICATION_LOGIN,
    domain: "authentication",
    action: "created",
    actorType: "system",
    actorId: "SYSTEM",
    actorDisplayNameSnapshot: "System",
    subjectType: "User",
    subjectId: "SYSTEM",
    source: "web",
    changes: [],
    metadata: { authMethod: "session" },
  });
}
