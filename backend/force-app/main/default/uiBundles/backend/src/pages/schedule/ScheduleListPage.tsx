import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, User } from "lucide-react";
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
  getScheduleOptions,
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
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("current");
  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("all");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDialogWeekId, setPlanDialogWeekId] = useState<string>("");
  const [planDialogPlan, setPlanDialogPlan] = useState<SchedulePlan | null>(null);
  const [planDialogParticipantId, setPlanDialogParticipantId] = useState<string | null>(null);

  const programs = board?.programs ?? [];
  const effectiveProgramId = selectedProgramId || programs[0]?.id || "";

  const { data: programBoard } = useAsyncData(
    () => (effectiveProgramId ? listScheduleBoard(effectiveProgramId) : Promise.resolve(null)),
    [effectiveProgramId, reload],
  );

  const { data: options } = useAsyncData(
    () => (effectiveProgramId ? getScheduleOptions(effectiveProgramId) : Promise.resolve(null)),
    [effectiveProgramId],
  );

  const weeks = programBoard?.weeks ?? [];
  const participants = options?.participants ?? [];

  // All plans flattened
  const allPlans = useMemo(() => {
    const plans: SchedulePlan[] = [];
    for (const week of weeks) {
      for (const plan of week.plans) {
        plans.push(plan);
      }
    }
    return plans;
  }, [weeks]);

  // Coaches
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

  // Filtered plans for "all plans" view
  const hasActiveFilters = scopeFilter !== "all" || statusFilter !== "all" || timeFilter !== "current" || search.trim() !== "" || coachFilter !== "all" || selectedParticipantId !== "";


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

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wochenpläne</h1>
        <Button size="sm" variant="outline" onClick={() => navigate("/wochenplan/vorlagen")}>
          Vorlagen verwalten
        </Button>
      </div>

      {/* Participant selector - primary filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <label className="text-xs text-muted-foreground mb-1 block">Teilnehmer</label>
          <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
            <SelectTrigger>
              <SelectValue placeholder="Teilnehmer wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Teilnehmer</SelectItem>
              {participants.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <SelectTrigger className="w-[130px]">
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
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="Draft">Entwurf</SelectItem>
            <SelectItem value="Published">Veröffentlicht</SelectItem>
          </SelectContent>
        </Select>

        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[130px]">
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
            <SelectTrigger className="w-[130px]">
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
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[180px]"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => {
            setScopeFilter("all");
            setStatusFilter("all");
            setTimeFilter("current");
            setSearch("");
            setCoachFilter("all");
            setSelectedParticipantId("");
          }}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Participant header */}
      {selectedParticipant && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedParticipant.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Programm: {programs.find((p) => p.id === effectiveProgramId)?.name ?? "–"}
          </CardContent>
        </Card>
      )}

      {/* Weeks as cards */}
      {weeks.map((week) => {
        const plans = selectedParticipantId
          ? week.plans.filter((p) =>
              p.scopeType === "Individual"
                ? p.participantId === selectedParticipantId
                : true
            )
          : week.plans;

        if (plans.length === 0 && selectedParticipantId) return null;

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
                    setPlanDialogParticipantId(selectedParticipantId || null);
                    setPlanDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Plan anlegen
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <div className="text-sm text-muted-foreground">Kein Plan vorhanden.</div>
              ) : (
                <div className="space-y-2">
                  {plans.map((plan) => (
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
              )}
            </CardContent>
          </Card>
        );
      })}

      {weeks.length === 0 && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          In diesem Programm wurden noch keine Kurswochen angelegt. Kurswoche anlegen unter Programs → Kurswochen.
        </div>
      )}

      <SchedulePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        programWeekId={planDialogWeekId}
        programId={effectiveProgramId}
        defaultParticipantId={planDialogParticipantId}
        plan={planDialogPlan}
        existingScopes={
          weeks.find((w) => w.programWeekId === planDialogWeekId)?.plans.map((p) => p.scopeType) ?? []
        }
        onSaved={refresh}
      />
    </div>
  );
}
