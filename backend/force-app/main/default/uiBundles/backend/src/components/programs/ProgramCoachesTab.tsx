import { useState } from "react";
import { AlertCircle, GraduationCap, UserMinus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  assignCoach,
  listAvailableCoaches,
  listProgramCoaches,
  unassignCoach,
} from "@/api/program/programService";

interface ProgramCoachesTabProps {
  programId: string;
  onChanged: () => void;
}

export default function ProgramCoachesTab({
  programId,
  onChanged,
}: ProgramCoachesTabProps) {
  const [reload, setReload] = useState(0);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");

  const {
    data: assigned,
    loading: loadingAssigned,
    error: assignedError,
  } = useAsyncData(() => listProgramCoaches(programId), [
    programId,
    reload,
  ]);

  const { data: available, loading: loadingAvailable } = useAsyncData(
    () => listAvailableCoaches(programId),
    [programId, reload],
  );

  const refresh = () => {
    setReload((value) => value + 1);
    setSelectedCoachId("");
    onChanged();
  };

  async function handleAssign() {
    if (selectedCoachId === "") return;
    const coach = (available ?? []).find((c) => c.id === selectedCoachId);
    try {
      await assignCoach(programId, selectedCoachId);
      toast.success("Coach assigned", { description: coach?.name });
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assign failed";
      toast.error("Assign failed", { description: message });
    }
  }

  async function handleRemove(coachId: string, name: string) {
    try {
      await unassignCoach(programId, coachId);
      toast.success("Coach removed", { description: name });
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
          <CardTitle>Assigned Coaches</CardTitle>
          <CardDescription>
            Coaches responsible for this program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAssigned && <CoachesSkeleton />}

          {assignedError && (
            <Alert variant="destructive" role="alert">
              <AlertCircle />
              <AlertTitle>
                <h2>Failed to load coaches</h2>
              </AlertTitle>
              <AlertDescription>
                Something went wrong while loading coaches. Please try again
                later.
              </AlertDescription>
            </Alert>
          )}

          {!loadingAssigned && !assignedError && (assigned ?? []).length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No coaches assigned yet. Assign one below.
            </p>
          )}

          {!loadingAssigned && !assignedError && (assigned ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(assigned ?? []).map((coach) => (
                  <TableRow key={coach.id}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <GraduationCap
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {coach.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${coach.name}`}
                        onClick={() => handleRemove(coach.id, coach.name)}
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
          <CardTitle>Assign Coach</CardTitle>
          <CardDescription>
            Add a coach to this program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAvailable && <CoachesSkeleton />}

          {!loadingAvailable && (available ?? []).length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              All coaches are already assigned to this program.
            </p>
          )}

          {!loadingAvailable && (available ?? []).length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Coach</Label>
                <Select
                  value={selectedCoachId}
                  onValueChange={setSelectedCoachId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a coach" />
                  </SelectTrigger>
                  <SelectContent>
                    {(available ?? []).map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAssign}
                disabled={selectedCoachId === ""}
              >
                Assign Coach
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CoachesSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}
