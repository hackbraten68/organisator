import { useState } from "react";
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
  createProgram,
  updateProgram,
} from "@/api/program/programService";
import {
  PROGRAM_STATUSES,
  type Program,
  type ProgramStatus,
} from "@/types/program";

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = create mode, set = edit mode. */
  program: Program | null;
  onSaved: (program: Program) => void;
}

export default function ProgramFormDialog({
  open,
  onOpenChange,
  program,
  onSaved,
}: ProgramFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState<ProgramStatus>("Draft");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset the editable copy whenever the dialog opens (create vs. edit
  // mode, or a different program). This is the documented "adjust state
  // when props change" pattern — no effect needed.
  const [prevResetKey, setPrevResetKey] = useState<string | null>(null);
  const resetKey = open ? `open:${program?.id ?? "new"}` : "closed";
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setName(program?.name ?? "");
      setDescription(program?.description ?? "");
      setDuration(
        program?.durationWeeks !== undefined
          ? String(program.durationWeeks)
          : "",
      );
      setStatus(program?.status ?? "Draft");
      setFormError(null);
      setSaving(false);
    }
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      setFormError("Name is required.");
      return;
    }

    let durationWeeks: number | undefined;
    if (duration.trim() !== "") {
      const parsed = Number(duration);
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormError("Duration must be a positive whole number of weeks.");
        return;
      }
      durationWeeks = parsed;
    }

    setSaving(true);
    setFormError(null);
    try {
      const saved = program
        ? await updateProgram(program.id, {
            name: trimmedName,
            description: description.trim() || undefined,
            durationWeeks,
            status,
          })
        : await createProgram({
            name: trimmedName,
            description: description.trim() || undefined,
            durationWeeks,
            status,
          });

      if (!saved) {
        throw new Error("Program could not be saved.");
      }

      toast.success(
        program ? "Program updated" : "Program created",
        { description: saved.name },
      );
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Saving failed";
      setFormError(message);
      toast.error("Saving failed", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {program ? "Edit Program" : "Create Program"}
          </DialogTitle>
          <DialogDescription>
            {program
              ? "Update the program details below."
              : "Create a new training program. Modules, participants and coaches can be added afterwards."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="program-name">Name</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Pro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="program-description">Description</Label>
            <Input
              id="program-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this program about?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-duration">Duration (weeks)</Label>
              <Input
                id="program-duration"
                type="number"
                min={1}
                step={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 24"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ProgramStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save Program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
