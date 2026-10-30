import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Weekday } from '@/features/weekly-plan-template/types';

const HEADER_CELL_CLASS =
  'border-r border-white/20 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-white last:border-r-0';

interface Props {
  days: readonly Weekday[];
}

export default function WeeklyPlanTableHeader({ days }: Props) {
  return (
    <TableHeader className="print:table-header-group">
      <TableRow className="border-0 bg-slate-800 hover:bg-slate-800">
        <TableHead scope="col" className={cn(HEADER_CELL_CLASS, 'w-[9%]')}>
          Zeitraum
        </TableHead>
        <TableHead scope="col" className={cn(HEADER_CELL_CLASS, 'w-[6%]')}>
          Dauer
        </TableHead>
        {days.map((day) => (
          <TableHead
            key={day}
            scope="col"
            className={cn(HEADER_CELL_CLASS, 'w-[14%] text-left')}
          >
            {day}
          </TableHead>
        ))}
        <TableHead scope="col" className={cn(HEADER_CELL_CLASS, 'w-[15%]')}>
          Format / AZAV-Zuordnung
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
