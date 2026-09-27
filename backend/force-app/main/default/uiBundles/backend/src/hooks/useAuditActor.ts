/**
 * Actor bootstrap for the app shell.
 *
 * Kicks off `resolveAuditActor()` once (platform identity → session
 * override → SYSTEM) and reports whether the session picker is needed:
 * only when neither source produced an identity. Choosing a name stores a
 * session-scoped, self-attested staff actor; dismissing keeps SYSTEM.
 */

import { useCallback, useEffect, useState } from "react";
import type { ActorInfo } from "@/types/audit";
import {
  getAuditActor,
  resolveAuditActor,
  setSessionActorOverride,
} from "@/api/audit/actorContext";

export type ActorPhase = "resolving" | "pick" | "done";

export function useAuditActorInit() {
  const [phase, setPhase] = useState<ActorPhase>("resolving");
  const [actor, setActor] = useState<ActorInfo>(() => getAuditActor());

  useEffect(() => {
    let live = true;
    resolveAuditActor().then((resolved) => {
      if (!live) return;
      setActor(getAuditActor());
      setPhase(resolved.type === "system" ? "pick" : "done");
    });
    return () => {
      live = false;
    };
  }, []);

  const chooseName = useCallback((firstName: string) => {
    const trimmed = firstName.trim();
    if (!trimmed) return;
    setActor(setSessionActorOverride(trimmed));
    setPhase("done");
  }, []);

  const chooseUser = useCallback((choice: { userId?: string; firstName: string }) => {
    const trimmed = choice.firstName.trim();
    if (!trimmed) return;
    setActor(
      choice.userId
        ? setSessionActorOverride({ userId: choice.userId, firstName: trimmed })
        : setSessionActorOverride(trimmed),
    );
    setPhase("done");
  }, []);

  const dismissPicker = useCallback(() => {
    setPhase("done");
  }, []);

  return { phase, actor, needsPicker: phase === "pick", ready: phase === "done", chooseName, chooseUser, dismissPicker };
}
