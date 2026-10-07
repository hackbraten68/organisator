/**
 * Verlauf der eigenen Verfuegbarkeits-Slots.
 *
 * Fuellt eine Luecke, die es vorher nicht gab: geloeschte Slots waren im
 * Audit-Protokoll, aber aus keiner Oberflaeche erreichbar. Wer einem Coach
 * einen Slot versehentlich weggeloescht hat, konnte es nur mit einem Report
 * oder SOQL finden. Siehe `availabilityAuditTrail`.
 */

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/layout";
import { getAvailabilityAuditTrail } from "@/api/audit/availabilityAuditTrail";
import type { AuditEvent } from "@/types/audit";

interface AvailabilityHistoryProps {
  currentUserId: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: "angelegt",
  updated: "geändert",
  deleted: "gelöscht",
};

const CHANGE_LABELS: Record<string, string> = {
  User__c: "Coach",
  DayOfWeek__c: "Tag",
  StartTime__c: "Von",
  EndTime__c: "Bis",
  Type__c: "Typ",
  IsActive__c: "Aktiv",
  ValidFrom__c: "Gültig ab",
  ValidTo__c: "Gültig bis",
};

/** "09:00:00.000Z" -> "09:00"; unbrauchbare Werte bleiben, wie sie sind. */
function shortTime(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match ? match[1] : null;
}

/**
 * Kurzbeschreibung der Aenderung, aus den tatsaechlichen Werten gebaut.
 *
 * Bewusst nicht aus `changedFields`: dort steht fuer "angelegt" und "geloescht"
 * das volle Feldraster, aber ohne einen Wert. Bei einer Loeschung ist genau der
 * Wert das Interessante ("welcher Slot ist weg?"), und der steht in
 * `changes[].oldValue`.
 */
function describeChanges(event: AuditEvent): string {
  const changes = event.changes;
  if (!Array.isArray(changes) || changes.length === 0) return "";

  const valueOf = (field: string): unknown =>
    event.action === "deleted"
      ? changes.find((c) => c.field === field)?.oldValue
      : changes.find((c) => c.field === field)?.newValue;

  const parts: string[] = [];
  const day = valueOf("DayOfWeek__c");
  if (typeof day === "string" && day) parts.push(day);
  const start = shortTime(valueOf("StartTime__c"));
  const end = shortTime(valueOf("EndTime__c"));
  if (start && end) parts.push(`${start}–${end}`);

  if (parts.length > 0) return parts.join(" · ");

  const changed = (event.changedFields as string[]) ?? [];
  return changed
    .map((field) => CHANGE_LABELS[field] ?? field)
    .filter((label) => label !== CHANGE_LABELS.User__c)
    .slice(0, 3)
    .join(", ");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AvailabilityHistory({ currentUserId }: AvailabilityHistoryProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `withSpinner` nur beim manuellen Nachladen: im Effekt sind `loading` und
  // `error` bereits auf ihrem Anfangswert, die beiden setStates dort wuerden also
  // kaskadierende Renders ohne Aenderung ausloesen — genau die Warnung, die in
  // 16 weiteren Dateien steht (Paket B6).
  const applyResult = useCallback(
    (loaded: AuditEvent[] | null) => {
      if (loaded) {
        setEvents(loaded);
        return;
      }
      setEvents([]);
      setError("Der Verlauf konnte nicht geladen werden.");
    },
    [],
  );

  const load = useCallback(
    async (withSpinner: boolean) => {
      if (withSpinner) {
        setLoading(true);
        setError(null);
      }
      try {
        applyResult(await getAvailabilityAuditTrail(currentUserId));
      } catch {
        applyResult(null);
      } finally {
        setLoading(false);
      }
    },
    [currentUserId, applyResult],
  );

  // Eigenstaendiger Effekt statt `void load(false)`: so stehen die setStates in
  // Callbacks und nicht im Effektkoerper. `cancelled` verhindert, dass ein
  // Wechsel der User-ID eine Antwort der alten noch in die Liste schreibt.
  useEffect(() => {
    let cancelled = false;
    getAvailabilityAuditTrail(currentUserId)
      .then((loaded) => {
        if (!cancelled) applyResult(loaded);
      })
      .catch(() => {
        if (!cancelled) applyResult(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, applyResult]);

  return (
    <section aria-labelledby="verfuegbarkeit-verlauf" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="verfuegbarkeit-verlauf" className="text-h3 flex items-center gap-2">
          <History className="size-5" aria-hidden="true" />
          Verlauf
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void load(true)} disabled={loading}>
          <RefreshCw className="size-4 mr-2" aria-hidden="true" />
          Aktualisieren
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<History className="size-12" />}
          title="Noch keine Änderungen protokolliert"
          description={
            error ??
            "Sobald Sie Slots anlegen, bearbeiten oder löschen, erscheinen sie hier."
          }
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(event.occurredAt)}
              </span>
              <Badge variant={event.action === "deleted" ? "destructive" : "secondary"}>
                {ACTION_LABELS[event.action] ?? event.action}
              </Badge>
              <span className="font-medium">{describeChanges(event) || "—"}</span>
              {event.metadata.isActive === false && (
                <Badge variant="outline">inaktiv</Badge>
              )}
              {event.actorDisplayNameSnapshot && (
                <span className="text-xs text-muted-foreground">
                  von {event.actorDisplayNameSnapshot}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
