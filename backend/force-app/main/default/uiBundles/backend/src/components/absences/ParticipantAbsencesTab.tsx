import { useState, useEffect, useCallback } from "react";
import { Plus, Calendar, AlertCircle, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { listAbsences, createAbsence, approveAbsence, cancelAbsence, type Absence, type AbsenceInput, type AbsenceFilters } from "@/api/absence/absenceService";
import { AbsenceListCard } from "./AbsenceListCard";
import { AbsenceFormDialog } from "./AbsenceFormDialog";
import { AbsenceDocuments } from "./AbsenceDocuments";
import { AbsenceApprovalActions } from "./AbsenceApprovalActions";
import { AbsenceListCardSkeleton } from "./AbsenceSkeleton";
import { useAuditActorInit } from "@/hooks/useAuditActor";
import { toast } from "sonner";

const STATUS_STYLES: Record<Absence["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
  Submitted: { variant: "secondary", icon: <AlertCircle className="size-3.5" />, label: "Gemeldet" },
  Approved: { variant: "default", icon: <CheckCircle className="size-3.5" />, label: "Genehmigt" },
  Rejected: { variant: "destructive", icon: <XCircle className="size-3.5" />, label: "Abgelehnt" },
  Cancelled: { variant: "outline", icon: <XCircle className="size-3.5" />, label: "Storniert" },
};

interface ParticipantAbsencesTabProps {
  participantId: string;
  participantName?: string;
  canManage?: boolean;
}

export function ParticipantAbsencesTab({ participantId, participantName, canManage = false }: ParticipantAbsencesTabProps) {
  const { actor } = useAuditActorInit();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [viewDocumentsFor, setViewDocumentsFor] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<Absence["status"] | "all">("all");
  const [filterType, setFilterType] = useState<Absence["type"] | "all">("all");

  const fetchAbsences = useCallback(async () => {
    setLoading(true);
    try {
      const currentFilters: AbsenceFilters = {
        participantId,
        ...(filterStatus !== "all" && { status: filterStatus }),
        ...(filterType !== "all" && { type: filterType }),
      };
      const { absences: fetched } = await listAbsences(currentFilters);
      setAbsences(fetched);
    } catch (err) {
      console.error("Failed to load absences", err);
      toast.error("Abwesenheiten konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [participantId, filterStatus, filterType]);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  const handleCreate = async (data: AbsenceInput) => {
    await createAbsence(data);
    toast.success("Abwesenheit gemeldet");
    fetchAbsences();
  };

  const handleApprove = async (id: string) => {
    await approveAbsence(id);
    toast.success("Genehmigt");
    fetchAbsences();
  };

const handleReject = async (_id: string) => {
    // Will be handled by AbsenceApprovalActions
  };

const handleCancel = async (id: string) => {
    await cancelAbsence(id);
    toast.success("Storniert");
    fetchAbsences();
  };

const handleStatusChange = (_newStatus: string) => {
    fetchAbsences();
  };

  const absenceTypes = ["Krank", "Urlaub", "Berufsschule", "Praktikum", "Behörde", "Sonstiges"] as const;

  const pendingCount = absences.filter((a) => a.status === "Submitted").length;
  const approvedCount = absences.filter((a) => a.status === "Approved").length;
  const rejectedCount = absences.filter((a) => a.status === "Rejected").length;

  return (
    <div className="space-y-6">
      {/* Header with stats and new button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Abwesenheiten</h2>
          <p className="text-sm text-muted-foreground">
            {participantName ? `von ${participantName}` : "Übersicht aller Abwesenheitsmeldungen"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Badges */}
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="size-3.5" />
              Gemeldet: {pendingCount}
            </Badge>
            <Badge variant="default" className="gap-1">
              <CheckCircle className="size-3.5" />
              Genehmigt: {approvedCount}
            </Badge>
            <Badge variant="destructive" className="gap-1">
              <XCircle className="size-3.5" />
              Abgelehnt: {rejectedCount}
            </Badge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={(v: Absence["status"] | "all") => setFilterStatus(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="Submitted">Gemeldet</SelectItem>
                <SelectItem value="Approved">Genehmigt</SelectItem>
                <SelectItem value="Rejected">Abgelehnt</SelectItem>
                <SelectItem value="Cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v: Absence["type"] | "all") => setFilterType(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {absenceTypes.map((t) => (
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
              Neu melden
            </Button>
          )}
        </div>
      </div>

      {/* Absences List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <AbsenceListCardSkeleton key={i} />)
        ) : absences.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="size-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium mb-1">Keine Abwesenheiten</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {canManage ? "Erstellen Sie die erste Abwesenheitsmeldung" : "Für diesen Teilnehmer liegen noch keine Abwesenheiten vor"}
              </p>
              {canManage && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="size-4 mr-2" />
                  Erste Abwesenheit melden
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          absences.map((absence) => (
            <AbsenceListCard
              key={absence.id}
              absence={absence}
              onApprove={canManage ? handleApprove : undefined}
              onReject={canManage ? handleReject : undefined}
              onCancel={canManage ? handleCancel : undefined}
              onViewDocuments={() => setViewDocumentsFor(absence.id)}
              showActions={canManage}
            />
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <AbsenceFormDialog
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingAbsence(null); }}
        onSubmit={handleCreate}
        participantId={participantId}
        initialData={editingAbsence ? { ...editingAbsence, status: "Submitted" } : undefined}
        title={editingAbsence ? "Abwesenheit bearbeiten" : "Abwesenheit melden"}
      />

      {/* Documents Dialog */}
      <Dialog open={!!viewDocumentsFor} onOpenChange={(open) => !open && setViewDocumentsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Dokumente zur Abwesenheit</DialogTitle>
          </DialogHeader>
          {viewDocumentsFor && (
            <AbsenceDocuments
              absenceId={viewDocumentsFor}
              currentUserId={actor?.id || ""}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail view with approval actions for coaches */}
      {canManage && (
        <Dialog open={!!editingAbsence} onOpenChange={(open) => !open && setEditingAbsence(null)}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Abwesenheit Details</DialogTitle>
            </DialogHeader>
            {editingAbsence && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{editingAbsence.type}</span>
                    <Badge variant={STATUS_STYLES[editingAbsence.status].variant}>
                      {STATUS_STYLES[editingAbsence.status].icon}
                      {STATUS_STYLES[editingAbsence.status].label}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(editingAbsence.startDate), "dd.MM.yyyy")} – {format(new Date(editingAbsence.endDate), "dd.MM.yyyy")}
                  </div>
                  {editingAbsence.reason && (
                    <div className="text-sm text-muted-foreground">
                      Grund: {editingAbsence.reason}
                    </div>
                  )}
                </div>
                <Separator />
                <AbsenceApprovalActions
                  absenceId={editingAbsence.id}
                  status={editingAbsence.status}
                  onStatusChange={handleStatusChange}
                />
                <Separator />
                <Button onClick={() => { setViewDocumentsFor(editingAbsence!.id); setEditingAbsence(null); }}>
                  Dokumente anzeigen
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}