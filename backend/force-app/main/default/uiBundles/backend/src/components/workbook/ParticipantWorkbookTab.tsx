import { format } from "date-fns";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ExternalLink, LifeBuoy, Target } from "lucide-react";
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
  getParticipantWorkbook,
  type ParticipantWorkbookEvidence,
} from "@/api/workbook/workbookService";

const DAY_STATUS_LABELS: Record<string, string> = {
  Open: "Offen",
  Closed: "Abgeschlossen",
  Reopened: "Wieder geöffnet",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  Open: "Offen",
  InProgress: "In Arbeit",
  Done: "Erledigt",
  Dropped: "Verworfen",
};

const SUPPORT_LABELS: Record<string, string> = {
  None: "Kein Bedarf",
  Question: "Frage",
  Blocked: "Blockiert",
  Coaching: "Coaching",
};

const RATING_LABELS: Record<string, string> = {
  Unclear: "Noch unklar",
  WithHelp: "Mit Hilfe",
  Independent: "Selbstständig",
  Explain: "Kann es erklären",
};

function formatDay(value: string | null): string {
  if (!value) return "—";
  return format(new Date(`${value}T12:00:00`), "dd.MM.yyyy");
}

function formatDateLong(value: string | null): string {
  if (!value) return "—";
  return format(new Date(`${value}T12:00:00`), "EEEE, dd.MM.yyyy");
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return format(new Date(value), "dd.MM.yyyy, HH:mm");
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

interface ParticipantWorkbookTabProps {
  participantId: string;
  participantName: string;
}

/**
 * Read-only coach view of a participant's Mein-Lernen workbook. It deliberately
 * has no edit controls: the workbook is the participant's Ist layer, and coach
 * feedback is not part of the MVP.
 */
export default function ParticipantWorkbookTab({
  participantId,
  participantName,
}: ParticipantWorkbookTabProps) {
  const { data, loading, error } = useAsyncData(
    () => getParticipantWorkbook(participantId),
    [participantId],
  );

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [exportingDay, setExportingDay] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  useEffect(() => {
    if (!selectedDay && data?.days?.length) {
      const today = format(new Date(), "yyyy-MM-dd");
      const todayDay = data.days.find((day) => day.date === today);
      setSelectedDay(todayDay?.date ?? data.days[0].date ?? null);
    }
  }, [data, selectedDay]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
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

  const days = data?.days ?? [];
  const tasks = data?.tasks ?? [];
  const evidence = data?.evidence ?? [];
  const today = format(new Date(), "yyyy-MM-dd");
  const todayDay = days.find((day) => day.date === today) ?? null;
  const openTasks = tasks.filter(
    (task) => task.status !== "Done" && task.status !== "Dropped",
  );
  const focusTasks = tasks.filter((task) => task.isFocus && task.status !== "Dropped");
  const selectedDayRecord = selectedDay
    ? days.find((day) => day.date === selectedDay) ?? null
    : null;
  const selectedDayTasks = selectedDay
    ? tasks.filter((task) => task.plannedDate === selectedDay)
    : [];
  const selectedDayEvidence = selectedDay
    ? evidence.filter((item) => item.createdAt?.slice(0, 10) === selectedDay)
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Mein Lernen · {participantName}</CardTitle>
            <CardDescription>
              Die Ist-Schicht aus Tages-Check-ins, Fokustasks, Unterstützung und
              Nachweisen. Der Wochenplan bleibt der Soll-Plan.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exportingDay || !selectedDay}
              onClick={() => {
                if (!selectedDayRecord) return;
                setExportingDay(true);
                try {
                  downloadCsv(`mein-lernen-${participantName}-${selectedDay}.csv`, [
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
                    [
                      selectedDayRecord.date,
                      participantName,
                      selectedDayRecord.status,
                      selectedDayRecord.checkInAt,
                      selectedDayRecord.checkInSource,
                      selectedDayRecord.supportStatus,
                      selectedDayRecord.supportNote,
                      selectedDayRecord.focus,
                      selectedDayRecord.nextStep,
                      selectedDayRecord.closedAt,
                    ],
                    ...selectedDayTasks.map((task) => [
                      selectedDay,
                      participantName,
                      `Aufgabe: ${task.title ?? "Aufgabe"}`,
                      task.status,
                      "",
                      task.needsSupport ? "Hilfe angefragt" : "",
                      task.supportNote,
                      task.isFocus ? "Fokus" : "",
                      "",
                      task.completedAt,
                    ]),
                    ...selectedDayEvidence.map((item) => [
                      selectedDay,
                      participantName,
                      `Nachweis: ${item.title ?? "Nachweis"}`,
                      item.feedbackStatus,
                      "",
                      "",
                      item.note,
                      "",
                      "",
                      item.createdAt,
                    ]),
                  ]);
                } finally {
                  setExportingDay(false);
                }
              }}
              className="gap-2"
            >
              <Download className="size-4" />
              {exportingDay ? "Exportiert…" : "Tag exportieren"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportingAll}
              onClick={() => {
                setExportingAll(true);
                try {
                  downloadCsv(`mein-lernen-${participantName}-alle.csv`, [
                    ["Typ", "Datum", "Teilnehmer", "Titel / Status", "Details"],
                    ...days.map((day) => [
                      "Tag",
                      day.date,
                      participantName,
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
                    ...tasks.map((task) => [
                      "Aufgabe",
                      task.plannedDate,
                      participantName,
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
                    ...evidence.map((item) => [
                      "Nachweis",
                      item.createdAt,
                      participantName,
                      item.title,
                      [item.type, item.feedbackStatus ? `Feedback: ${item.feedbackStatus}` : null]
                        .filter(Boolean)
                        .join(" | "),
                    ]),
                  ]);
                } finally {
                  setExportingAll(false);
                }
              }}
              className="gap-2"
            >
              <Download className="size-4" />
              {exportingAll ? "Exportiert…" : "Alle Einträge exportieren"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Check-in heute"
            value={
              todayDay?.checkInAt
                ? formatDateTime(todayDay.checkInAt)
                : "Noch nicht"
            }
            icon={CheckCircle2}
            tone={todayDay?.checkInAt ? "success" : "muted"}
          />
          <SummaryTile
            label="Offene Aufgaben"
            value={String(openTasks.length)}
            icon={Target}
          />
          <SummaryTile
            label="Fokustasks"
            value={String(focusTasks.length)}
            icon={Target}
            tone={focusTasks.length > 3 ? "warning" : "muted"}
          />
          <SummaryTile
            label="Nachweise"
            value={String(evidence.length)}
            icon={ExternalLink}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Tagesansicht</CardTitle>
            <CardDescription>
              Read-only-Ansicht für einen einzelnen Tag.
            </CardDescription>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="participant-day">Tag</Label>
            <Input
              id="participant-day"
              type="date"
              value={selectedDay ?? ""}
              onChange={(event) => setSelectedDay(event.target.value || null)}
              className="w-44"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedDayRecord ? (
            <p className="text-sm text-muted-foreground">
              Für diesen Tag gibt es noch keinen Tageseintrag.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedDayRecord.status === "Closed" ? "success" : "secondary"}>
                  {DAY_STATUS_LABELS[selectedDayRecord.status ?? ""] ?? selectedDayRecord.status ?? "—"}
                </Badge>
                {selectedDayRecord.supportStatus && selectedDayRecord.supportStatus !== "None" ? (
                  <Badge variant="warning">
                    <LifeBuoy className="size-3" />
                    {SUPPORT_LABELS[selectedDayRecord.supportStatus] ?? selectedDayRecord.supportStatus}
                  </Badge>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedDayRecord.checkInAt
                  ? `Check-in ${formatDateTime(selectedDayRecord.checkInAt)} · ${selectedDayRecord.checkInSource ?? "Portal"}`
                  : "Kein Check-in"}
                {selectedDayRecord.closedAt ? ` · Abgeschlossen ${formatDateTime(selectedDayRecord.closedAt)}` : ""}
              </div>
              {(selectedDayRecord.focus || selectedDayRecord.supportNote || selectedDayRecord.nextStep) && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {selectedDayRecord.focus ? <p>Fokus: {selectedDayRecord.focus}</p> : null}
                  {selectedDayRecord.supportNote ? <p>Unterstützung: {selectedDayRecord.supportNote}</p> : null}
                  {selectedDayRecord.nextStep ? <p>Nächster Schritt: {selectedDayRecord.nextStep}</p> : null}
                </div>
              )}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Aufgaben ({selectedDayTasks.length})
                </h3>
                {selectedDayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Aufgaben für diesen Tag.</p>
                ) : (
                  selectedDayTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{task.title ?? "Aufgabe"}</span>
                        {task.isFocus ? <Badge variant="secondary">Fokus</Badge> : null}
                        <Badge variant="outline">
                          {TASK_STATUS_LABELS[task.status ?? ""] ?? task.status ?? "—"}
                        </Badge>
                      </div>
                      {task.supportNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">{task.supportNote}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Nachweise ({selectedDayEvidence.length})
                </h3>
                {selectedDayEvidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Nachweise für diesen Tag.</p>
                ) : (
                  selectedDayEvidence.map((item) => <EvidenceRow key={item.id} item={item} />)
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Tage</CardTitle>
            <CardDescription>Die letzten 21 Tageseinträge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Tageseinträge.
              </p>
            ) : (
              days.map((day) => (
                <div key={day.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{formatDateLong(day.date)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {day.checkInAt
                          ? `Check-in ${formatDateTime(day.checkInAt)} · ${day.checkInSource ?? "Portal"}`
                          : "Kein Check-in"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={day.status === "Closed" ? "success" : "secondary"}>
                        {DAY_STATUS_LABELS[day.status ?? ""] ?? day.status ?? "—"}
                      </Badge>
                      {day.supportStatus && day.supportStatus !== "None" ? (
                        <Badge variant="warning">
                          <LifeBuoy className="size-3" />
                          {SUPPORT_LABELS[day.supportStatus] ?? day.supportStatus}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {(day.focus || day.nextStep || day.supportNote) && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {day.focus ? <p>Fokus: {day.focus}</p> : null}
                      {day.supportNote ? <p>Unterstützung: {day.supportNote}</p> : null}
                      {day.nextStep ? <p>Nächster Schritt: {day.nextStep}</p> : null}
                      {day.selfRating ? (
                        <p>
                          Selbsteinschätzung:{" "}
                          {RATING_LABELS[day.selfRating] ?? day.selfRating}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {day.closedAt ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Abgeschlossen am {formatDateTime(day.closedAt)}
                      {day.lastReopenedAt
                        ? ` · wieder geöffnet am ${formatDateTime(day.lastReopenedAt)}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aufgaben</CardTitle>
              <CardDescription>Die letzten 50 Aufgaben.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Aufgaben.
                </p>
              ) : (
                tasks.slice(0, 20).map((task) => (
                  <div key={task.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          task.status === "Done"
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
                        {task.title ?? "Aufgabe"}
                      </span>
                      {task.isFocus ? <Badge variant="secondary">Fokus</Badge> : null}
                      <Badge variant="outline">
                        {TASK_STATUS_LABELS[task.status ?? ""] ?? task.status ?? "—"}
                      </Badge>
                      {task.needsSupport ? (
                        <Badge variant="warning">
                          <LifeBuoy className="size-3" />
                          Hilfe
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Geplant {formatDay(task.plannedDate)}
                      {task.completedAt
                        ? ` · erledigt ${formatDateTime(task.completedAt)}`
                        : ""}
                      {task.source ? ` · ${task.source}` : ""}
                    </p>
                    {task.supportNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.supportNote}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nachweise</CardTitle>
              <CardDescription>Links und Notizen der letzten Zeit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Nachweise.
                </p>
              ) : (
                evidence.map((item) => <EvidenceRow key={item.id} item={item} />)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  icon: typeof CheckCircle2;
  tone?: "muted" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-lg font-semibold">{value}</p>
        <span className={`rounded-md p-1.5 ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function EvidenceRow({ item }: { item: ParticipantWorkbookEvidence }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.title ?? "Nachweis"}</span>
        <Badge variant="outline">{item.type === "Link" ? "Link" : "Notiz"}</Badge>
        {item.feedbackStatus === "Requested" ? (
          <Badge variant="warning">Feedback angefragt</Badge>
        ) : item.feedbackStatus === "Given" ? (
          <Badge variant="success">Feedback gegeben</Badge>
        ) : null}
      </div>
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block break-all text-xs text-primary underline underline-offset-4"
        >
          {item.url}
        </a>
      ) : null}
      {item.note ? (
        <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
      ) : null}
      {item.coachFeedback ? (
        <p className="mt-2 rounded bg-muted/40 p-2 text-xs">
          Coach-Feedback: {item.coachFeedback}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDateTime(item.createdAt)}
      </p>
    </div>
  );
}
