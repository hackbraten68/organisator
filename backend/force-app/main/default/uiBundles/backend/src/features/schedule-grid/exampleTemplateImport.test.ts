import { describe, expect, it } from 'vitest';

import { buildExampleTemplateImport, EXAMPLE_TEMPLATE_NAME } from './exampleTemplateImport';

describe('example template import', () => {
  it('builds eight slots and forty entries from the static AWS week', () => {
    const input = buildExampleTemplateImport();
    const grid = JSON.parse(input.gridConfig);

    expect(input.name).toBe(EXAMPLE_TEMPLATE_NAME);
    expect(grid.slots).toHaveLength(8);
    expect(input.entries).toHaveLength(40);
    expect(input.entries.every((entry) => entry.timeSlotId)).toBe(true);
  });

  it('preserves the special Gabi session with its own time', () => {
    const input = buildExampleTemplateImport();
    const special = input.entries.find((entry) => entry.title === 'Gabi-Session');

    expect(special).toMatchObject({
      dayOfWeek: 'Wednesday',
      startTime: '11:00',
      endTime: '12:00',
      category: 'special',
      timeSlotId: 'slot-1030',
      location: 'Zoom',
      coachName: null,
    });
  });

  it('maps async and break entries to valid schedule values', () => {
    const input = buildExampleTemplateImport();
    const asyncEntry = input.entries.find((entry) => entry.title === 'Asynchrones Lernen I');
    const breakEntry = input.entries.find((entry) => entry.title === 'Kaffeepause');

    expect(asyncEntry).toMatchObject({
      entryKind: 'Aufgabe',
      type: 'Selbstlernphase',
      category: 'async',
    });
    expect(breakEntry).toMatchObject({
      entryKind: 'Aktivität',
      type: 'Sonstiges',
      category: 'break',
    });
  });
});
