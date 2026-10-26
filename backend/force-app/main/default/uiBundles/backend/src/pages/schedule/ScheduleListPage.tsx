import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import ScheduleTimeStatusBadge, { timeStatus } from "@/components/schedule/ScheduleTimeStatusBadge";
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

  // Collect coaches
  const coaches = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const week of weeks) {
      for (const plan of week.plans) {
        if (plan.coachName && !seen.has(plan.coachName)) {
          seen.add(plan.coachName);
          result.push({ id: plan.coachName, name: plan.coachName });
        }
      }
    }
    return result;
  }, [weeks]);

  // Filter plans within each week
  const filteredWeeks = useMemo(() => {
    return weeks.map((week) => {
      const filteredPlans = week.plans.filter((plan) => {
        if (scopeFilter !== "all" && plan.scopeType !== scopeFilter) return false;
        if (statusFilter !== "all" && plan.status !== statusFilter) return false;
        if (timeFilter !== "all" && timeStatus(plan) !== timeFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !(plan.participantName?.toLowerCase().includes(q) ?? false) &&
            !(plan.participantGroupName?.toLowerCase().includes(q) ?? false) &&
            !plan.name.toLowerCase().includes(q)
          ) return false;
        }
        if (coachFilter !== "all" && plan.coachName !== coachFilter) return false;
        return true;
      });
      return { ...week, plans: filteredPlans };
    }).filter((w) => hasActiveFilters ? w.plans.length > 0 : true);
  }, [weeks, scopeFilter, statusFilter, timeFilter, search, coachFilter]);

  const hasActiveFilters = scopeFilter !== "all" || statusFilter !== "all" || timeFilter !== "current" || search.trim() !== "" || coachFilter !== "all";

  const resetFilters = () => {
    setScopeFilter("all");
    setStatusFilter("all");
    setTimeFilter("current");
    setSearch("");
    setCoachFilter("all");
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

      {/* Filter bar in shadcn style */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={effectiveProgramId} onValueChange={setSelectedProgramId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Programm" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Scopes</SelectItem>
            <SelectItem value="Course">Kurs</SelectItem>
            <SelectItem value="Group">Gruppe</SelectItem>
            <SelectItem value="Individual">Individuell</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="Draft">Entwurf</SelectItem>
            <SelectItem value="Published">Veröffentlicht</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Aktuell</SelectItem>
            <SelectItem value="future">Zukünftig</SelectItem>
            <SelectItem value="past">Vergangen</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>

        {coaches.length > 0 && (
          <Select value={coachFilter} onValueChange={setCoachFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Coach" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Coaches</SelectItem>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Teilnehmer suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[200px]"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Weeks as cards (original layout) */}
      {filteredWeeks.map((week) => {
        if (week.plans.length === 0) return null;
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
                  onClick={() => {
                    setPlanDialogWeekId(week.programWeekId);
                    setPlanDialogPlan(null);
                    setPlanDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Plan anlegen
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {week.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between border rounded-md p-3"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <ScheduleTimeStatusBadge status={timeStatus(plan)} />
                      <ScheduleStatusBadge status={plan.status} />
                      <ScheduleScopeBadge scope={plan.scopeType} />
                      <span className="font-medium">{plan.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {plan.scopeType === "Group"
                          ? plan.participantGroupName ?? "–"
                          : plan.scopeType === "Individual"
                            ? plan.participantName ?? "–"
                            : ""}
                      </span>
                      {plan.coachName && (
                        <span className="text-xs text-muted-foreground">
                          Coach: {plan.coachName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {plan.startDate ?? "–"}{plan.endDate ? ` – ${plan.endDate}` : ""} · {plan.entryCount} Einträge
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
                          onClick={async () => {
                            if (!window.confirm(`Plan "${plan.name}" wirklich löschen?`)) return;
                            try {
                              await deleteSchedulePlan(plan.id);
                              toast.success("Plan gelöscht.");
                              refresh();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Fehler beim Löschen.");
                            }
                          }}
                        >
                          Löschen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {filteredWeeks.every((w) => w.plans.length === 0) && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Für die gewählten Filter wurden keine Wochenpläne gefunden.
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
