import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  createModule,
  deleteModule,
  listModules,
  reorderModules,
  updateModule,
} from "@/api/program/programService";
import type { ProgramModule } from "@/types/program";

export default function ProgramModulesTab({
  programId,
}: {
  programId: string;
}) {
  const [reload, setReload] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramModule | null>(null);

  const { data, loading, error } = useAsyncData(
    () => listModules(programId),
    [programId, reload],
  );

  const modules = data ?? [];
  const refresh = () => setReload((value) => value + 1);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(module: ProgramModule) {
    setEditing(module);
    setDialogOpen(true);
  }

  async function handleDelete(module: ProgramModule) {
    const confirmed = window.confirm(
      `Delete module "${module.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteModule(module.id);
      toast.success("Module deleted", { description: module.name });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const ordered = [...modules].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((m) => m.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;

    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);

    try {
      await reorderModules(
        programId,
        ordered.map((m) => m.id),
      );
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reorder failed";
      toast.error("Reorder failed", { description: message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Modules</h2>
          <p className="text-sm text-muted-foreground">
            Reusable content templates — each participant follows their own
            individual learning path.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Add Module
        </Button>
      </div>

      {loading && <ModulesSkeleton />}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Failed to load modules</h2>
          </AlertTitle>
          <AlertDescription>
            Something went wrong while loading modules. Please try again
            later.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && modules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ListOrdered className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No modules yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Structure the program content by adding its first module.
            </p>
            <Button onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add Module
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && modules.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {modules.map((module, index) => (
              <div
                key={module.id}
                className="flex items-center gap-3 p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{module.name}</p>
                  {module.description && (
                    <p className="truncate text-sm text-muted-foreground">
                      {module.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${module.name} up`}
                    disabled={index === 0}
                    onClick={() => handleMove(module.id, -1)}
                  >
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${module.name} down`}
                    disabled={index === modules.length - 1}
                    onClick={() => handleMove(module.id, 1)}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${module.name}`}
                    onClick={() => openEdit(module)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${module.name}`}
                    onClick={() => handleDelete(module)}
                  >
                    <Trash2
                      className="size-4 text-destructive"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ModuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        programId={programId}
        module={editing}
        onSaved={refresh}
      />
    </div>
  );
}

function ModuleFormDialog({
  open,
  onOpenChange,
  programId,
  module,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  module: ProgramModule | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reset(next: ProgramModule | null) {
    setName(next?.name ?? "");
    setDescription(next?.description ?? "");
    setFormError(null);
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) reset(module);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {module ? "Edit Module" : "Add Module"}
          </DialogTitle>
          <DialogDescription>
            {module
              ? "Update the module details below."
              : "Add a new module to structure the program content."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="module-name">Name</Label>
            <Input
              id="module-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Networking"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Description</Label>
            <Input
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this module cover?"
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              const trimmedName = name.trim();
              if (trimmedName === "") {
                setFormError("Name is required.");
                return;
              }
              setSaving(true);
              setFormError(null);
              try {
                if (module) {
                  await updateModule(module.id, {
                    name: trimmedName,
                    description: description.trim() || undefined,
                  });
                  toast.success("Module updated", {
                    description: trimmedName,
                  });
                } else {
                  await createModule(programId, {
                    name: trimmedName,
                    description: description.trim() || undefined,
                  });
                  toast.success("Module added", {
                    description: trimmedName,
                  });
                }
                onSaved();
                onOpenChange(false);
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "Saving failed";
                setFormError(message);
                toast.error("Saving failed", { description: message });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : module ? "Save Module" : "Add Module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModulesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
