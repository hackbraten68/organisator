import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  programId: string;
  programs: { id: string; name: string }[];
  onProgramChange: (id: string) => void;
  scopeFilter: string;
  onScopeChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  timeFilter: string;
  onTimeChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  coachFilter: string;
  onCoachChange: (v: string) => void;
  coaches: { id: string; name: string }[];
  onReset: () => void;
}

export default function ScheduleFilterBar({
  programId,
  programs,
  onProgramChange,
  scopeFilter,
  onScopeChange,
  statusFilter,
  onStatusChange,
  timeFilter,
  onTimeChange,
  search,
  onSearchChange,
  coachFilter,
  onCoachChange,
  coaches,
  onReset,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56">
        <label className="text-xs text-muted-foreground mb-1 block">Programm</label>
        <Select value={programId} onValueChange={onProgramChange}>
          <SelectTrigger>
            <SelectValue placeholder="Programm wählen" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <label className="text-xs text-muted-foreground mb-1 block">Scope</label>
        <Select value={scopeFilter} onValueChange={onScopeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="Course">Kurs</SelectItem>
            <SelectItem value="Group">Gruppe</SelectItem>
            <SelectItem value="Individual">Individuell</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="Draft">Entwurf</SelectItem>
            <SelectItem value="Published">Veröffentlicht</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <label className="text-xs text-muted-foreground mb-1 block">Zeitraum</label>
        <Select value={timeFilter} onValueChange={onTimeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Aktuell</SelectItem>
            <SelectItem value="future">Zukünftig</SelectItem>
            <SelectItem value="past">Vergangen</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-48">
        <label className="text-xs text-muted-foreground mb-1 block">Teilnehmer-Suche</label>
        <Input
          placeholder="Name suchen..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {coaches.length > 0 && (
        <div className="w-40">
          <label className="text-xs text-muted-foreground mb-1 block">Coach</label>
          <Select value={coachFilter} onValueChange={onCoachChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={onReset}>
        Filter zurücksetzen
      </Button>
    </div>
  );
}
