import { weeklyPlanTemplate } from '@/features/weekly-plan-template/weekPlanData';
import type { Weekday } from '@/features/weekly-plan-template/types';
import { serializeGridConfig, timeToMinutes } from './gridConfig';
import type {
  EntryCategory,
  GridConfig,
  ImportTemplateEntry,
  ImportTemplateInput,
} from '@/types/schedule';

export const EXAMPLE_TEMPLATE_NAME = 'AWS Cloud & DevOps – Musterwoche';

const DAY_MAP: Record<Weekday, string> = {
  Montag: 'Monday',
  Dienstag: 'Tuesday',
  Mittwoch: 'Wednesday',
  Donnerstag: 'Thursday',
  Freitag: 'Friday',
};

function typeForCategory(category: EntryCategory): string {
  if (category === 'async') return 'Selbstlernphase';
  if (category === 'break' || category === 'special') return 'Sonstiges';
  return 'Workshop';
}

function buildDescription(
  topics: string[] | undefined,
  details: string | undefined,
): string | null {
  const parts = [topics?.join(' · '), details].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join('\n') : null;
}

function buildNotes(note: string | undefined): string | null {
  return note?.trim() ? note.trim() : null;
}

/**
 * Converts the static AWS example week into the same shape as a persisted
 * ScheduleTemplate__c. This is the one-time seed; the UI afterwards reads and
 * writes only Salesforce records.
 */
export function buildExampleTemplateImport(): ImportTemplateInput {
  const slots = weeklyPlanTemplate.timeSlots;
  const gridConfig: GridConfig = {
    version: 1,
    slots: slots.map((slot) => ({
      id: slot.id,
      start: slot.start,
      end: slot.end,
      durationMinutes: slot.durationMinutes,
      units: slot.units ?? '',
      format: slot.format,
      azav: '',
    })),
  };

  const entries: ImportTemplateEntry[] = [];
  for (const [slotIndex, slot] of slots.entries()) {
    for (const day of weeklyPlanTemplate.days) {
      for (const entry of slot.entries[day] ?? []) {
        const startTime = entry.time?.start ?? slot.start;
        const endTime = entry.time?.end ?? slot.end;
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        entries.push({
          title: entry.title,
          description: buildDescription(entry.topics, entry.details),
          entryKind: entry.category === 'async' ? 'Aufgabe' : 'Aktivität',
          type: typeForCategory(entry.category),
          isRequired: false,
          dayOfWeek: DAY_MAP[day],
          startTime,
          endTime,
          durationMinutes: start !== null && end !== null && end > start ? end - start : null,
          category: entry.category,
          timeSlotId: slot.id,
          order: slotIndex + 1,
          location: entry.location ?? null,
          notes: buildNotes(entry.note),
          coachName: entry.trainer ?? null,
        });
      }
    }
  }

  return {
    name: EXAMPLE_TEMPLATE_NAME,
    description: weeklyPlanTemplate.subtitle,
    status: 'Active',
    programId: null,
    programWeekId: null,
    gridConfig: serializeGridConfig(gridConfig),
    entries,
  };
}
