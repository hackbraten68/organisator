import { CATEGORY_STYLES } from '@/features/weekly-plan-template/categoryStyles';
import type { PlanEntry } from '@/features/weekly-plan-template/types';
import { cn } from '@/lib/utils';

interface Props {
  entry: PlanEntry;
}

export default function WeeklyPlanSpecialCard({ entry }: Props) {
  const style = CATEGORY_STYLES.special;
  const Icon = style.icon;

  return (
    <article
      className={cn(
        'week-plan-entry break-words rounded-lg border-2 border-dashed p-2.5 shadow-sm',
        style.cardClass,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-xs font-semibold leading-snug">{entry.title}</h4>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                style.badgeClass,
              )}
            >
              {style.label}
            </span>
          </div>

          {entry.time && (
            <p className="text-[11px] font-semibold">
              {entry.time.start}–{entry.time.end} Uhr
              {entry.time.label ? ` · ${entry.time.label}` : ''}
            </p>
          )}

          {entry.location && (
            <p className="text-[11px]">
              <span className="font-semibold">Ort:</span> {entry.location}
            </p>
          )}

          {entry.details && (
            <p className="text-[11px] leading-relaxed">{entry.details}</p>
          )}

          {entry.note && (
            <p className="text-[10px] leading-relaxed opacity-90">{entry.note}</p>
          )}
        </div>
      </div>
    </article>
  );
}
