import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import OnboardingBadge from "@/components/participants/OnboardingBadge";
import CompletionBar from "@/components/participants/CompletionBar";
import { getCompletion } from "@/utils/participantOnboarding";
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
}: ParticipantListCardProps) {
  const [query, setQuery] = useState("");

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

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.map((g) => ({
      ...g,
      participants: participants.filter((p) => {
        if (!g.filter(p)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.programName ?? "").toLowerCase().includes(q) ||
          (p.coachName ?? "").toLowerCase().includes(q)
        );
      }),
    }));
  }, [participants, query, groups]);

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
          defaultValue={groups.filter((g) => g.defaultOpen).map((g) => g.key)}
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
                        aria-label={`Teilnehmer ${p.name} auswählen`}
                        className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${
                          isSelected ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{p.name}</span>
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
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {query ? "Keine Treffer" : "Keine Teilnehmer"}
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
