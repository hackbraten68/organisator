import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, ChevronUp, Plus, Search, User } from "lucide-react";
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
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDialogWeekId, setPlanDialogWeekId] = useState<string>("");
  const [planDialogPlan, setPlanDialogPlan] = useState<SchedulePlan | null>(null);
  const [showPast, setShowPast] = useState(false);

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
  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId);

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

  // Participant progress
  const participantProgress = useMemo(() => {
    const map = new Map<string, { planned: number; published: number }>();
    for (const p of participants) {
      let planned = 0;
      let published = 0;
      for (const plan of allPlans) {
        if (plan.scopeType === "Individual" && plan.participantId === p.id) {
          planned++;
          if (plan.status === "Published") published++;
        }
      }
      map.set(p.id, { planned, published });
    }
    return map;
  }, [participants, allPlans]);

  // Filtered weeks for "all plans" view

  // Participant timeline
  const participantTimeline = useMemo(() => {
    if (!selectedParticipantId) return null;
    const past: { week: ScheduleWeek; plans: SchedulePlan[] }[] = [];
    const current: { week: ScheduleWeek; plans: SchedulePlan[] }[] = [];
    const future: { week: ScheduleWeek; plans: SchedulePlan[] }[] = [];

    for (const week of weeks) {
      // For selected participant: show their individual plans + course/group plans
      const plans = week.plans.filter((p) =>
        p.scopeType === "Individual"
          ? p.participantId === selectedParticipantId
          : true
      );
      if (plans.length === 0) continue;
      const ts = timeStatus(plans[0]);
      if (ts === "past") past.push({ week, plans });
      else if (ts === "current") current.push({ week, plans });
      else future.push({ week, plans });
    }

    return { past, current, future };
  }, [weeks, selectedParticipantId]);

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

  const totalWeeks = programs.find((p) => p.id === effectiveProgramId)?.durationWeeks ?? null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wochenpläne</h1>
        <Button size="sm" variant="outline" onClick={() => navigate("/wochenplan/vorlagen")}>
          Vorlagen verwalten
        </Button>
      </div>

      {/* Filter bar */}
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

        <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Teilnehmer wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Alle Teilnehmer</SelectItem>
            {participants.map((p) => (
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

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[180px]"
          />
        </div>
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
            <div className="flex gap-4">
              <span>Programm: {programs.find((p) => p.id === effectiveProgramId)?.name ?? "–"}</span>
              <span>
                Fortschritt: {participantProgress.get(selectedParticipantId)?.published ?? 0} / {totalWeeks ?? "–"} Wochen veröffentlicht
              </span>
              <span>
                ({participantProgress.get(selectedParticipantId)?.planned ?? 0} Entwürfe)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participant timeline view */}
      {selectedParticipantId && participantTimeline ? (
        <div className="space-y-6">
          {/* Past weeks (collapsible) */}
          {participantTimeline.past.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2"
                onClick={() => setShowPast(!showPast)}
              >
                {showPast ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Vergangene Wochen ({participantTimeline.past.length})
              </button>
              {showPast && (
                <div className="space-y-2">
                  {participantTimeline.past.map(({ week, plans }) => (
                    <WeekCard key={week.programWeekId} week={week} plans={plans} navigate={navigate} onPlanCreate={(wid) => { setPlanDialogWeekId(wid); setPlanDialogPlan(null); setPlanDialogOpen(true); }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current week */}
          {participantTimeline.current.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Aktuelle Woche</h2>
              {participantTimeline.current.map(({ week, plans }) => (
                <WeekCard key={week.programWeekId} week={week} plans={plans} navigate={navigate} onPlanCreate={(wid) => { setPlanDialogWeekId(wid); setPlanDialogPlan(null); setPlanDialogOpen(true); }} highlighted />
              ))}
            </div>
          )}

          {/* Future weeks */}
          {participantTimeline.future.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">Kommende Wochen</h2>
              <div className="space-y-2">
                {participantTimeline.future.map(({ week, plans }) => (
                  <WeekCard key={week.programWeekId} week={week} plans={plans} navigate={navigate} onPlanCreate={(wid) => { setPlanDialogWeekId(wid); setPlanDialogPlan(null); setPlanDialogOpen(true); }} />
                ))}
              </div>
            </div>
          )}

          {participantTimeline.past.length === 0 && participantTimeline.current.length === 0 && participantTimeline.future.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Für diesen Teilnehmer wurden noch keine Wochenpläne erstellt.
            </div>
          )}
        </div>
      ) : (
        /* All plans view (no participant selected) */
        <>
          {weeks.map((week) => (
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
                {week.plans.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Kein Plan vorhanden.</div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          ))}

          {weeks.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              In diesem Programm wurden noch keine Kurswochen angelegt. Kurswoche anlegen unter Programs → Kurswochen.
            </div>
          )}
        </>
      )}

      <SchedulePlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        programWeekId={planDialogWeekId}
        programId={effectiveProgramId}
        defaultScope={selectedParticipantId ? "Individual" : "Course"}
        defaultParticipantId={selectedParticipantId || null}
        plan={planDialogPlan}
        existingScopes={
          weeks.find((w) => w.programWeekId === planDialogWeekId)?.plans.map((p) => p.scopeType) ?? []
        }
        onSaved={refresh}
      />
    </div>
  );
}

function WeekCard({ week, plans, navigate, onPlanCreate, highlighted }: {
  week: ScheduleWeek;
  plans: SchedulePlan[];
  navigate: (path: string) => void;
  onPlanCreate: (weekId: string) => void;
  highlighted?: boolean;
}) {
  return (
    <Card className={highlighted ? "border-primary" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>
            Woche {week.weekNumber ?? "–"} – {week.name ?? "Ohne Name"}
            {week.moduleName ? ` (${week.moduleName})` : ""}
          </span>
          {plans.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPlanCreate(week.programWeekId)}
            >
              <Plus className="h-4 w-4 mr-1" /> Plan anlegen
            </Button>
          )}
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
}
