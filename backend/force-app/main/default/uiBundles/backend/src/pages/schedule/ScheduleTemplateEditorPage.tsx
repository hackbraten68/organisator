import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, LayoutGrid, List, Plus, Printer, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  getScheduleTemplate,
  deleteScheduleEntry,
  saveScheduleGrid,
} from "@/api/schedule/scheduleEditorService";
import ScheduleEntryTable from "@/components/schedule/ScheduleEntryTable";
import ScheduleEntryDialog from "@/components/schedule/ScheduleEntryDialog";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import ScheduleGridSettingsDialog from "@/components/schedule/ScheduleGridSettingsDialog";
import { normalizeGridConfig } from "@/features/schedule-grid/gridConfig";
import type { GridConfig, GridSlot, ScheduleEntry, SchedulePlan } from "@/types/schedule";

export default function ScheduleTemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((v) => v + 1);

  const { data, loading, error } = useAsyncData(
    () => (templateId ? getScheduleTemplate(templateId) : Promise.resolve(null)),
    [templateId, reload],
  );

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [entryDefaults, setEntryDefaults] = useState<{
    day?: string;
    slot?: GridSlot | null;
    order?: number | null;
  }>({});
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<ScheduleEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const template = data?.plan ?? null;
  const entries: ScheduleEntry[] = data?.entries ?? [];
  const gridConfig = useMemo(
    () => normalizeGridConfig(template?.gridConfig),
    [template?.gridConfig],
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
    if (!templateId) return;
    try {
      await saveScheduleGrid({ scheduleTemplateId: templateId, gridConfig: config });
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
  if (error || !template) {
    return <div className="p-6 text-destructive">{error ?? "Vorlage nicht gefunden."}</div>;
  }

  // Create a pseudo-plan for the entry dialog
  const pseudoPlan: SchedulePlan = {
    id: template.id,
    name: template.name,
    programId: template.programId,
    programWeekId: template.programWeekId,
    scopeType: "Course",
    status: "Draft",
    startDate: null,
    endDate: null,
    participantGroupId: null,
    participantGroupName: null,
    participantId: null,
    participantName: null,
    appliedTemplateId: null,
    templateName: null,
    entryCount: entries.length,
    notes: template.notes,
    deviationReason: null,
    publishedAt: null,
    publishedBy: null,
    coachName: null,
    mergeMode: "Overlay",
    gridConfig: template.gridConfig,
  };

  return (
    <div className="space-y-6 p-6 print:space-y-3 print:p-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/wochenplan/vorlagen")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">
          Vorlage
        </span>
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

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="print:hidden">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{viewMode === "grid" ? "Wochenplan-Raster" : "Einträge"}</span>
            <div className="flex gap-2">
              {viewMode === "grid" && (
                <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="mr-1 h-4 w-4" /> Zeitblöcke
                </Button>
              )}
              <Button size="sm" onClick={() => openNewEntry()}>
                <Plus className="h-4 w-4 mr-1" /> Eintrag anlegen
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="print:p-0">
          {viewMode === "grid" ? (
            <ScheduleGrid
              config={gridConfig}
              entries={entries}
              editable
              editableContent
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
        plan={pseudoPlan}
        entry={editingEntry}
        onSaved={refresh}
        templateId={templateId}
        programId={template.programId ?? undefined}
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
