import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { PARTICIPANT_STATUSES, type Participant } from '@/types/participant';
import type { Program, ProgramCoachSummary } from '@/types/program';

const NONE = '__none';

interface ParticipantSummaryCardProps {
  participant: Participant;
  programs: Program[];
  coaches: ProgramCoachSummary[];
  editing: boolean;
  onToggleEdit: () => void;
  onFieldChange: <K extends keyof Participant>(
    field: K,
    value: Participant[K]
  ) => void;
  onProgramChange: (id: string) => void;
  onCoachChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium truncate">{value || '—'}</dd>
    </div>
  );
}

/**
 * The person behind the participant role (ADR-001). Read-only with a link out:
 * name and email are maintained on the Contact, so there is no edit affordance
 * and no lookup switch here. Contact as the single source for name and email
 * across the participant views is Phase 1.2.
 */
function ContactField({ contactId }: { contactId?: string }) {
  const navigate = useNavigate();
  if (!contactId) return <Field label="Contact" value="—" />;

  return (
    <div className="space-y-1">
      <dt className="text-caption text-muted-foreground">Contact</dt>
      <dd>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 font-medium"
          onClick={() => navigate(`/contacts/${contactId}`)}
        >
          Contact öffnen
          <ArrowUpRight className="size-3" />
        </Button>
      </dd>
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
  loading = false,
  error = null,
}: ParticipantSummaryCardProps) {
  if (error) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-h2">Teilnehmerdetails</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Fehler beim Laden</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-h2">Teilnehmerdetails</CardTitle>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Skeleton className="h-5 w-20" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-5 w-20" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-h2">Teilnehmerdetails</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={onToggleEdit}>
              {editing ? 'Fertig' : 'Bearbeiten'}
            </Button>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!editing ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-4">
              <h3 className="text-h4 font-medium text-muted-foreground">
                Kontakt
              </h3>
              <dl className="grid gap-4">
                <ContactField contactId={participant.contactId} />
                <Field label="E-Mail" value={participant.email} />
                <Field label="GitHub" value={participant.github} />
                <Field label="Discord" value={participant.discord} />
              </dl>
            </section>

            <section className="space-y-4">
              <h3 className="text-h4 font-medium text-muted-foreground">
                Zuordnung
              </h3>
              <dl className="grid gap-4">
                <Field label="Status" value={participant.status} />
                <Field label="Programm" value={participant.programName} />
                <Field label="Coach" value={participant.coachName} />
              </dl>
            </section>
          </div>
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
                    onChange={e => onFieldChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={participant.status}
                    onValueChange={value => onFieldChange('status', value)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTICIPANT_STATUSES.map(status => (
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
                    value={participant.email ?? ''}
                    onChange={e => onFieldChange('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github">GitHub</Label>
                  <Input
                    id="github"
                    value={participant.github ?? ''}
                    onChange={e => onFieldChange('github', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discord">Discord</Label>
                  <Input
                    id="discord"
                    value={participant.discord ?? ''}
                    onChange={e => onFieldChange('discord', e.target.value)}
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
                      {programs.map(program => (
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
                      {coaches.map(coach => (
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
