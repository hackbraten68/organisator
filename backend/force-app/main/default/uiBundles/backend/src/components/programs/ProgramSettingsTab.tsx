import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { updateProgram } from "@/api/program/programService";
import {
  PROGRAM_STATUSES,
  type Program,
  type ProgramStatus,
} from "@/types/program";

interface ProgramSettingsTabProps {
  program: Program;
  onChanged: () => void;
}

export default function ProgramSettingsTab({
  program,
  onChanged,
}: ProgramSettingsTabProps) {
  const [status, setStatus] = useState<ProgramStatus>(program.status);
  const [saving, setSaving] = useState(false);

  // Reset the local selection whenever a freshly saved program arrives.
  const isDirty = status !== program.status;

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateProgram(program.id, { status });
      if (!saved) {
        throw new Error("Program could not be saved.");
      }
      toast.success("Program status updated", { description: saved.name });
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Saving failed";
      toast.error("Saving failed", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Control the lifecycle state of this program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ProgramStatus)}
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
          <p className="text-xs text-muted-foreground">
            Draft programs are hidden from reports, Archived programs are
            read-only history.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
