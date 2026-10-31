import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  listParticipants,
  listRecentParticipants,
} from "@/api/participant/participantService";
import {
  getMissingFields,
  getOnboardingCounts,
  getStatusCounts,
  needsAttention,
} from "@/utils/participantOnboarding";
import {
  PARTICIPANT_STATUSES,
} from "@/types/participant";

const FIELD_LABELS: Record<string, string> = {
  program: "Program",
  coach: "Coach",
  discord: "Discord",
  github: "GitHub",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data, loading, error } = useAsyncData(async () => {
    const [participants, recentParticipants] = await Promise.all([
      listParticipants(),
      listRecentParticipants(6),
    ]);

    return { participants, recentParticipants };
  }, []);

  const participants = useMemo(
    () => data?.participants ?? [],
    [data?.participants],
  );
  const recentParticipants = useMemo(
    () => data?.recentParticipants ?? [],
    [data?.recentParticipants],
  );

  const statusCounts = useMemo(
    () => getStatusCounts(participants),
    [participants],
  );
  const onboardingCounts = useMemo(
    () => getOnboardingCounts(participants),
    [participants],
  );
  const attentionList = useMemo(
    () =>
      [...participants]
        .filter((participant) => needsAttention(participant))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 5),
    [participants],
  );

  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Operations overview</p>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Button asChild>
          <Link to="/participants">
            Open participant list
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-3 h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Failed to load dashboard</h2>
          </AlertTitle>
          <AlertDescription>
            Something went wrong while loading the participant dashboard. Please
            try again later.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && participants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-4 size-12 text-muted-foreground" />
            <h2 className="mb-1 text-lg font-semibold">No participants yet</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Add the first participant to begin tracking onboarding and status.
            </p>
            <Button asChild variant="outline">
              <Link to="/participants">Review participants</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && participants.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total participants"
              value={participants.length}
              icon={Users}
            />
            <MetricCard
              label="Active"
              value={statusCounts.Active}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Needs attention"
              value={onboardingCounts.needsAttention}
              icon={AlertCircle}
            />
            <MetricCard
              label="Onboarding"
              value={statusCounts.Onboarding}
              icon={CalendarClock}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
                <CardDescription>
                  Participants with missing onboarding data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {attentionList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Everything looks healthy. No onboarding gaps right now.
                  </p>
                ) : (
                  attentionList.map((participant) => {
                    const missing = getMissingFields(participant)
                      .map((field) => FIELD_LABELS[field])
                      .join(", ");

                    return (
                      <div
                        key={participant.id}
                        className="rounded-lg border bg-muted/30 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{participant.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {participant.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {missing || "Check required fields"}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lifecycle overview</CardTitle>
                <CardDescription>
                  Participant status distribution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PARTICIPANT_STATUSES.map((status) => (
                    <div
                      key={status}
                      className="rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          {status}
                        </span>
                        <span className="text-lg font-semibold">
                          {statusCounts[status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recent participants</CardTitle>
                <CardDescription>
                  Recently created or started participants.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/participants">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent participants available.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recentParticipants.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4"
                    >
                      <div>
                        <p className="font-medium">{participant.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {participant.status}
                        </p>
                      </div>
                      <time className="text-sm text-muted-foreground">
                        {formatDate(participant.createdAt ?? participant.startDate)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}