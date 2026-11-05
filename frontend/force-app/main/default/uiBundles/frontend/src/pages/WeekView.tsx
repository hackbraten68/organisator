import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Target,
} from "lucide-react";
import { StatusAlert } from "../components/alerts/status-alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Skeleton } from "../components/ui/skeleton";
import { useParticipant } from "../features/participant/context/ParticipantContext";
import {
  fetchWeek,
  updateReview,
  WorkbookError,
  type WorkbookWeek,
} from "../features/participant/api/workbookApi";

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatDateShort(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "EEE dd.MM.", { locale: de });
}

export default function WeekView() {
  const { me } = useParticipant();
  const [weekStart, setWeekStart] = useState<string>(
    isoDate(mondayOf(new Date())),
  );
  const [week, setWeek] = useState<WorkbookWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Review fields
  const [proudOf, setProudOf] = useState("");
  const [clearerNow, setClearerNow] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState("");
  const [supportWish, setSupportWish] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeek(weekStart)
      .then((data) => {
        if (cancelled) return;
        setWeek(data);
        if (data.review) {
          setProudOf(data.review.proudOf ?? "");
          setClearerNow(data.review.clearerNow ?? "");
          setNextWeekFocus(data.review.nextWeekFocus ?? "");
          setSupportWish(data.review.supportWish ?? "");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof WorkbookError ? err.message : "Wochenansicht konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const displayName = me?.participantName ?? me?.contactName ?? null;

  const prevWeek = () => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() - 7);
    setWeekStart(isoDate(mondayOf(d)));
  };

  const nextWeek = () => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + 7);
    setWeekStart(isoDate(mondayOf(d)));
  };

  async function onSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!week) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateReview(week.weekStart, {
        proudOf,
        clearerNow,
        nextWeekFocus,
        supportWish,
        status: "Submitted",
      });
      setWeek({ ...week, review: updated });
      setNotice("Wochenrückblick eingereicht.");
    } catch (err) {
      setError(err instanceof WorkbookError ? err.message : "Rückblick konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-2 h-8 w-72" />
        <Skeleton className="mb-8 h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mein Lernen · Woche</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {displayName ? `Guten Tag, ${displayName}` : "Guten Tag"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deine Woche im Überblick: Check-ins, Fokustasks und Tagesabschlüsse.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {week ? `${format(new Date(`${week.weekStart}T12:00:00`), "dd.MM.")} – ${format(new Date(`${week.weekEnd}T12:00:00`), "dd.MM.yyyy")}` : "—"}
          </span>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </header>

      {error ? (
        <div className="mb-6">
          <StatusAlert>{error}</StatusAlert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-6">
          <StatusAlert variant="success">{notice}</StatusAlert>
        </div>
      ) : null}

      {week ? (
        <>
          {/* Summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Check-ins</p>
              <p className="mt-1 text-2xl font-bold">{week.checkedInDays}/7</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Tagesabschlüsse</p>
              <p className="mt-1 text-2xl font-bold">{week.closedDays}/7</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Tasks erledigt</p>
              <p className="mt-1 text-2xl font-bold">{week.completedTasks}/{week.totalTasks}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">Nachweise</p>
              <p className="mt-1 text-2xl font-bold">{week.evidenceCount}</p>
            </div>
          </div>

          {/* Day cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {week.days.map((day) => (
              <Card key={day.dateValue} className="flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {formatDateShort(day.dateValue)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 text-xs">
                  <div className="flex items-center gap-1">
                    {day.checkedIn ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {day.checkedIn ? "Eingecheckt" : "Kein Check-in"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {day.day.status === "Closed" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      {day.day.status === "Closed" ? "Abgeschlossen" : "Offen"}
                    </span>
                  </div>
                  {day.focusTasks.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {day.focusTasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-1">
                          <Target className="size-3 text-primary" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <Link
                    to="/"
                    className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Heute ansehen →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Weekly Review */}
          <Card>
            <CardHeader>
              <CardTitle>Wochenrückblick</CardTitle>
              <CardDescription>
                Optional – in etwa zwei Minuten erledigt. Kein Pflichtfeld.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {week.review?.status === "Submitted" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Wochenrückblick eingereicht</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Eingereicht am {week.review.submittedAt ? format(new Date(week.review.submittedAt), "dd.MM.yyyy, HH:mm", { locale: de }) : "—"}
                    </p>
                    {week.review.proudOf ? (
                      <p className="mt-2 text-xs"><strong>Stolz auf:</strong> {week.review.proudOf}</p>
                    ) : null}
                    {week.review.clearerNow ? (
                      <p className="mt-1 text-xs"><strong>Klarer geworden:</strong> {week.review.clearerNow}</p>
                    ) : null}
                    {week.review.nextWeekFocus ? (
                      <p className="mt-1 text-xs"><strong>Nächste Woche:</strong> {week.review.nextWeekFocus}</p>
                    ) : null}
                    {week.review.supportWish ? (
                      <p className="mt-1 text-xs"><strong>Unterstützungswunsch:</strong> {week.review.supportWish}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmitReview} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="proudOf">Worauf bist du diese Woche stolz?</Label>
                    <textarea
                      id="proudOf"
                      value={proudOf}
                      onChange={(e) => setProudOf(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                      placeholder="Zum Beispiel: Ich habe jeden Tag eingecheckt."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="clearerNow">Was ist dir diese Woche klarer geworden?</Label>
                    <textarea
                      id="clearerNow"
                      value={clearerNow}
                      onChange={(e) => setClearerNow(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                      placeholder="Zum Beispiel: Wie die REST-API funktioniert."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nextWeekFocus">Dein Fokus für nächste Woche</Label>
                    <textarea
                      id="nextWeekFocus"
                      value={nextWeekFocus}
                      onChange={(e) => setNextWeekFocus(e.target.value)}
                      maxLength={2000}
                      rows={2}
                      className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                      placeholder="Womit machst du nächste Woche weiter?"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="supportWish">Brauchst du Unterstützung?</Label>
                    <textarea
                      id="supportWish"
                      value={supportWish}
                      onChange={(e) => setSupportWish(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                      placeholder="Zum Beispiel: Code-Review für meine Aufgabe."
                    />
                  </div>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Wird eingereicht…" : "Wochenrückblick einreichen"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}