import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/audit";
import { getParticipantActivity } from "@/api/audit/auditApiService";
import type { AuditEvent } from "@/types/audit";

interface ParticipantActivityProps {
  participantId: string;
  /** Bump to refetch (e.g. after a save). */
  refreshKey?: number;
}

/**
 * Participant activity section: chronological audit timeline for one
 * participant. First page loads on mount/selection change; older events
 * append via cursor pagination. Read-only projection of AuditEvent__c.
 */
export function ParticipantActivity({ participantId, refreshKey = 0 }: ParticipantActivityProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitäten</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityTimeline
          events={events}
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
