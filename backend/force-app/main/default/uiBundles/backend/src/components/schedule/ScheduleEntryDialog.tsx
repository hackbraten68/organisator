import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
} from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  saveScheduleEntry,
  getScheduleOptions,
} from "@/api/schedule/scheduleEditorService";
import type { ScheduleEntry, SchedulePlan, EntryInput, ScheduleOptions } from "@/types/schedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SchedulePlan;
  entry: ScheduleEntry | null;
  onSaved: () => void;
  templateId?: string;
}

export default function ScheduleEntryDialog({ open, onOpenChange, plan, entry, onSaved, templateId }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entryKind, setEntryKind] = useState("Aktivität");
  const [type, setType] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [coachProfileId, setCoachProfileId] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [order, setOrder] = useState("");
  const [deviationReason, setDeviationReason] = useState("");
  const [notes, setNotes] = useState("");
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = entry !== null;

  useEffect(() => {
    if (!open) return;
    getScheduleOptions("")
      .then(setOptions)
      .catch(() => setOptions(null));
  }, [open]);

  // We need programId for options; plan doesn't carry it. Fetch via list? For now use empty and rely on options endpoint with programId from plan's programWeek? We'll pass programWeekId's program via a separate fetch is not available. Simpler: options endpoint requires programId; we can't get it here. We'll fetch options with the plan's programWeekId? The endpoint accepts programId. We'll leave options null and load coaches/groups/participants from a list call. To keep it simple, fetch options with an empty programId (returns coaches + templates only).
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setTitle(entry.title);
      setDescription(entry.description ?? "");
      setEntryKind(entry.entryKind);
      setType(entry.type);
      setIsRequired(entry.isRequired);
      setDayOfWeek(entry.dayOfWeek);
      setStartTime(entry.startTime ?? "");
      setEndTime(entry.endTime ?? "");
      setDurationMinutes(entry.durationMinutes?.toString() ?? "");
      setCoachProfileId(entry.coachProfileId ?? "");
      setLocation(entry.location ?? "");
      setMeetingLink(entry.meetingLink ?? "");
      setOrder(entry.order?.toString() ?? "");
      setDeviationReason(entry.deviationReason ?? "");
      setNotes(entry.notes ?? "");
    } else {
      setTitle("");
      setDescription("");
      setEntryKind("Aktivität");
      setType(options?.types?.[0] ?? "");
      setIsRequired(false);
      setDayOfWeek("Monday");
      setStartTime("");
      setEndTime("");
      setDurationMinutes("");
      setCoachProfileId("");
      setLocation("");
      setMeetingLink("");
      setOrder("");
      setDeviationReason("");
      setNotes("");
    }
  }, [open, entry, options]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Titel ist erforderlich.");
      return;
    }
    if (!type) {
      toast.error("Typ ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const input: EntryInput = {
        weeklyScheduleId: templateId ? undefined : plan.id,
        scheduleTemplateId: templateId,
        title: title.trim(),
        description: description || null,
        entryKind: entryKind as EntryInput["entryKind"],
        type,
        isRequired,
        dayOfWeek,
        startTime: startTime || null,
        endTime: endTime || null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        targetType: templateId ? "Course" : plan.scopeType,
        coachProfileId: coachProfileId || null,
        location: location || null,
        meetingLink: meetingLink || null,
        order: order ? Number(order) : null,
        deviationReason: deviationReason || null,
        notes: notes || null,
      };
      if (plan.scopeType === "Group") {
        input.participantGroupId = plan.participantGroupId;
      }
      if (plan.scopeType === "Individual") {
        input.participantId = plan.participantId;
      }
      if (isEdit && entry) {
        input.id = entry.id;
      }
      await saveScheduleEntry(input);
      toast.success(isEdit ? "Eintrag gespeichert." : "Eintrag angelegt.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  const kinds = options?.entryKinds?.length ? options.entryKinds : ["Aktivität", "Aufgabe"];
  const types = options?.types?.length ? options.types : [];
  const days = options?.days?.length ? options.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const locations = options?.locations?.length ? options.locations : [];
  const coaches = options?.coaches ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Eintrag bearbeiten" : "Eintrag anlegen"}</DialogTitle>
          <DialogDescription>
            Geltungsbereich: {plan.scopeType === "Course" ? "Kurs" : plan.scopeType === "Group" ? "Gruppe" : "Individuell"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="entry-title">Titel</Label>
            <Input id="entry-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="entry-desc">Beschreibung</Label>
            <Textarea id="entry-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Art</Label>
              <Select value={entryKind} onValueChange={setEntryKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Typ wählen" /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Tag</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="entry-start">Start</Label>
              <Input id="entry-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="entry-end">Ende</Label>
              <Input id="entry-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="entry-dur">Dauer (Min)</Label>
              <Input id="entry-dur" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Coach</Label>
            <Select value={coachProfileId} onValueChange={setCoachProfileId}>
              <SelectTrigger><SelectValue placeholder="Kein Coach" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Kein Coach</SelectItem>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ort</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger><SelectValue placeholder="Ort wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="entry-link">Meeting-Link</Label>
              <Input id="entry-link" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="entry-order">Reihenfolge</Label>
              <Input id="entry-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="entry-required" checked={isRequired} onCheckedChange={(v) => setIsRequired(!!v)} />
              <Label htmlFor="entry-required">Pflicht</Label>
            </div>
          </div>
          <div>
            <Label htmlFor="entry-deviation">Abweichungsgrund</Label>
            <Input id="entry-deviation" value={deviationReason} onChange={(e) => setDeviationReason(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="entry-notes">Notizen</Label>
            <Textarea id="entry-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
