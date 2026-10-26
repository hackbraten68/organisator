import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  listScheduleBoard,
  deleteSchedulePlan,
} from "@/api/schedule/scheduleEditorService";
import ScheduleFilterBar from "@/components/schedule/ScheduleFilterBar";
import SchedulePlanDialog from "@/components/schedule/SchedulePlanDialog";
import SchedulePlanTable from "@/components/schedule/SchedulePlanTable";
import { timeStatus } from "@/components/schedule/ScheduleTimeStatusBadge";
import type { SchedulePlan } from "@/types/schedule";

export default function ScheduleListPage() {
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((v) => v + 1);

  const { data: board, loading, error } = useAsyncData(
    () => listScheduleBoard(),
    [reload],
  );

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("current");
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("all");
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

  // Flatten all plans
  const allPlans = useMemo(() => {
    const plans: (SchedulePlan & { weekNumber?: number | null; weekName?: string | null; moduleName?: string | null })[] = [];
    for (const week of weeks) {
      for (const plan of week.plans) {
        plans.push({ ...plan, weekNumber: week.weekNumber, weekName: week.name, moduleName: week.moduleName });
      }
    }
    return plans;
  }, [weeks]);

  // Collect coaches
  const coaches = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const plan of allPlans) {
      if (plan.coachName && !seen.has(plan.coachName)) {
        seen.add(plan.coachName);
        result.push({ id: plan.coachName, name: plan.coachName });
      }
    }
    return result;
  }, [allPlans]);

  // Filter
  const filteredPlans = useMemo(() => {
    let result = allPlans;
    if (scopeFilter !== "all") {
      result = result.filter((p) => p.scopeType === scopeFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (timeFilter !== "all") {
      result = result.filter((p) => timeStatus(p) === timeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        (p.participantName?.toLowerCase().includes(q) ?? false) ||
        (p.participantGroupName?.toLowerCase().includes(q) ?? false) ||
        (p.name.toLowerCase().includes(q))
      );
    }
    if (coachFilter !== "all") {
      result = result.filter((p) => p.coachName === coachFilter);
    }
    // Sort
    const statusOrder = { current: 0, future: 1, past: 2 };
    const draftOrder = { Draft: 0, Published: 1 };
    return [...result].sort((a, b) => {
      const ta = timeStatus(a), tb = timeStatus(b);
      if (ta !== tb) return statusOrder[ta] - statusOrder[tb];
      if (a.status !== b.status) return draftOrder[a.status as keyof typeof draftOrder] - draftOrder[b.status as keyof typeof draftOrder];
      return (a.startDate ?? '').localeCompare(b.startDate ?? '');
    });
  }, [allPlans, scopeFilter, statusFilter, timeFilter, search, coachFilter]);

  const resetFilters = () => {
    setScopeFilter("all");
    setStatusFilter("all");
    setTimeFilter("current");
    setSearch("");
    setCoachFilter("all");
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
        <h1 className="text-2xl font-semibold">Wochenpläne</h1>
        <Button size="sm" variant="outline" onClick={() => navigate("/wochenplan/vorlagen")}>
          Vorlagen verwalten
        </Button>
      </div>

      <ScheduleFilterBar
        programId={effectiveProgramId}
        programs={programs}
        onProgramChange={setSelectedProgramId}
        scopeFilter={scopeFilter}
        onScopeChange={setScopeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        timeFilter={timeFilter}
        onTimeChange={setTimeFilter}
        search={search}
        onSearchChange={setSearch}
        coachFilter={coachFilter}
        onCoachChange={setCoachFilter}
        coaches={coaches}
        onReset={resetFilters}
      />

      {filteredPlans.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          {allPlans.length === 0
            ? "In diesem Programm wurden noch keine Kurswochen angelegt. Kurswoche anlegen unter Programs → Kurswochen."
            : "Für die gewählten Filter wurden keine Wochenpläne gefunden."}
        </div>
      ) : (
        <SchedulePlanTable plans={filteredPlans} onDelete={handleDelete} />
      )}

      {/* Plan anlegen: show for each week */}
      {weeks.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setPlanDialogWeekId(weeks[0].programWeekId);
              setPlanDialogPlan(null);
              setPlanDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Plan anlegen
          </Button>
        </div>
      )}

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
