/**
 * Actor bootstrap for the app shell.
 *
 * Kicks off `resolveAuditActor()` once (server identity → platform identity →
 * remembered self-attestation → SYSTEM) and reports whether the picker is
 * needed: only when nothing produced an identity. Choosing a name stores a
 * remembered, self-attested staff actor; dismissing keeps SYSTEM.
 *
 * `switchable` is false when the server named the user: the actor is then the
 * signed-in User record, not a choice, and "Benutzer wechseln" would be a dead
 * menu entry that silently re-resolves to the same person.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActorInfo } from "@/types/audit";
import {
  clearSessionActorOverride,
  getAuditActor,
  getAuditActorSource,
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
  const [switchable, setSwitchable] = useState(true);
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
      setSwitchable(getAuditActorSource() !== "server");
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

  /** "Benutzer wechseln": drop the self-attestation, re-resolve. Lands on the
   * picker only when nothing else names the user; a server-resolved identity
   * comes straight back, which is why the menu entry hides itself then. */
  const switchUser = useCallback(async () => {
    clearSessionActorOverride();
    setDetails(null);
    setPhase("resolving");
    const resolved = await refreshAuditActor();
    if (!liveRef.current) return;
    const current = getAuditActor();
    setActor(current);
    setPhase(resolved.type === "system" ? "pick" : "done");
    setSwitchable(getAuditActorSource() !== "server");
    void loadDetails(current.id);
  }, [loadDetails]);

  return { phase, actor, details, needsPicker: phase === "pick", ready: phase === "done", switchable, chooseName, chooseUser, dismissPicker, switchUser };
}
