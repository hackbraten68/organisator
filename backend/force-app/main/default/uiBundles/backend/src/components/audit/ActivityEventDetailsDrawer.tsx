/**
 * Activity Event Details Drawer Component
 * 
 * Side panel showing complete details of an audit event.
 */

import { format } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AuditEvent } from '@/types/audit';
import { ActorBadge } from './ActorBadge';
import { DomainBadge } from './DomainBadge';
import { ChangeSetViewer } from './ChangeSetViewer';

export interface ActivityEventDetailsDrawerProps {
  event: AuditEvent;
  isOpen: boolean;
  onClose: () => void;
  participantId?: string;
}

export function ActivityEventDetailsDrawer({
  event,
  isOpen,
  onClose,
  participantId,
}: ActivityEventDetailsDrawerProps) {
  if (!isOpen) return null;

  const occurredDate = new Date(event.occurredAt);
  const recordedDate = new Date(event.recordedAt);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-screen w-96 bg-background border-l shadow-lg z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 border-b bg-muted/50 p-4 flex items-center justify-between">
          <h2 className="font-semibold">Ereignisdetails</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Event type and domain */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              EREIGNISTYP
            </label>
            <div className="space-y-2">
              <p className="text-sm font-mono">{event.eventType}</p>
              <DomainBadge domain={event.domain} action={event.action} />
            </div>
          </div>

          {/* Actor */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              DURCHFÜHRENDER
            </label>
            <ActorBadge
              displayName={event.actorDisplayNameSnapshot ?? 'Unbekannt'}
              type={event.actorType}
            />
            {event.actorId && (
              <p className="text-xs text-muted-foreground">ID: {event.actorId}</p>
            )}
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                EINGETRETEN
              </label>
              <p className="text-xs">
                {format(occurredDate, 'dd.MM.yyyy HH:mm:ss')}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                PROTOKOLLIERT
              </label>
              <p className="text-xs">
                {format(recordedDate, 'dd.MM.yyyy HH:mm:ss')}
              </p>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              BETROFFENE ENTITÄT
            </label>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {event.subjectType}
              </p>
              <p className="text-xs font-mono">{event.subjectId}</p>
            </div>
          </div>

          {/* Parent entity (if applicable) */}
          {event.parentType && event.parentId && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                ÜBERGEORDNETE ENTITÄT
              </label>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {event.parentType}
                </p>
                <p className="text-xs font-mono">{event.parentId}</p>
              </div>
            </div>
          )}

          {/* Source */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              QUELLE
            </label>
            <Badge variant="secondary" className="text-xs">
              {event.source}
            </Badge>
          </div>

          {/* Correlation & Request IDs */}
          {(event.correlationId || event.requestId) && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                VERFOLGUNG
              </label>
              <div className="space-y-1">
                {event.correlationId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Korrelations-ID</p>
                    <p className="text-xs font-mono text-amber-600">
                      {event.correlationId}
                    </p>
                  </div>
                )}
                {event.requestId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Anfrage-ID</p>
                    <p className="text-xs font-mono text-amber-600">
                      {event.requestId}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reason */}
          {event.reason && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                BEGRÜNDUNG
              </label>
              <p className="text-xs bg-muted p-2 rounded">{event.reason}</p>
            </div>
          )}

          {/* Field changes */}
          {event.changes && event.changes.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                FELDÄNDERUNGEN ({event.changes.length})
              </label>
              <ChangeSetViewer changes={event.changes} />
            </div>
          )}

          {/* Metadata */}
          {Object.keys(event.metadata || {}).length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                METADATEN
              </label>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Visibility and Sensitivity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                SICHTBARKEIT
              </label>
              <Badge
                variant={
                  event.visibility === 'restricted'
                    ? 'destructive'
                    : 'secondary'
                }
                className="text-xs"
              >
                {event.visibility}
              </Badge>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                EMPFINDLICHKEIT
              </label>
              <Badge
                variant={
                  event.sensitivity === 'restricted'
                    ? 'destructive'
                    : 'secondary'
                }
                className="text-xs"
              >
                {event.sensitivity}
              </Badge>
            </div>
          </div>

          {/* Event ID */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-xs font-semibold text-muted-foreground">
              EREIGNIS-ID
            </label>
            <p className="text-xs font-mono text-muted-foreground break-all">
              {event.id}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default ActivityEventDetailsDrawer;
