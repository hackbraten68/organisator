import { format } from "date-fns";
import { Calendar, MapPin, Video, Phone, Hash, MessageSquare, CheckCheck, Building, Landmark, Briefcase, FileText, GitMerge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Appointment } from "@/types/appointment";

const STATUS_STYLES: Record<Appointment["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
  Draft: { variant: "secondary", icon: <Hash className="size-3.5" />, label: "Entwurf" },
  Finding: { variant: "default", icon: <Calendar className="size-3.5" />, label: "Terminfindung" },
  Confirmed: { variant: "default", icon: <Calendar className="size-3.5" />, label: "Bestätigt" },
  Completed: { variant: "default", icon: <Calendar className="size-3.5" />, label: "Durchgeführt" },
  Documented: { variant: "default", icon: <Calendar className="size-3.5" />, label: "Dokumentiert" },
  Cancelled: { variant: "destructive", icon: <Hash className="size-3.5" />, label: "Abgesagt" },
  NoShow: { variant: "destructive", icon: <Hash className="size-3.5" />, label: "Nicht erschienen" },
};

const TYPE_ICONS: Record<Appointment["type"], React.ReactNode> = {
  Coaching: <MessageSquare className="size-4 text-blue-500" aria-label="Coaching" />,
  CheckIn: <CheckCheck className="size-4 text-green-500" aria-label="Check-In" />,
  Berufsschule: <Building className="size-4 text-purple-500" aria-label="Berufsschule" />,
  Behörde: <Landmark className="size-4 text-orange-500" aria-label="Behörde" />,
  Praktikum: <Briefcase className="size-4 text-teal-500" aria-label="Praktikum" />,
  Sonstiges: <FileText className="size-4 text-gray-500" aria-label="Sonstiges" />,
};

const LOCATION_ICONS: Record<Exclude<Appointment["location"], undefined>, React.ReactNode> = {
  OnSite: <MapPin className="size-3.5" />,
  Teams: <Video className="size-3.5" />,
  Phone: <Phone className="size-3.5" />,
  Hybrid: <GitMerge className="size-3.5 text-purple-500" />,
  External: <MapPin className="size-3.5" />,
};

const LOCATION_ICON_FALLBACK = <MapPin className="size-3.5" />;

interface AppointmentListCardProps {
  appointment: Appointment;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onComplete?: (id: string) => void;
  onNoShow?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  showActions?: boolean;
  isLoading?: boolean;
  highlightCorrelation?: boolean;
}

export function AppointmentListCard({
  appointment,
  onReschedule,
  onCancel,
  onConfirm,
  onComplete,
  onNoShow,
  onViewDetails,
  showActions = true,
  isLoading = false,
  highlightCorrelation = false,
}: AppointmentListCardProps) {
  const statusConfig = STATUS_STYLES[appointment.status];
  const typeIcon = TYPE_ICONS[appointment.type] || TYPE_ICONS.Sonstiges;
  const locationIcon = appointment.location ? LOCATION_ICONS[appointment.location] : LOCATION_ICON_FALLBACK;

  if (isLoading) {
    return <AppointmentListCardSkeleton />;
  }

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd.MM.yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const isPending = appointment.status === "Finding";
  const isConfirmed = appointment.status === "Confirmed";
  const isDraft = appointment.status === "Draft";

  const canConfirm = isPending && onConfirm;
  const canReschedule = (isConfirmed || isPending) && onReschedule;
  const canComplete = isConfirmed && onComplete;
  const canNoShow = isConfirmed && onNoShow;
  const canCancel = (isDraft || isPending || isConfirmed) && onCancel;

  return (
    <Card className={`transition-shadow hover:shadow-md ${highlightCorrelation && appointment.correlationId ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl" aria-hidden="true">
            {typeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{appointment.type}</span>
                <Badge variant={statusConfig.variant} className="gap-1">
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
                {appointment.correlationId && highlightCorrelation && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Hash className="size-3" />
                    Journey
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                {appointment.name}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" aria-hidden="true" />
                {formatDateTime(appointment.startTime)} – {format(appointment.endTime, "HH:mm")}
              </span>
              {locationIcon && (
                <span className="flex items-center gap-1">
                  {locationIcon}
                  {appointment.location}
                </span>
              )}
              {appointment.meetingLink && (
                <span className="flex items-center gap-1 text-blue-600 hover:underline cursor-pointer">
                  <Video className="size-3.5" />
                  Online
                </span>
              )}
              {appointment.coachName && (
                <span className="truncate max-w-xs">
                  Coach: {appointment.coachName}
                </span>
              )}
            </div>

            {appointment.notes && (
              <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {appointment.notes}
              </div>
            )}

            {appointment.cancellationReason && (
              <div className="mt-2 text-sm text-destructive/80 bg-destructive/5 p-2 rounded">
                Absagegrund: {appointment.cancellationReason}
              </div>
            )}

            {appointment.correlationId && !highlightCorrelation && (
              <div className="mt-2 text-xs text-muted-foreground font-mono">
                Correlation: {appointment.correlationId}
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex flex-col gap-1.5 ml-2">
              {canConfirm && (
                <button
                  onClick={() => onConfirm?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Bestätigen
                </button>
              )}
              {canReschedule && (
                <button
                  onClick={() => onReschedule?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Verschieben
                </button>
              )}
              {canComplete && (
                <button
                  onClick={() => onComplete?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Durchgeführt
                </button>
              )}
              {canNoShow && (
                <button
                  onClick={() => onNoShow?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Nicht erschienen
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => onCancel?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Absagen
                </button>
              )}
              {onViewDetails && (
                <button
                  onClick={() => onViewDetails?.(appointment.id)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Details
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentListCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-3/4 bg-muted rounded" />
            <div className="h-4 w-1/2 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded" />
              <div className="h-8 w-24 bg-muted rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}