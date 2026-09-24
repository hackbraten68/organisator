import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertCircle, FileQuestion, Pencil } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ObjectBreadcrumb } from "@/components/ObjectBreadcrumb";
import { useAsyncData } from "@/hooks/useAsyncData";
import ProgramFormDialog from "@/components/programs/ProgramFormDialog";
import ProgramStatusBadge from "@/components/programs/ProgramStatusBadge";
import ProgramOverviewTab from "@/components/programs/ProgramOverviewTab";
import ProgramModulesTab from "@/components/programs/ProgramModulesTab";
import ProgramParticipantsTab from "@/components/programs/ProgramParticipantsTab";
import ProgramCoachesTab from "@/components/programs/ProgramCoachesTab";
import ProgramSettingsTab from "@/components/programs/ProgramSettingsTab";
import { getProgram } from "@/api/program/programService";

export default function ProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);

  const { data: program, loading, error } = useAsyncData(
    () => getProgram(programId ?? ""),
    [programId, reload],
  );

  const refresh = () => setReload((value) => value + 1);

  return (
    <div className="container mx-auto max-w-[1500px] p-6">
      <ObjectBreadcrumb
        listPath="/programs"
        listLabel="Programs"
        loading={loading}
        recordName={
          program
            ? program.name
            : error
              ? "Error"
              : loading
                ? undefined
                : "Not Found"
        }
      />

      {loading && <ProgramDetailSkeleton />}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle />
          <AlertTitle>
            <h2>Failed to load program</h2>
          </AlertTitle>
          <AlertDescription>
            Something went wrong while loading this program. Please try again
            later.
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && !program && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileQuestion className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">Program not found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              The program you&apos;re looking for doesn&apos;t exist or may
              have been deleted.
            </p>
            <Button variant="outline" onClick={() => navigate("/programs")}>
              ← Back to Programs
            </Button>
          </CardContent>
        </Card>
      )}

      {program && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{program.name}</h1>
              <ProgramStatusBadge status={program.status} />
            </div>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit Program
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="coaches">Coaches</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ProgramOverviewTab
                program={program}
                refreshKey={reload}
                onEdit={() => setEditOpen(true)}
              />
            </TabsContent>
            <TabsContent value="modules">
              <ProgramModulesTab programId={program.id} />
            </TabsContent>
            <TabsContent value="participants">
              <ProgramParticipantsTab programId={program.id} />
            </TabsContent>
            <TabsContent value="coaches">
              <ProgramCoachesTab programId={program.id} onChanged={refresh} />
            </TabsContent>
            <TabsContent value="settings">
              <ProgramSettingsTab program={program} onChanged={refresh} />
            </TabsContent>
          </Tabs>

          <ProgramFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            program={program}
            onSaved={refresh}
          />
        </>
      )}
    </div>
  );
}

function ProgramDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
