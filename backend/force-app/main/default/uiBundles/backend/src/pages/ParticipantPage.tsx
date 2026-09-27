import { useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useAsyncData";
import ParticipantLearningPath from "@/components/participants/ParticipantLearningPath";
import ParticipantActivity from "@/components/participants/ParticipantActivity";
import ParticipantListCard, {
  type ParticipantFilter,
} from "@/components/participants/ParticipantListCard";
import ParticipantStickyHeader from "@/components/participants/ParticipantStickyHeader";
import ParticipantSummaryCard from "@/components/participants/ParticipantSummaryCard";
import OnboardingChecklist from "@/components/participants/OnboardingChecklist";
import {
  getCompletion,
  getOnboardingCounts,
  needsAttention,
} from "@/utils/participantOnboarding";
import {
  listParticipants,
  updateParticipant,
} from "@/api/participant/participantService";
import { listPrograms } from "@/api/program/programService";
import { listCoaches } from "@/api/coach/coachService";
import { type Participant } from "@/types/participant";

const NONE = "__none";

type ParticipantTab = "uebersicht" | "verlauf" | "lernpfad";

function compareByOnboarding(a: Participant, b: Participant): number {
  const pa = getCompletion(a).percent;
  const pb = getCompletion(b).percent;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
}

export default function ParticipantPage() {
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [prevSelectionKey, setPrevSelectionKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ParticipantFilter>("needs-attention");
  const [tab, setTab] = useState<ParticipantTab>("uebersicht");
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

  const visibleParticipants = [...participants]
    .filter((p) => {
      if (filter === "needs-attention") return needsAttention(p);
      if (filter === "active") return p.status === "Active";
      return true;
    })
    .sort((a, b) => {
      if (filter === "all") {
        const na = needsAttention(a);
        const nb = needsAttention(b);
        if (na !== nb) return na ? -1 : 1;
        if (!na) return a.name.localeCompare(b.name);
      }
      return compareByOnboarding(a, b);
    });

  // Fall back to the full list so the details stay visible when the
  // current filter view is empty (e.g. inbox cleared, all Ready).
  const effectiveSelectedId =
    selectedId ?? visibleParticipants[0]?.id ?? participants[0]?.id ?? null;
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
    setSelectedId(id);
    setTab("uebersicht");
    setEditing(false);
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
    <div className="container mx-auto max-w-[1500px] p-6">
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
        <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
          <ParticipantListCard
            participants={visibleParticipants}
            counts={counts}
            filter={filter}
            effectiveSelectedId={effectiveSelectedId}
            onFilterChange={setFilter}
            onSelect={handleParticipantChange}
          />

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
                onValueChange={(value) => setTab(value as ParticipantTab)}
              >
                <TabsList variant="line" className="mb-4">
                  <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
                  <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
                  <TabsTrigger value="lernpfad">Lernpfad</TabsTrigger>
                </TabsList>

                <TabsContent value="uebersicht" className="space-y-6">
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
                  <OnboardingChecklist participant={participant} />
                </TabsContent>

                <TabsContent value="verlauf">
                  {/* Lazy: timeline fetches only when the tab is opened. */}
                  {tab === "verlauf" && (
                    <ParticipantActivity
                      participantId={participant.id}
                      refreshKey={reload}
                    />
                  )}
                </TabsContent>

                <TabsContent value="lernpfad">
                  {/* Lazy: learning path loads only when the tab is opened. */}
                  {tab === "lernpfad" && (
                    <ParticipantLearningPath
                      key={participant.id}
                      participantId={participant.id}
                      participantName={participant.name}
                      programId={participant.programId}
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
      )}
    </div>
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
