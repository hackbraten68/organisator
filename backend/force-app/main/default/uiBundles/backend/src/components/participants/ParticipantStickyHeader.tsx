import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCompletion } from "@/utils/participantOnboarding";
import type { Participant } from "@/types/participant";

interface ParticipantStickyHeaderProps {
  participant: Participant;
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ParticipantStickyHeader({
  participant,
  isDirty,
  saving,
  onReset,
  onSave,
}: ParticipantStickyHeaderProps) {
  const completion = getCompletion(participant);
  const meta = [
    participant.programName,
    participant.coachName,
    `${completion.percent}% Onboarding`,
  ].filter(Boolean);

  return (
    <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4">
        <Avatar className="size-10">
          <AvatarFallback>{initials(participant.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-h2 font-semibold">
              {participant.name}
            </h2>
            <Badge variant="secondary">{participant.status}</Badge>
          </div>
          {meta.length > 0 && (
            <p className="truncate text-small text-muted-foreground">
              {meta.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!isDirty || saving}
          >
            Zurücksetzen
          </Button>
          <Button size="sm" onClick={onSave} disabled={!isDirty || saving}>
            {saving ? "Speichern..." : "Teilnehmer speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
