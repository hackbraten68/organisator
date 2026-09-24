/**
 * Domain Badge Component
 * 
 * Displays the domain and action of an audit event.
 */

import { Badge } from '@/components/ui/badge';
import type { AuditDomain, AuditAction } from '@/types/audit';

export interface DomainBadgeProps {
  domain: AuditDomain;
  action: AuditAction;
}

const DOMAIN_LABELS: Record<AuditDomain, string> = {
  participant: 'Teilnehmer',
  workbook: 'Arbeitsbuch',
  absence: 'Abwesenheit',
  appointment: 'Termin',
  classbook: 'Klassenbuch',
  daily_checkin: 'Tägliche Überprüfung',
  time_tracking: 'Zeiterfassung',
  authentication: 'Authentifizierung',
  system: 'System',
};

const ACTION_LABELS: Record<AuditAction, string> = {
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
  rescheduled: 'verschoben',
  attendance_changed: 'Anwesenheit geändert',
  document_added: 'Dokument hinzugefügt',
};

export function DomainBadge({ domain, action }: DomainBadgeProps) {
  const domainLabel = DOMAIN_LABELS[domain];
  const actionLabel = ACTION_LABELS[action];

  return (
    <Badge variant="outline" className="text-xs">
      {domainLabel} – {actionLabel}
    </Badge>
  );
}

export default DomainBadge;
