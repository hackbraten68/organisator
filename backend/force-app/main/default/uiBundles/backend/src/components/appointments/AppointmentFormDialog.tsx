import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { AppointmentInput, AppointmentType, AppointmentStatus, AppointmentLocation } from "@/types/appointment";

interface AppointmentFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentInput) => Promise<void>;
  /** Participant the appointment belongs to. Taken from the surrounding page
   *  context, never typed in: the form has no participant picker, so this is
   *  the single source of truth for Appointment__c.Participant__c. */
  participantId: string;
  /** Shown instead of the raw id; falls back to the id when unknown. */
  participantName?: string;
  initialData?: Partial<AppointmentInput>;
  isLoading?: boolean;
  title?: string;
  availableCoaches?: { id: string; name: string }[];
}

export function AppointmentFormDialog({
  isOpen,
  onClose,
  onSubmit,
  participantId,
  participantName,
  initialData,
  isLoading = false,
  title = "Termin erstellen",
  availableCoaches = [],
}: AppointmentFormDialogProps) {
  const [type, setType] = useState<AppointmentType>(initialData?.type || "Coaching");
  const [status, setStatus] = useState<AppointmentStatus>(initialData?.status || "Draft");
  const [startTime, setStartTime] = useState(initialData?.startTime || "");
  const [endTime, setEndTime] = useState(initialData?.endTime || "");
  const [location, setLocation] = useState<AppointmentLocation>(initialData?.location || "OnSite");
  const [meetingLink, setMeetingLink] = useState(initialData?.meetingLink || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [coachId, setCoachId] = useState(initialData?.coachId || "");
  const [errors, setErrors] = useState<Partial<Record<keyof AppointmentInput, string>>>({});
  const [idCopied, setIdCopied] = useState(false);

  // Editing keeps the appointment's own participant; creating uses the page
  // context. The lookup is never reassigned by the form itself.
  const resolvedParticipantId = initialData?.participantId ?? participantId;
  // A name only exists for the page context participant. If the edited
  // appointment belongs to someone else, fall back to showing the id.
  const belongsToPageParticipant = initialData?.participantId == null
    || initialData.participantId === participantId;
  const resolvedParticipantName = belongsToPageParticipant ? participantName : undefined;

  async function copyParticipantId() {
    try {
      await navigator.clipboard.writeText(resolvedParticipantId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy participant id", err);
    }
  }

  const validate = () => {
    const newErrors: Partial<Record<keyof AppointmentInput, string>> = {};
    if (!resolvedParticipantId) newErrors.participantId = "Kein Teilnehmer ausgewählt";
    if (!type) newErrors.type = "Typ ist erforderlich";
    if (!startTime) newErrors.startTime = "Startzeit ist erforderlich";
    if (!endTime) newErrors.endTime = "Endzeit ist erforderlich";
    if (startTime && endTime && parseISO(startTime) >= parseISO(endTime)) {
      newErrors.endTime = "Endzeit muss nach Startzeit liegen";
    }
    if (!coachId) newErrors.coachId = "Coach ist erforderlich";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      participantId: resolvedParticipantId,
      coachId: coachId || undefined,
      type,
      status,
      startTime,
      endTime,
      location: location || undefined,
      meetingLink: meetingLink.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  // Update datetime-local format when date changes
  useEffect(() => {
    if (initialData?.startTime) {
      const date = parseISO(initialData.startTime);
      setStartTime(format(date, "yyyy-MM-dd'T'HH:mm"));
    }
    if (initialData?.endTime) {
      const date = parseISO(initialData.endTime);
      setEndTime(format(date, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [initialData]);

  const appointmentTypes: AppointmentType[] = ["Coaching", "CheckIn", "Berufsschule", "Behörde", "Praktikum", "Sonstiges"];
  const appointmentStatuses: AppointmentStatus[] = ["Draft", "Finding", "Confirmed", "Completed", "Documented", "Cancelled", "NoShow"];
  const appointmentLocations: AppointmentLocation[] = ["OnSite", "Teams", "Phone", "Hybrid", "External"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-h2">{title}</DialogTitle>
          <p className="text-small text-muted-foreground">Erstellen Sie einen neuen Termin für den Teilnehmer.</p>
        </DialogHeader>
        <form id="appointment-form" onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-h4 font-medium">Grunddaten</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="participantId">Teilnehmer *</Label>
                <div className="flex items-center gap-2">
                  <div
                    id="participantId"
                    className="flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-1 text-small"
                  >
                    <span className="truncate font-medium">
                      {resolvedParticipantName || resolvedParticipantId}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={copyParticipantId}
                      aria-label="Teilnehmer-ID kopieren"
                      title={`${resolvedParticipantId} kopieren`}
                    >
                      {idCopied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
                {errors.participantId && <p className="text-caption text-destructive" role="alert">{errors.participantId}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="coachId">Coach *</Label>
                <Select value={coachId} onValueChange={(v) => setCoachId(v)}>
                  <SelectTrigger id="coachId">
                    <SelectValue placeholder="Coach wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoaches.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Keine Coaches verfügbar
                      </SelectItem>
                    )}
                    {availableCoaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.coachId && <p className="text-caption text-destructive" role="alert">{errors.coachId}</p>}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Typ *</Label>
                <Select value={type} onValueChange={(v: AppointmentType) => setType(v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v: AppointmentStatus) => setStatus(v)}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "Draft" ? "Entwurf" : s === "Finding" ? "Terminfindung" : s === "Confirmed" ? "Bestätigt" : s === "Completed" ? "Durchgeführt" : s === "Documented" ? "Dokumentiert" : s === "Cancelled" ? "Abgesagt" : "Nicht erschienen"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-h4 font-medium">Zeit & Ort</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Von *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={errors.startTime ? "border-destructive" : ""}
                  aria-invalid={!!errors.startTime}
                  aria-describedby={errors.startTime ? "startTime-error" : undefined}
                />
                {errors.startTime && <p id="startTime-error" className="text-caption text-destructive" role="alert">{errors.startTime}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Bis *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={errors.endTime ? "border-destructive" : ""}
                  aria-invalid={!!errors.endTime}
                  aria-describedby={errors.endTime ? "endTime-error" : undefined}
                />
                {errors.endTime && <p id="endTime-error" className="text-caption text-destructive" role="alert">{errors.endTime}</p>}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Ort</Label>
                <Select value={location} onValueChange={(v: AppointmentLocation) => setLocation(v)}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Ort wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentLocations.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l === "OnSite" ? "Vor Ort" : l === "Teams" ? "MS Teams" : l === "Phone" ? "Telefon" : l === "Hybrid" ? "Hybrid" : "Extern"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetingLink">Meeting Link</Label>
                <Input
                  id="meetingLink"
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://teams.microsoft.com/..."
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-h4 font-medium">Notizen</legend>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notizen zum Termin..."
              rows={4}
            />
          </fieldset>
        </form>
        <DialogFooter className="justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button type="submit" form="appointment-form" disabled={isLoading}>
            {isLoading ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}