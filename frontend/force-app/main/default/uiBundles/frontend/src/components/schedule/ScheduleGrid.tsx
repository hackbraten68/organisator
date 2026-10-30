import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CATEGORY_STYLES } from '@/features/weekly-plan-template/categoryStyles';
import {
  GRID_DAY_LABELS,
  GRID_DAYS,
  deriveEntryCategory,
  formatTimeRange,
  groupEntriesForGrid,
  slotDurationMinutes,
  type GridConfig,
} from '@/features/schedule-grid/gridConfig';
import { cn } from '@/lib/utils';
import type { GridSlot, ScheduleEntry } from '@/types/schedule';

interface Props {
  config: GridConfig;
  entries: ScheduleEntry[];
  days?: readonly string[];
  editable?: boolean;
  onAddEntry?: (day: string, slot: GridSlot) => void;
  onEditEntry?: (entry: ScheduleEntry) => void;
  onDeleteEntry?: (entry: ScheduleEntry) => void;
  onEditSlot?: (slot: GridSlot) => void;
  onManageSlots?: () => void;
  showFormatColumn?: boolean;
  className?: string;
}

function EntryCard({
  entry,
  slot,
  editable,
  onEdit,
  onDelete,
}: {
  entry: ScheduleEntry;
  slot?: GridSlot;
  editable: boolean;
  onEdit?: (entry: ScheduleEntry) => void;
  onDelete?: (entry: ScheduleEntry) => void;
}) {
  const category = deriveEntryCategory(entry);
  const style = CATEGORY_STYLES[category];
  const Icon = style.icon;
  const hasOwnTime =
    slot &&
    entry.startTime &&
    entry.endTime &&
    (entry.startTime.slice(0, 5) !== slot.start ||
      entry.endTime.slice(0, 5) !== slot.end);
  const isBreak = category === 'break';

  return (
    <article
      className={cn(
        'week-plan-entry group relative rounded-lg border p-2.5 shadow-sm',
        isBreak ? style.cellClass : style.cardClass,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 pr-12">
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

          {(hasOwnTime || entry.location) && (
            <p className="text-[11px] font-medium">
              {hasOwnTime && (
                <span>{formatTimeRange(entry.startTime, entry.endTime)} Uhr</span>
              )}
              {hasOwnTime && entry.location && <span> · </span>}
              {entry.location}
            </p>
          )}

          {entry.coachName && (
            <p className="text-[11px]">
              <span className="font-semibold">Trainer:</span> {entry.coachName}
            </p>
          )}

          {entry.description && (
            <p className="whitespace-pre-line text-[11px] leading-relaxed">
              {entry.description}
            </p>
          )}

          {entry.notes && (
            <p className="whitespace-pre-line text-[10px] leading-relaxed opacity-90">
              {entry.notes}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 print:hidden">
          {onEdit && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 bg-white/70 dark:bg-black/40"
              aria-label={`${entry.title} bearbeiten`}
              onClick={() => onEdit(entry)}
            >
              <Pencil className="size-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 bg-white/70 dark:bg-black/40 text-destructive"
              aria-label={`${entry.title} löschen`}
              onClick={() => onDelete(entry)}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

export default function ScheduleGrid({
  config,
  entries,
  days = GRID_DAYS,
  editable = false,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onEditSlot,
  onManageSlots,
  showFormatColumn = true,
  className,
}: Props) {
  const { bySlotAndDay, unmatched } = groupEntriesForGrid(entries, config, days);

  return (
    <section className={cn('mx-2 space-y-3', className)}>
      {editable && onManageSlots && (
        <div className="flex justify-end print:hidden">
          <Button type="button" size="sm" variant="outline" onClick={onManageSlots}>
            <Settings2 className="mr-1 size-4" />
            Zeitblöcke bearbeiten
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <Table
          aria-label="Wochenplan-Raster"
          className="week-plan-table w-full min-w-[1120px] table-fixed border-collapse text-sm print:min-w-0 print:text-[8pt]"
        >
          <TableHeader className="print:table-header-group">
            <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-max whitespace-nowrap border-r border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                Zeitraum
              </TableHead>
              <TableHead className="w-max whitespace-nowrap border-r border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                Dauer
              </TableHead>
              {days.map((day) => (
                <TableHead
                  key={day}
                  className="w-[13%] border-r border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foreground"
                >
                  {GRID_DAY_LABELS[day] ?? day}
                </TableHead>
              ))}
              {showFormatColumn && (
                <TableHead className="w-[15%] border-r border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground last:border-r-0">
                  Format / AZAV-Zuordnung
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {config.slots.map((slot) => {
              const slotDays = days.map((day) => ({
                day,
                entries: bySlotAndDay.get(`${slot.id}|${day}`) ?? [],
              }));
              return (
                <TableRow key={slot.id} className="week-plan-row align-top hover:bg-transparent">
                  <th
                    scope="row"
                    className="border-r border-border bg-muted/30 dark:bg-muted/40 px-3 py-3 text-left align-top"
                  >
                    <span className="block font-semibold text-foreground">{slot.start}</span>
                    <span className="block text-xs text-muted-foreground">bis {slot.end}</span>
                    {slot.units && (
                      <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                        {slot.units}
                      </span>
                    )}
                    {editable && onEditSlot && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-6 px-1 text-[10px] print:hidden"
                        onClick={() => onEditSlot(slot)}
                      >
                        <Pencil className="mr-1 size-3" />
                        Zeit
                      </Button>
                    )}
                  </th>
                  <TableCell className="border-r border-border bg-muted/20 dark:bg-muted/40 px-3 py-3 align-top text-xs text-muted-foreground">
                    {slotDurationMinutes(slot)} Min.
                  </TableCell>

                  {slotDays.map(({ day, entries: cellEntries }) => (
                    <TableCell
                      key={day}
                      className="border-r border-border px-3 py-3 align-top whitespace-normal break-words"
                    >
                      {cellEntries.length === 0 ? (
                        editable && onAddEntry ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-full justify-start px-2 text-xs text-muted-foreground print:hidden"
                            onClick={() => onAddEntry(day, slot)}
                          >
                            <Plus className="mr-1 size-3" />
                            Eintrag
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )
                      ) : (
                        <div className="space-y-2">
                          {cellEntries.map((entry) => (
                            <EntryCard
                              key={entry.id}
                              entry={entry}
                              slot={slot}
                              editable={editable}
                              onEdit={onEditEntry}
                              onDelete={onDeleteEntry}
                            />
                          ))}
                          {editable && onAddEntry && cellEntries.length < 3 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-full justify-start px-1 text-[10px] text-muted-foreground print:hidden"
                              onClick={() => onAddEntry(day, slot)}
                            >
                              <Plus className="mr-1 size-3" />
                              Weiterer Eintrag
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  ))}

                  {showFormatColumn && (
                    <TableCell className="px-3 py-3 align-top whitespace-normal break-words">
                      <p className="text-xs font-semibold text-foreground">{slot.format || '–'}</p>
                      {slot.azav && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{slot.azav}</p>
                      )}
                      {slot.units && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{slot.units}</p>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {unmatched.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 print:border print:bg-transparent">
          <p className="text-xs font-semibold text-amber-900">
            Nicht zugeordnet (bestehende Einträge)
          </p>
          <p className="mt-0.5 text-[11px] text-amber-800">
            Diese Einträge haben keinen passenden Zeitblock. Sie bleiben sichtbar und können
            über den Eintragsdialog einem Block zugeordnet werden.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unmatched.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                  {GRID_DAY_LABELS[entry.dayOfWeek] ?? entry.dayOfWeek}
                  {entry.startTime ? ` · ${formatTimeRange(entry.startTime, entry.endTime)}` : ''}
                </p>
                <EntryCard
                  entry={entry}
                  editable={editable}
                  onEdit={onEditEntry}
                  onDelete={onDeleteEntry}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
