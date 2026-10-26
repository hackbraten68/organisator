import { Badge } from "@/components/ui/badge";

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
    return <Badge className="bg-green-600 text-white">Aktuell</Badge>;
  }
  if (status === "future") {
    return <Badge className="bg-blue-600 text-white">Zukünftig</Badge>;
  }
  return <Badge variant="secondary">Vergangen</Badge>;
}
