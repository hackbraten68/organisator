import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  BookOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import ProgramFormDialog from "@/components/programs/ProgramFormDialog";
import {
  listProgramsWithCounts,
  updateProgram,
  type ProgramWithCounts,
} from "@/api/program/programService";
import ProgramStatusBadge from "@/components/programs/ProgramStatusBadge";
import type { ProgramStatus } from "@/types/program";

type StatusFilter = "All" | ProgramStatus;
type SortKey = "name" | "status" | "participants" | "updated";

export default function ProgramsPage() {
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sort, setSort] = useState<SortKey>("name");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProgramWithCounts | null>(null);

  const { data, loading, error } = useAsyncData(
    () => listProgramsWithCounts(),
    [reload],
  );

  const programs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data ?? []).filter((program) => {
      const matchesSearch =
        needle === "" ||
        program.name.toLowerCase().includes(needle) ||
        (program.description ?? "").toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "All" || program.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "status":
          return a.status.localeCompare(b.status);
        case "participants":
          return b.participantCount - a.participantCount;
        case "updated":
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [data, search, statusFilter, sort]);

  const archiveOne = async (program: ProgramWithCounts) => {
    await updateProgram(program.id, { name: program.name, status: "Archived" });
    setReload((v) => v + 1);
  };

  const activateOne = async (program: ProgramWithCounts) => {
    await updateProgram(program.id, { name: program.name, status: "Active" });
    setReload((v) => v + 1);
  };

  return (
    <div className="container mx-auto max-w-[1500px] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-sm text-muted-foreground">
            Manage training programs, modules and assignments.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Create Program
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_160px_160px]">
        <div className="space-y-2">
          <Label htmlFor="program-search">Search</Label>
          <Input
            id="program-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as StatusFilter)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="participants">Participants</SelectItem>
              <SelectItem value="updated">Last updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <ProgramsSkeleton />}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Failed to load programs</h2>
          </AlertTitle>
          <AlertDescription>
            Something went wrong while loading programs. Please try again
            later.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && programs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No programs found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {search.trim() !== "" || statusFilter !== "All"
                ? "No programs match your current filters."
                : "Get started by creating your first training program."}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Create Program
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && programs.length > 0 && (
        <div className="flex flex-col gap-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onOpen={() => navigate(`/programs/${program.id}`)}
              onEdit={() => setEditing(program)}
              onArchive={() => archiveOne(program)}
              onActivate={() => activateOne(program)}
            />
          ))}
        </div>
      )}

      <ProgramFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        program={null}
        onSaved={(saved) => {
          setReload((value) => value + 1);
          navigate(`/programs/${saved.id}`);
        }}
      />
      <ProgramFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        program={editing}
        onSaved={() => {
          setEditing(null);
          setReload((value) => value + 1);
        }}
      />
    </div>
  );
}

function ProgramCard({
  program,
  onOpen,
  onEdit,
  onArchive,
  onActivate,
}: {
  program: ProgramWithCounts;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onActivate: () => void;
}) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{program.name}</CardTitle>
            <CardDescription>
              {program.description || "No description yet."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <ProgramStatusBadge status={program.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}>
                  <BookOpen className="size-4" /> Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                {program.status !== "Archived" ? (
                  <DropdownMenuItem onClick={onArchive}>
                    <Archive className="size-4" /> Archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onActivate}>
                    <RotateCcw className="size-4" /> Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Participants</dt>
            <dd className="font-semibold">{program.participantCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Coaches</dt>
            <dd className="font-semibold">{program.coachCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modules</dt>
            <dd className="font-semibold">{program.moduleCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-semibold">
              {program.durationWeeks !== undefined
                ? `${program.durationWeeks} weeks`
                : "—"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function ProgramsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <Card key={key}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}