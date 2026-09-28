import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import type { AppointmentType } from "@/types/appointment";

interface ProposedSlot {
  startTime: string;
  endTime: string;
}

interface SelectSlotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (slot: ProposedSlot) => Promise<void>;
  proposedSlots: ProposedSlot[];
  type: AppointmentType;
  participantId: string;
  coachName?: string;
  isLoading?: boolean;
}

export function SelectSlotDialog({
  isOpen,
  onClose,
  onSelect,
  proposedSlots,
  type,
  coachName,
  isLoading = false,
}: SelectSlotDialogProps) {
  const [selecting, setSelecting] = useState<string | null>(null);

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd.MM.yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const handleSelect = async (slot: ProposedSlot) => {
    const slotKey = `${slot.startTime}|${slot.endTime}`;
    setSelecting(slotKey);
    try {
      await onSelect(slot);
      onClose();
    } catch (err) {
      console.error("Select failed", err);
      alert("Fehler beim Auswählen des Slots");
    } finally {
      setSelecting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Termin auswählen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              {coachName ? `Vorschläge von ${coachName}` : "Neue Terminvorschläge"}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Typ: {type} · Bitte einen der 3 Vorschläge auswählen
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            {proposedSlots.map((slot, index) => {
              const slotKey = `${slot.startTime}|${slot.endTime}`;
              return (
                <Card
                  key={slotKey}
                  className={`cursor-pointer transition-all ${
                    selecting === slotKey ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{formatDateTime(slot.startTime)}</p>
                          <p className="text-sm text-muted-foreground">
                            bis {format(slot.endTime, "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSelect(slot)}
                        disabled={isLoading || selecting !== null}
                        className={selecting === slotKey ? "bg-primary" : ""}
                      >
                        {selecting === slotKey ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Wähle...
                          </>
                        ) : (
                          <>
                            <Check className="size-4 mr-2" />
                            Auswählen
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator />

          <Button variant="outline" onClick={onClose} disabled={isLoading} className="w-full">
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}