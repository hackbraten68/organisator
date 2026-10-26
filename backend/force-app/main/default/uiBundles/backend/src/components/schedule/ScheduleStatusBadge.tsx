import { Badge } from "@/components/ui/badge";

export default function ScheduleStatusBadge({ status }: { status: string }) {
  if (status === "Published") {
    return <Badge className="bg-green-600 text-white">Veröffentlicht</Badge>;
  }
  return <Badge variant="secondary">Entwurf</Badge>;
}
