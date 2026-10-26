import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, User } from "lucide-react";

export default function ScheduleScopeBadge({ scope }: { scope: string }) {
  if (scope === "Course") {
    return (
      <Badge variant="outline" className="gap-1">
        <BookOpen className="h-3 w-3" /> Kurs
      </Badge>
    );
  }
  if (scope === "Group") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700">
        <Users className="h-3 w-3" /> Gruppe
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-purple-300 text-purple-700">
      <User className="h-3 w-3" /> Individuell
    </Badge>
  );
}
