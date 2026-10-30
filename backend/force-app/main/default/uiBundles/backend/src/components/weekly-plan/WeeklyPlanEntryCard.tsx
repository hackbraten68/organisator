import { CATEGORY_STYLES } from '@/features/weekly-plan-template/categoryStyles';
import type { PlanEntry } from '@/features/weekly-plan-template/types';
import { cn } from '@/lib/utils';

interface Props {
  entry: PlanEntry;
}

export default function WeeklyPlanEntryCard({ entry }: Props) {
  const style = CATEGORY_STYLES[entry.category];
  const Icon = style.icon;

  return (
    <article className={cn('week-plan-entry break-words rounded-lg border p-2.5 shadow-sm', style.cardClass)}>
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

          {entry.units && <p className="text-[11px] font-medium">{entry.units}</p>}

          {entry.trainer && (
            <p className="text-[11px]">
              <span className="font-semibold">Trainer:</span> {entry.trainer}
            </p>
          )}

          {entry.details && (
            <p className="text-[11px] leading-relaxed">{entry.details}</p>
          )}

          {entry.topics && entry.topics.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label={`Themen: ${entry.title}`}>
              {entry.topics.map((topic) => (
                <li
                  key={`${entry.id}-${topic}`}
                  className="rounded bg-white/75 px-1.5 py-0.5 text-[10px] leading-tight text-slate-800"
                >
                  {topic}
                </li>
              ))}
            </ul>
          )}

          {entry.format && (
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
              {entry.format}
            </p>
          )}

          {entry.note && (
            <p className="text-[10px] leading-relaxed opacity-90">{entry.note}</p>
          )}
        </div>
      </div>
    </article>
  );
}
