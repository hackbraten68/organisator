import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Archive } from "lucide-react";

export type TimeStatus = "current" | "future" | "past";

export function timeStatus(plan: { startDate: string | null; endDate: string | null }): TimeStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (!plan.startDate) return "past";
  const start = plan.startDate;
  const end = plan.endDate ?? start;
  if (today < start) return "future";
  if (today > end) return "past";
  return "current";
}

export default function ScheduleTimeStatusBadge({ status }: { status: TimeStatus }) {
  if (status === "current") {
    return (
      <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
        <Calendar className="h-3 w-3" /> Aktuell
      </Badge>
    );
  }
  if (status === "future") {
    return (
      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300">
        <Clock className="h-3 w-3" /> Zukünftig
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Archive className="h-3 w-3" /> Vergangen
    </Badge>
  );
}
