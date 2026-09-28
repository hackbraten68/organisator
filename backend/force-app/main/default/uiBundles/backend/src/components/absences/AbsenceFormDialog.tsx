import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import type { AbsenceInput, AbsenceType, AbsenceStatus } from "@/types/absence";

interface AbsenceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AbsenceInput) => Promise<void>;
  participantId: string;
  initialData?: Partial<AbsenceInput>;
  isLoading?: boolean;
  title?: string;
}

export function AbsenceFormDialog({
  isOpen,
  onClose,
  onSubmit,
  participantId,
  initialData,
  isLoading = false,
  title = "Abwesenheit melden",
}: AbsenceFormDialogProps) {
  const [type, setType] = useState<AbsenceType>(initialData?.type || "Krank");
  const [status, setStatus] = useState<AbsenceStatus>(initialData?.status || "Submitted");
  const [startDate, setStartDate] = useState(initialData?.startDate || format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initialData?.endDate || format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState(initialData?.reason || "");
  const [errors, setErrors] = useState<Partial<Record<keyof AbsenceInput, string>>>({});

  const validate = () => {
    const newErrors: Partial<Record<keyof AbsenceInput, string>> = {};
    if (!startDate) newErrors.startDate = "Startdatum ist erforderlich";
    if (!endDate) newErrors.endDate = "Enddatum ist erforderlich";
    if (startDate && endDate && parseISO(startDate) > parseISO(endDate)) {
      newErrors.endDate = "Enddatum muss nach Startdatum liegen";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      participantId,
      type,
      status,
      startDate,
      endDate,
      reason: reason.trim() || undefined,
    });
    onClose();
  };

  const absenceTypes: AbsenceType[] = ["Krank", "Urlaub", "Berufsschule", "Praktikum", "Behörde", "Sonstiges"];
  const absenceStatuses: AbsenceStatus[] = ["Submitted", "Approved", "Rejected", "Cancelled"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form id="absence-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Typ *</Label>
              <Select value={type} onValueChange={(v: AbsenceType) => setType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  {absenceTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: AbsenceStatus) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent>
                  {absenceStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "Submitted" ? "Gemeldet" : s === "Approved" ? "Genehmigt" : s === "Rejected" ? "Abgelehnt" : "Storniert"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">Von *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                className={errors.startDate ? "border-destructive" : ""}
                aria-invalid={!!errors.startDate}
                aria-describedby={errors.startDate ? "startDate-error" : undefined}
              />
              {errors.startDate && <p id="startDate-error" className="text-sm text-destructive" role="alert">{errors.startDate}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDate">Bis *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                className={errors.endDate ? "border-destructive" : ""}
                aria-invalid={!!errors.endDate}
                aria-describedby={errors.endDate ? "endDate-error" : undefined}
              />
              {errors.endDate && <p id="endDate-error" className="text-sm text-destructive" role="alert">{errors.endDate}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Grund (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Kurze Begründung..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Wird im Audit redaktioniert. Nur Typ und Zeitraum sind für alle sichtbar.
              </p>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button type="submit" form="absence-form" disabled={isLoading}>
            {isLoading ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}