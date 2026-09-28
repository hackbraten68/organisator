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
import { Separator } from "@/components/ui/separator";
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

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium truncate">{value || "—"}</dd>
    </div>
  );
}

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
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-h2">Teilnehmerdetails</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onToggleEdit}>
              {editing ? "Fertig" : "Bearbeiten"}
            </Button>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!editing ? (
          <>
            <section className="space-y-4">
              <h3 className="text-h4 font-medium text-muted-foreground">Kontakt</h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field label="E-Mail" value={participant.email} />
                <Field label="GitHub" value={participant.github} />
                <Field label="Discord" value={participant.discord} />
              </dl>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="text-h4 font-medium text-muted-foreground">Zuordnung</h3>
              <dl className="grid gap-4 md:grid-cols-2">
                <Field label="Status" value={participant.status} />
                <Field label="Programm" value={participant.programName} />
                <Field label="Coach" value={participant.coachName} />
              </dl>
            </section>
          </>
        ) : (
          <>
            <fieldset className="space-y-4">
              <legend className="text-h4 font-medium">Grunddaten</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={participant.name}
                    onChange={(e) => onFieldChange("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={participant.status}
                    onValueChange={(value) => onFieldChange("status", value)}
                  >
                    <SelectTrigger id="status">
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
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-h4 font-medium">Kontakt</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={participant.email ?? ""}
                    onChange={(e) => onFieldChange("email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github">GitHub</Label>
                  <Input
                    id="github"
                    value={participant.github ?? ""}
                    onChange={(e) => onFieldChange("github", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discord">Discord</Label>
                  <Input
                    id="discord"
                    value={participant.discord ?? ""}
                    onChange={(e) => onFieldChange("discord", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-h4 font-medium">Zuordnung</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="program">Programm</Label>
                  <Select
                    value={participant.programId ?? NONE}
                    onValueChange={onProgramChange}
                  >
                    <SelectTrigger id="program">
                      <SelectValue placeholder="Kein Programm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Kein Programm</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach">Coach</Label>
                  <Select
                    value={participant.coachId ?? NONE}
                    onValueChange={onCoachChange}
                  >
                    <SelectTrigger id="coach">
                      <SelectValue placeholder="Kein Coach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Kein Coach</SelectItem>
                      {coaches.map((coach) => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
          </>
        )}
      </CardContent>
    </Card>
  );
}
