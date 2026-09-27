import type { DateRange } from "react-day-picker";
import type { AuditEvent } from "@/types/audit";

export interface ActivityTextDateFilter {
  query?: string;
  range?: DateRange;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Text + date filtering over an already authorized, already projected event
 * set. Client-side display filtering only — never a substitute for
 * server-side access control.
 *
 * Text matches eventType, domain, action, actor snapshot, reason and changed
 * fields. Date range (inclusive, calendar-day granularity) applies to
 * occurredAt.
 */
export function filterActivityEvents(
  events: AuditEvent[],
  filter: ActivityTextDateFilter,
): AuditEvent[] {
  const needle = filter.query?.trim().toLowerCase();
  const from = filter.range?.from ? startOfDay(filter.range.from) : undefined;
  const to =
    filter.range?.to ?? filter.range?.from
      ? endOfDay(filter.range?.to ?? filter.range!.from!)
      : undefined;
  if (!needle && !from && !to) return events;
  return events.filter((event) => {
    if (from || to) {
      const occurred = new Date(event.occurredAt).getTime();
      if (Number.isNaN(occurred)) return false;
      if (from && occurred < from.getTime()) return false;
      if (to && occurred > to.getTime()) return false;
    }
    if (!needle) return true;
    const haystack = [
      event.eventType,
      event.domain,
      event.action,
      event.actorDisplayNameSnapshot,
      event.reason,
      ...event.changedFields,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}
