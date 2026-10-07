import { useState, useMemo } from "react";
import { Calendar, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import type { AppointmentType } from "@/types/appointment";
import type { AvailabilitySlot } from "@/types/availabilitySlot";
import { slotDateTimes } from "@/utils/slotDateTime";

interface ProposeSlotsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPropose: (slots: { startTime: string; endTime: string }[]) => Promise<void>;
  type: AppointmentType;
  availableSlots: AvailabilitySlot[];
}

export function ProposeSlotsDialog({
  isOpen,
  onClose,
  onPropose,
  type,
  availableSlots,
}: ProposeSlotsDialogProps) {
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (timeStr: string) => {
    try {
      return format(parseISO(`2000-01-01T${timeStr}`), "HH:mm");
    } catch {
      return timeStr;
    }
  };

  const filteredSlots = useMemo(() => {
    return availableSlots
      .filter((slot) => {
        if (!slot.isActive) return false;
        if (slot.type !== type && slot.type !== "General") return false;
        if (dateFilter) {
          const slotDate = slot.validFrom || slot.validTo;
          if (slotDate && !slotDate.startsWith(dateFilter)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const dayA = dayOrder.indexOf(a.dayOfWeek);
        const dayB = dayOrder.indexOf(b.dayOfWeek);
        if (dayA !== dayB) return dayA - dayB;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [availableSlots, type, dateFilter]);

  // Ohne Datum gibt es keinen vorschlagbaren Termin. Solche Slots werden
  // angezeigt, aber nicht auswaehlbar — sonst entstaende beim Senden die
  // nackte Uhrzeit ("09:00") statt eines Datums.
  const isProposable = (slot: AvailabilitySlot) => slotDateTimes(slot) !== null;

  const handleToggleSlot = (slotId: string) => {
    setError(null);
    setSelectedSlotIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const handlePropose = async () => {
    if (selectedSlotIds.length !== 3) {
      setError("Bitte genau 3 Slots auswählen");
      return;
    }

    const selectedSlots = selectedSlotIds
      .map((id) => availableSlots.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);

    // Slot koennte zwischen Auswahl und Klick deaktiviert worden sein.
    const undated = selectedSlots.filter((slot) => !isProposable(slot));
    if (undated.length > 0) {
      setError("Ausgewählte Slots haben kein gültiges Datum und können nicht vorgeschlagen werden.");
      return;
    }

    const slots = selectedSlots.map((slot) => slotDateTimes(slot) as { startTime: string; endTime: string });

    setProposing(true);
    setError(null);
    try {
      await onPropose(slots);
      onClose();
    } catch (err) {
      console.error("Propose failed", err);
      setError("Fehler beim Vorschlagen der Slots");
    } finally {
      setProposing(false);
    }
  };

  const dayLabels: Record<string, string> = {
    Monday: "Montag",
    Tuesday: "Dienstag",
    Wednesday: "Mittwoch",
    Thursday: "Donnerstag",
    Friday: "Freitag",
  };

  const groupedSlots = useMemo(() => {
    const groups: Record<string, AvailabilitySlot[]> = {};
    filteredSlots.forEach((slot) => {
      if (!groups[slot.dayOfWeek]) groups[slot.dayOfWeek] = [];
      groups[slot.dayOfWeek].push(slot);
    });
    return groups;
  }, [filteredSlots]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>3 Terminvorschläge für {type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFilter(e.target.value)}
              placeholder="Datum filtern"
              className="w-[200px]"
            />
            <span className="text-sm text-muted-foreground">
              {selectedSlotIds.length}/3 ausgewählt
            </span>
          </div>

          <Separator />

          <div className="max-h-96 overflow-y-auto space-y-4">
            {Object.entries(groupedSlots).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="size-12 mx-auto mb-2 opacity-50" />
                <p>Keine verfügbaren Slots für diesen Typ</p>
              </div>
            ) : (
              Object.entries(groupedSlots).map(([day, slots]) => (
                <Card key={day}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {dayLabels[day] || day}
                      <Badge variant="secondary">{slots.length} Slots</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {slots.map((slot) => {
                        const isSelected = selectedSlotIds.includes(slot.id);
                        const proposable = isProposable(slot);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleToggleSlot(slot.id)}
                            disabled={proposing || !proposable}
                            aria-pressed={isSelected}
                            className={`p-3 rounded-lg border-2 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</span>
                              {isSelected && <Check className="size-4 text-primary" />}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {proposable ? (
                                <>
                                  {slot.type}
                                  {" · "}
                                  {format(parseISO(slotDateTimes(slot)!.startTime), "dd.MM.yyyy")}
                                </>
                              ) : (
                                "Kein Datum hinterlegt — nicht vorschlagbar"
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Separator />

          {error && (
            <p className="text-small text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={proposing}>
              Abbrechen
            </Button>
            <Button
              onClick={handlePropose}
              disabled={proposing || selectedSlotIds.length !== 3}
            >
              {proposing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Vorschläge senden...
                </>
              ) : (
                "3 Slots vorschlagen"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}