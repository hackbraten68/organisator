import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { de } from "date-fns/locale";
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
import { EmptyState } from "@/components/ui/layout";
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
    try {
      const id = await createAppointment(data);
      if (!id) {
        toast.error("Termin konnte nicht angelegt werden");
        return;
      }
      toast.success("Termin erstellt");
      await fetchAppointments();
    } catch (err) {
      // Ohne diesen Zweig blieb der Dialog beim Aufrufer offen und es
      // passierte sichtbar nichts: der Fehler landete nur als unbehandelte
      // Rejection in der Konsole.
      console.error("Failed to create appointment", err);
      toast.error("Termin konnte nicht angelegt werden");
    }
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

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterType !== "all" && a.type !== filterType) return false;
      return true;
    });
  }, [appointments, filterStatus, filterType]);

  const upcomingAppointments = useMemo(() => {
    return filteredAppointments
      .filter((a) => new Date(a.startTime) >= new Date() && ["Confirmed", "Finding", "Draft"].includes(a.status))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [filteredAppointments]);

  const pastAppointments = useMemo(() => {
    return filteredAppointments
      .filter((a) => new Date(a.startTime) < new Date() || ["Completed", "Documented", "Cancelled", "NoShow"].includes(a.status))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [filteredAppointments]);

  const pastByMonth = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const a of pastAppointments) {
      const key = format(new Date(a.startTime), "yyyy-MM");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [pastAppointments]);

  const statusOptions: { value: Appointment["status"] | "all"; label: string }[] = [
    { value: "all", label: "Alle" },
    { value: "Draft", label: "Entwurf" },
    { value: "Finding", label: "Terminfindung" },
    { value: "Confirmed", label: "Bestätigt" },
    { value: "Completed", label: "Durchgeführt" },
    { value: "Documented", label: "Dokumentiert" },
    { value: "Cancelled", label: "Abgesagt" },
    { value: "NoShow", label: "Nicht erschienen" },
  ];

  const typeOptions: { value: Appointment["type"] | "all"; label: string }[] = [
    { value: "all", label: "Alle" },
    ...appointmentTypes.map((t) => ({ value: t as Appointment["type"] | "all", label: t })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-h2 font-semibold">Termine</h2>
          <p className="text-small text-muted-foreground">
            {participantName ? `von ${participantName}` : "Übersicht aller Termine"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="w-48 text-center text-small font-medium">
              {format(adjustedStart, "dd.MM.")} – {format(weekEnd, "dd.MM.yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

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

          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as Appointment["status"] | "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as Appointment["type"] | "all")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Anstehend ({upcomingCount})</TabsTrigger>
          <TabsTrigger value="past">Vergangene ({pastCount})</TabsTrigger>
          {canManage && <TabsTrigger value="verfügbarkeit">Verfügbarkeit</TabsTrigger>}
        </TabsList>

        <TabsContent value="upcoming">
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <AppointmentListCardSkeleton key={i} />)
            ) : upcomingAppointments.length === 0 ? (
              <EmptyState
                icon={<Calendar className="size-12" />}
                title="Keine anstehenden Termine"
                description={canManage ? "Erstellen Sie den ersten Termin" : "Keine Termine geplant"}
                action={canManage ? <Button onClick={() => setShowForm(true)}><Plus className="size-4 mr-2" /> Ersten Termin anlegen</Button> : undefined}
              />
            ) : (
              upcomingAppointments.map((appointment) => (
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
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="past">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <AppointmentListCardSkeleton key={i} />)}
            </div>
          ) : pastByMonth.length === 0 ? (
            <EmptyState
              icon={<Calendar className="size-12" />}
              title="Keine vergangenen Termine"
            />
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {pastByMonth.map(([month, apps]) => (
                <AccordionItem value={month} key={month}>
                  <AccordionTrigger className="text-h4 font-medium px-4 py-3">
                    {format(new Date(month + "-01"), "MMMM yyyy", { locale: de })}
                    <Badge variant="secondary" className="ml-2">{apps.length}</Badge>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-3">
                      {apps.map((appointment) => (
                        <AppointmentListCard
                          key={appointment.id}
                          appointment={appointment}
                          showActions={false}
                          highlightCorrelation={true}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="verfügbarkeit">
            <AvailabilitySlots currentUserId={actor?.id || ""} canManage={true} />
          </TabsContent>
        )}
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
            participantId={participantId}
            participantName={participantName}
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