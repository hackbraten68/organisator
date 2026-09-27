/**
 * Actor bootstrap for the app shell.
 *
 * Kicks off `resolveAuditActor()` once (platform identity → session
 * override → SYSTEM) and reports whether the session picker is needed:
 * only when neither source produced an identity. Choosing a name stores a
 * session-scoped, self-attested staff actor; dismissing keeps SYSTEM.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActorInfo } from "@/types/audit";
import {
  clearSessionActorOverride,
  getAuditActor,
  refreshAuditActor,
  resolveAuditActor,
  resolveUserDetails,
  setSessionActorOverride,
  type ActorDetails,
} from "@/api/audit/actorContext";

export type ActorPhase = "resolving" | "pick" | "done";

export function useAuditActorInit() {
  const [phase, setPhase] = useState<ActorPhase>("resolving");
  const [actor, setActor] = useState<ActorInfo>(() => getAuditActor());
  const [details, setDetails] = useState<ActorDetails | null>(null);
  const liveRef = useRef(true);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  const loadDetails = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      if (liveRef.current) setDetails(null);
      return;
    }
    const resolved = await resolveUserDetails(userId);
    if (liveRef.current) setDetails(resolved);
  }, []);

  useEffect(() => {
    resolveAuditActor().then((resolved) => {
      if (!liveRef.current) return;
      const current = getAuditActor();
      setActor(current);
      setPhase(resolved.type === "system" ? "pick" : "done");
      void loadDetails(current.id);
    });
  }, [loadDetails]);

  const chooseName = useCallback((firstName: string) => {
    const trimmed = firstName.trim();
    if (!trimmed) return;
    setActor(setSessionActorOverride(trimmed));
    setPhase("done");
  }, []);

  const chooseUser = useCallback((choice: { userId?: string; firstName: string }) => {
    const trimmed = choice.firstName.trim();
    if (!trimmed) return;
    const next = choice.userId
      ? setSessionActorOverride({ userId: choice.userId, firstName: trimmed })
      : setSessionActorOverride(trimmed);
    setActor(next);
    setPhase("done");
    void loadDetails(next.id);
  }, [loadDetails]);

  const dismissPicker = useCallback(() => {
    setPhase("done");
  }, []);

  /** "Benutzer wechseln": drop the session override, re-resolve (lands back
   * on the picker when no platform identity exists). */
  const switchUser = useCallback(async () => {
    clearSessionActorOverride();
    setDetails(null);
    setPhase("resolving");
    const resolved = await refreshAuditActor();
    if (!liveRef.current) return;
    const current = getAuditActor();
    setActor(current);
    setPhase(resolved.type === "system" ? "pick" : "done");
    void loadDetails(current.id);
  }, [loadDetails]);

  return { phase, actor, details, needsPicker: phase === "pick", ready: phase === "done", chooseName, chooseUser, dismissPicker, switchUser };
}
