import {
  CATEGORY_ORDER,
  CATEGORY_STYLES,
} from '@/features/weekly-plan-template/categoryStyles';
import { cn } from '@/lib/utils';

export default function WeeklyPlanLegend() {
  return (
    <section
      aria-labelledby="weekly-plan-legend"
      className="rounded-xl border bg-card p-4 print:border-0 print:bg-transparent print:p-0"
    >
      <h2 id="weekly-plan-legend" className="text-sm font-semibold">
        Legende
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_ORDER.map((category) => {
          const style = CATEGORY_STYLES[category];
          const Icon = style.icon;

          return (
            <li key={category} className="flex items-start gap-2">
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
                  style.cellClass,
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold">{style.label}</p>
                <p className="text-[11px] text-muted-foreground">{style.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
