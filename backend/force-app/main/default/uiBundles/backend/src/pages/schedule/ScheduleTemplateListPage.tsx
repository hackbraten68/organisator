import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/hooks/useAsyncData";
import { listScheduleTemplates } from "@/api/schedule/scheduleEditorService";

export default function ScheduleTemplateListPage() {
  const navigate = useNavigate();

  const { data: templates, loading, error } = useAsyncData(
    () => listScheduleTemplates(),
    [],
  );

  const list = templates ?? [];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-destructive">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wochenplan-Vorlagen</h1>
        <Button size="sm" variant="outline" onClick={() => navigate("/wochenplan")}>
          ← Wochenpläne
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Vorlagen sind undatierte Standardinhalte. Sie werden beim Anlegen eines Plans als Deep Copy übernommen.
      </p>

      {list.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Es sind noch keine Wochenplan-Vorlagen vorhanden.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border rounded-md p-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800">
                  Vorlage
                </span>
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.entryCount} Einträge
                </span>
                {t.status && (
                  <span className="text-xs text-muted-foreground">
                    Status: {t.status}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/wochenplan/vorlagen/${t.id}`)}
                >
                  Öffnen
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
