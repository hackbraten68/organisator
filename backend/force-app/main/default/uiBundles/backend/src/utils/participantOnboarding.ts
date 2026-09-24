import type { Participant } from "@/types/participant";

export type MissingField = "program" | "coach" | "discord" | "github";

export type OnboardingState = "needs-setup" | "incomplete" | "ready";

export interface OnboardingCompletion {
  percent: number;
  state: OnboardingState;
}

export interface OnboardingCounts {
  needsAttention: number;
  active: number;
  total: number;
}

function isFilled(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

/**
 * Required onboarding fields still missing on the participant.
 *
 * Order is stable: program, coach, discord, github.
 */
export function getMissingFields(p: Participant): MissingField[] {
  const missing: MissingField[] = [];
  if (!isFilled(p.programId)) missing.push("program");
  if (!isFilled(p.coachId)) missing.push("coach");
  if (!isFilled(p.discord)) missing.push("discord");
  if (!isFilled(p.github)) missing.push("github");
  return missing;
}

const REQUIRED_COUNT = 4;

/**
 * Derived onboarding completion: 0/4 = needs-setup, 1-3/4 = incomplete,
 * 4/4 = ready.
 */
export function getCompletion(p: Participant): OnboardingCompletion {
  const missing = getMissingFields(p).length;
  const done = REQUIRED_COUNT - missing;
  const percent = (done / REQUIRED_COUNT) * 100;
  const state: OnboardingState =
    done === 0 ? "needs-setup" : done === REQUIRED_COUNT ? "ready" : "incomplete";
  return { percent, state };
}

/** True when the participant still has onboarding gaps (needs-setup or incomplete). */
export function needsAttention(p: Participant): boolean {
  return getCompletion(p).state !== "ready";
}

/**
 * Derived counts for the participants filter tabs (and a future dashboard
 * widget). `active` follows the Status__c lifecycle value, orthogonal to
 * completeness.
 */
export function getOnboardingCounts(list: Participant[]): OnboardingCounts {
  return {
    needsAttention: list.filter(needsAttention).length,
    active: list.filter((p) => p.status === "Active").length,
    total: list.length,
  };
}
