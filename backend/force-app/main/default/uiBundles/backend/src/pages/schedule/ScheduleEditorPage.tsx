import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, LayoutGrid, List, Plus, Printer, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  getSchedulePlan,
  deleteScheduleEntry,
  publishSchedulePlan,
  unpublishSchedulePlan,
  deleteSchedulePlan,
  saveAsTemplate,
  saveScheduleGrid,
} from "@/api/schedule/scheduleEditorService";
import ScheduleStatusBadge from "@/components/schedule/ScheduleStatusBadge";
import ScheduleScopeBadge from "@/components/schedule/ScheduleScopeBadge";
import ScheduleEntryTable from "@/components/schedule/ScheduleEntryTable";
import ScheduleEntryDialog from "@/components/schedule/ScheduleEntryDialog";
import SchedulePlanDialog from "@/components/schedule/SchedulePlanDialog";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import ScheduleGridSettingsDialog from "@/components/schedule/ScheduleGridSettingsDialog";
import { normalizeGridConfig } from "@/features/schedule-grid/gridConfig";
import type { GridConfig, GridSlot, ScheduleEntry, SchedulePlan } from "@/types/schedule";

export default function ScheduleEditorPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((v) => v + 1);

  const { data, loading, error } = useAsyncData(
    () => (planId ? getSchedulePlan(planId) : Promise.resolve(null)),
    [planId, reload],
  );

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [entryDefaults, setEntryDefaults] = useState<{
    day?: string;
    slot?: GridSlot | null;
    order?: number | null;
  }>({});
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<ScheduleEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const plan: SchedulePlan | null = data?.plan ?? null;
  const entries: ScheduleEntry[] = data?.entries ?? [];
  const gridConfig = useMemo(
    () => normalizeGridConfig(plan?.gridConfig),
    [plan?.gridConfig],
  );

  const openNewEntry = (day?: string, slot?: GridSlot | null) => {
    setEditingEntry(null);
    setEntryDefaults({
      day,
      slot,
      order: slot ? gridConfig.slots.findIndex((item) => item.id === slot.id) + 1 : null,
    });
    setEntryDialogOpen(true);
  };

  const openEditEntry = (entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setEntryDefaults({});
    setEntryDialogOpen(true);
  };

  const handlePublish = async () => {
    if (!plan) return;
    try {
      await publishSchedulePlan(plan.id);
      toast.success("Plan veröffentlicht.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Veröffentlichen.");
    }
  };

  const handleUnpublish = async () => {
    if (!plan) return;
    try {
      await unpublishSchedulePlan(plan.id);
      toast.success("Plan zurückgezogen.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Zurückziehen.");
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    if (!window.confirm(`Plan "${plan.name}" wirklich löschen?`)) return;
    try {
      await deleteSchedulePlan(plan.id);
      toast.success("Plan gelöscht.");
      navigate("/wochenplan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryTarget) return;
    setDeleting(true);
    try {
      await deleteScheduleEntry(deleteEntryTarget.id);
      toast.success("Eintrag gelöscht.");
      setDeleteEntryTarget(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveGrid = async (config: GridConfig) => {
    if (!plan) return;
    try {
      await saveScheduleGrid({ weeklyScheduleId: plan.id, gridConfig: config });
      toast.success("Zeitblöcke gespeichert.");
      setSettingsOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern der Zeitblöcke.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !plan) {
    return <div className="p-6 text-destructive">{error ?? "Plan nicht gefunden."}</div>;
  }

  const editable = plan.status === "Draft";

  return (
    <div className="space-y-6 p-6 print:space-y-3 print:p-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/wochenplan")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-semibold">{plan.name}</h1>
        <ScheduleStatusBadge status={plan.status} />
        <ScheduleScopeBadge scope={plan.scopeType} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Drucken
          </Button>
          <div className="inline-flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Raster
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1 h-3.5 w-3.5" /> Liste
            </Button>
          </div>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Plan-Details</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPlanDialogOpen(true)}>
                Bearbeiten
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTemplateName(plan.name);
                  setTemplateDialogOpen(true);
                }}
              >
                Als Vorlage speichern
              </Button>
              {plan.status === "Draft" ? (
                <Button size="sm" onClick={handlePublish}>
                  Veröffentlichen
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleUnpublish}>
                  Zurückziehen
                </Button>
              )}
              {plan.status === "Draft" && (
                <Button size="sm" variant="destructive" onClick={handleDeletePlan}>
                  Löschen
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Geltungsbereich:</span>{" "}
            {plan.scopeType === "Course"
              ? "Kurs (gilt für alle Teilnehmer des Programms)"
              : plan.scopeType === "Group"
                ? `Gruppe: ${plan.participantGroupName ?? "–"}`
                : `Individuell: ${plan.participantName ?? "–"}`}
          </div>
          <div>
            <span className="text-muted-foreground">Start:</span> {plan.startDate ?? "–"}
          </div>
          <div>
            <span className="text-muted-foreground">Ende:</span> {plan.endDate ?? "–"}
          </div>
          <div>
            <span className="text-muted-foreground">Einträge:</span> {plan.entryCount}
          </div>
          {plan.participantGroupName && (
            <div>
              <span className="text-muted-foreground">Gruppe:</span> {plan.participantGroupName}
            </div>
          )}
          {plan.participantName && (
            <div>
              <span className="text-muted-foreground">Teilnehmer:</span> {plan.participantName}
            </div>
          )}
          {plan.scopeType === "Individual" && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Umgang mit bestehendem Plan:</span>{" "}
              {plan.mergeMode === "Replace"
                ? "Vollständig ersetzen (nur die Einträge dieses Plans sind im Portal sichtbar)"
                : "Ergänzen (Kurs- und Gruppenplan bleiben sichtbar, gleiche Slots werden überschrieben)"}
            </div>
          )}
          {plan.notes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Notizen:</span> {plan.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {plan.status === "Published" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          Dieser Plan ist veröffentlicht und schreibgeschützt. Für Änderungen bitte zuerst
          zurückziehen.
        </div>
      )}

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:hidden">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{viewMode === "grid" ? "Wochenplan-Raster" : "Einträge"}</span>
            <div className="flex gap-2">
              {editable && viewMode === "grid" && (
                <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="mr-1 h-4 w-4" /> Zeitblöcke
                </Button>
              )}
              {editable && (
                <Button size="sm" onClick={() => openNewEntry()}>
                  <Plus className="h-4 w-4 mr-1" /> Eintrag anlegen
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="print:p-0">
          {viewMode === "grid" ? (
            <ScheduleGrid
              config={gridConfig}
              entries={entries}
              editable={editable}
              onAddEntry={openNewEntry}
              onEditEntry={openEditEntry}
              onDeleteEntry={(entry) => setDeleteEntryTarget(entry)}
              onEditSlot={() => setSettingsOpen(true)}
              onManageSlots={() => setSettingsOpen(true)}
            />
          ) : (
            <ScheduleEntryTable
              entries={entries}
              onEdit={openEditEntry}
              onDelete={(e) => setDeleteEntryTarget(e)}
            />
          )}
        </CardContent>
      </Card>

      <ScheduleEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        plan={plan}
        entry={editingEntry}
        onSaved={refresh}
        programId={plan.programId ?? undefined}
        defaultDay={entryDefaults.day}
        defaultSlot={entryDefaults.slot}
        defaultOrder={entryDefaults.order}
        slots={gridConfig.slots}
      />

      <ScheduleGridSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={gridConfig}
        onSave={handleSaveGrid}
      />

      <SchedulePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        programWeekId={plan.programWeekId ?? ""}
        programId={plan.programId ?? ""}
        plan={plan}
        existingScopes={[]}
        onSaved={refresh}
      />

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Als Vorlage speichern</DialogTitle>
            <DialogDescription>
              Erstellt eine wiederverwendbare Vorlage aus diesem Plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Vorlagenname</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={savingTemplate}>
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                if (!plan || !templateName.trim()) return;
                setSavingTemplate(true);
                try {
                  await saveAsTemplate({
                    weeklyScheduleId: plan.id,
                    name: templateName.trim(),
                  });
                  toast.success("Vorlage gespeichert.");
                  setTemplateDialogOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Fehler.");
                } finally {
                  setSavingTemplate(false);
                }
              }}
              disabled={savingTemplate || !templateName.trim()}
            >
              {savingTemplate ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEntryTarget} onOpenChange={(o) => !o && setDeleteEntryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Eintrag „{deleteEntryTarget?.title}“ wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry} disabled={deleting}>
              {deleting ? "Löschen..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
