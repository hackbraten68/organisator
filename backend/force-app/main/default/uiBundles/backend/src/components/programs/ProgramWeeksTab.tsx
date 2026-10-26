import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  createProgramWeek,
  deleteProgramWeek,
  listModules,
  listProgramWeeks,
  updateProgramWeek,
} from "@/api/program/programService";
import type { ProgramWeek } from "@/types/program";

export default function ProgramWeeksTab({ programId }: { programId: string }) {
  const [reload, setReload] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramWeek | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: weeks, loading, error } = useAsyncData(
    () => listProgramWeeks(programId),
    [programId, reload],
  );
  const { data: modules } = useAsyncData(() => listModules(programId), [programId]);

  const moduleList = modules ?? [];
  const weekList = weeks ?? [];
  const refresh = () => setReload((v) => v + 1);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [description, setDescription] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setNumber(String(weekList.length + 1));
    setModuleId(moduleList[0]?.id ?? "");
    setStatus("Draft");
    setDescription("");
    setDialogOpen(true);
  }

  function openEdit(week: ProgramWeek) {
    setEditing(week);
    setName(week.name);
    setNumber(String(week.number));
    setModuleId(week.moduleId);
    setStatus(week.status);
    setDescription(week.description ?? "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    if (!moduleId) {
      toast.error("Modul ist erforderlich.");
      return;
    }
    const num = Number(number);
    if (!Number.isInteger(num) || num < 1) {
      toast.error("Nummer muss eine positive ganze Zahl sein.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateProgramWeek(editing.id, {
          name: name.trim(),
          number: num,
          status,
          description: description.trim() || undefined,
          moduleId,
        });
        toast.success("Kurswoche aktualisiert.");
      } else {
        await createProgramWeek(programId, {
          name: name.trim(),
          moduleId,
          number: num,
          status,
          description: description.trim() || undefined,
        });
        toast.success("Kurswoche angelegt.");
      }
      setDialogOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(week: ProgramWeek) {
    if (!window.confirm(`Kurswoche "${week.name}" wirklich löschen?`)) return;
    try {
      await deleteProgramWeek(week.id);
      toast.success("Kurswoche gelöscht.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kurswochen</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Kurswoche anlegen
        </Button>
      </div>

      {weekList.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Kurswochen. Erste Kurswoche anlegen.
        </div>
      ) : (
        <div className="space-y-2">
          {weekList.map((week) => (
            <div
              key={week.id}
              className="flex items-center justify-between border rounded-md p-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  Woche {week.number} – {week.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  Modul: {moduleList.find((m) => m.id === week.moduleId)?.name ?? "–"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Status: {week.status}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(week)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(week)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Kurswoche bearbeiten" : "Kurswoche anlegen"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="week-name">Name</Label>
              <Input
                id="week-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Modul</Label>
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Modul wählen" />
                </SelectTrigger>
                <SelectContent>
                  {moduleList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="week-number">Nummer</Label>
                <Input
                  id="week-number"
                  type="number"
                  min={1}
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="week-desc">Beschreibung</Label>
              <Textarea
                id="week-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
