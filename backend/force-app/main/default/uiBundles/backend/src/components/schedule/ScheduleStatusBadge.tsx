import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileEdit } from "lucide-react";

export default function ScheduleStatusBadge({ status }: { status: string }) {
  if (status === "Published") {
    return (
      <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
        <CheckCircle className="h-3 w-3" /> Veröffentlicht
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <FileEdit className="h-3 w-3" /> Entwurf
    </Badge>
  );
}
