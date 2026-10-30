import type {
  EntryCategory,
  GridConfig,
  GridSlot,
  ScheduleEntry,
} from '@/types/schedule';

export type { GridConfig, GridSlot } from '@/types/schedule';

export const GRID_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const GRID_DAY_LABELS: Record<string, string> = {
  Monday: 'Montag',
  Tuesday: 'Dienstag',
  Wednesday: 'Mittwoch',
  Thursday: 'Donnerstag',
  Friday: 'Freitag',
  Saturday: 'Samstag',
  Sunday: 'Sonntag',
};

export const DEFAULT_GRID_SLOTS: GridSlot[] = [
  {
    id: 'slot-0830',
    start: '08:30',
    end: '10:00',
    durationMinutes: 90,
    units: '1. & 2. UE',
    format: 'Synchron, 2 UE',
    azav: '',
  },
  {
    id: 'slot-1000',
    start: '10:00',
    end: '10:15',
    durationMinutes: 15,
    units: '',
    format: 'Asynchron / flexibel',
    azav: '',
  },
  {
    id: 'slot-1015',
    start: '10:15',
    end: '10:30',
    durationMinutes: 15,
    units: '',
    format: 'Pause',
    azav: '',
  },
  {
    id: 'slot-1030',
    start: '10:30',
    end: '12:00',
    durationMinutes: 90,
    units: '3. & 4. UE',
    format: 'Synchron, 2 UE',
    azav: '',
  },
  {
    id: 'slot-1200',
    start: '12:00',
    end: '13:00',
    durationMinutes: 60,
    units: '',
    format: 'Pause',
    azav: '',
  },
  {
    id: 'slot-1300',
    start: '13:00',
    end: '14:30',
    durationMinutes: 90,
    units: '5. & 6. UE',
    format: 'Synchron, 2 UE',
    azav: '',
  },
  {
    id: 'slot-1430',
    start: '14:30',
    end: '14:45',
    durationMinutes: 15,
    units: '',
    format: 'Pause',
    azav: '',
  },
  {
    id: 'slot-1445',
    start: '14:45',
    end: '16:00',
    durationMinutes: 75,
    units: '',
    format: 'Asynchron',
    azav: '',
  },
];

export function createDefaultGridConfig(): GridConfig {
  return {
    version: 1,
    slots: DEFAULT_GRID_SLOTS.map((slot) => ({ ...slot })),
  };
}

export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesToTime(value: number): string {
  const bounded = Math.max(0, Math.min(24 * 60 - 1, value));
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function slotDurationMinutes(slot: Pick<GridSlot, 'start' | 'end'>): number {
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return '–';
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeSlot(raw: unknown, index: number): GridSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const start = asText(record.start).slice(0, 5);
  const end = asText(record.end).slice(0, 5);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  const normalizedStart = minutesToTime(startMinutes);
  const normalizedEnd = minutesToTime(endMinutes);
  const duration = slotDurationMinutes({ start: normalizedStart, end: normalizedEnd });
  if (duration <= 0) return null;
  return {
    id: asText(record.id) || `slot-${index + 1}`,
    start: normalizedStart,
    end: normalizedEnd,
    durationMinutes: duration,
    units: asText(record.units),
    format: asText(record.format),
    azav: asText(record.azav),
  };
}

/**
 * Reads the persisted JSON. Invalid or missing data falls back to the eight
 * standard blocks, while legacy entries remain visible in the "Nicht
 * zugeordnet" row.
 */
export function normalizeGridConfig(raw: string | null | undefined): GridConfig {
  if (!raw) return createDefaultGridConfig();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return createDefaultGridConfig();
  }
  if (!parsed || typeof parsed !== 'object') return createDefaultGridConfig();
  const config = parsed as Record<string, unknown>;
  const slots = Array.isArray(config.slots)
    ? config.slots
        .map((slot, index) => normalizeSlot(slot, index))
        .filter((slot): slot is GridSlot => slot !== null)
    : [];
  if (slots.length === 0) return createDefaultGridConfig();
  return {
    version: 1,
    slots: sortSlots(slots),
  };
}

export function sortSlots(slots: GridSlot[]): GridSlot[] {
  return [...slots].sort((a, b) => {
    const startDiff = (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0);
    if (startDiff !== 0) return startDiff;
    return a.id.localeCompare(b.id);
  });
}

export function serializeGridConfig(config: GridConfig): string {
  return JSON.stringify({
    version: 1,
    slots: sortSlots(config.slots).map((slot) => ({
      id: slot.id,
      start: slot.start,
      end: slot.end,
      durationMinutes: slotDurationMinutes(slot),
      units: slot.units ?? '',
      format: slot.format ?? '',
      azav: slot.azav ?? '',
    })),
  });
}

export function deriveEntryCategory(entry: ScheduleEntry): EntryCategory {
  if (entry.category) return entry.category;
  const title = entry.title.toLowerCase();
  const type = entry.type.toLowerCase();
  if (title.includes('pause') || type.includes('pause')) return 'break';
  if (
    entry.entryKind === 'Aufgabe' ||
    type.includes('selbstlern') ||
    type.includes('selbststud') ||
    type.includes('asynchron')
  ) {
    return 'async';
  }
  if (type === 'sonstiges') return 'special';
  return 'live';
}

export function resolveEntrySlot(
  entry: ScheduleEntry,
  slots: GridSlot[],
): GridSlot | null {
  if (entry.timeSlotId) {
    const byId = slots.find((slot) => slot.id === entry.timeSlotId);
    if (byId) return byId;
  }

  const start = timeToMinutes(entry.startTime);
  const end = timeToMinutes(entry.endTime);
  if (start === null || end === null || end <= start) return null;

  const exact = slots.find(
    (slot) =>
      timeToMinutes(slot.start) === start && timeToMinutes(slot.end) === end,
  );
  if (exact) return exact;

  const containing = slots
    .filter(
      (slot) =>
        (timeToMinutes(slot.start) ?? Infinity) <= start &&
        (timeToMinutes(slot.end) ?? -Infinity) >= end,
    )
    .sort((a, b) => slotDurationMinutes(a) - slotDurationMinutes(b));
  return containing[0] ?? null;
}

export interface GridEntryGroups {
  bySlotAndDay: Map<string, ScheduleEntry[]>;
  unmatched: ScheduleEntry[];
}

export function groupEntriesForGrid(
  entries: ScheduleEntry[],
  config: GridConfig,
  days: readonly string[] = GRID_DAYS,
): GridEntryGroups {
  const bySlotAndDay = new Map<string, ScheduleEntry[]>();
  const unmatched: ScheduleEntry[] = [];
  const daySet = new Set(days);

  for (const entry of entries) {
    if (!daySet.has(entry.dayOfWeek)) {
      unmatched.push(entry);
      continue;
    }
    const slot = resolveEntrySlot(entry, config.slots);
    if (!slot) {
      unmatched.push(entry);
      continue;
    }
    const key = `${slot.id}|${entry.dayOfWeek}`;
    const current = bySlotAndDay.get(key) ?? [];
    current.push(entry);
    bySlotAndDay.set(key, current);
  }

  for (const list of bySlotAndDay.values()) {
    list.sort((a, b) => {
      const orderDiff = (a.order ?? 999) - (b.order ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  }
  unmatched.sort((a, b) => {
    const dayDiff = days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });

  return { bySlotAndDay, unmatched };
}

export function nextSlotId(slots: GridSlot[]): string {
  const existing = new Set(slots.map((slot) => slot.id));
  let index = slots.length + 1;
  while (existing.has(`slot-${index}`)) index += 1;
  return `slot-${index}`;
}
