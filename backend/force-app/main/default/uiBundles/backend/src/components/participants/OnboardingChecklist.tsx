import { Circle, CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Participant } from "@/types/participant";
import {
  getCompletion,
  getMissingFields,
  type MissingField,
} from "@/utils/participantOnboarding";
import CompletionBar from "./CompletionBar";
import OnboardingBadge from "./OnboardingBadge";

const MISSING_LABELS: Record<MissingField, string> = {
  program: "Program",
  coach: "Coach",
  discord: "Discord",
  github: "GitHub",
};

function isFilled(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function ChecklistRow({
  label,
  done,
  detail,
}: {
  label: string;
  done: boolean;
  detail?: string;
}) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon
        className={
          done ? "size-4 text-primary" : "size-4 text-muted-foreground"
        }
      />
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
      {detail && (
        <span className="ml-auto truncate text-xs text-muted-foreground">
          {detail}
        </span>
      )}
    </li>
  );
}

/**
 * Onboarding checklist for the editable participant copy, so checkmarks
 * react live while editing. Name/Email arrive from the sales process;
 * the percentage covers the four required fields (program, coach,
 * discord, github).
 */
export default function OnboardingChecklist({
  participant,
}: {
  participant: Participant;
}) {
  const completion = getCompletion(participant);
  const missing = getMissingFields(participant);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Onboarding
          <OnboardingBadge state={completion.state} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          <ChecklistRow label="Name" done={isFilled(participant.name)} />
          <ChecklistRow label="Email" done={isFilled(participant.email)} />
          <ChecklistRow
            label="Program"
            done={isFilled(participant.programId)}
            detail={participant.programName}
          />
          <ChecklistRow
            label="Coach"
            done={isFilled(participant.coachId)}
            detail={participant.coachName}
          />
          <ChecklistRow
            label="GitHub"
            done={isFilled(participant.github)}
            detail={participant.github}
          />
          <ChecklistRow
            label="Discord"
            done={isFilled(participant.discord)}
            detail={participant.discord}
          />
        </ul>
        <CompletionBar percent={completion.percent} />
        {missing.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Missing: {missing.map((field) => MISSING_LABELS[field]).join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
