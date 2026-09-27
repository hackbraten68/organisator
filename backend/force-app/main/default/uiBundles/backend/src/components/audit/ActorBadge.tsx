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
  staff: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-900 dark:text-blue-200' },
  participant: { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-900 dark:text-green-200' },
  system: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-900 dark:text-gray-200' },
  integration: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-900 dark:text-purple-200' },
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
