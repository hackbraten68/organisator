import { describe, expect, it } from 'vitest';

import { WEEKDAYS } from './types';
import { weeklyPlanTemplate } from './weekPlanData';

describe('weeklyPlanTemplate', () => {
  it('contains all five weekdays and eight time slots', () => {
    expect(weeklyPlanTemplate.days).toEqual(WEEKDAYS);
    expect(weeklyPlanTemplate.timeSlots).toHaveLength(8);
  });

  it('keeps the configured time blocks in order with their durations', () => {
    expect(
      weeklyPlanTemplate.timeSlots.map((slot) => slot.durationMinutes),
    ).toEqual([90, 15, 15, 90, 60, 90, 15, 75]);

    expect(weeklyPlanTemplate.timeSlots[0]).toMatchObject({
      start: '08:30',
      end: '10:00',
    });
    expect(weeklyPlanTemplate.timeSlots[7]).toMatchObject({
      start: '14:45',
      end: '16:00',
    });
  });

  it('contains the Wednesday special appointment with its own time and location', () => {
    const slot = weeklyPlanTemplate.timeSlots.find(
      (candidate) => candidate.id === 'slot-1030',
    );

    expect(slot?.entries.Mittwoch?.[0]).toMatchObject({
      category: 'special',
      title: 'Gabi-Session',
      location: 'Zoom',
      time: { start: '11:00', end: '12:00' },
    });
  });
});
