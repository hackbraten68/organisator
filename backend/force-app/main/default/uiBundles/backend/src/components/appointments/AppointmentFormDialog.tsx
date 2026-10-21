import { useState, useEffect, useMemo, useRef } from "react";
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
import { parseISO } from "date-fns";
import { toApiDateTime, toDateTimeLocalValue } from "@/lib/datetime";
import type { AppointmentInput, AppointmentType, AppointmentLocation } from "@/types/appointment";
import { APPOINTMENT_TYPES, APPOINTMENT_LOCATIONS, APPOINTMENT_LOCATION_LABELS } from "@/types/appointment";

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
  initialData?: Partial<AppointmentInput> & { coachName?: string };
  isLoading?: boolean;
  title?: string;
  availableCoaches?: { id: string; name: string }[];
  /**
   * "create" oder "edit" — und der Unterschied ist mehr als eine Beschriftung.
   *
   * Im Bearbeitungsmodus bedeutet ein leeres Feld "leeren", im Anlegen
   * "nicht setzen". Serverseitig sind das zwei verschiedene Aussagen: die
   * Whitelist des Einstiegspunkts liest `null` als "nicht mitschicken" und `""`
   * als "leeren". Ohne diese Unterscheidung koennte der Bearbeitungsdialog eine
   * Notiz nie entfernen.
   *
   * Ausserdem ist der Coach im Bearbeitungsmodus nicht Pflicht: `Coach__c` ist
   * in der Org kein Pflichtfeld, und ein Dialog, der beim Bearbeiten einen
   * Coach verlangt, schreibt einen Coach, den der Aufrufer gar nicht wollte.
   */
  mode?: "create" | "edit";
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
  mode = "create",
}: AppointmentFormDialogProps) {
  const isEdit = mode === "edit";
  const [type, setType] = useState<AppointmentType>(initialData?.type || "Coaching");
  const [startTime, setStartTime] = useState(initialData?.startTime || "");
  const [endTime, setEndTime] = useState(initialData?.endTime || "");
  // Kein Fallback auf einen festen Wert: Location__c hat in der Org keinen
  // Default-Wert, ein erzwungener waere zudem ein Wert, den die Picklist gar
  // nicht kennt. Ohne Auswahl bleibt das Feld leer — das erlaubt die Org.
  const [location, setLocation] = useState<AppointmentLocation | "">(initialData?.location || "");
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

  /**
   * Die Coach-Auswahl, ergaenzt um den Coach des Termins.
   *
   * `listAssignableUsers()` liefert die aktiven Benutzer. Gehoert der Coach
   * eines Termins nicht dazu (inaktiv, gefiltert), wuerde das Select den Wert
   * anzeigen, aber ohne Namen — und der Aufrufer glaubte, der Termin haette
   * gar keinen Coach.
   */
  const coachOptions = useMemo(() => {
    const options = [...availableCoaches];
    const currentId = initialData?.coachId;
    if (currentId && !options.some((c) => c.id === currentId)) {
      options.push({ id: currentId, name: initialData?.coachName || currentId });
    }
    return options;
  }, [availableCoaches, initialData]);

  /**
   * Ein leeres Feld bedeutet im Bearbeitungsmodus "leeren" und im Anlegen
   * "nicht setzen".
   *
   * Serverseitig sind das zwei verschiedene Aussagen: die Whitelist des
   * Einstiegspunkts liest ein fehlendes Feld als "unberuehrt" und `""` als
   * "leeren". Ohne die Unterscheidung koennte der Bearbeitungsdialog eine
   * Notiz nie entfernen — das Leeren waere im Anlegen nie noetig, dort ist ein
   * leeres Feld schlicht ein leeres Feld.
   */
  const optional = (value: string) => (isEdit ? value.trim() : value.trim() || undefined);

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
    if (!coachId && !isEdit) newErrors.coachId = "Coach ist erforderlich";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // datetime-local liefert lokale Wanduhrzeit ohne Offset; die Mutation
    // deklariert $startTime/$endTime als DateTime und braucht die Zone.
    let startTimeIso: string;
    let endTimeIso: string;
    try {
      startTimeIso = toApiDateTime(startTime);
      endTimeIso = toApiDateTime(endTime);
    } catch {
      setErrors((prev) => ({ ...prev, startTime: "Ungültiges Datum oder Uhrzeit" }));
      return;
    }

    try {
      await onSubmit({
        participantId: resolvedParticipantId,
        coachId: coachId || undefined,
        type,
        startTime: startTimeIso,
        endTime: endTimeIso,
        // Der Ort laesst sich im Dialog nicht leeren: das Select hat keinen
        // leeren Eintrag, und Radix reserviert den Leerstring fuer den
        // Platzhalter. "Nicht mitschicken" heisst hier also "unberuehrt
        // lassen" — der Server kann den Ort loeschen, die Oberflaeche nicht.
        location: location || undefined,
        meetingLink: optional(meetingLink),
        notes: optional(notes),
      });
    } catch (err) {
      // Der Aufrufer hat den Fehler bereits gemeldet (Toast). Der Dialog
      // bleibt offen, damit die Eingabe nicht verloren geht, und wirft nicht
      // weiter — sonst landet das als unbehandelte Rejection in der Konsole.
      console.error("Failed to save appointment", err);
      return;
    }
    onClose();
  };

  /**
   * Das Formular an den Datensatz anpassen — beim Oeffnen und wenn sich der
   * Datensatz aendert.
   *
   * Der Schluessel ist der *Inhalt* von `initialData`, nicht die Identitaet des
   * Objekts: ein Elternteil, das die Daten bei jedem Rendern neu baut, soll das
   * Formular nicht zuruecksetzen, solange sich nichts geaendert hat. Sonst
   * waere jede Eingabe weg, sobald irgendetwas anderes einen Render ausloest.
   * Das `isOpen` gehoert mit in den Schluessel, damit ein Abbrechen die
   * Eingaben verwirft: derselbe Termin, danach wieder geoeffnet, zeigt sonst
   * noch die Eingaben des ersten Versuchs.
   *
   * Vorher stand hier nur die Zeit im Effekt. Der Rest (Typ, Ort, Link, Notiz,
   * Coach) blieb im Initialzustand — beim zweiten Bearbeiten eines Termins
   * zeigte das Formular die Werte des *ersten* Bearbeitens.
   */
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${isOpen ? "open" : "closed"}|${JSON.stringify(initialData ?? null)}`;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    // initialData kommt als ISO-Zeit; das Input kennt keine Zeitzone.
    setType(initialData?.type || "Coaching");
    setStartTime(initialData?.startTime ? toDateTimeLocalValue(initialData.startTime) : "");
    setEndTime(initialData?.endTime ? toDateTimeLocalValue(initialData.endTime) : "");
    setLocation(initialData?.location || "");
    setMeetingLink(initialData?.meetingLink || "");
    setNotes(initialData?.notes || "");
    setCoachId(initialData?.coachId || "");
    setErrors({});
  }, [initialData, isOpen]);

  const appointmentTypes: AppointmentType[] = [...APPOINTMENT_TYPES];
  const appointmentLocations: AppointmentLocation[] = [...APPOINTMENT_LOCATIONS];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-h2">{title}</DialogTitle>
          <p className="text-small text-muted-foreground">
            {isEdit
              ? "Ändern Sie die Angaben des Termins. Der Termin bleibt im Status Entwurf."
              : "Erstellen Sie einen neuen Termin für den Teilnehmer."}
          </p>
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
                <Label htmlFor="coachId">Coach{isEdit ? "" : " *"}</Label>
                <Select value={coachId} onValueChange={(v) => setCoachId(v)}>
                  <SelectTrigger id="coachId">
                    <SelectValue placeholder="Coach wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {coachOptions.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Keine Coaches verfügbar
                      </SelectItem>
                    )}
                    {coachOptions.map((c) => (
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
              {/* Kein Statusfeld. Der Termin startet fest als Draft; jeden weiteren
                  Zustand erreicht er ueber die benannte Lifecycle-Aktion. Eine
                  Auswahl hier liess Termine direkt in einen Endzustand entstehen,
                  ohne die zugehoerigen Zeitstempel — siehe CreateAppointment. */}
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
                        {APPOINTMENT_LOCATION_LABELS[l] ?? l}
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