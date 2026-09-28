import { useState, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AvailabilitySlot, AvailabilitySlotFilters, AvailabilitySlotType } from "@/types/availabilitySlot";
import { getAvailabilitySlots, createAvailabilitySlot, updateAvailabilitySlot, deleteAvailabilitySlot } from "@/api/appointment/appointmentService";
import { toast } from "sonner";

interface AvailabilitySlotsProps {
  currentUserId: string;
  canManage?: boolean;
}

type FilterDay = AvailabilitySlotFilters["dayOfWeek"] | "all";
type FilterType = AvailabilitySlotFilters["type"] | "all";
type FilterActive = AvailabilitySlotFilters["isActive"] | "all";

export function AvailabilitySlots({ currentUserId }: AvailabilitySlotsProps) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [filterDay, setFilterDay] = useState<FilterDay>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterActive, setFilterActive] = useState<FilterActive>("all");

  const fetchSlots = useCallback(async () => {
    try {
      const filters: AvailabilitySlotFilters = {
        userId: currentUserId,
        ...(filterDay !== "all" && { dayOfWeek: filterDay }),
        ...(filterType !== "all" && { type: filterType }),
        ...(filterActive !== "all" && { isActive: filterActive }),
      };
      const fetched = await getAvailabilitySlots(filters);
      setSlots(fetched);
    } catch (err) {
      console.error("Failed to load slots", err);
      toast.error("Verfügbarkeiten konnten nicht geladen werden");
    }
  }, [currentUserId, filterDay, filterType, filterActive]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const [formDay, setFormDay] = useState<AvailabilitySlot["dayOfWeek"]>("Monday");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formType, setFormType] = useState<AvailabilitySlotType>("Coaching");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidTo, setFormValidTo] = useState("");

  const handleCreate = async () => {
    try {
      await createAvailabilitySlot({
        userId: currentUserId,
        dayOfWeek: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        type: formType,
        isActive: formIsActive,
        validFrom: formValidFrom || undefined,
        validTo: formValidTo || undefined,
      });
      toast.success("Verfügbarkeit angelegt");
      fetchSlots();
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("Create failed", err);
      toast.error("Anlegen fehlgeschlagen");
    }
  };

  const handleUpdate = async () => {
    if (!editingSlot) return;
    try {
      await updateAvailabilitySlot(editingSlot.id, {
        dayOfWeek: formDay,
        startTime: formStartTime,
        endTime: formEndTime,
        type: formType,
        isActive: formIsActive,
        validFrom: formValidFrom || undefined,
        validTo: formValidTo || undefined,
      });
      toast.success("Verfügbarkeit aktualisiert");
      fetchSlots();
      setEditingSlot(null);
      resetForm();
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Aktualisieren fehlgeschlagen");
    }
  };

  const resetForm = () => {
    setFormDay("Monday");
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setFormType("Coaching");
    setFormIsActive(true);
    setFormValidFrom("");
    setFormValidTo("");
  };

  const handleEdit = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setFormDay(slot.dayOfWeek);
    setFormStartTime(slot.startTime.slice(0, 5));
    setFormEndTime(slot.endTime.slice(0, 5));
    setFormType(slot.type);
    setFormIsActive(slot.isActive);
    setFormValidFrom(slot.validFrom || "");
    setFormValidTo(slot.validTo || "");
    setShowForm(true);
  };

  const handleDelete = async (slot: AvailabilitySlot) => {
    if (!confirm("Dieser Slot wird gelöscht. Fortfahren?")) return;
    try {
      await deleteAvailabilitySlot(slot.id);
      toast.success("Slot gelöscht");
      fetchSlots();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Löschen fehlgeschlagen");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Meine Verfügbarkeiten</h2>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Ihre wöchentlichen Slots für Terminbuchungen
          </p>
        </div>
        <Button onClick={() => { resetForm(); setEditingSlot(null); setShowForm(true); }}>
          <Plus className="size-4 mr-2" />
          Slot hinzufügen
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterDay} onValueChange={(v) => setFilterDay(v as FilterDay)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Alle Tage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tage</SelectItem>
            <SelectItem value="Monday">Montag</SelectItem>
            <SelectItem value="Tuesday">Dienstag</SelectItem>
            <SelectItem value="Wednesday">Mittwoch</SelectItem>
            <SelectItem value="Thursday">Donnerstag</SelectItem>
            <SelectItem value="Friday">Freitag</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Alle Typen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="Coaching">Coaching</SelectItem>
            <SelectItem value="CheckIn">Check-In</SelectItem>
            <SelectItem value="General">Allgemein</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterActive === "all" ? "all" : filterActive ? "true" : "false"}
          onValueChange={(v) => setFilterActive(v === "all" ? "all" : v === "true")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="true">Aktiv</SelectItem>
            <SelectItem value="false">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Slots Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slots.map((slot) => (
          <Card key={slot.id} className={slot.isActive ? "" : "opacity-50"}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="capitalize">{slot.dayOfWeek}</span>
                  <Badge variant={slot.isActive ? "default" : "secondary"}>
                    {slot.isActive ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
                <Badge variant="outline">{slot.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Von</span>
                <span className="font-mono">{slot.startTime.slice(0, 5)}</span>
                <span className="text-muted-foreground">–</span>
                <span className="font-mono">{slot.endTime.slice(0, 5)}</span>
              </div>
              {slot.validFrom && (
                <div className="text-xs text-muted-foreground">
                  Gültig: {slot.validFrom} – {slot.validTo || "unbefristet"}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(slot)}>
                  Bearbeiten
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(slot)}>
                  Löschen
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {slots.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium mb-2">Keine Verfügbarkeiten angelegt</p>
            <p className="text-sm mb-4">Erstellen Sie Ihre ersten wöchentlichen Slots</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="size-4 mr-2" />
              Ersten Slot anlegen
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setEditingSlot(null); setShowForm(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlot ? "Slot bearbeiten" : "Neuen Slot anlegen"}</DialogTitle>
          </DialogHeader>
          <form>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="day">Tag *</Label>
                <Select value={formDay} onValueChange={(v) => setFormDay(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tag wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monday">Montag</SelectItem>
                    <SelectItem value="Tuesday">Dienstag</SelectItem>
                    <SelectItem value="Wednesday">Mittwoch</SelectItem>
                    <SelectItem value="Thursday">Donnerstag</SelectItem>
                    <SelectItem value="Friday">Freitag</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Typ</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coaching">Coaching</SelectItem>
                    <SelectItem value="CheckIn">Check-In</SelectItem>
                    <SelectItem value="General">Allgemein</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Von *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">Bis *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="type">Typ</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Typ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coaching">Coaching</SelectItem>
                    <SelectItem value="CheckIn">Check-In</SelectItem>
                    <SelectItem value="General">Allgemein</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="checkbox"
                  id="isActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <Label htmlFor="isActive">Aktiv</Label>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="validFrom">Gültig ab</Label>
                  <Input
                    id="validFrom"
                    type="date"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="validTo">Gültig bis (optional)</Label>
                  <Input
                    id="validTo"
                    type="date"
                    value={formValidTo}
                    onChange={(e) => setFormValidTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingSlot(null); resetForm(); }}>
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={editingSlot ? handleUpdate : handleCreate}
              disabled={formStartTime >= formEndTime}
            >
              {editingSlot ? "Aktualisieren" : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}