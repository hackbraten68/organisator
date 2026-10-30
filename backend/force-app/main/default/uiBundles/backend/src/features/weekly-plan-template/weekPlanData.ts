import {
  WEEKDAYS,
  type DayEntries,
  type EntryCategory,
  type PlanEntry,
  type TimeSlot,
  type WeekPlan,
  type Weekday,
} from './types';

/**
 * Zentrale Datenquelle der Wochenplan-Vorlage.
 *
 * Inhalte werden hier gepflegt, nicht im Tabellen-Markup. Ein Eintrag kann pro
 * Wochentag direkt ergänzt werden, z. B.:
 *
 *   entries: {
 *     Mittwoch: [
 *       createEntry('mein-sondertermin', 'special', 'Zusatztermin', {
 *         time: { start: '11:00', end: '12:00' },
 *         location: 'Zoom',
 *       }),
 *     ],
 *   }
 *
 * Mehrere Einträge pro Tag sind erlaubt; sie werden untereinander in der
 * jeweiligen Tageszelle dargestellt.
 */

const MORNING_TOPICS: Record<Weekday, string[]> = {
  Montag: ['Feedback', 'KursPlan'],
  Dienstag: ['AWS Cloud Practitioner'],
  Mittwoch: ['AWS Solutions Architect Associate'],
  Donnerstag: ['AWS Cloud Practitioner', 'Kubernetes'],
  Freitag: ['AWS Solutions Architect Associate', 'Azure'],
};

const MID_MORNING_TOPICS: Record<Weekday, string[]> = {
  Montag: ['AWS Cloud Practitioner'],
  Dienstag: ['AWS Solutions Architect Associate'],
  Mittwoch: ['AWS Solutions Architect Associate'],
  Donnerstag: ['Kubernetes'],
  Freitag: ['Azure'],
};

const AFTERNOON_TOPICS: Record<Weekday, string[]> = {
  Montag: ['Zielerreichungsgespräche'],
  Dienstag: ['Projektplanung'],
  Mittwoch: ['AWS Cloud Practitioner'],
  Donnerstag: ['AWS Solutions Architect Associate'],
  Freitag: ['Kubernetes'],
};

const ASYNC_ACTIVITIES: Record<Weekday, string> = {
  Montag: 'KursPlan schreiben',
  Dienstag: 'Stand-up',
  Mittwoch: 'Termine vereinbaren',
  Donnerstag: 'Aufgaben evaluieren',
  Freitag: 'Wochenreflexion und offene Fragen',
};

function createEntry(
  id: string,
  category: EntryCategory,
  title: string,
  details: Omit<PlanEntry, 'id' | 'category' | 'title'> = {},
): PlanEntry {
  return { id, category, title, ...details };
}

function fromWeekdays(create: (day: Weekday) => PlanEntry[]): DayEntries {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, create(day)]),
  ) as DayEntries;
}

function liveEntry(
  id: string,
  day: Weekday,
  trainer: string,
  units: string,
  topics: string[],
): PlanEntry {
  return createEntry(`${id}-${day.toLowerCase()}`, 'live', 'Live-Unterricht', {
    trainer,
    units,
    unitCount: 2,
    topics,
    format: 'Synchron',
  });
}

function breakEntry(id: string, day: Weekday, title: string): PlanEntry {
  return createEntry(`${id}-${day.toLowerCase()}`, 'break', title, {
    format: 'Pause',
  });
}

function asyncEntry(
  id: string,
  day: Weekday,
  title: string,
  details: string,
  format: string,
): PlanEntry {
  return createEntry(`${id}-${day.toLowerCase()}`, 'async', title, {
    details,
    format,
  });
}

const TIME_SLOTS: TimeSlot[] = [
  {
    id: 'slot-0830',
    start: '08:30',
    end: '10:00',
    durationMinutes: 90,
    units: '1. & 2. UE',
    format: 'Synchron, 2 UE',
    entries: fromWeekdays((day) => [
      liveEntry('live-morning', day, 'Sandra', '1. & 2. UE', MORNING_TOPICS[day]),
    ]),
  },
  {
    id: 'slot-1000',
    start: '10:00',
    end: '10:15',
    durationMinutes: 15,
    format: 'Asynchron / flexibel',
    entries: fromWeekdays((day) => [
      asyncEntry(
        'async-morning',
        day,
        'Asynchrones Lernen I',
        ASYNC_ACTIVITIES[day],
        'Asynchron / flexibel',
      ),
    ]),
  },
  {
    id: 'slot-1015',
    start: '10:15',
    end: '10:30',
    durationMinutes: 15,
    format: 'Pause',
    entries: fromWeekdays((day) => [breakEntry('break-coffee', day, 'Kaffeepause')]),
  },
  {
    id: 'slot-1030',
    start: '10:30',
    end: '12:00',
    durationMinutes: 90,
    units: '3. & 4. UE',
    format: 'Synchron, 2 UE',
    entries: fromWeekdays((day) =>
      day === 'Mittwoch'
        ? [
            createEntry('special-gabi-session', 'special', 'Gabi-Session', {
              time: { start: '11:00', end: '12:00' },
              location: 'Zoom',
              details: 'Zweiwöchiger Rhythmus',
              note: 'Meeting-Vorbereitung 10:15–11:00 · Lebenslauf und Fragen',
              format: 'Sondertermin',
            }),
          ]
        : [
            liveEntry(
              'live-mid-morning',
              day,
              'Ghaith',
              '3. & 4. UE',
              MID_MORNING_TOPICS[day],
            ),
          ],
    ),
  },
  {
    id: 'slot-1200',
    start: '12:00',
    end: '13:00',
    durationMinutes: 60,
    format: 'Pause',
    entries: fromWeekdays((day) => [breakEntry('break-lunch', day, 'Mittagspause')]),
  },
  {
    id: 'slot-1300',
    start: '13:00',
    end: '14:30',
    durationMinutes: 90,
    units: '5. & 6. UE',
    format: 'Synchron, 2 UE',
    entries: fromWeekdays((day) => [
      liveEntry(
        'live-afternoon',
        day,
        'Sam',
        '5. & 6. UE',
        AFTERNOON_TOPICS[day],
      ),
    ]),
  },
  {
    id: 'slot-1430',
    start: '14:30',
    end: '14:45',
    durationMinutes: 15,
    format: 'Pause',
    entries: fromWeekdays((day) => [
      breakEntry('break-afternoon', day, 'Nachmittagspause'),
    ]),
  },
  {
    id: 'slot-1445',
    start: '14:45',
    end: '16:00',
    durationMinutes: 75,
    format: 'Asynchron',
    entries: fromWeekdays((day) => [
      asyncEntry(
        'async-afternoon',
        day,
        'Asynchrones Lernen II',
        'Praxis und Vertiefung',
        'Asynchron',
      ),
    ]),
  },
];

export const weeklyPlanTemplate: WeekPlan = {
  title: 'Wochenplan',
  subtitle:
    'Beispielwoche für einen Cloud-Bildungskurs mit Live-Unterricht, Selbstlernphasen und Pausen.',
  program: 'AWS Cloud & DevOps',
  weekLabel: 'Musterwoche · Montag bis Freitag',
  days: WEEKDAYS,
  timeSlots: TIME_SLOTS,
};
