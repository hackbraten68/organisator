import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PageContainer, PageHeader } from "@/components/ui/layout";
import ParticipantLearningPath from "@/components/participants/ParticipantLearningPath";
import ParticipantActivity from "@/components/participants/ParticipantActivity";
import ParticipantListCard from "@/components/participants/ParticipantListCard";
import ParticipantStickyHeader from "@/components/participants/ParticipantStickyHeader";
import ParticipantSummaryCard from "@/components/participants/ParticipantSummaryCard";
import OnboardingChecklist from "@/components/participants/OnboardingChecklist";
import { ParticipantAbsencesTab } from "@/components/absences";
import { ParticipantAppointmentsTab } from "@/components/appointments";
import {
  getCompletion,
  getOnboardingCounts,
} from "@/utils/participantOnboarding";
import {
  listParticipants,
  updateParticipant,
} from "@/api/participant/participantService";
import { listPrograms } from "@/api/program/programService";
import { listCoaches } from "@/api/coach/coachService";
import { type Participant } from "@/types/participant";

const NONE = "__none";

type ParticipantTab =
  | "uebersicht"
  | "verlauf"
  | "lernpfad"
  | "abwesenheiten"
  | "termine";

const PARTICIPANT_TABS: ParticipantTab[] = [
  "uebersicht",
  "verlauf",
  "lernpfad",
  "abwesenheiten",
  "termine",
];

function tabFromParams(params: URLSearchParams): ParticipantTab {
  const tab = params.get("tab");
  if (PARTICIPANT_TABS.includes(tab as ParticipantTab)) return tab as ParticipantTab;
  // A deep-linked event implies the verlauf tab even without ?tab=.
  if (params.get("event")) return "verlauf";
  return "uebersicht";
}

