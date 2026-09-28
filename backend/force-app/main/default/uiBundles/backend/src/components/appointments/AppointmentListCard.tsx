import { format } from "date-fns";
import { Calendar, MapPin, Video, Phone, Hash, MessageSquare, CheckCheck, Building, Landmark, Briefcase, FileText, GitMerge, MoreHorizontal, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
  Coaching: <MessageSquare className="size-5 text-blue-500" aria-label="Coaching" />,
  CheckIn: <CheckCheck className="size-5 text-green-500" aria-label="Check-In" />,
  Berufsschule: <Building className="size-5 text-purple-500" aria-label="Berufsschule" />,
  Behörde: <Landmark className="size-5 text-orange-500" aria-label="Behörde" />,
  Praktikum: <Briefcase className="size-5 text-teal-500" aria-label="Praktikum" />,
  Sonstiges: <FileText className="size-5 text-gray-500" aria-label="Sonstiges" />,
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

  const hasActions = canConfirm || canReschedule || canComplete || canNoShow || canCancel || onViewDetails;

  return (
    <Card className={`group transition-shadow hover:shadow-card-hover ${highlightCorrelation && appointment.correlationId ? "ring-2 ring-primary" : ""}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {typeIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-h4 font-medium">{appointment.type}</span>
              <Badge variant={statusConfig.variant} className="gap-1.5">
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
            <span className="text-xs text-muted-foreground font-mono mt-1 block">
              {appointment.name}
            </span>
          </div>

          {showActions && hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canConfirm && (
                  <DropdownMenuItem onSelect={() => onConfirm?.(appointment.id)}>
                    Bestätigen
                  </DropdownMenuItem>
                )}
                {canReschedule && (
                  <DropdownMenuItem onSelect={() => onReschedule?.(appointment.id)}>
                    Verschieben
                  </DropdownMenuItem>
                )}
                {canComplete && (
                  <DropdownMenuItem onSelect={() => onComplete?.(appointment.id)}>
                    Durchgeführt
                  </DropdownMenuItem>
                )}
                {canNoShow && (
                  <DropdownMenuItem onSelect={() => onNoShow?.(appointment.id)}>
                    Nicht erschienen
                  </DropdownMenuItem>
                )}
                {canCancel && (
                  <DropdownMenuItem className="text-destructive" onSelect={() => onCancel?.(appointment.id)}>
                    Absagen
                  </DropdownMenuItem>
                )}
                {onViewDetails && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onViewDetails?.(appointment.id)}>
                      Details
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 font-mono">
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
            <a href={appointment.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <Video className="size-3.5" />
              Online
            </a>
          )}
          {appointment.coachName && (
            <span className="truncate max-w-xs flex items-center gap-1">
              <User className="size-3.5" />
              Coach: {appointment.coachName}
            </span>
          )}
        </div>

        {appointment.notes && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground line-clamp-3">
            {appointment.notes}
          </div>
        )}

        {appointment.cancellationReason && (
          <div className="p-3 bg-destructive/5 rounded-lg text-sm text-destructive/80">
            Absagegrund: {appointment.cancellationReason}
          </div>
        )}

        {appointment.correlationId && !highlightCorrelation && (
          <div className="text-xs text-muted-foreground font-mono">
            Correlation: {appointment.correlationId}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentListCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted" />
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
