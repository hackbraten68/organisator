import { useState, useEffect, useCallback } from "react";
import { Plus, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { listAppointments, createAppointment, confirmAppointment, completeAppointment, rescheduleAppointment, cancelAppointment, updateAppointmentAttendance, getAvailabilitySlots } from "@/api/appointment/appointmentService";
import { listAssignableUsers } from "@/api/user/userService";
import type { AssignableUser } from "@/types/user";
import type { Appointment, AppointmentInput, AppointmentFilters } from "@/types/appointment";
import { AppointmentListCard } from "./AppointmentListCard";
import { AppointmentFormDialog } from "./AppointmentFormDialog";
import { ProposeSlotsDialog } from "./ProposeSlotsDialog";
import { SelectSlotDialog } from "./SelectSlotDialog";
import { AvailabilitySlots } from "./AvailabilitySlots";
import { AppointmentListCardSkeleton } from "./AppointmentSkeleton";
import { useAuditActorInit } from "@/hooks/useAuditActor";
import { toast } from "sonner";

interface ParticipantAppointmentsTabProps {
  participantId: string;
  participantName?: string;
  canManage?: boolean;
}

export function ParticipantAppointmentsTab({ participantId, participantName, canManage = false }: ParticipantAppointmentsTabProps) {
  const { actor } = useAuditActorInit();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Appointment["status"] | "all">("all");
  const [filterType, setFilterType] = useState<Appointment["type"] | "all">("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [proposeSlotsFor, setProposeSlotsFor] = useState<Appointment | null>(null);
  const [selectSlotFor, setSelectSlotFor] = useState<Appointment | null>(null);
  const [availableCoaches, setAvailableCoaches] = useState<AssignableUser[]>([]);
  const [availableSlots, setAvailableSlots] = useState<import("@/types/availabilitySlot").AvailabilitySlot[]>([]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const adjustedStart = addWeeks(weekStart, weekOffset);
      const weekEnd = endOfWeek(adjustedStart, { weekStartsOn: 1 });

      const currentFilters: AppointmentFilters = {
        participantId,
        ...(filterStatus !== "all" && { status: filterStatus }),
        ...(filterType !== "all" && { type: filterType }),
        startTimeFrom: adjustedStart.toISOString(),
        startTimeTo: weekEnd.toISOString(),
      };
      const { appointments: fetched } = await listAppointments(currentFilters, 200);
      setAppointments(fetched);
    } catch (err) {
      console.error("Failed to load appointments", err);
      toast.error("Termine konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [participantId, filterStatus, filterType, weekOffset]);

  const fetchCoaches = useCallback(async () => {
    try {
      // Coach__c is a lookup to User, so the picker is fed from the filtered
      // user list. This org has no user roles and no coach profiles, so there
      // is nothing to narrow the list down by beyond "active, human user".
      const users = await listAssignableUsers();
      setAvailableCoaches(users);
    } catch (err) {
      console.error("Failed to load assignable users", err);
      toast.error("Coach-Auswahl konnte nicht geladen werden");
      setAvailableCoaches([]);
    }
  }, []);

  const fetchAvailableSlots = useCallback(async (coachId: string) => {
    try {
      const slots = await getAvailabilitySlots({ userId: coachId, isActive: true });
      setAvailableSlots(slots);
    } catch (err) {
      console.error("Failed to load slots", err);
      toast.error("Verfügbarkeiten konnten nicht geladen werden");
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchCoaches();
  }, [fetchAppointments, fetchCoaches]);

  const handleCreate = async (data: AppointmentInput) => {
    await createAppointment(data);
    toast.success("Termin erstellt");
    fetchAppointments();
  };

  const handleConfirm = async (id: string) => {
    await confirmAppointment(id);
    toast.success("Termin bestätigt");
    fetchAppointments();
  };

  const handleComplete = async (id: string) => {
    await completeAppointment(id);
    toast.success("Als durchgeführt markiert");
    fetchAppointments();
  };

  const handleNoShow = async (id: string) => {
    await updateAppointmentAttendance(id, "NoShow");
    toast.success("Als nicht erschienen markiert");
    fetchAppointments();
  };

  const handleReschedule = async (id: string) => {
    setProposeSlotsFor(appointments.find(a => a.id === id) || null);
    if (appointments.find(a => a.id === id)?.coachId) {
      fetchAvailableSlots(appointments.find(a => a.id === id)!.coachId!);
    }
  };

  const handleProposeSlots = async (slots: { startTime: string; endTime: string }[]) => {
    if (!proposeSlotsFor) return;
    await rescheduleAppointment(proposeSlotsFor.id, slots[0].startTime, slots[0].endTime, proposeSlotsFor.correlationId);
    toast.success("Slots vorgeschlagen");
    fetchAppointments();
    setProposeSlotsFor(null);
  };

  const handleSelectSlot = async (slot: { startTime: string; endTime: string }) => {
    if (!selectSlotFor) return;
    await rescheduleAppointment(selectSlotFor.id, slot.startTime, slot.endTime, selectSlotFor.correlationId);
    toast.success("Slot ausgewählt");
    fetchAppointments();
    setSelectSlotFor(null);
  };

  const handleCancel = async (id: string) => {
    await cancelAppointment(id);
    toast.success("Termin abgesagt");
    fetchAppointments();
  };

  const appointmentTypes = ["Coaching", "CheckIn", "Berufsschule", "Behörde", "Praktikum", "Sonstiges"] as const;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const adjustedStart = addWeeks(weekStart, weekOffset);
  const weekEnd = endOfWeek(adjustedStart, { weekStartsOn: 1 });

  const upcomingCount = appointments.filter((a) => new Date(a.startTime) >= new Date() && ["Confirmed", "Finding"].includes(a.status)).length;
  const pastCount = appointments.filter((a) => new Date(a.startTime) < new Date() || ["Completed", "Documented", "Cancelled", "NoShow"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      {/* Header with stats and navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Termine</h2>
          <p className="text-sm text-muted-foreground">
            {participantName ? `von ${participantName}` : "Übersicht aller Termine"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-48 text-center text-sm font-medium">
              {format(adjustedStart, "dd.MM.")} – {format(weekEnd, "dd.MM.yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Stats Badges */}
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="default" className="gap-1">
              <Calendar className="size-3.5" />
              Anstehend: {upcomingCount}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Calendar className="size-3.5" />
              Vergangene: {pastCount}
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Appointment["status"] | "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="Draft">Entwurf</SelectItem>
                <SelectItem value="Finding">Terminfindung</SelectItem>
                <SelectItem value="Confirmed">Bestätigt</SelectItem>
                <SelectItem value="Completed">Durchgeführt</SelectItem>
                <SelectItem value="Documented">Dokumentiert</SelectItem>
                <SelectItem value="Cancelled">Abgesagt</SelectItem>
                <SelectItem value="NoShow">Nicht erschienen</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as Appointment["type"] | "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {appointmentTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterStatus !== "all" || filterType !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setFilterStatus("all"); setFilterType("all"); }} aria-label="Filter zurücksetzen">
                <X className="size-4" />
              </Button>
            )}
          </div>

          {canManage && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="size-4 mr-2" />
              Termin anlegen
            </Button>
          )}
        </div>
      </div>

      {/* Appointments List */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Anstehend ({upcomingCount})</TabsTrigger>
          <TabsTrigger value="past">Vergangene ({pastCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <AppointmentListCardSkeleton key={i} />)
            ) : appointments
              .filter((a) => new Date(a.startTime) >= new Date())
              .filter((a) => ["Confirmed", "Finding", "Draft"].includes(a.status))
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((appointment) => (
                <AppointmentListCard
                  key={appointment.id}
                  appointment={appointment}
                  onReschedule={canManage ? handleReschedule : undefined}
                  onCancel={canManage ? handleCancel : undefined}
                  onConfirm={canManage ? handleConfirm : undefined}
                  onComplete={canManage ? handleComplete : undefined}
                  onNoShow={canManage ? handleNoShow : undefined}
                  showActions={canManage}
                  highlightCorrelation={true}
                />
              )) || (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="text-lg font-medium mb-1">Keine anstehenden Termine</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {canManage ? "Erstellen Sie den ersten Termin" : "Keine Termine geplant"}
                    </p>
                    {canManage && (
                      <Button onClick={() => setShowForm(true)}>
                        <Plus className="size-4 mr-2" />
                        Ersten Termin anlegen
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>

        <TabsContent value="past">
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <AppointmentListCardSkeleton key={i} />)
            ) : appointments
              .filter((a) => new Date(a.startTime) < new Date() || ["Completed", "Documented", "Cancelled", "NoShow"].includes(a.status))
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map((appointment) => (
                <AppointmentListCard
                  key={appointment.id}
                  appointment={appointment}
                  showActions={false}
                  highlightCorrelation={true}
                />
              )) || (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="size-12 mx-auto text-muted-foreground/50 mb-3" />
                    <h3 className="text-lg font-medium mb-1">Keine vergangenen Termine</h3>
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={() => { setShowForm(false); setEditingAppointment(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingAppointment ? "Termin bearbeiten" : "Termin anlegen"}</DialogTitle>
          </DialogHeader>
          <AppointmentFormDialog
            isOpen={showForm}
            onClose={() => { setShowForm(false); setEditingAppointment(null); }}
            onSubmit={handleCreate}
            initialData={editingAppointment ?? undefined}
            availableCoaches={availableCoaches}
            title={editingAppointment ? "Termin bearbeiten" : "Termin anlegen"}
          />
        </DialogContent>
      </Dialog>

      {/* Propose Slots Dialog (Coach) */}
      <ProposeSlotsDialog
        isOpen={!!proposeSlotsFor}
        onClose={() => setProposeSlotsFor(null)}
        onPropose={handleProposeSlots}
        type={proposeSlotsFor?.type || "Coaching"}
        availableSlots={availableSlots}
      />

      {/* Select Slot Dialog (Participant) */}
      <SelectSlotDialog
        isOpen={!!selectSlotFor}
        onClose={() => setSelectSlotFor(null)}
        onSelect={handleSelectSlot}
        proposedSlots={selectSlotFor ? [
          { startTime: "2026-01-15T10:00:00", endTime: "2026-01-15T11:00:00" },
          { startTime: "2026-01-16T14:00:00", endTime: "2026-01-16T15:00:00" },
          { startTime: "2026-01-17T09:00:00", endTime: "2026-01-17T10:00:00" },
        ] : []}
        type={selectSlotFor?.type || "Coaching"}
        participantId={participantId}
        coachName={selectSlotFor?.coachName}
      />

      {/* Coach Self-Service Availability (in separate dialog for coach view) */}
      {canManage && (
        <Dialog open={false} onOpenChange={() => {}}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Meine Verfügbarkeiten</DialogTitle>
            </DialogHeader>
            <AvailabilitySlots currentUserId={actor?.id || ""} canManage={true} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}