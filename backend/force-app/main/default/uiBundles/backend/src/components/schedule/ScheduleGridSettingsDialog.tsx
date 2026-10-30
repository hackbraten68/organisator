import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import {
  minutesToTime,
  nextSlotId,
  slotDurationMinutes,
  sortSlots,
  timeToMinutes,
  type GridConfig,
} from '@/features/schedule-grid/gridConfig';
import type { GridSlot } from '@/types/schedule';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GridConfig;
  onSave: (config: GridConfig) => Promise<void> | void;
}

function cloneSlots(config: GridConfig): GridSlot[] {
  return config.slots.map((slot) => ({ ...slot }));
}

export default function ScheduleGridSettingsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: Props) {
  const [slots, setSlots] = useState<GridSlot[]>(() => cloneSlots(config));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSlots(cloneSlots(config));
  }, [open, config]);

  const updateSlot = (index: number, patch: Partial<GridSlot>) => {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  };

  const addSlot = () => {
    const lastEnd = slots.length > 0 ? timeToMinutes(slots[slots.length - 1].end) : null;
    const start = minutesToTime(lastEnd ?? 8 * 60);
    const end = minutesToTime((lastEnd ?? 8 * 60) + 90);
    setSlots((current) => [
      ...current,
      {
        id: nextSlotId(current),
        start,
        end,
        durationMinutes: 90,
        units: '',
        format: '',
        azav: '',
      },
    ]);
  };

  const removeSlot = (index: number) => {
    if (slots.length <= 1) return;
    setSlots((current) => current.filter((_, slotIndex) => slotIndex !== index));
  };

  const handleSave = async () => {
    const seenIds = new Set<string>();
    for (const slot of slots) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(slot.id)) {
        toast.error('Jede Zeitblock-ID darf nur Buchstaben, Zahlen, _ und - enthalten.');
        return;
      }
      if (seenIds.has(slot.id)) {
        toast.error('Die Zeitblock-IDs müssen eindeutig sein.');
        return;
      }
      seenIds.add(slot.id);
      const start = timeToMinutes(slot.start);
      const end = timeToMinutes(slot.end);
      if (start === null || end === null || end <= start) {
        toast.error('Endzeit muss nach Startzeit liegen.');
        return;
      }
    }

    const sorted = sortSlots(slots).map((slot) => ({
      ...slot,
      durationMinutes: slotDurationMinutes(slot),
    }));
    for (let index = 1; index < sorted.length; index += 1) {
      if ((timeToMinutes(sorted[index - 1].end) ?? 0) > (timeToMinutes(sorted[index].start) ?? 0)) {
        toast.error('Die Zeitblöcke dürfen sich nicht überschneiden.');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({ version: 1, slots: sorted });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zeitblöcke bearbeiten</DialogTitle>
          <DialogDescription>
            Zeit, Dauer, UE und Format/AZAV gelten für alle Tage dieses Rasters. Änderungen an
            Start und Ende verschieben zugeordnete Einträge automatisch mit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {slots.map((slot, index) => (
            <div key={slot.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Block {index + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeSlot(index)}
                  disabled={slots.length <= 1}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Entfernen
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor={`slot-start-${slot.id}`}>Start</Label>
                  <Input
                    id={`slot-start-${slot.id}`}
                    type="time"
                    value={slot.start}
                    onChange={(event) => updateSlot(index, { start: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`slot-end-${slot.id}`}>Ende</Label>
                  <Input
                    id={`slot-end-${slot.id}`}
                    type="time"
                    value={slot.end}
                    onChange={(event) => updateSlot(index, { end: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`slot-units-${slot.id}`}>UE</Label>
                  <Input
                    id={`slot-units-${slot.id}`}
                    value={slot.units ?? ''}
                    placeholder="z. B. 1. & 2. UE"
                    onChange={(event) => updateSlot(index, { units: event.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`slot-id-${slot.id}`}>ID</Label>
                  <Input
                    id={`slot-id-${slot.id}`}
                    value={slot.id}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`slot-format-${slot.id}`}>Format</Label>
                  <Input
                    id={`slot-format-${slot.id}`}
                    value={slot.format ?? ''}
                    placeholder="z. B. Synchron, 2 UE"
                    onChange={(event) => updateSlot(index, { format: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`slot-azav-${slot.id}`}>AZAV-Zuordnung</Label>
                  <Input
                    id={`slot-azav-${slot.id}`}
                    value={slot.azav ?? ''}
                    placeholder="z. B. AZAV-Modul / UE"
                    onChange={(event) => updateSlot(index, { azav: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addSlot}>
            <Plus className="mr-1 size-4" />
            Zeitblock hinzufügen
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
