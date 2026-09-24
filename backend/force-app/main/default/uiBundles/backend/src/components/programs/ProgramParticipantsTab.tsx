import { useMemo, useState } from "react";
import { AlertCircle, UserMinus, UserPlus, Users } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  getLearningPathProgress,
  getProgram,
  listLearningPath,
  listPrograms,
} from "@/api/program/programService";
import {
  assignParticipant,
  listProgramParticipants,
  searchParticipants,
  unassignParticipant,
} from "@/api/participant/participantService";

interface ParticipantRow {
  id: string;
  name: string;
  durationWeeks?: number;
  roadmap: string;
  total: number;
  completed: number;
  percent: number;
}

export default function ProgramParticipantsTab({
  programId,
}: {
  programId: string;
}) {
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    name: string;
    fromProgramId: string;
  } | null>(null);

  const {
    data: assigned,
    loading: loadingAssigned,
    error: assignedError,
  } = useAsyncData<ParticipantRow[]>(async () => {
    const [program, assignedList] = await Promise.all([
      getProgram(programId),
      listProgramParticipants(programId),
    ]);
    const durationWeeks = program?.durationWeeks;
    return Promise.all(
      assignedList.map(async (participant) => {
        const [items, progress] = await Promise.all([
          listLearningPath(participant.id),
          getLearningPathProgress(participant.id),
        ]);
        return {
          id: participant.id,
          name: participant.name,
          durationWeeks,
          roadmap: items.map((item) => item.title).join(" → "),
          total: progress.total,
          completed: progress.completed,
          percent: progress.percent,
        };
      }),
    );
  }, [programId, reload]);

  const { data: candidates, loading: loadingCandidates } = useAsyncData(
    () => searchParticipants(search),
    [search, reload],
  );

  const { data: programs } = useAsyncData(() => listPrograms(), [reload]);
  const programNames = useMemo(
    () => new Map((programs ?? []).map((p) => [p.id, p.name])),
    [programs],
  );
  const currentProgramName = programNames.get(programId) ?? "this program";

  const assignedIds = useMemo(
    () => new Set((assigned ?? []).map((p) => p.id)),
    [assigned],
  );
  const available = useMemo(
    () => (candidates ?? []).filter((p) => !assignedIds.has(p.id)),
    [candidates, assignedIds],
  );

  const refresh = () => setReload((value) => value + 1);

  async function handleAssign(participantId: string, name: string) {
    try {
      await assignParticipant(participantId, programId);
      toast.success("Participant assigned", { description: name });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assign failed";
      toast.error("Assign failed", { description: message });
    }
  }

  // A participant can only be in one program (Participant__c.Program__c is a
  // single lookup), so assigning someone who already has a different program
  // moves them — ask for confirmation first.
  function requestAssign(participant: {
    id: string;
    name: string;
    programId?: string;
  }) {
    if (participant.programId && participant.programId !== programId) {
      setPendingMove({
        id: participant.id,
        name: participant.name,
        fromProgramId: participant.programId,
      });
      return;
    }
    void handleAssign(participant.id, participant.name);
  }

  async function confirmMove() {
    if (!pendingMove) return;
    const { id, name } = pendingMove;
    setPendingMove(null);
    await handleAssign(id, name);
  }

  async function handleRemove(participantId: string, name: string) {
    try {
      await unassignParticipant(participantId);
      toast.success("Participant removed", { description: name });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Remove failed";
      toast.error("Remove failed", { description: message });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assigned Participants</CardTitle>
          <CardDescription>
            Participants currently enrolled in this program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAssigned && <ParticipantsSkeleton />}

          {assignedError && (
            <Alert variant="destructive" role="alert">
              <AlertCircle />
              <AlertTitle>
                <h2>Failed to load participants</h2>
              </AlertTitle>
              <AlertDescription>
                Something went wrong while loading participants. Please try
                again later.
              </AlertDescription>
            </Alert>
          )}

          {!loadingAssigned && !assignedError && (assigned ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No participants assigned yet. Use the search below to add some.
            </p>
          )}

          {!loadingAssigned &&
            !assignedError &&
            (assigned ?? []).length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Learning Path</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(assigned ?? []).map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">
                        {participant.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {participant.durationWeeks !== undefined
                          ? `${participant.durationWeeks} weeks`
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-sm">
                        {participant.roadmap !== "" ? (
                          participant.roadmap
                        ) : (
                          <span className="text-muted-foreground">
                            No learning path yet
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-24 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuenow={participant.percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Learning path progress for ${participant.name}`}
                          >
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${participant.percent}%` }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {participant.completed}/{participant.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${participant.name}`}
                          onClick={() =>
                            handleRemove(participant.id, participant.name)
                          }
                        >
                          <UserMinus
                            className="size-4 text-destructive"
                            aria-hidden="true"
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Participant</CardTitle>
          <CardDescription>
            Search all participants and assign them to this program.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="participant-search">Search</Label>
            <Input
              id="participant-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
            />
          </div>

          {loadingCandidates && <ParticipantsSkeleton />}

          {!loadingCandidates && available.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              {search.trim() === ""
                ? "All participants are already assigned to this program."
                : "No matching participants found."}
            </p>
          )}

          {!loadingCandidates && available.length > 0 && (
            <ul className="divide-y rounded-md border">
              {available.map((participant) => {
                const fromName =
                  participant.programId !== undefined
                    ? (programNames.get(participant.programId) ??
                      "another program")
                    : null;
                return (
                  <li
                    key={participant.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Users
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium">
                        {participant.name}
                      </span>
                      {fromName !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          In {fromName}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => requestAssign(participant)}
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                      Assign
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={pendingMove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move participant?</DialogTitle>
            <DialogDescription>
              {pendingMove !== null
                ? `${pendingMove.name} is currently assigned to ${
                    programNames.get(pendingMove.fromProgramId) ??
                    "another program"
                  }. Assigning them to ${currentProgramName} will move them — a participant can only be in one program at a time.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingMove(null)}>
              Cancel
            </Button>
            <Button onClick={confirmMove}>Move participant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParticipantsSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}
