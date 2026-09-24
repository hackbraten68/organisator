/**
 * Activity Timeline Item Component
 * 
 * Renders a single event or group of events in the timeline.
 */

import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActivityGrouping, AuditEvent, AuditActorType } from '@/types/audit';
import { ActorBadge } from './ActorBadge';
import { DomainBadge } from './DomainBadge';
import { ChangeSetViewer } from './ChangeSetViewer';

export interface ActivityTimelineItemProps {
  group: ActivityGrouping;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectEvent: (event: AuditEvent) => void;
  participantId?: string;
}

/**
 * Get icon/color for actor type
 */
function getActorTypeColor(type: AuditActorType): string {
  switch (type) {
    case 'staff':
      return 'bg-blue-100 text-blue-900';
    case 'participant':
      return 'bg-green-100 text-green-900';
    case 'system':
      return 'bg-gray-100 text-gray-900';
    case 'integration':
      return 'bg-purple-100 text-purple-900';
    default:
      return 'bg-gray-100 text-gray-900';
  }
}

/**
 * Get actor type label
 */
function getActorTypeLabel(type: AuditActorType): string {
  const labels: Record<AuditActorType, string> = {
    staff: 'Team',
    participant: 'Teilnehmer',
    system: 'System',
    integration: 'Integration',
  };
  return labels[type];
}

export function ActivityTimelineItem({
  group,
  isExpanded,
  onToggleExpand,
  onSelectEvent,
  participantId,
}: ActivityTimelineItemProps) {
  const primary = group.events[0]!;
  const isMulti = group.events.length > 1;

  // Format timestamp
  const occurredDate = new Date(group.occurredAt);
  const timeAgo = formatDistanceToNow(occurredDate, { locale: de, addSuffix: true });
  const timeFormatted = format(occurredDate, 'dd.MM.yyyy HH:mm:ss');

  return (
    <Card className="mb-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Primary info */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActorBadge
                displayName={group.actor.displayName}
                type={group.actor.type}
              />
              <span className="text-sm text-muted-foreground">{timeAgo}</span>
            </div>

            {/* Summary */}
            <p className="text-sm font-medium mt-2 leading-tight">
              {group.summary}
            </p>

            {/* Domain badge */}
            {primary && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <DomainBadge domain={primary.domain} action={primary.action} />
                {isMulti && (
                  <Badge variant="secondary" className="text-xs">
                    {group.events.length} Ereignisse
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Expand button */}
          {group.events.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="mt-1"
              aria-expanded={isExpanded}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="pt-0 space-y-3 border-t">
          {/* Timestamp detail */}
          <div className="text-xs text-muted-foreground">
            <p>{timeFormatted} UTC</p>
            {primary.reason && (
              <p className="mt-1 font-medium">Begründung: {primary.reason}</p>
            )}
          </div>

          {/* Field changes */}
          {group.events.map((event, idx) => (
            <div key={event.id} className="space-y-2">
              {isMulti && idx > 0 && <hr className="my-2" />}

              {event.changes && event.changes.length > 0 && (
                <ChangeSetViewer changes={event.changes} />
              )}

              {/* Metadata */}
              {Object.keys(event.metadata || {}).length > 0 && (
                <div className="text-xs p-2 bg-muted rounded">
                  <p className="font-medium mb-1">Kontext:</p>
                  <ul className="space-y-1">
                    {Object.entries(event.metadata || {}).map(([key, val]) => (
                      <li key={key}>
                        {key}: <span className="text-muted-foreground">{String(val)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Details button */}
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs"
                onClick={() => onSelectEvent(event)}
              >
                Vollständige Details →
              </Button>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default ActivityTimelineItem;
