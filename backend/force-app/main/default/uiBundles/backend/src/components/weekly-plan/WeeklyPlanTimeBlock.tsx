import { TableCell, TableRow } from '@/components/ui/table';
import type { PlanEntry, TimeSlot, Weekday } from '@/features/weekly-plan-template/types';
import WeeklyPlanEntryCard from './WeeklyPlanEntryCard';
import WeeklyPlanPause from './WeeklyPlanPause';
import WeeklyPlanSpecialCard from './WeeklyPlanSpecialCard';

interface Props {
  slot: TimeSlot;
  days: readonly Weekday[];
}

function Entry({ entry }: { entry: PlanEntry }) {
  if (entry.category === 'break') {
    return <WeeklyPlanPause entry={entry} />;
  }

  if (entry.category === 'special') {
    return <WeeklyPlanSpecialCard entry={entry} />;
  }

  return <WeeklyPlanEntryCard entry={entry} />;
}

export default function WeeklyPlanTimeBlock({ slot, days }: Props) {
  return (
    <TableRow className="week-plan-row align-top hover:bg-transparent">
      <th
        scope="row"
        className="border-r border-border bg-slate-50 px-3 py-3 text-left align-top"
      >
        <span className="block font-semibold text-slate-900">{slot.start}</span>
        <span className="block text-xs text-muted-foreground">bis {slot.end}</span>
        {slot.units && (
          <span className="mt-1 block text-[11px] font-medium text-slate-600">
            {slot.units}
          </span>
        )}
      </th>

      <TableCell className="border-r border-border bg-slate-50/60 px-3 py-3 align-top text-xs text-muted-foreground">
        {slot.durationMinutes} Min.
      </TableCell>

      {days.map((day) => {
        const entries = slot.entries[day] ?? [];

        return (
          <TableCell
            key={day}
            className="border-r border-border px-3 py-3 align-top whitespace-normal break-words"
          >
            {entries.length === 0 ? (
              <span className="text-xs text-muted-foreground">–</span>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <Entry key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </TableCell>
        );
      })}

      <TableCell className="px-3 py-3 align-top whitespace-normal break-words">
        <p className="text-xs font-semibold text-slate-900">{slot.format}</p>
        {slot.units && (
          <p className="mt-1 text-[11px] text-muted-foreground">{slot.units}</p>
        )}
      </TableCell>
    </TableRow>
  );
}
