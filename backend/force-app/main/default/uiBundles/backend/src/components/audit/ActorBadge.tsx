/**
 * Actor Badge Component
 * 
 * Displays who performed the action with visual distinction by type.
 */

import { Badge } from '@/components/ui/badge';
import type { AuditActorType } from '@/types/audit';

export interface ActorBadgeProps {
  displayName: string;
  type: AuditActorType;
  avatarUrl?: string;
}

const ACTOR_COLORS: Record<AuditActorType, { bg: string; text: string }> = {
  staff: { bg: 'bg-blue-100', text: 'text-blue-900' },
  participant: { bg: 'bg-green-100', text: 'text-green-900' },
  system: { bg: 'bg-gray-100', text: 'text-gray-900' },
  integration: { bg: 'bg-purple-100', text: 'text-purple-900' },
};

const ACTOR_LABELS: Record<AuditActorType, string> = {
  staff: 'Team',
  participant: 'Teilnehmer',
  system: 'System',
  integration: 'Integration',
};

export function ActorBadge({ displayName, type, avatarUrl }: ActorBadgeProps) {
  const colors = ACTOR_COLORS[type];
  const label = ACTOR_LABELS[type];

  return (
    <Badge className={`${colors.bg} ${colors.text} border-0`}>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-3 h-3 rounded-full mr-1"
        />
      )}
      <span className="text-xs">
        {displayName}
        {type !== 'participant' && ` (${label})`}
      </span>
    </Badge>
  );
}

export default ActorBadge;
