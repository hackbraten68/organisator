/**
 * ActorPicker: session-scoped self-attestation of WHO is working here.
 *
 * The user picks THEMSELF from the org's active Standard users (real
 * Salesforce User id, verifiable — but still self-selected, honestly so).
 * Display everywhere is first-name-only. Stored in sessionStorage (gone with
 * the tab). If the user list can't load, a freetext fallback keeps the
 * picker usable (then id-less, as before). Dismissing keeps SYSTEM.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listStaffUsers, type StaffUserChoice } from "@/api/audit/actorContext";

export interface ActorPickerProps {
  isOpen: boolean;
  onChoose: (choice: { userId?: string; firstName: string }) => void;
  onDismiss: () => void;
}

export function ActorPicker({ isOpen, onChoose, onDismiss }: ActorPickerProps) {
  const [users, setUsers] = useState<StaffUserChoice[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [fallbackName, setFallbackName] = useState("");
  const trimmedFallback = fallbackName.trim();

  useEffect(() => {
    if (!isOpen || users !== null) return;
    let live = true;
    listStaffUsers().then((list) => {
      if (live) setUsers(list);
    });
    return () => {
      live = false;
    };
  }, [isOpen, users]);

  const canConfirm = selectedId !== "" || trimmedFallback !== "";

  const confirm = () => {
    const user = users?.find((u) => u.id === selectedId);
    if (user) onChoose({ userId: user.id, firstName: user.firstName });
    else if (trimmedFallback) onChoose({ firstName: trimmedFallback });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent
        showCloseButton
        aria-describedby={undefined}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>Wer arbeitet hier?</DialogTitle>
          <DialogDescription>
            Wähle deinen Org-Benutzer — dein Vorname erscheint in der
            Aktivitäts-Chronik als Autor deiner Änderungen. Nur für diese
            Browser-Sitzung gespeichert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-4">
          {users === null ? (
            <p className="text-sm text-muted-foreground">Benutzer werden geladen…</p>
          ) : users.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="actor-user">Org-Benutzer</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="actor-user" className="w-full">
                  <SelectValue placeholder="Deinen Benutzer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="actor-first-name">Vorname</Label>
              <Input
                id="actor-first-name"
                value={fallbackName}
                onChange={(e) => setFallbackName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
                placeholder="z. B. Samuel"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Benutzerliste nicht verfügbar — Name wird ohne Org-ID gespeichert.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onDismiss}>
            Später
          </Button>
          <Button onClick={confirm} disabled={!canConfirm}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
