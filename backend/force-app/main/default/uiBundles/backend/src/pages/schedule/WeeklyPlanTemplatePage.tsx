import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { importScheduleTemplate } from '@/api/schedule/scheduleEditorService';
import { buildExampleTemplateImport } from '@/features/schedule-grid/exampleTemplateImport';

export default function WeeklyPlanTemplatePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const importPromise = useRef<Promise<{ id: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const promise =
      importPromise.current ??
      (importPromise.current = importScheduleTemplate(buildExampleTemplateImport()));
    promise
      .then(({ id }) => {
        if (!cancelled) navigate(`/wochenplan/vorlagen/${id}`, { replace: true });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          importPromise.current = null;
          setError(reason instanceof Error ? reason.message : 'Import fehlgeschlagen.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, attempt]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-semibold">Beispielvorlage konnte nicht importiert werden</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {
            importPromise.current = null;
            setError(null);
            setAttempt((value) => value + 1);
          }}>
            Erneut versuchen
          </Button>
          <Button variant="outline" onClick={() => navigate('/wochenplan/vorlagen')}>
            Zu den Vorlagen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="font-medium">Beispielvorlage wird importiert …</p>
      <p className="max-w-xl text-sm text-muted-foreground">
        Die statische AWS-Musterwoche wird einmalig als Vorlage gespeichert. Danach wird
        ausschließlich der Salesforce-Datensatz verwendet.
      </p>
    </div>
  );
}
