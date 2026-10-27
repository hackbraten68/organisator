import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
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
  listScheduleTemplates,
  deleteScheduleTemplate,
} from "@/api/schedule/scheduleEditorService";

export default function ScheduleTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: templates, loading } = useAsyncData(
    () => listScheduleTemplates(),
    [],
  );

  const template = (templates ?? []).find((t) => t.id === templateId) ?? null;

  // Load entries via a separate fetch - we need to get them from the template
  // For now, we'll use getScheduleOptions to get templates with entry counts
  // and show basic info

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!template) {
    return <div className="p-6 text-destructive">Vorlage nicht gefunden.</div>;
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
            <span>Vorlagen-Details</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/wochenplan/vorlagen/${template.id}/edit`)}>
                Bearbeiten
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Löschen
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Einträge:</span> {template.entryCount}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einträge</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {template.entryCount} Vorlageneinträge. Bearbeitung von Vorlageneinträgen folgt in einer späteren Version.
          </p>
        </CardContent>
      </Card>

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

