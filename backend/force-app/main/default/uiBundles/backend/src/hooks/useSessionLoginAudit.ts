import { useEffect } from "react";
import { recordSessionLogin, SESSION_LOGIN_DEDUPE_KEY } from "@/api/audit/sessionAudit";
import { getAuditActor } from "@/api/audit/actorContext";

/**
 * Writes one `authentication.created` audit event per browser session.
 * Best-effort per ADR-14: failures are logged and never surface in the UI.
 *
 * Gated on `enabled` so AppLayout can wait for actor resolution first —
 * the login event then carries the real actor whenever one is available
 * instead of a premature SYSTEM.
 */
export function useSessionLoginAudit(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (sessionStorage.getItem(SESSION_LOGIN_DEDUPE_KEY) !== null) return;
    sessionStorage.setItem(SESSION_LOGIN_DEDUPE_KEY, new Date().toISOString());
    recordSessionLogin(getAuditActor()).catch((err) => {
      console.error("Failed to write audit event authentication.created", err);
    });
  }, [enabled]);
}
