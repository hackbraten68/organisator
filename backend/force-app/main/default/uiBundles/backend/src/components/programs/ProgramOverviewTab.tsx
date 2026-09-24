import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  listModules,
  listProgramParticipants,
} from "@/api/program/programService";
import type { Program } from "@/types/program";

interface ProgramOverviewTabProps {
  program: Program;
  refreshKey: number;
  onEdit: () => void;
}

export default function ProgramOverviewTab({
  program,
  refreshKey,
  onEdit,
}: ProgramOverviewTabProps) {
  const { data, loading } = useAsyncData(async () => {
    const [moduleList, participantList] = await Promise.all([
      listModules(program.id),
      listProgramParticipants(program.id),
    ]);
    return { modules: moduleList, participants: participantList };
  }, [program.id, refreshKey]);

  const stats = [
    {
      label: "Participants",
      value: loading ? null : (data?.participants.length ?? 0),
    },
    { label: "Coaches", value: program.coachIds.length },
    {
      label: "Modules",
      value: loading ? null : (data?.modules.length ?? 0),
    },
    {
      label: "Duration",
      value:
        program.durationWeeks !== undefined
          ? `${program.durationWeeks} weeks`
          : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stat.value === null ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>About this program</CardTitle>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {program.description || "No description yet."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
