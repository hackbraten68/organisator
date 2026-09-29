import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Contact } from '@/types/contact';
import type { Program, ProgramCoachSummary } from '@/types/program';

const NONE = '__none';

export interface CreateParticipantDraft {
  programId: string | null;
  coachId: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
}

interface CreateParticipantDialogProps {
  contact: Contact | null;
  programs: Program[];
  coaches: ProgramCoachSummary[];
  onClose: () => void;
  onSubmit: (draft: CreateParticipantDraft) => Promise<void>;
  error?: string | null;
}

/**
 * Turns a contact into a participant.
 *
 * Deliberately has no name, email or contact field: those come from the
 * Contact (ADR-001) and the participant is created *for* that person, not
 * with a typed-in name. Only the academy role is collected here.
 */
export default function CreateParticipantDialog({
  contact,
  programs,
  coaches,
  onClose,
  onSubmit,
  error = null,
}: CreateParticipantDialogProps) {
  const [programId, setProgramId] = useState<string>(NONE);
  const [coachId, setCoachId] = useState<string>(NONE);
  const [startDate, setStartDate] = useState('');
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        programId: programId === NONE ? null : programId,
        coachId: coachId === NONE ? null : coachId,
        startDate: startDate || null,
        expectedEndDate: expectedEndDate || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={contact != null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Als Teilnehmer anlegen</DialogTitle>
          <DialogDescription>
            {contact
              ? `${contact.name} wird als Teilnehmer registriert. Name und E-Mail kommen aus dem Contact.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Anlegen fehlgeschlagen</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="program">Programm</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger id="program">
                <SelectValue placeholder="Programm wählen" />
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
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger id="coach">
                <SelectValue placeholder="Coach wählen" />
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedEndDate">Enddatum</Label>
              <Input
                id="expectedEndDate"
                type="date"
                value={expectedEndDate}
                onChange={e => setExpectedEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || contact == null}>
              {saving ? 'Wird angelegt…' : 'Teilnehmer anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
