import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Pencil, Printer, Trash2 } from "lucide-react";
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
  deleteScheduleTemplate,
} from "@/api/schedule/scheduleEditorService";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import WeeklyPlanLegend from "@/components/weekly-plan/WeeklyPlanLegend";
import { normalizeGridConfig } from "@/features/schedule-grid/gridConfig";

export default function ScheduleTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error } = useAsyncData(
    () => (templateId ? getScheduleTemplate(templateId) : Promise.resolve(null)),
    [templateId],
  );

  const template = data?.plan ?? null;
  const entries = data?.entries ?? [];
  const gridConfig = useMemo(
    () => normalizeGridConfig(template?.gridConfig),
    [template?.gridConfig],
  );

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteScheduleTemplate(template.id);
      toast.success("Vorlage gelöscht.");
      navigate("/wochenplan/vorlagen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
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
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Drucken
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/wochenplan/vorlagen/${template.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Löschen
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Vorlagen-Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Einträge:</span> {template.entryCount ?? entries.length}
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span> {template.status ?? "–"}
          </div>
          {template.programId && (
            <div>
              <span className="text-muted-foreground">Programm:</span> {template.programId}
            </div>
          )}
          {template.programWeekId && (
            <div>
              <span className="text-muted-foreground">Kurswoche:</span> {template.programWeekId}
            </div>
          )}
          {template.notes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Beschreibung:</span> {template.notes}
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleGrid config={gridConfig} entries={entries} />
      <WeeklyPlanLegend />
      <p className="text-xs text-muted-foreground print:hidden">
        Diese Vorlage wird im Plan-Editor als Ausgangsraster verwendet. Veröffentlichte Pläne
        bleiben auch bei Rasteränderungen schreibgeschützt.
      </p>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Vorlage „{template.name}“ wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Löschen..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
