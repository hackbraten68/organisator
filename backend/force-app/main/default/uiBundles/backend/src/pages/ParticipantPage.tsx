import { useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useAsyncData";
import ParticipantLearningPath from "@/components/participants/ParticipantLearningPath";
import OnboardingBadge from "@/components/participants/OnboardingBadge";
import OnboardingChecklist from "@/components/participants/OnboardingChecklist";
import CompletionBar from "@/components/participants/CompletionBar";
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
import {
  PARTICIPANT_STATUSES,
  type Participant,
} from "@/types/participant";

const NONE = "__none";

type ParticipantFilter = "needs-attention" | "active" | "all";

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

  // Reset the editable copy when the selection or the loaded data changes.
  const selectionKey = `${effectiveSelectedId ?? "none"}#${reload}`;
  if (selectionKey !== prevSelectionKey) {
    setPrevSelectionKey(selectionKey);
    setParticipant(selectedParticipant);
    setSaving(false);
  }

  function handleParticipantChange(id: string) {
    setSelectedId(id);
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
        <>
          <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
            {/* Teilnehmerliste */}

            <Card>
              <CardHeader>
                <CardTitle>Participants</CardTitle>
              </CardHeader>

              <CardContent>
                <Tabs
                  value={filter}
                  onValueChange={(value) =>
                    setFilter(value as ParticipantFilter)
                  }
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="needs-attention">
                      Needs Attention ({counts.needsAttention})
                    </TabsTrigger>
                    <TabsTrigger value="active">
                      Active ({counts.active})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      All Participants ({counts.total})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Onboarding</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {visibleParticipants.map((p) => {
                      const completion = getCompletion(p);
                      return (
                        <TableRow
                          key={p.id}
                          className={`cursor-pointer ${
                            p.id === effectiveSelectedId ? "bg-accent" : ""
                          }`}
                          onClick={() => handleParticipantChange(p.id)}
                        >
                          <TableCell className="max-w-36 truncate">
                            {p.name}
                          </TableCell>
                          <TableCell>{p.status}</TableCell>
                          <TableCell className="max-w-32 truncate">
                            {p.programName ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <OnboardingBadge state={completion.state} />
                              <CompletionBar percent={completion.percent} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visibleParticipants.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          {filter === "needs-attention"
                            ? "All participants are fully onboarded."
                            : "No participants in this view."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detailformular + Onboarding-Checkliste */}

            {participant ? (
            <div className="space-y-6">
              <Card>
              <CardHeader>
                <CardTitle>Participant Details</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>

                    <Input
                      value={participant.name}
                      onChange={(e) =>
                        updateField("name", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>

                    <Select
                      value={participant.status}
                      onValueChange={(value) =>
                        updateField("status", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        {PARTICIPANT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>

                    <Input
                      type="email"
                      value={participant.email ?? ""}
                      onChange={(e) =>
                        updateField("email", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>GitHub</Label>

                    <Input
                      value={participant.github ?? ""}
                      onChange={(e) =>
                        updateField("github", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Discord</Label>

                    <Input
                      value={participant.discord ?? ""}
                      onChange={(e) =>
                        updateField("discord", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Program</Label>

                    <Select
                      value={participant.programId ?? NONE}
                      onValueChange={handleProgramChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No program" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NONE}>
                          No program
                        </SelectItem>
                        {programs.map((program) => (
                          <SelectItem
                            key={program.id}
                            value={program.id}
                          >
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Coach</Label>

                    <Select
                      value={participant.coachId ?? NONE}
                      onValueChange={handleCoachChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No coach" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value={NONE}>
                          No coach
                        </SelectItem>
                        {coaches.map((coach) => (
                          <SelectItem
                            key={coach.id}
                            value={coach.id}
                          >
                            {coach.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={!isDirty || saving}
                  >
                    Reset
                  </Button>

                  <Button
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                  >
                    {saving ? "Saving…" : "Save Participant"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <OnboardingChecklist participant={participant} />
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

          {/* Individuelles Curriculum des ausgewählten Teilnehmers */}

          {participant && (
          <div className="mt-6">
            <ParticipantLearningPath
              key={participant.id}
              participantId={participant.id}
              participantName={participant.name}
              programId={participant.programId}
            />
          </div>
          )}
        </>
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
            {[0, 1, 2, 3, 4, 5, 6].map((key) => (
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
