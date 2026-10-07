/**
 * Activity Event Details Drawer Component
 *
 * Side panel showing complete details of an audit event.
 * Built on shadcn Dialog (right-side panel variant).
 */

import { format } from 'date-fns';
import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AuditEvent } from '@/types/audit';
import { ActorBadge } from './ActorBadge';
import { DomainBadge } from './DomainBadge';
import { ChangeSetViewer } from './ChangeSetViewer';
import { RestoreDeletedButton } from './RestoreDeletedButton';

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
}: ActivityEventDetailsDrawerProps) {
  const occurredDate = new Date(event.occurredAt);
  const recordedDate = new Date(event.recordedAt);
  const [linkCopied, setLinkCopied] = useState(false);

  // Canonical deep link to this event. Built from the current location
  // (already the participant route incl. basename) — share-safe by design:
  // viewers without access see an empty timeline, never the event.
  async function copyDeepLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "verlauf");
    url.searchParams.set("event", event.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy deep link", err);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        aria-describedby={undefined}
        className="left-auto right-0 top-0 h-screen max-h-screen w-full max-w-96 translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-l border-t-0 border-r-0 border-b-0 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
      >
        <DialogHeader className="border-b bg-muted/50 p-4">
          <DialogTitle>Ereignisdetails</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-6">
          {/* Wiederherstellen — vor allem anderen, weil es die einzige Aktion
              ist, die den Ereigniszustand tatsaechlich aendert. */}
          <RestoreDeletedButton event={event} />

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
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
                      {event.correlationId}
                    </p>
                  </div>
                )}
                {event.requestId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Anfrage-ID</p>
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400">
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
            <Button
              variant="outline"
              size="sm"
              onClick={copyDeepLink}
              aria-live="polite"
            >
              {linkCopied ? (
                <>
                  <Check className="size-4" /> Link kopiert
                </>
              ) : (
                <>
                  <Link2 className="size-4" /> Link zu diesem Ereignis kopieren
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityEventDetailsDrawer;
