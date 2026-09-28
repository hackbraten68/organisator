import { format } from "date-fns";
import { Calendar, XCircle, CheckCircle, AlertCircle, FileText, Thermometer, Sun, Building, Briefcase, Landmark, FileText as FileTextIcon, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Absence } from "@/types/absence";

const STATUS_STYLES: Record<Absence["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
  Submitted: { variant: "secondary", icon: <AlertCircle className="size-3.5" />, label: "Gemeldet" },
  Approved: { variant: "default", icon: <CheckCircle className="size-3.5" />, label: "Genehmigt" },
  Rejected: { variant: "destructive", icon: <XCircle className="size-3.5" />, label: "Abgelehnt" },
  Cancelled: { variant: "outline", icon: <XCircle className="size-3.5" />, label: "Storniert" },
};

const TYPE_ICONS: Record<Absence["type"], React.ReactNode> = {
  Krank: <Thermometer className="size-4 text-red-500" aria-label="Krank" />,
  Urlaub: <Sun className="size-4 text-blue-500" aria-label="Urlaub" />,
  Berufsschule: <Building className="size-4 text-purple-500" aria-label="Berufsschule" />,
  Praktikum: <Briefcase className="size-4 text-green-500" aria-label="Praktikum" />,
  Behörde: <Landmark className="size-4 text-orange-500" aria-label="Behörde" />,
  Sonstiges: <FileTextIcon className="size-4 text-gray-500" aria-label="Sonstiges" />,
};

interface AbsenceListCardProps {
  absence: Absence;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onViewDocuments?: (id: string) => void;
  showActions?: boolean;
  isLoading?: boolean;
}

export function AbsenceListCard({
  absence,
  onApprove,
  onReject,
  onCancel,
  onViewDocuments,
  showActions = true,
  isLoading = false,
}: AbsenceListCardProps) {
  const statusConfig = STATUS_STYLES[absence.status];
  const typeIcon = TYPE_ICONS[absence.type] || TYPE_ICONS.Sonstiges;

  if (isLoading) {
    return <AbsenceListCardSkeleton />;
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd.MM.yyyy");
    } catch {
      return dateStr;
    }
  };

  const isPending = absence.status === "Submitted";
  const canApprove = isPending && onApprove;
  const canReject = isPending && onReject;
  const canCancel = (absence.status === "Submitted" || absence.status === "Approved") && onCancel;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl" aria-hidden="true">
            {typeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{absence.type}</span>
                <Badge variant={statusConfig.variant} className="gap-1">
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {absence.name}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" aria-hidden="true" />
                {formatDate(absence.startDate)} – {formatDate(absence.endDate)}
              </span>
              {absence.participantName && (
                <span className="truncate max-w-xs flex items-center gap-1">
                  <User className="size-3.5" />
                  {absence.participantName}
                </span>
              )}
            </div>

            {absence.reason && (
              <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {absence.reason}
              </div>
            )}

            {absence.approvedByName && (
              <div className="mt-2 text-xs text-muted-foreground">
                Genehmigt von {absence.approvedByName} am {formatDate(absence.approvedAt || "")}
              </div>
            )}

            {absence.rejectedByName && (
              <div className="mt-2 text-xs text-muted-foreground">
                Abgelehnt von {absence.rejectedByName} am {formatDate(absence.rejectedAt || "")}
              </div>
            )}

            {absence.coachComment && (
              <div className="mt-2 text-sm text-destructive/80 bg-destructive/5 p-2 rounded">
                Ablehnungsgrund: {absence.coachComment}
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex flex-row flex-wrap gap-2 ml-2 mt-2 pt-2 border-t border-border">
              {canApprove && (
                <button
                  onClick={() => onApprove?.(absence.id)}
                  className="px-3 py-1.5 text-sm font-medium text-success bg-success/10 border border-success/20 rounded hover:bg-success/20 focus:outline-none focus:ring-2 focus:ring-success/50"
                >
                  Genehmigen
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => onReject?.(absence.id)}
                  className="px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive/50"
                >
                  Ablehnen
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => onCancel?.(absence.id)}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted/50 border border-border rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-muted-foreground/50"
                >
                  Stornieren
                </button>
              )}
              {onViewDocuments && (
                <button
                  onClick={() => onViewDocuments?.(absence.id)}
                  className="px-3 py-1.5 text-sm font-medium text-info bg-info/10 border border-info/20 rounded hover:bg-info/20 focus:outline-none focus:ring-2 focus:ring-info/50"
                >
                  <FileText className="size-3.5 inline-block align-middle mr-1" />
                  Dokumente
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AbsenceListCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded bg-muted animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}