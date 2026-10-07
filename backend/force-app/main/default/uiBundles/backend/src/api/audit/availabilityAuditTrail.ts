/**
 * Audit-Verlauf der eigenen Verfuegbarkeits-Slots.
 *
 * Warum ein eigener Pfad und nicht die Teilnehmer-Timeline: ein
 * `AvailabilitySlot__c` haengt an einem `User`, nicht an einem Teilnehmer.
 * Die Ereignisse tragen darum bewusst kein `ParticipantId__c` (siehe
 * `availabilityAuditIntegration.baseRecord`), und `GetParticipantActivityTimeline`
 * filtert genau auf dieses Feld. Slot-Aenderungen waren protokolliert, aber aus
 * der Oberflaeche heraus nicht abrufbar — die Loeschung eines Slots war damit
 * praktisch unsichtbar.
 *
 * Der Domain-Filter steht in der Query, nicht nur hier im Code.
 */

import { executeGraphQL } from '../graphqlClient';
import { mapAuditEventNode } from './auditApiService';
import type { AuditEventNode } from './auditApiService';
import type { AuditEvent } from '@/types/audit';
import GET_AVAILABILITY_AUDIT_TRAIL from './query/GetAvailabilityAuditTrail.graphql?raw';

interface AvailabilityTrailResponse {
  uiapi?: {
    query?: {
      AuditEvent__c?: {
        edges?: Array<{ node?: AuditEventNode | null } | null> | null;
      } | null;
    } | null;
  } | null;
}

export const AVAILABILITY_TRAIL_DEFAULT_LIMIT = 25;

/**
 * Die letzten Aenderungen an den Verfuegbarkeits-Slots eines Users.
 *
 * Der Projection-Filter laeuft hier bewusst NICHT: `availability.*` ist als
 * "erscheint in keiner Audience-Ansicht" klassifiziert (availabilityAudit.test.ts),
 * und `filterForAudience` wuerde die Liste leeren. Das ist auch richtig so — die
 * Audience-Projection entscheidet fachliche Relevanz, nicht Zugriff.
 *
 * Die Einsraenkung auf die eigene User-ID kommt aus der Query. Sie ist keine
 * Sicherheitsgrenze und kann auch keine sein: `AuditEvent__c` hat OWD Private
 * und `viewAllRecords` fuer `backend_Coach` (Befund A1), ein Coach kann sich
 * fremde Audit-Ereignisse ohnehin ueber den Explorer holen.
 */
export async function getAvailabilityAuditTrail(
  userId: string,
  options: { limit?: number } = {},
): Promise<AuditEvent[]> {
  if (!userId) return [];

  const data = await executeGraphQL<AvailabilityTrailResponse, { userId: string; limit: number }>(
    GET_AVAILABILITY_AUDIT_TRAIL,
    { userId, limit: options.limit ?? AVAILABILITY_TRAIL_DEFAULT_LIMIT },
  );

  const edges = data.uiapi?.query?.AuditEvent__c?.edges ?? [];
  const events = edges
    .filter((edge): edge is { node: AuditEventNode } => edge?.node != null)
    .map((edge) => mapAuditEventNode(edge.node));

  return events;
}
