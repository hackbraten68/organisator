import { Badge } from "@/components/ui/badge";
import type { OnboardingState } from "@/utils/participantOnboarding";

const LABELS: Record<OnboardingState, string> = {
  "needs-setup": "Needs Setup",
  incomplete: "Incomplete",
  ready: "Ready",
};

/**
 * Onboarding state badge for a participant (derived completeness, not the
 * Status__c lifecycle value).
 */
export default function OnboardingBadge({ state }: { state: OnboardingState }) {
  if (state === "ready") {
    return <Badge variant="default">{LABELS[state]}</Badge>;
  }
  if (state === "incomplete") {
    return <Badge variant="secondary">{LABELS[state]}</Badge>;
  }
  return <Badge variant="destructive">{LABELS[state]}</Badge>;
}
