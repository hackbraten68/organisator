import { CATEGORY_STYLES } from '@/features/weekly-plan-template/categoryStyles';
import type { PlanEntry } from '@/features/weekly-plan-template/types';
import { cn } from '@/lib/utils';

interface Props {
  entry: PlanEntry;
}

export default function WeeklyPlanPause({ entry }: Props) {
  const style = CATEGORY_STYLES[entry.category];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        'week-plan-entry flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium',
        style.cellClass,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{entry.title}</span>
    </div>
  );
}
