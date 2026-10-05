import { useState, useMemo } from "react";
import { Search, Users, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/layout";
import OnboardingBadge from "@/components/participants/OnboardingBadge";
import CompletionBar from "@/components/participants/CompletionBar";
import { getCompletion } from "@/utils/participantOnboarding";
import { participantDisplayName } from "@/utils/participantDisplay";
import type { Participant } from "@/types/participant";

export interface ParticipantListCounts {
  needsAttention: number;
  active: number;
  total: number;
}

interface ParticipantListCardProps {
  participants: Participant[];
  counts: ParticipantListCounts;
  effectiveSelectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
}

interface GroupConfig {
  key: string;
  label: string;
  count: number;
  defaultOpen: boolean;
  filter: (p: Participant) => boolean;
}

export default function ParticipantListCard({
  participants,
  counts,
  effectiveSelectedId,
  onSelect,
  loading = false,
  error = null,
}: ParticipantListCardProps) {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const groups: GroupConfig[] = [
      {
        key: "needs-attention",
        label: "Achtung",
        count: counts.needsAttention,
        defaultOpen: true,
        filter: (p) => getCompletion(p).state !== "ready",
      },
      {
        key: "active",
        label: "Aktiv",
        count: counts.active,
        defaultOpen: true,
        filter: (p) => p.status === "Active",
      },
      {
        key: "all",
        label: "Alle",
        count: counts.total,
        defaultOpen: false,
        filter: () => true,
      },
    ];
    const q = query.trim().toLowerCase();
    return groups.map((g) => ({
      ...g,
      participants: participants.filter((p) => {
        if (!g.filter(p)) return false;
        if (!q) return true;
        return (
          participantDisplayName(p).toLowerCase().includes(q) ||
          (p.programName ?? "").toLowerCase().includes(q) ||
          (p.coachName ?? "").toLowerCase().includes(q)
        );
      }),
    }));
  }, [participants, query, counts.needsAttention, counts.active, counts.total]);

  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-h3">Teilnehmer</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="size-4" />
            <AlertTitle>Fehler beim Laden</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-h3">Teilnehmer</CardTitle>
          <div className="relative mt-3">
            <Skeleton className="h-10 w-full" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (participants.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-h3">Teilnehmer</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon={<Users className="size-12" />}
            title="Keine Teilnehmer vorhanden"
            description="Es wurden noch keine Teilnehmer angelegt."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-h3">Teilnehmer</CardTitle>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <Accordion
          type="multiple"
          defaultValue={filteredGroups.filter((g) => g.defaultOpen).map((g) => g.key)}
          className="w-full"
        >
          {filteredGroups.map((group) => (
            <AccordionItem key={group.key} value={group.key} className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-h4 font-medium hover:no-underline">
                <span className="flex items-center gap-2">
                  {group.label}
                  <Badge variant="secondary" className="text-xs">{group.count}</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-2">
                <div className="divide-y divide-muted/50">
                  {group.participants.map((p) => {
                    const completion = getCompletion(p);
                    const isSelected = p.id === effectiveSelectedId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        aria-label={`Teilnehmer ${participantDisplayName(p)} auswählen`}
                        className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                          isSelected ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {participantDisplayName(p)}
                          </span>
                          <span className="text-xs text-muted-foreground">{p.status}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate">
                            {p.programName ?? "—"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <OnboardingBadge state={completion.state} />
                          <CompletionBar percent={completion.percent} />
                        </div>
                      </button>
                    );
                  })}
                  {group.participants.length === 0 && (
                    <div className="px-4 py-6">
                      <EmptyState
                        icon={<Users className="size-8" />}
                        title={query ? "Keine Treffer" : "Keine Teilnehmer"}
                        description={query ? `Keine Teilnehmer gefunden für "${query}"` : "In dieser Gruppe sind keine Teilnehmer vorhanden."}
                      />
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
