import { useId } from 'react';

import { Table, TableBody, TableCaption } from '@/components/ui/table';
import type { WeekPlan } from '@/features/weekly-plan-template/types';
import { cn } from '@/lib/utils';
import WeeklyPlanTableHeader from './WeeklyPlanTableHeader';
import WeeklyPlanTimeBlock from './WeeklyPlanTimeBlock';

interface Props {
  plan: WeekPlan;
  className?: string;
}

export default function WeeklyPlanTemplate({ plan, className }: Props) {
  const headingId = `weekly-plan-title-${useId()}`;

  return (
    <section className={cn('space-y-4', className)} aria-labelledby={headingId}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id={headingId}
              className="text-2xl font-semibold tracking-tight print:text-lg"
            >
              {plan.title}
            </h2>
            <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:hidden">
              Vorlage
            </span>
          </div>
          <p className="max-w-4xl text-sm text-muted-foreground">{plan.subtitle}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-right">
          <div>
            <dt className="font-medium text-muted-foreground">Programm</dt>
            <dd className="font-semibold">{plan.program}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Woche</dt>
            <dd className="font-semibold">{plan.weekLabel}</dd>
          </div>
        </dl>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <Table
          aria-label={`${plan.title} von Montag bis Freitag`}
          className="week-plan-table w-full min-w-[1120px] table-fixed border-collapse text-sm print:min-w-0 print:text-[8pt]"
        >
          <TableCaption className="caption-top mt-0 px-4 pb-3 text-left text-xs text-muted-foreground print:mb-1 print:p-0">
            {plan.title} · {plan.program} · {plan.weekLabel}
          </TableCaption>

          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[6%]" />
            {plan.days.map((day) => (
              <col key={day} className="w-[14%]" />
            ))}
            <col className="w-[15%]" />
          </colgroup>

          <WeeklyPlanTableHeader days={plan.days} />

          <TableBody>
            {plan.timeSlots.map((slot) => (
              <WeeklyPlanTimeBlock key={slot.id} slot={slot} days={plan.days} />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
