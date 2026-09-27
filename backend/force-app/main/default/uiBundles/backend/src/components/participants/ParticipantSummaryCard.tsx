import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARTICIPANT_STATUSES,
  type Participant,
} from "@/types/participant";
import type { Program, ProgramCoachSummary } from "@/types/program";

const NONE = "__none";

interface ParticipantSummaryCardProps {
  participant: Participant;
  programs: Program[];
  coaches: ProgramCoachSummary[];
  editing: boolean;
  onToggleEdit: () => void;
  onFieldChange: <K extends keyof Participant>(
    field: K,
    value: Participant[K],
  ) => void;
  onProgramChange: (id: string) => void;
  onCoachChange: (id: string) => void;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

/**
 * Compact participant summary with edit toggle. View mode surfaces the
 * frequently used information without the full form grid; edit mode keeps
 * the previous details form (same fields, same handlers).
 */
export default function ParticipantSummaryCard({
  participant,
  programs,
  coaches,
  editing,
  onToggleEdit,
  onFieldChange,
  onProgramChange,
  onCoachChange,
}: ParticipantSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant Details</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={onToggleEdit}>
            {editing ? "Done" : "Edit"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {!editing ? (
          <dl className="grid gap-x-8 md:grid-cols-2">
            <div className="divide-y">
              <Row label="Email" value={participant.email} />
              <Row label="GitHub" value={participant.github} />
              <Row label="Discord" value={participant.discord} />
            </div>
            <div className="divide-y">
              <Row label="Status" value={participant.status} />
              <Row label="Program" value={participant.programName} />
              <Row label="Coach" value={participant.coachName} />
            </div>
          </dl>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>

              <Input
                value={participant.name}
                onChange={(e) => onFieldChange("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>

              <Select
                value={participant.status}
                onValueChange={(value) => onFieldChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {PARTICIPANT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>

              <Input
                type="email"
                value={participant.email ?? ""}
                onChange={(e) => onFieldChange("email", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>GitHub</Label>

              <Input
                value={participant.github ?? ""}
                onChange={(e) => onFieldChange("github", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Discord</Label>

              <Input
                value={participant.discord ?? ""}
                onChange={(e) => onFieldChange("discord", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Program</Label>

              <Select
                value={participant.programId ?? NONE}
                onValueChange={onProgramChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No program" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={NONE}>No program</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coach</Label>

              <Select
                value={participant.coachId ?? NONE}
                onValueChange={onCoachChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No coach" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={NONE}>No coach</SelectItem>
                  {coaches.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
