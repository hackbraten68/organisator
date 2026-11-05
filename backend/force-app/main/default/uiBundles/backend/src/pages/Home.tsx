import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  GraduationCap,
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
import WorkbookSupportWidget from "@/components/workbook/WorkbookSupportWidget";

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

function QuickLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
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
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
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
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Operations overview</p>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Button asChild>
          <Link to="/participants">
            Teilnehmer öffnen
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <WorkbookSupportWidget />

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Dashboard konnte nicht geladen werden</h2>
          </AlertTitle>
          <AlertDescription>
            Beim Laden der Dashboard-Daten ist ein Fehler aufgetreten. Bitte
            versuche es später erneut.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && participants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="mb-3 size-10 text-muted-foreground" />
            <h2 className="mb-1 text-lg font-semibold">Noch keine Teilnehmer</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Lege den ersten Teilnehmer an, um loszulegen.
            </p>
            <Button asChild variant="outline">
              <Link to="/participants">Teilnehmer verwalten</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && participants.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Teilnehmer gesamt"
              value={participants.length}
              icon={Users}
            />
            <MetricCard
              label="Aktiv"
              value={statusCounts.Active}
              icon={CheckCircle2}
            />
            <MetricCard
              label="Braucht Aufmerksamkeit"
              value={onboardingCounts.needsAttention}
              icon={AlertCircle}
            />
            <MetricCard
              label="Onboarding"
              value={statusCounts.Onboarding}
              icon={CalendarClock}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Schnellzugriff
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickLink
                to="/participants"
                icon={Users}
                title="Teilnehmer"
                description="Liste, Onboarding, Status"
              />
              <QuickLink
                to="/wochenplan"
                icon={CalendarClock}
                title="Wochenplan"
                description="Soll-Plan erstellen und verwalten"
              />
              <QuickLink
                to="/programs"
                icon={GraduationCap}
                title="Programme"
                description="Programme und Module"
              />
              <QuickLink
                to="/wochenplan/vorlagen"
                icon={FileText}
                title="Vorlagen"
                description="Wochenplan-Vorlagen"
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="text-sm">Braucht Aufmerksamkeit</CardTitle>
                  <CardDescription className="text-xs">
                    Teilnehmer mit fehlenden Onboarding-Daten.
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/participants">Alle</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {attentionList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Alles in Ordnung – keine Onboarding-Lücken.
                  </p>
                ) : (
                  attentionList.map((participant) => {
                    const missing = getMissingFields(participant)
                      .map((field) => FIELD_LABELS[field])
                      .join(", ");

                    return (
                      <div
                        key={participant.id}
                        className="rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{participant.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {participant.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {missing || "Felder prüfen"}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Lifecycle-Übersicht</CardTitle>
                <CardDescription className="text-xs">
                  Status-Verteilung der Teilnehmer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {PARTICIPANT_STATUSES.map((status) => (
                    <div
                      key={status}
                      className="rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {status}
                        </span>
                        <span className="text-sm font-semibold">
                          {statusCounts[status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="text-sm">Zuletzt hinzugefügt</CardTitle>
                  <CardDescription className="text-xs">
                    Kürzlich erstellte Teilnehmer.
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/participants">Alle</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentParticipants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Keine aktuellen Teilnehmer.
                  </p>
                ) : (
                  recentParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {participant.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {participant.status}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(participant.createdAt ?? participant.startDate)}
                      </time>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}