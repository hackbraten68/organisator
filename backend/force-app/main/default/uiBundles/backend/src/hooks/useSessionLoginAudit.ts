import { useEffect } from "react";
import { recordSessionLogin, SESSION_LOGIN_DEDUPE_KEY } from "@/api/audit/sessionAudit";

/**
 * Writes one `authentication.created` audit event per browser session.
 * Best-effort per ADR-14: failures are logged and never surface in the UI.
 */
export function useSessionLoginAudit(): void {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_LOGIN_DEDUPE_KEY) !== null) return;
    sessionStorage.setItem(SESSION_LOGIN_DEDUPE_KEY, new Date().toISOString());
    recordSessionLogin().catch((err) => {
      console.error("Failed to write audit event authentication.created", err);
    });
  }, []);
}
