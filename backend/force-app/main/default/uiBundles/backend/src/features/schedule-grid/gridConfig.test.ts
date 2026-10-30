import { describe, expect, it } from 'vitest';

import type { ScheduleEntry } from '@/types/schedule';
import {
  createDefaultGridConfig,
  deriveEntryCategory,
  groupEntriesForGrid,
  normalizeGridConfig,
  serializeGridConfig,
  timeToMinutes,
} from './gridConfig';

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: 'e1',
    title: 'Live-Unterricht',
    description: null,
    entryKind: 'Aktivität',
    type: 'Workshop',
    isRequired: false,
    dayOfWeek: 'Monday',
    startTime: '08:30:00.000Z',
    endTime: '10:00:00.000Z',
    durationMinutes: 90,
    targetType: 'Course',
    participantGroupId: null,
    participantId: null,
    coachProfileId: null,
    coachName: null,
    location: null,
    meetingLink: null,
    order: 1,
    deviationReason: null,
    notes: null,
    isCustomized: false,
    timeSlotId: null,
    category: null,
    ...overrides,
  };
}

describe('schedule grid config', () => {
  it('falls back to the eight standard blocks for missing or invalid JSON', () => {
    expect(normalizeGridConfig(null).slots).toHaveLength(8);
    expect(normalizeGridConfig('{broken').slots).toHaveLength(8);
    expect(normalizeGridConfig('{"version":1,"slots":[]}').slots).toHaveLength(8);
  });

  it('normalizes times, recomputes duration and sorts slots', () => {
    const config = normalizeGridConfig(
      JSON.stringify({
        version: 1,
        slots: [
          { id: 'late', start: '13:00', end: '14:30', format: 'Synchron' },
          { id: 'early', start: '8:30', end: '10:00', format: 'Synchron' },
        ],
      }),
    );

    expect(config.slots.map((slot) => slot.id)).toEqual(['early', 'late']);
    expect(config.slots[0]).toMatchObject({ start: '08:30', end: '10:00', durationMinutes: 90 });
  });

  it('serializes a canonical JSON payload', () => {
    const parsed = JSON.parse(serializeGridConfig(createDefaultGridConfig()));
    expect(parsed.version).toBe(1);
    expect(parsed.slots).toHaveLength(8);
    expect(parsed.slots[0]).toMatchObject({ id: 'slot-0830', durationMinutes: 90 });
  });

  it('groups entries by slot and day and keeps unmatched entries visible', () => {
    const config = normalizeGridConfig(null);
    const { bySlotAndDay, unmatched } = groupEntriesForGrid(
      [
        entry({ id: 'normal', timeSlotId: 'slot-0830' }),
        entry({
          id: 'special',
          title: 'Gabi-Session',
          category: 'special',
          dayOfWeek: 'Wednesday',
          startTime: '11:00:00.000Z',
          endTime: '12:00:00.000Z',
        }),
        entry({
          id: 'legacy',
          dayOfWeek: 'Saturday',
          startTime: '09:00:00.000Z',
          endTime: '10:00:00.000Z',
        }),
      ],
      config,
    );

    expect(bySlotAndDay.get('slot-0830|Monday')?.[0].id).toBe('normal');
    expect(bySlotAndDay.get('slot-1030|Wednesday')?.[0].id).toBe('special');
    expect(unmatched.map((item) => item.id)).toEqual(['legacy']);
  });

  it('derives a category for legacy entries', () => {
    expect(deriveEntryCategory(entry({ title: 'Kaffeepause' }))).toBe('break');
    expect(deriveEntryCategory(entry({ entryKind: 'Aufgabe', type: 'Selbstlernphase' }))).toBe('async');
    expect(deriveEntryCategory(entry({ type: 'Sonstiges' }))).toBe('special');
    expect(deriveEntryCategory(entry())).toBe('live');
  });

  it('parses times independently of the date suffix', () => {
    expect(timeToMinutes('08:30:00.000Z')).toBe(510);
    expect(timeToMinutes('8:30')).toBe(510);
  });
});
