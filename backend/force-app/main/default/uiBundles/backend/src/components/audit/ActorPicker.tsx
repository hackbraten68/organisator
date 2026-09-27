/**
 * ActorPicker: session-scoped self-attestation of the staff first name.
 *
 * Shown only when no platform identity could be resolved. Stores a
 * staff actor WITHOUT id (honestly unverified) in sessionStorage — gone
 * with the tab. Dismissing keeps the SYSTEM fallback. First name only.
 */

import { useState } from "react";
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

export interface ActorPickerProps {
  isOpen: boolean;
  onChoose: (firstName: string) => void;
  onDismiss: () => void;
}

export function ActorPicker({ isOpen, onChoose, onDismiss }: ActorPickerProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const confirm = () => {
    if (trimmed) onChoose(trimmed);
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
            Dein Vorname erscheint in der Aktivitäts-Chronik als Autor deiner
            Änderungen. Nur für diese Browser-Sitzung gespeichert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-4">
          <Label htmlFor="actor-first-name">Vorname</Label>
          <Input
            id="actor-first-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
            }}
            placeholder="z. B. Samuel"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onDismiss}>
            Später
          </Button>
          <Button onClick={confirm} disabled={!trimmed}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