export default function ParticipantPage() {
  const navigate = useNavigate();
  const { participantId: routeParticipantId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reload, setReload] = useState(0);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [prevSelectionKey, setPrevSelectionKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ParticipantTab>(() => tabFromParams(searchParams));
  const unknownIdNotified = useRef<string | null>(null);
  // Edit mode lives here (not in the summary card) so a list reload after
  // save — which briefly unmounts the detail column via the skeleton — does
  // not silently drop the user back to view mode.
  const [editing, setEditing] = useState(false);

  const { data, loading, error } = useAsyncData(async () => {
    const [participantList, programList, coachList] = await Promise.all([
      listParticipants(),
      listPrograms(),
      listCoaches(),
    ]);
    return {
      participants: participantList,
      programs: programList,
      coaches: coachList,
    };
  }, [reload]);

  const participants = data?.participants ?? [];
  const programs = data?.programs ?? [];
  const coaches = data?.coaches ?? [];

  const counts = getOnboardingCounts(participants);

  const visibleParticipants = participants;

  // Fall back to the full list so the details stay visible when the
  // current filter view is empty (e.g. inbox cleared, all Ready).
  // Route id wins over manual selection; unknown route ids fall back to the
  // legacy auto-first behavior with a one-time notice.
  const knownRouteId =
    routeParticipantId != null &&
    participants.some((p) => p.id === routeParticipantId)
      ? routeParticipantId
      : null;
  // Side effects (ref write + toast) must not run during render, so the
  // "unknown id" notice is driven from an effect keyed on the id itself.
  const unknownRouteId =
    routeParticipantId != null &&
    !loading &&
    participants.length > 0 &&
    knownRouteId == null
      ? routeParticipantId
      : null;
  useEffect(() => {
    if (unknownRouteId == null) return;
    if (unknownIdNotified.current === unknownRouteId) return;
    unknownIdNotified.current = unknownRouteId;
    toast.error("Teilnehmer nicht gefunden", {
      description: "Es wird der erste Teilnehmer der Liste gezeigt.",
    });
  }, [unknownRouteId]);
  const effectiveSelectedId =
    knownRouteId ??
    visibleParticipants[0]?.id ??
    participants[0]?.id ??
    null;
  const selectedParticipant =
    participants.find((p) => p.id === effectiveSelectedId) ?? null;

  // Reset the editable copy only when the selection changes — never on
  // data refresh: after a save the list refetch lands while the previous
  // data is still rendered, and resetting here would clobber the just-saved
  // values with stale ones. (No polling exists, so no background refetch can
  // wipe unsaved edits.)
  const selectionKey = effectiveSelectedId ?? "none";
  if (selectionKey !== prevSelectionKey) {
    setPrevSelectionKey(selectionKey);
    setParticipant(selectedParticipant);
    setSaving(false);
  }

  function handleParticipantChange(id: string) {
    setTab("uebersicht");
    setEditing(false);
    if (id === routeParticipantId) return;
    // Canonical deep link: selection lives in the URL from here on.
    navigate(`/participants/${id}`);
  }

  function handleTabChange(value: ParticipantTab) {
    setTab(value);
    // Keep the tab shareable (?tab=), preserving a deep-linked ?event= so a
    // copied link stays complete while switching tabs.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", value);
        return next;
      },
      { replace: true },
    );
  }

  function updateField<K extends keyof Participant>(
    field: K,
    value: Participant[K],
  ) {
    setParticipant((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  const isDirty =
    participant !== null &&
    selectedParticipant !== null &&
    JSON.stringify(participant) !== JSON.stringify(selectedParticipant);

  function handleProgramChange(id: string) {
    if (id === NONE) {
      setParticipant((current) =>
        current
          ? { ...current, programId: undefined, programName: undefined }
          : current,
      );
      return;
    }
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    setParticipant((current) =>
      current
        ? { ...current, programId: program.id, programName: program.name }
        : current,
    );
  }

  function handleCoachChange(id: string) {
    if (id === NONE) {
      setParticipant((current) =>
        current
          ? { ...current, coachId: undefined, coachName: undefined }
          : current,
      );
      return;
    }
    const coach = coaches.find((c) => c.id === id);
    if (!coach) return;
    setParticipant((current) =>
      current
        ? { ...current, coachId: coach.id, coachName: coach.name }
        : current,
    );
  }

  function handleReset() {
    setParticipant(selectedParticipant);
  }

  async function handleSave() {
    if (!participant || !selectedParticipant) return;
    setSaving(true);
    try {
      const saved = await updateParticipant(selectedParticipant.id, {
        name: participant.name.trim(),
        status: participant.status,
        email: participant.email ?? null,
        github: participant.github ?? null,
        discord: participant.discord ?? null,
        programId: participant.programId ?? null,
        coachId: participant.coachId ?? null,
      });
      if (!saved) {
        throw new Error("Participant could not be saved.");
      }
      toast.success("Participant saved", { description: saved.name });
      // Adopt the server read-back immediately so the form keeps showing the
      // persisted values (the list refresh below must not reset the copy).
      setParticipant(saved);
      setReload((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Saving failed";
      toast.error("Saving failed", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      {loading && <ParticipantPageSkeleton />}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Failed to load participants</h2>
          </AlertTitle>
          <AlertDescription>
            Something went wrong while loading participants. Please try again
            later.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && participants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No participants yet</h2>
            <p className="text-sm text-muted-foreground">
              Participants created in Salesforce will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && participants.length > 0 && (
        <>
          <PageHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Teilnehmer</span>
              <span>/</span>
              <span className="font-medium text-foreground">{participant?.name}</span>
            </div>
          </PageHeader>

          <div className="grid gap-8 lg:grid-cols-[384px_1fr]">
            <aside className="hidden lg:block">
              <ParticipantListCard
                participants={visibleParticipants}
                counts={counts}
                effectiveSelectedId={effectiveSelectedId}
                onSelect={handleParticipantChange}
              />
            </aside>

            {participant ? (
              <div className="min-w-0">
                <ParticipantStickyHeader
                  participant={participant}
                  isDirty={isDirty}
                  saving={saving}
                  onReset={handleReset}
                  onSave={handleSave}
                />

                <Tabs
                  value={tab}
                  onValueChange={(value) => handleTabChange(value as ParticipantTab)}
                >
                  <TabsList variant="line" className="mb-4">
                    <TabsTrigger value="uebersicht" aria-label="Übersicht anzeigen">Übersicht</TabsTrigger>
                    <TabsTrigger value="verlauf" aria-label="Verlauf anzeigen">Verlauf</TabsTrigger>
                    <TabsTrigger value="lernpfad" aria-label="Lernpfad anzeigen">Lernpfad</TabsTrigger>
                    <TabsTrigger value="abwesenheiten" aria-label="Abwesenheiten anzeigen">Abwesenheiten</TabsTrigger>
                    <TabsTrigger value="termine" aria-label="Termine anzeigen">Termine</TabsTrigger>
                  </TabsList>

                  <TabsContent value="uebersicht" className={`grid gap-6 ${getCompletion(participant).state === "ready" ? "" : "lg:grid-cols-2"}`}>
                    <ParticipantSummaryCard
                      participant={participant}
                      programs={programs}
                      coaches={coaches}
                      editing={editing}
                      onToggleEdit={() => setEditing((value) => !value)}
                      onFieldChange={updateField}
                      onProgramChange={handleProgramChange}
                      onCoachChange={handleCoachChange}
                    />
                    {getCompletion(participant).state !== "ready" && (
                      <OnboardingChecklist participant={participant} />
                    )}
                  </TabsContent>

                  <TabsContent value="verlauf">
                    {tab === "verlauf" && (
                      <ParticipantActivity
                        participantId={participant.id}
                        refreshKey={reload}
                        highlightEventId={searchParams.get("event")}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="lernpfad">
                    {tab === "lernpfad" && (
                      <ParticipantLearningPath
                        key={participant.id}
                        participantId={participant.id}
                        participantName={participant.name}
                        programId={participant.programId}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="abwesenheiten">
                    {tab === "abwesenheiten" && (
                      <ParticipantAbsencesTab
                        participantId={participant.id}
                        participantName={participant.name}
                        canManage={true}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="termine">
                    {tab === "termine" && (
                      <ParticipantAppointmentsTab
                        participantId={participant.id}
                        participantName={participant.name}
                        canManage={true}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="size-12 text-muted-foreground mb-4" />
                  <h2 className="text-lg font-semibold mb-1">
                    No participant selected
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Select a participant from the list to view details.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}

function ParticipantPageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
