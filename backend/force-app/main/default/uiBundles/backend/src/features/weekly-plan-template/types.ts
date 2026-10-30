export const WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type EntryCategory = 'live' | 'async' | 'break' | 'special';

export interface PlanTime {
  start: string;
  end: string;
  label?: string;
}

export interface PlanEntry {
  id: string;
  category: EntryCategory;
  title: string;
  trainer?: string;
  topics?: string[];
  details?: string;
  units?: string;
  unitCount?: number;
  format?: string;
  time?: PlanTime;
  location?: string;
  note?: string;
}

export type DayEntries = Partial<Record<Weekday, PlanEntry[]>>;

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  durationMinutes: number;
  units?: string;
  format: string;
  entries: DayEntries;
}

export interface WeekPlan {
  title: string;
  subtitle: string;
  program: string;
  weekLabel: string;
  days: readonly Weekday[];
  timeSlots: TimeSlot[];
}
