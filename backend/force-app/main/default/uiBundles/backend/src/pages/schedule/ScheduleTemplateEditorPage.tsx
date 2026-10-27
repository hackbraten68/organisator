import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
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
} from "@/api/schedule/scheduleEditorService";
import ScheduleEntryTable from "@/components/schedule/ScheduleEntryTable";
import ScheduleEntryDialog from "@/components/schedule/ScheduleEntryDialog";
import type { ScheduleEntry } from "@/types/schedule";

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
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<ScheduleEntry | null>(null);
  const [deleting, setDeleting] = useState(false);


  const template = data?.plan ?? null;
  const entries: ScheduleEntry[] = data?.entries ?? [];

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
  const pseudoPlan = {
    id: template.id,
    name: template.name,
    programWeekId: null,
    scopeType: "Course" as const,
    status: "Draft" as const,
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
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/wochenplan/vorlagen")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
        </Button>
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">
          Vorlage
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Einträge</span>
            <Button size="sm" onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Eintrag anlegen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleEntryTable
            entries={entries}
            onEdit={(e) => { setEditingEntry(e); setEntryDialogOpen(true); }}
            onDelete={(e) => setDeleteEntryTarget(e)}
          />
        </CardContent>
      </Card>

      <ScheduleEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        plan={pseudoPlan}
        entry={editingEntry}
        onSaved={refresh}
        templateId={templateId}
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

