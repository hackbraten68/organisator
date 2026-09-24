import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ListOrdered,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  addLearningPathItem,
  deleteLearningPathItem,
  listLearningPath,
  reorderLearningPathItems,
  updateLearningPathItem,
} from "@/api/program/programService";
import {
  LEARNING_PATH_STATUSES,
  type LearningPathItemStatus,
} from "@/types/program";

interface ParticipantLearningPathProps {
  participantId: string;
  participantName: string;
  programId?: string;
}

/**
 * Participant-specific curriculum. A Program defines duration and framework;
 * the actual learning path is assembled individually per participant and may
 * differ significantly between participants of the same program.
 */
export default function ParticipantLearningPath({
  participantId,
  participantName,
  programId,
}: ParticipantLearningPathProps) {
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState("");
  const [status, setStatus] = useState<LearningPathItemStatus>("Planned");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, loading, error } = useAsyncData(
    () => listLearningPath(participantId),
    [participantId, reload],
  );

  const items = data ?? [];
  const refresh = () => setReload((value) => value + 1);

  async function handleAdd() {
    if (programId === undefined) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      setFormError("Title is required.");
      return;
    }

    let estimatedWeeks: number | undefined;
    if (weeks.trim() !== "") {
      const parsed = Number(weeks);
      if (!Number.isInteger(parsed) || parsed < 1) {
        setFormError("Estimated weeks must be a positive whole number.");
        return;
      }
      estimatedWeeks = parsed;
    }

    setAdding(true);
    setFormError(null);
    try {
      await addLearningPathItem(participantId, programId, {
        title: trimmedTitle,
        estimatedWeeks,
        status,
      });
      toast.success("Learning path item added", {
        description: trimmedTitle,
      });
      setTitle("");
      setWeeks("");
      setStatus("Planned");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Adding failed";
      setFormError(message);
      toast.error("Adding failed", { description: message });
    } finally {
      setAdding(false);
    }
  }

  async function handleStatusChange(id: string, next: LearningPathItemStatus) {
    try {
      await updateLearningPathItem(id, { status: next });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error("Update failed", { description: message });
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ordered.length) return;

    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);

    try {
      await reorderLearningPathItems(
        participantId,
        ordered.map((item) => item.id),
      );
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reorder failed";
      toast.error("Reorder failed", { description: message });
    }
  }

  async function handleDelete(id: string, itemTitle: string) {
    const confirmed = window.confirm(
      `Remove "${itemTitle}" from the learning path?`,
    );
    if (!confirmed) return;
    try {
      await deleteLearningPathItem(id);
      toast.success("Learning path item removed", {
        description: itemTitle,
      });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error("Delete failed", { description: message });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Path</CardTitle>
        <CardDescription>
          Individual curriculum for {participantName} — independent of other
          participants in the same program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {programId === undefined && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Assign a program first to build an individual learning path.
          </p>
        )}

        {programId !== undefined && loading && <LearningPathSkeleton />}

        {programId !== undefined && error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertTitle>
              <h2>Failed to load learning path</h2>
            </AlertTitle>
            <AlertDescription>
              Something went wrong while loading the learning path. Please try
              again later.
            </AlertDescription>
          </Alert>
        )}

        {programId !== undefined && !loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ListOrdered className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">No learning path yet</p>
            <p className="text-sm text-muted-foreground">
              Add the first certification or training block below.
            </p>
          </div>
        )}

        {programId !== undefined && !loading && !error && items.length > 0 && (
          <ul className="divide-y rounded-md border">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.estimatedWeeks !== undefined
                      ? `~${item.estimatedWeeks} weeks`
                      : "No estimate"}
                  </p>
                </div>
                <Select
                  value={item.status}
                  onValueChange={(value) =>
                    handleStatusChange(item.id, value as LearningPathItemStatus)
                  }
                >
                  <SelectTrigger className="w-36" aria-label={`Status of ${item.title}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNING_PATH_STATUSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onClick={() => handleMove(item.id, -1)}
                  >
                    <ChevronUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${item.title} down`}
                    disabled={index === items.length - 1}
                    onClick={() => handleMove(item.id, 1)}
                  >
                    <ChevronDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => handleDelete(item.id, item.title)}
                  >
                    <Trash2
                      className="size-4 text-destructive"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {programId !== undefined && (
          <div className="space-y-4 rounded-md border p-4">
            <p className="text-sm font-medium">Add certification or training block</p>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px_160px]">
              <div className="space-y-2">
                <Label htmlFor="learning-path-title">Title</Label>
                <Input
                  id="learning-path-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. KCNA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="learning-path-weeks">Weeks (est.)</Label>
                <Input
                  id="learning-path-weeks"
                  type="number"
                  min={1}
                  step={1}
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  placeholder="e.g. 6"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as LearningPathItemStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEARNING_PATH_STATUSES.map((option) => (
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

            <div className="flex justify-end">
              <Button onClick={handleAdd} disabled={adding}>
                <Plus className="size-4" aria-hidden="true" />
                {adding ? "Adding…" : "Add to Learning Path"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LearningPathSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-12 w-full" />
      ))}
    </div>
  );
}
