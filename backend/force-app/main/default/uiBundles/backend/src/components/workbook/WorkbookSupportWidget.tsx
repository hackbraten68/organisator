import { Link } from "react-router";
import { format } from "date-fns";
import { useState } from "react";
import {
  AlertCircle,
  Download,
  LifeBuoy,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  getWorkbookDayOverview,
  getWorkbookExportData,
  getWorkbookSupportOverview,
  type WorkbookDayOverview,
  type WorkbookExportData,
} from "@/api/workbook/workbookService";

function formatDay(value: string | null): string {
  if (!value) return "—";
  return format(new Date(`${value}T12:00:00`), "dd.MM.yyyy");
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value), "HH:mm");
}

function participantLink(participantId: string | null): string {
  return participantId
    ? `/participants/${participantId}?tab=lernen`
    : "/participants";
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dayExportRows(overview: WorkbookDayOverview) {
  return [
    [
      "Datum",
      "Teilnehmer",
      "Status",
      "Check-in",
      "Check-in-Quelle",
      "Unterstützung",
      "Unterstützungsnotiz",
      "Fokus",
      "Nächster Schritt",
      "Tagesabschluss",
    ],
    ...overview.days.map((day) => [
      day.date,
      day.participantName,
      day.status,
      day.checkInAt,
      day.checkInSource,
      day.supportStatus,
      day.supportNote,
      day.focus,
      day.nextStep,
      day.closedAt,
    ]),
  ];
}

function allExportRows(data: WorkbookExportData) {
  return [
    ["Typ", "Datum", "Teilnehmer", "Titel / Status", "Details"],
    ...data.days.map((day) => [
      "Tag",
      day.date,
      day.participantName,
      day.status,
      [
        day.checkInAt ? `Check-in ${day.checkInAt}` : "Kein Check-in",
        day.supportStatus && day.supportStatus !== "None"
          ? `Unterstützung: ${day.supportStatus}`
          : null,
        day.focus ? `Fokus: ${day.focus}` : null,
        day.closedAt ? `Abgeschlossen: ${day.closedAt}` : "Nicht abgeschlossen",
      ]
        .filter(Boolean)
        .join(" | "),
    ]),
    ...data.tasks.map((task) => [
      "Aufgabe",
      task.plannedDate,
      task.participantName,
      task.title,
      [
        task.status,
        task.isFocus ? "Fokus" : null,
        task.needsSupport ? "Hilfe angefragt" : null,
        task.supportNote,
        task.completedAt ? `Erledigt: ${task.completedAt}` : null,
        task.source ? `Quelle: ${task.source}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    ]),
    ...data.evidence.map((evidence) => [
      "Nachweis",
      evidence.createdAt,
      evidence.participantName,
      evidence.title,
      [
        evidence.type,
        evidence.feedbackStatus ? `Feedback: ${evidence.feedbackStatus}` : null,
      ]
        .filter(Boolean)
        .join(" | "),
    ]),
  ];
}

/**
 * Global coach widget for the participant-facing workbook. It answers the
 * coach questions at a glance: who checked in, who closed the day, who asked
 * for support, and which evidence is waiting for feedback.
 */
export default function WorkbookSupportWidget() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDay, setSelectedDay] = useState(today);
  const [exportingDay, setExportingDay] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const {
    data: support,
    loading: supportLoading,
    error: supportError,
  } = useAsyncData(() => getWorkbookSupportOverview(today), [today]);

  const {
    data: dayOverview,
    loading: dayLoading,
    error: dayError,
  } = useAsyncData(() => getWorkbookDayOverview(selectedDay), [selectedDay]);

  const loading = supportLoading || dayLoading;
  const error = supportError || dayError;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle />
        <AlertTitle>
          <h2>Mein Lernen konnte nicht geladen werden</h2>
        </AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const supportTasks = support?.supportTasks ?? [];
  const feedbackEvidence = support?.feedbackEvidence ?? [];
  const overview = dayOverview as WorkbookDayOverview | null;

  async function handleExportDay() {
    if (!overview) return;
    setExportingDay(true);
    setExportError(null);
    try {
      downloadCsv(`mein-lernen-${selectedDay}.csv`, dayExportRows(overview));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export fehlgeschlagen.");
    } finally {
      setExportingDay(false);
    }
  }

  async function handleExportAll() {
    setExportingAll(true);
    setExportError(null);
    try {
      const data = await getWorkbookExportData();
      downloadCsv("mein-lernen-alle-eintraege.csv", allExportRows(data));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export fehlgeschlagen.");
    } finally {
      setExportingAll(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Mein Lernen · Tagesübersicht</CardTitle>
          <CardDescription>
            Check-ins, Tagesabschlüsse, offene Fragen und Feedbackwünsche.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDay}
            disabled={exportingDay || !overview}
            className="gap-2"
          >
            <Download className="size-4" />
            {exportingDay ? "Exportiert…" : "Tag exportieren"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exportingAll}
            className="gap-2"
          >
            <Download className="size-4" />
            {exportingAll ? "Exportiert…" : "Alle Einträge exportieren"}
          </Button>
          <Link
            to="/participants"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Teilnehmer
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {exportError ? (
          <Alert variant="destructive" role="alert">
            <AlertCircle />
            <AlertDescription>{exportError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="workbook-day">Tag</Label>
            <Input
              id="workbook-day"
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value)}
              className="w-44"
            />
          </div>
          {overview ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {overview.totalDays} Tageseinträge
              </Badge>
              <Badge variant={overview.closedDays > 0 ? "success" : "secondary"}>
                {overview.closedDays} abgeschlossen
              </Badge>
              <Badge variant={overview.openDays > 0 ? "warning" : "secondary"}>
                {overview.openDays} offen
              </Badge>
              <Badge variant="secondary">
                {overview.checkedInCount} Check-ins
              </Badge>
              <Badge variant="secondary">
                {overview.doneTaskCount}/{overview.taskCount} Tasks erledigt
              </Badge>
              <Badge variant="secondary">
                {overview.evidenceCount} Nachweise
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <UserCheck className="size-4 text-muted-foreground" />
                Tagesabschlüsse
              </h3>
              <Badge variant={overview && overview.openDays > 0 ? "warning" : "secondary"}>
                {overview ? overview.openDays : 0} offen
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {!overview || overview.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Tageseinträge für diesen Tag.
                </p>
              ) : (
                overview.days.map((day) => (
                  <div
                    key={day.id}
                    className="rounded-md border bg-background p-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={participantLink(day.participantId)}
                        className="text-sm font-medium hover:underline"
                      >
                        {day.participantName ?? "Unbekannter Teilnehmer"}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={day.status === "Closed" ? "success" : "warning"}
                        >
                          {day.status === "Closed"
                            ? "Abgeschlossen"
                            : "Tagesabschluss fehlt"}
                        </Badge>
                        {day.supportStatus && day.supportStatus !== "None" ? (
                          <Badge variant="outline">
                            {day.supportStatus}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {day.checkInAt
                          ? `Check-in ${formatTime(day.checkInAt)}`
                          : "Kein Check-in"}
                      </span>
                      {day.closedAt ? (
                        <>
                          <span>·</span>
                          <span>Abgeschlossen {formatTime(day.closedAt)}</span>
                        </>
                      ) : null}
                    </div>
                    {day.supportNote ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {day.supportNote}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="size-4 text-muted-foreground" />
                Unterstützung
              </h3>
              <Badge variant={supportTasks.length > 0 ? "warning" : "secondary"}>
                {supportTasks.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {supportTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aktuell keine offenen Unterstützungsanfragen.
                </p>
              ) : (
                supportTasks.slice(0, 6).map((task) => (
                  <div key={task.id} className="rounded-md border bg-background p-2.5">
                    <Link
                      to={participantLink(task.participantId)}
                      className="text-sm font-medium hover:underline"
                    >
                      {task.participantName ?? "Unbekannter Teilnehmer"}
                    </Link>
                    <p className="mt-1 text-xs">
                      {task.title ?? "Aufgabe"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDay(task.plannedDate)}
                      </span>
                    </p>
                    {task.supportNote ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {task.supportNote}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="size-4 text-muted-foreground" />
                Feedbackwünsche
              </h3>
              <Badge
                variant={feedbackEvidence.length > 0 ? "warning" : "secondary"}
              >
                {feedbackEvidence.length}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {feedbackEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine offenen Feedbackwünsche.
                </p>
              ) : (
                feedbackEvidence.slice(0, 6).map((evidence) => (
                  <div
                    key={evidence.id}
                    className="rounded-md border bg-background p-2.5"
                  >
                    <Link
                      to={participantLink(evidence.participantId)}
                      className="text-sm font-medium hover:underline"
                    >
                      {evidence.participantName ?? "Unbekannter Teilnehmer"}
                    </Link>
                    <p className="mt-1 text-xs">
                      {evidence.title ?? "Nachweis"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {evidence.type === "Link" ? "Link" : "Notiz"}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
