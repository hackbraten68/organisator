import { Badge } from "@/components/ui/badge";
import type { ProgramStatus } from "@/types/program";

function statusBadgeVariant(status: ProgramStatus) {
  switch (status) {
    case "Active":
      return "default";
    case "Draft":
      return "secondary";
    case "Archived":
      return "outline";
  }
}

export default function ProgramStatusBadge({
  status,
}: {
  status: ProgramStatus;
}) {
  return <Badge variant={statusBadgeVariant(status)}>{status}</Badge>;
}
