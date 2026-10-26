import { useNavigate } from "react-router";
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
import ScheduleStatusBadge from "@/components/schedule/ScheduleStatusBadge";
import ScheduleScopeBadge from "@/components/schedule/ScheduleScopeBadge";
import ScheduleTimeStatusBadge, { timeStatus } from "@/components/schedule/ScheduleTimeStatusBadge";
import type { SchedulePlan } from "@/types/schedule";

interface Props {
  plans: SchedulePlan[];
  onDelete: (plan: SchedulePlan) => void;
}

export default function SchedulePlanTable({ plans, onDelete }: Props) {
  const navigate = useNavigate();

  if (plans.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Keine Pläne gefunden.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Zeitstatus</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead>Teilnehmer / Gruppe / Kurs</TableHead>
          <TableHead>Programm</TableHead>
          <TableHead>Kurswoche</TableHead>
          <TableHead>Datumsbereich</TableHead>
          <TableHead>Coach</TableHead>
          <TableHead>Einträge</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.id}>
            <TableCell>
              <ScheduleTimeStatusBadge status={timeStatus(plan)} />
            </TableCell>
            <TableCell>
              <ScheduleStatusBadge status={plan.status} />
            </TableCell>
            <TableCell>
              <ScheduleScopeBadge scope={plan.scopeType} />
            </TableCell>
            <TableCell className="font-medium">
              {plan.scopeType === "Individual"
                ? plan.participantName ?? "–"
                : plan.scopeType === "Group"
                  ? plan.participantGroupName ?? "–"
                  : "Kurs"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {/* program name not in plan, shown via week context */}
            </TableCell>
            <TableCell className="text-xs">
              {plan.entryCount} Einträge
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {plan.startDate ?? "–"} – {plan.endDate ?? plan.startDate ?? "–"}
            </TableCell>
            <TableCell className="text-xs">
              {plan.coachName ?? "–"}
            </TableCell>
            <TableCell className="text-xs">{plan.entryCount}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/wochenplan/${plan.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {plan.status === "Draft" && (
                  <Button size="sm" variant="ghost" onClick={() => onDelete(plan)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
