/**
 * Wiederherstellen-Knopf fuer ein geloeschtes Ereignis.
 *
 * Steht bewusst nicht direkt im Drawer, sondern hinter einem Bestaetigungs-
 * dialog: das Wiederherstellen legt einen neuen Datensatz an, und der Coach
 * soll vorher sehen, was genau entsteht. Nach dem Erfolg bleibt der Knopf
 * deaktiviert — sonst legt ein zweiter Klick eine zweite Kopie an.
 */

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeRestore, restoreFromEvent } from "@/api/audit/restoreService";
import type { AuditEvent } from "@/types/audit";
import { toast } from "@/components/ui/sonner";

interface RestoreDeletedButtonProps {
  event: AuditEvent;
}

export function RestoreDeletedButton({ event }: RestoreDeletedButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = describeRestore(event);
  if (!preview) return null;

  async function handleRestore() {
    setWorking(true);
    setError(null);
    try {
      await restoreFromEvent(event);
      setDone(true);
      setConfirmOpen(false);
      toast.success("Wiederhergestellt", {
        description: preview?.headline,
      });
    } catch (err) {
      console.error("[audit] Restore failed", event.id, err);
      setError(
        err instanceof Error
          ? err.message
          : "Wiederherstellen fehlgeschlagen. Der Datensatz wurde nicht angelegt.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={done}
        className="w-full"
      >
        <Undo2 className="size-4 mr-2" aria-hidden="true" />
        {done ? "Wiederhergestellt" : "Wiederherstellen"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(open) => !working && setConfirmOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wiederherstellen?</DialogTitle>
            <DialogDescription>
              {preview.headline} Es wird ein neuer Datensatz angelegt — der alte
              bleibt gelöscht und ist weiterhin im Verlauf nachlesbar.
              {preview.caveat && ` ${preview.caveat}`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={working}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={handleRestore} disabled={working}>
              {working ? "Wird wiederhergestellt…" : "Wiederherstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
