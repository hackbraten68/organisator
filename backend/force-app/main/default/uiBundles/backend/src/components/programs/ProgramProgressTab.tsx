import { } from "react";
import { AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listLearningPath } from "@/api/program/programService";
import {
  getParticipant,
  listProgramParticipants,
} from "@/api/participant/participantService";

interface Item {
  title: string;
  estimatedWeeks: number;
  status: string;
}

interface ParticipantProgress {
  id: string;
  name: string;
  startDate: Date;
  items: Item[];
  totalWeeks: number;
}

function weekIndex(date: Date, origin: Date): number {
  const ms = date.getTime() - origin.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

export default function ProgramProgressTab({ programId }: { programId: string }) {
  const { data, loading, error } = useAsyncData<ParticipantProgress[]>(
    async () => {
      const assigned = await listProgramParticipants(programId);
      return Promise.all(
        assigned.map(async (p) => {
          const full = await getParticipant(p.id);
          const items = await listLearningPath(p.id);
          const start = full?.startDate ? new Date(full.startDate) : new Date();
          const mapped: Item[] = items.map((i) => ({
            title: i.title,
            estimatedWeeks: i.estimatedWeeks ?? 1,
            status: i.status,
          }));
          const totalWeeks = mapped.reduce((s, i) => s + i.estimatedWeeks, 0);
          return { id: p.id, name: p.name, startDate: start, items: mapped, totalWeeks };
        }),
      );
    },
    [programId],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Failed to load progress</AlertTitle>
        <AlertDescription>Try again later.</AlertDescription>
      </Alert>
    );
  }
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="size-10 mx-auto mb-3" />
          No participants assigned yet.
        </CardContent>
      </Card>
    );
  }

  // Build week columns from earliest start to latest planned end.
  const minStart = new Date(Math.min(...data.map((p) => p.startDate.getTime())));
  const maxEnd = new Date(
    Math.max(
      ...data.map((p) => p.startDate.getTime() + p.totalWeeks * 7 * 24 * 60 * 60 * 1000),
    ),
  );
  const totalWeeks = weekIndex(maxEnd, minStart) + 1;
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i);

  const colorFor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-green-500";
      case "In Progress":
        return "bg-blue-500";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant progress (calendar weeks)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-max">
          <div className="flex text-xs text-muted-foreground mb-1">
            <div className="w-40 shrink-0" />
            {weeks.map((w) => (
              <div key={w} className="w-6 text-center">
                {w + 1}
              </div>
            ))}
          </div>
          {data.map((p) => {
            // Build per-week status array.
            const weekStatus: (string | null)[] = Array(totalWeeks).fill(null);
            let weekCursor = weekIndex(p.startDate, minStart);
            for (const item of p.items) {
              for (let k = 0; k < item.estimatedWeeks; k++) {
                const idx = weekCursor + k;
                if (idx >= 0 && idx < totalWeeks) weekStatus[idx] = item.status;
              }
              weekCursor += item.estimatedWeeks;
            }
            return (
              <div key={p.id} className="flex items-center mb-1">
                <div className="w-40 shrink-0 text-sm font-medium truncate pr-2">
                  {p.name}
                </div>
                {weeks.map((w) => {
                  const st = weekStatus[w];
                  return (
                    <div
                      key={w}
                      className={`w-6 h-6 mx-0.5 rounded ${st ? colorFor(st) : "bg-transparent"}`}
                      title={st ?? ""}
                    />
                  );
                })}
                <Badge className="ml-3" variant="secondary">
                  {p.items.filter((i) => i.status === "Completed").length}/
                  {p.items.length}
                </Badge>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-300" /> Planned
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500" /> In progress
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500" /> Completed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}