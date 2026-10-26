import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScheduleEntry } from "@/types/schedule";

interface Props {
  entries: ScheduleEntry[];
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (entry: ScheduleEntry) => void;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function ScheduleEntryTable({ entries, onEdit, onDelete }: Props) {
  const sorted = [...entries].sort((a, b) => {
    const di = DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek);
    if (di !== 0) return di;
    const ao = a.order ?? 999;
    const bo = b.order ?? 999;
    if (ao !== bo) return ao - bo;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Noch keine Einträge. Ersten Eintrag anlegen.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tag</TableHead>
          <TableHead>Zeit</TableHead>
          <TableHead>Art</TableHead>
          <TableHead>Titel</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Ziel</TableHead>
          <TableHead>Coach</TableHead>
          <TableHead>Ort</TableHead>
          <TableHead>Pflicht</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{e.dayOfWeek}</TableCell>
            <TableCell>
              {e.startTime ? `${e.startTime.slice(0, 5)}–${(e.endTime ?? "").slice(0, 5)}` : "—"}
            </TableCell>
            <TableCell>{e.entryKind}</TableCell>
            <TableCell>{e.title}</TableCell>
            <TableCell>{e.type}</TableCell>
            <TableCell>{e.targetType}</TableCell>
            <TableCell>{e.coachName ?? "—"}</TableCell>
            <TableCell>{e.location ?? "—"}</TableCell>
            <TableCell>{e.isRequired ? "Ja" : "Nein"}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(e)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(e)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
