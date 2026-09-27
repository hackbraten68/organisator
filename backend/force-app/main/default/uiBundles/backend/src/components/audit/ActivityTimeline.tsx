/**
 * Activity Timeline Component
 * 
 * Renders a chronological list of audit events for a participant or entity.
 * 
 * Features:
 * - Chronological ordering (most recent first)
 * - Actor badge with user info
 * - Human-readable action labels
 * - Expandable details with field changes
 * - Pagination support
 * - Loading and error states
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AuditEvent, ActivityGrouping } from '@/types/audit';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import { ActivityEventDetailsDrawer } from './ActivityEventDetailsDrawer';

export interface ActivityTimelineProps {
  events: AuditEvent[];
  loading?: boolean;
  error?: Error | null;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  participantId?: string; // For participant-specific display
  /** Deep link (?event=): highlight + auto-open this event's details once. */
  highlightEventId?: string | null;
}

/**
 * Group events by correlation ID to show multi-event transactions as one item
 */function groupEventsByCorrelation(events: AuditEvent[]): ActivityGrouping[] {
  const groups = new Map<string, AuditEvent[]>();

  for (const event of events) {
    const key = event.correlationId ?? event.id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(event);
  }

  return Array.from(groups.entries()).map(([correlationId, groupEvents]) => ({
    correlationId,
    occurredAt: groupEvents[0]!.occurredAt,
    actor: {
      id: groupEvents[0]!.actorId,
      displayName: groupEvents[0]!.actorDisplayNameSnapshot ?? 'System',
      type: groupEvents[0]!.actorType,
    },
    summary: generateActivitySummary(groupEvents),
    events: groupEvents,
    changedEntityIds: [...new Set(groupEvents.map(e => e.subjectId))],
  }));
}

/**
 * Generate a human-readable summary of the activity
 */
function generateActivitySummary(events: AuditEvent[]): string {
  if (events.length === 1) {
    return formatEventAsActivity(events[0]!);
  }

  // Multiple events: group by type
  const eventTypes = [...new Set(events.map(e => e.eventType))];
  if (eventTypes.length === 1) {
    return `${events.length} Änderungen: ${formatEventTypeAsLabel(eventTypes[0]!)}`;
  }

  return `${events.length} Änderungen`;
}

/**
 * Format a single event as a human-readable activity
 */
function formatEventAsActivity(event: AuditEvent): string {
  const actionLabels: Record<string, string> = {
    created: 'erstellt',
    updated: 'aktualisiert',
    deleted: 'gelöscht',
    archived: 'archiviert',
    restored: 'wiederhergestellt',
    status_changed: 'Status geändert',
    submitted: 'eingereicht',
    approved: 'genehmigt',
    rejected: 'abgelehnt',
    cancelled: 'abgebrochen',
    checked_in: 'angemeldet',
    checked_out: 'abgemeldet',
    corrected: 'korrigiert',
    flagged: 'gekennzeichnet',
    reviewed: 'überprüft',
    assigned: 'zugewiesen',
    started: 'gestartet',
    stopped: 'beendet',
    answer_updated: 'Antwort geändert',
    reported: 'gemeldet',
    entry_created: 'Eintrag erstellt',
    entry_updated: 'Eintrag geändert',
    entry_deleted: 'Eintrag gelöscht',
    reordered: 'umsortiert',
  };

  const action = actionLabels[event.action] ?? event.action;
  const subject = event.subjectType.replace('__c', '');

  if (event.action === 'status_changed' && event.changes.length > 0) {
    const statusChange = event.changes.find(c => c.field === 'Status__c');
    if (statusChange) {
      return `Status von „${statusChange.oldValue}" auf „${statusChange.newValue}" geändert`;
    }
  }

  return `${subject} ${action}`;
}

/**
 * Format event type as human-readable label
 */
function formatEventTypeAsLabel(eventType: string): string {
  const [domain, action] = eventType.split('.');
  const labels: Record<string, string> = {
    participant: 'Teilnehmer',
    workbook: 'Arbeitsbuch',
    absence: 'Abwesenheit',
    appointment: 'Termin',
    classbook: 'Klassenbuch',
    daily_checkin: 'Tägliche Überprüfung',
    time_tracking: 'Zeiterfassung',
  };

  return `${labels[domain!] ?? domain} ${action}`;
}

export function ActivityTimeline({
  events,
  loading = false,
  error = null,
  onLoadMore,
  hasMore = false,
  participantId,
  highlightEventId = null,
}: ActivityTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const highlightHandled = useRef<string | null>(null);

  const grouped = groupEventsByCorrelation(events);

  // Deep link: open the linked event's details once it is loaded, scroll it
  // into view, and keep it highlighted. Runs once per highlightEventId.
  useEffect(() => {
    if (!highlightEventId || loading || highlightHandled.current === highlightEventId) return;
    const target = events.find((e) => e.id === highlightEventId);
    if (!target) return;
    highlightHandled.current = highlightEventId;
    const groupKey = target.correlationId ?? target.id;
    setExpandedId(groupKey);
    setSelectedEvent(target);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-correlation-id="${CSS.escape(groupKey)}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [highlightEventId, loading, events]);

  const highlightMissed =
    highlightEventId != null &&
    !loading &&
    error == null &&
    events.length > 0 &&
    !events.some((e) => e.id === highlightEventId);

  const handleLoadMore = async () => {
    if (onLoadMore && !isLoadingMore) {
      setIsLoadingMore(true);
      try {
        await onLoadMore();
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertDescription>
          Fehler beim Laden der Aktivitätshistorie: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Keine Aktivitäten vorhanden</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {highlightMissed && (
        <Alert role="status">
          <AlertDescription>
            Das verlinkte Ereignis wurde nicht gefunden — es ist möglicherweise
            gefiltert, noch nicht geladen oder für diese Ansicht nicht sichtbar.
          </AlertDescription>
        </Alert>
      )}
      {/* Timeline */}
      <div className="space-y-2 relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

        {/* Events */}
        {grouped.map((group) => (
          <div
            key={group.correlationId}
            data-correlation-id={group.correlationId}
            className={`relative pl-16 rounded-md ${
              highlightEventId != null &&
              group.events.some((e) => e.id === highlightEventId)
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : ""
            }`}
          >
            {/* Event dot */}
            <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-primary border-4 border-background" />

            {/* Event card */}
            <ActivityTimelineItem
              group={group}
              isExpanded={expandedId === group.correlationId}
              onToggleExpand={() =>
                setExpandedId(
                  expandedId === group.correlationId ? null : group.correlationId,
                )
              }
              onSelectEvent={(event) => setSelectedEvent(event)}
              participantId={participantId}
            />
          </div>
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            variant="outline"
          >
            {isLoadingMore ? 'Wird geladen...' : 'Weitere Aktivitäten laden'}
          </Button>
        </div>
      )}

      {/* Event details drawer */}
      {selectedEvent && (
        <ActivityEventDetailsDrawer
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          participantId={participantId}
        />
      )}
    </div>
  );
}

export default ActivityTimeline;
