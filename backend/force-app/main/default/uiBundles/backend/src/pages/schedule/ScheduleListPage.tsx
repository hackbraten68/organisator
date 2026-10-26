import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  listScheduleBoard,
  deleteSchedulePlan,
} from "@/api/schedule/scheduleEditorService";
import ScheduleStatusBadge from "@/components/schedule/ScheduleStatusBadge";
import ScheduleScopeBadge from "@/components/schedule/ScheduleScopeBadge";
import SchedulePlanDialog from "@/components/schedule/SchedulePlanDialog";
import type { SchedulePlan, ScheduleWeek } from "@/types/schedule";

export default function ScheduleListPage() {
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((v) => v + 1);

  const { data: board, loading, error } = useAsyncData(
    () => listScheduleBoard(),
    [reload],
  );

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDialogWeekId, setPlanDialogWeekId] = useState<string>("");
  const [planDialogPlan, setPlanDialogPlan] = useState<SchedulePlan | null>(null);

  const programs = board?.programs ?? [];
  const effectiveProgramId = selectedProgramId || programs[0]?.id || "";

  const { data: programBoard } = useAsyncData(
    () => (effectiveProgramId ? listScheduleBoard(effectiveProgramId) : Promise.resolve(null)),
    [effectiveProgramId, reload],
  );

  const weeks = programBoard?.weeks ?? [];

  const openPlanDialog = (weekId: string, plan: SchedulePlan | null) => {
    setPlanDialogWeekId(weekId);
    setPlanDialogPlan(plan);
    setPlanDialogOpen(true);
  };

  const handleDelete = async (plan: SchedulePlan) => {
    if (!window.confirm(`Plan "${plan.name}" wirklich löschen?`)) return;
    try {
      await deleteSchedulePlan(plan.id);
      toast.success("Plan gelöscht.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wochenplan</h1>
        <div className="flex items-center gap-3">
          <Select value={effectiveProgramId} onValueChange={setSelectedProgramId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Programm wählen" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {weeks.map((week: ScheduleWeek) => {
        return (
          <Card key={week.programWeekId}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Woche {week.weekNumber ?? "–"} – {week.name ?? "Ohne Name"}
                  {week.moduleName ? ` (${week.moduleName})` : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openPlanDialog(week.programWeekId, null)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Plan anlegen
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {week.plans.length === 0 ? (
                <div className="text-sm text-muted-foreground">Kein Plan vorhanden.</div>
              ) : (
                <div className="space-y-2">
                  {week.plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div className="flex items-center gap-3">
                        <ScheduleStatusBadge status={plan.status} />
                        <span className="font-medium">{plan.name}</span>
                        <ScheduleScopeBadge scope={plan.scopeType} />
                        <span className="text-xs text-muted-foreground">
                          {plan.scopeType === "Group"
                            ? plan.participantGroupName ?? "–"
                            : plan.scopeType === "Individual"
                              ? plan.participantName ?? "–"
                              : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Start: {plan.startDate ?? "–"} · {plan.entryCount} Einträge
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/wochenplan/${plan.id}`)}
                        >
                          Öffnen
                        </Button>
                        {plan.status === "Draft" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(plan)}
                          >
                            Löschen
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <SchedulePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        programWeekId={planDialogWeekId}
        programId={effectiveProgramId}
        plan={planDialogPlan}
        existingScopes={
          weeks.find((w) => w.programWeekId === planDialogWeekId)?.plans.map((p) => p.scopeType) ?? []
        }
        onSaved={refresh}
      />
    </div>
  );
}
