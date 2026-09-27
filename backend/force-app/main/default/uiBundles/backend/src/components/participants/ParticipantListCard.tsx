import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OnboardingBadge from "@/components/participants/OnboardingBadge";
import CompletionBar from "@/components/participants/CompletionBar";
import { getCompletion } from "@/utils/participantOnboarding";
import type { Participant } from "@/types/participant";

export type ParticipantFilter = "needs-attention" | "active" | "all";

export interface ParticipantListCounts {
  needsAttention: number;
  active: number;
  total: number;
}

interface ParticipantListCardProps {
  participants: Participant[];
  counts: ParticipantListCounts;
  filter: ParticipantFilter;
  effectiveSelectedId: string | null;
  onFilterChange: (filter: ParticipantFilter) => void;
  onSelect: (id: string) => void;
}

/**
 * Left-column participant inbox: filter tabs + selectable table.
 * Extracted from ParticipantPage without behavior changes.
 */
export default function ParticipantListCard({
  participants,
  counts,
  filter,
  effectiveSelectedId,
  onFilterChange,
  onSelect,
}: ParticipantListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs
          value={filter}
          onValueChange={(value) => onFilterChange(value as ParticipantFilter)}
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
            {participants.map((p) => {
              const completion = getCompletion(p);
              return (
                <TableRow
                  key={p.id}
                  className={`cursor-pointer ${
                    p.id === effectiveSelectedId ? "bg-accent" : ""
                  }`}
                  onClick={() => onSelect(p.id)}
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
            {participants.length === 0 && (
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
  );
}
