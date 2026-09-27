import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DatePicker,
  DatePickerCalendar,
  DatePickerContent,
  DatePickerRangeTrigger,
} from "@/components/ui/datePicker";
import { ActivityTimeline } from "@/components/audit";
import { getParticipantActivity } from "@/api/audit/auditApiService";
import {
  ACTIVITY_CATEGORIES,
  filterForAudience,
  type ActivityAudience,
  type ActivityCategory,
} from "@/api/audit/activityProjection";
import { filterActivityEvents } from "@/api/audit/activityFilters";
import type { AuditEvent } from "@/types/audit";

interface ParticipantActivityProps {
  participantId: string;
  /** Bump to refetch (e.g. after a save). */
  refreshKey?: number;
  /** Default audience view. Coach excludes technical events. */
  audience?: ActivityAudience;
}

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  participant_journey: "Verlauf",
  appointments: "Termine",
  attendance: "Anwesenheit",
  absence: "Abwesenheit",
  learning: "Lernen",
  administration: "Verwaltung",
  security: "Sicherheit",
  audit: "Audit",
};

/**
 * Categories without a pill (deliberate, not a bug):
 * - audit: always empty by design (audit.viewed/exported carry
 *   includeInActivity:false — reading the audit log must not append to it).
 * - security: no writer exists yet (no login events). Re-enable together
 *   with login tracking (TODO(login-tracking)).
 */
const HIDDEN_CATEGORIES: ActivityCategory[] = ["audit", "security"];

const VISIBLE_CATEGORIES = ACTIVITY_CATEGORIES.filter(
  (category) => !HIDDEN_CATEGORIES.includes(category),
);

/**
 * Participant activity section: audience-specific projection of the central
 * audit store. Default is the fachliche coach view without technical events.
 * Category/audience/search/date filtering applies only to the already
 * authorized result set — never a substitute for server-side access control.
 */
export function ParticipantActivity({
  participantId,
  refreshKey = 0,
  audience = "coach",
}: ParticipantActivityProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEvents([]);
    setCursor(undefined);
    getParticipantActivity(participantId, 50)
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setCursor(res.nextCursor);
        setHasMore(res.hasNextPage);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error("Aktivitäten konnten nicht geladen werden"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [participantId, refreshKey]);

  const handleLoadMore = useCallback(async () => {
    const res = await getParticipantActivity(participantId, 50, cursor);
    setEvents((prev) => [...prev, ...res.events]);
    setCursor(res.nextCursor);
    setHasMore(res.hasNextPage);
  }, [participantId, cursor]);

  const visibleEvents = useMemo(() => {
    const projected = filterForAudience(events, audience, {
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      includeTechnicalEvents: showTechnical,
    });
    return filterActivityEvents(projected, { query, range });
  }, [events, audience, selectedCategories, showTechnical, query, range]);

  const activeFilterCount =
    selectedCategories.length +
    (showTechnical ? 1 : 0) +
    (query.trim() !== "" ? 1 : 0) +
    (range?.from != null ? 1 : 0);
  const filtersActive = activeFilterCount > 0;

  function toggleCategory(category: ActivityCategory) {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  }

  function resetFilters() {
    setQuery("");
    setRange(undefined);
    setSelectedCategories([]);
    setShowTechnical(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitäten</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Verlauf durchsuchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              aria-label="Verlauf durchsuchen"
            />
          </div>
          <DatePicker>
            <DatePickerRangeTrigger
              dateRange={range}
              placeholder="Zeitraum"
              dateFormat="dd.MM.yyyy"
              className="h-9"
            />
            <DatePickerContent>
              <DatePickerCalendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
              />
            </DatePickerContent>
          </DatePicker>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="size-4" />
              Zurücksetzen
            </Button>
          )}
        </div>
        {filtersActive && !loading && (
          <p className="mb-3 text-xs text-muted-foreground" role="status">
            {activeFilterCount} Filter aktiv · {visibleEvents.length} von{" "}
            {events.length} Einträgen
          </p>
        )}
        <div className="flex flex-wrap gap-2 mb-2">
          {VISIBLE_CATEGORIES.map((category) => {
            const active = selectedCategories.includes(category);
            return (
              <Button
                key={category}
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => toggleCategory(category)}
              >
                {CATEGORY_LABELS[category]}
              </Button>
            );
          })}
          <Button
            variant={showTechnical ? "default" : "outline"}
            size="sm"
            aria-pressed={showTechnical}
            onClick={() => setShowTechnical((v) => !v)}
            title="Technische Events einblenden (Supervisor)"
          >
            Technik
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Mehrfachauswahl möglich, Kategorien werden mit ODER verknüpft.
        </p>
        <ActivityTimeline
          events={visibleEvents}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          participantId={participantId}
        />
      </CardContent>
    </Card>
  );
}

export default ParticipantActivity;
