import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
  saveSchedulePlan,
  getScheduleOptions,
  applyScheduleTemplate,
} from "@/api/schedule/scheduleEditorService";
import type { ScheduleScope, SchedulePlan, PlanInput } from "@/types/schedule";
import type { ScheduleOptions } from "@/types/schedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programWeekId: string;
  programId: string;
  plan: SchedulePlan | null;
  existingScopes: ScheduleScope[];
  onSaved: () => void;
}

export default function SchedulePlanDialog({
  open,
  onOpenChange,
  programWeekId,
  programId,
  plan,
  existingScopes,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [scopeType, setScopeType] = useState<ScheduleScope>("Course");
  const [participantGroupId, setParticipantGroupId] = useState<string>("");
  const [participantId, setParticipantId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [deviationReason, setDeviationReason] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = plan !== null;

  useEffect(() => {
    if (!open) return;
    getScheduleOptions(programId)
      .then(setOptions)
      .catch(() => setOptions(null));
  }, [open, programId]);

  useEffect(() => {
    if (!open) return;
    if (plan) {
      setName(plan.name);
      setScopeType(plan.scopeType);
      setParticipantGroupId(plan.participantGroupId ?? "");
      setParticipantId(plan.participantId ?? "");
      setStartDate(plan.startDate ?? "");
      setEndDate(plan.endDate ?? "");
      setNotes(plan.notes ?? "");
      setDeviationReason(plan.deviationReason ?? "");
      setTemplateId("");
    } else {
      setName("");
      setScopeType("Course");
      setParticipantGroupId("");
      setParticipantId("");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setNotes("");
      setDeviationReason("");
      setTemplateId("");
    }
  }, [open, plan]);

  const availableScopes: ScheduleScope[] = (["Course", "Group", "Individual"] as ScheduleScope[]).filter(
    (s) => isEdit || !existingScopes.includes(s),
  );

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    if (!startDate) {
      toast.error("Startdatum ist erforderlich.");
      return;
    }
    if (scopeType === "Group" && !participantGroupId) {
      toast.error("Bitte eine Gruppe wählen.");
      return;
    }
    if (scopeType === "Individual" && !participantId) {
      toast.error("Bitte einen Teilnehmer wählen.");
      return;
    }
    setSaving(true);
    try {
      if (!isEdit && templateId) {
        await applyScheduleTemplate({
          templateId,
          programWeekId,
          startDate,
          name: name.trim(),
        });
        toast.success("Plan aus Vorlage angelegt.");
      } else {
        const input: PlanInput = {
          name: name.trim(),
          programWeekId,
          scopeType,
          startDate,
          endDate: endDate || null,
          notes: notes || null,
          deviationReason: deviationReason || null,
        };
        if (isEdit && plan) {
          input.id = plan.id;
          input.scopeType = scopeType;
          input.participantGroupId = scopeType === "Group" ? participantGroupId : "";
          input.participantId = scopeType === "Individual" ? participantId : "";
        } else {
          input.participantGroupId = scopeType === "Group" ? participantGroupId : null;
          input.participantId = scopeType === "Individual" ? participantId : null;
        }
        await saveSchedulePlan(input);
        toast.success(isEdit ? "Plan gespeichert." : "Plan angelegt.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Plan bearbeiten" : "Plan anlegen"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Metadaten des Plans bearbeiten." : "Neuen Wochenplan für diese Kurswoche anlegen."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="plan-name">Name</Label>
            <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Geltungsbereich</Label>
            <Select
              value={scopeType}
              onValueChange={(v) => {
                const newScope = v as ScheduleScope;
                setScopeType(newScope);
                if (newScope !== "Group") setParticipantGroupId("");
                if (newScope !== "Individual") setParticipantId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableScopes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "Course" ? "Kurs" : s === "Group" ? "Gruppe" : "Individuell"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {scopeType === "Course" && !isEdit && (
            <div>
              <Label>Vorlage (optional)</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Keine Vorlage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Vorlage</SelectItem>
                  {(options?.templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.entryCount} Einträge)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeType === "Group" && (
            <div>
              <Label>Gruppe</Label>
              <Select
                value={participantGroupId}
                onValueChange={setParticipantGroupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Gruppe wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.groups ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeType === "Individual" && (
            <div>
              <Label>Teilnehmer</Label>
              <Select
                value={participantId}
                onValueChange={setParticipantId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Teilnehmer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.participants ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="plan-start">Start (Montag)</Label>
              <Input
                id="plan-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="plan-end">Ende</Label>
              <Input
                id="plan-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="plan-notes">Notizen</Label>
            <Textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="plan-deviation">Abweichungsgrund</Label>
            <Input
              id="plan-deviation"
              value={deviationReason}
              onChange={(e) => setDeviationReason(e.target.value)}
            />
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
