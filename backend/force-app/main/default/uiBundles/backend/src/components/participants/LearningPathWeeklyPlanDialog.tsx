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
import { toast } from "@/components/ui/sonner";
import {
  getLearningPathOptions,
  createIndividualPlanFromLearningPath,
} from "@/api/schedule/scheduleEditorService";
import type { LearningPathPlanOptions } from "@/types/schedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learningPathId: string;
  onCreated: (planId: string) => void;
}

export default function LearningPathWeeklyPlanDialog({ open, onOpenChange, learningPathId, onCreated }: Props) {
  const [options, setOptions] = useState<LearningPathPlanOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [programWeekId, setProgramWeekId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open || !learningPathId) return;
    setLoading(true);
    getLearningPathOptions(learningPathId)
      .then((opts) => {
        setOptions(opts);
        if (opts.programWeeks.length === 1) {
          setProgramWeekId(opts.programWeeks[0].id);
        }
        if (opts.templates.length === 1) {
          setTemplateId(opts.templates[0].id);
        }
        if (opts.learningPathTitle && opts.participantName) {
          setName(`${opts.learningPathTitle} – ${opts.participantName}`);
        }
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Fehler beim Laden.");
      })
      .finally(() => setLoading(false));
  }, [open, learningPathId]);

  const handleCreate = async () => {
    if (!templateId) {
      toast.error("Bitte eine Vorlage wählen.");
      return;
    }
    if (!startDate) {
      toast.error("Startdatum (Montag) ist erforderlich.");
      return;
    }
    if (options?.programWeeks.length && options.programWeeks.length > 1 && !programWeekId) {
      toast.error("Bitte eine Kurswoche wählen.");
      return;
    }
    setCreating(true);
    try {
      const result = await createIndividualPlanFromLearningPath({
        learningPathId,
        templateId,
        startDate,
        name: name.trim() || undefined,
        programWeekId: programWeekId || undefined,
      });
      if (result.code === "EXISTING_SCHEDULE_OPENED") {
        toast.info("Vorhandener Plan wurde geöffnet.");
      } else {
        toast.success("Individueller Wochenplan als Entwurf angelegt.");
      }
      onCreated(result.planId);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Anlegen.");
    } finally {
      setCreating(false);
    }
  };

  const resolutionOk = options?.resolutionStatus === "OK";
  const hasTemplates = (options?.templates.length ?? 0) > 0;
  const hasWeeks = (options?.programWeeks.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Wochenplan aus Vorlage</DialogTitle>
          <DialogDescription>
            Erstellt einen individuellen Wochenplan als Entwurf für den Teilnehmer.
          </DialogDescription>
        </DialogHeader>

        {loading && <div className="py-4 text-center text-muted-foreground">Laden...</div>}

        {!loading && options && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <div><span className="text-muted-foreground">Teilnehmer:</span> {options.participantName ?? "–"}</div>
              <div><span className="text-muted-foreground">Programm:</span> {options.programName ?? "–"}</div>
              <div><span className="text-muted-foreground">Modul:</span> {options.moduleName ?? "–"}</div>
            </div>

            {!resolutionOk && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {options.resolutionStatus === "NO_PARTICIPANT" && "Kein Teilnehmer zugeordnet."}
                {options.resolutionStatus === "NO_PROGRAM" && "Kein Programm zugeordnet."}
                {options.resolutionStatus === "NO_MODULE" && "Kein Modul am Lernpfadeintrag. Bitte zuerst das Modul zuordnen."}
              </div>
            )}

            {resolutionOk && !hasWeeks && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Keine Kurswoche für dieses Modul gefunden.
              </div>
            )}

            {resolutionOk && hasWeeks && !hasTemplates && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Keine aktive Vorlage für dieses Programm/diese Kurswoche gefunden.
              </div>
            )}

            {resolutionOk && hasWeeks && hasTemplates && (
              <>
                {options.programWeeks.length > 1 && (
                  <div>
                    <Label>Kurswoche</Label>
                    <Select value={programWeekId} onValueChange={setProgramWeekId}>
                      <SelectTrigger><SelectValue placeholder="Kurswoche wählen" /></SelectTrigger>
                      <SelectContent>
                        {options.programWeeks.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            Woche {w.weekNumber ?? "–"} – {w.name ?? "Ohne Name"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Vorlage</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
                    <SelectContent>
                      {options.templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.entryCount} Einträge)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lp-start">Start (Montag)</Label>
                  <Input
                    id="lp-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="lp-name">Planname</Label>
                  <Input id="lp-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Abbrechen
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !resolutionOk || !hasWeeks || !hasTemplates}
          >
            {creating ? "Anlegen..." : "Entwurf anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
