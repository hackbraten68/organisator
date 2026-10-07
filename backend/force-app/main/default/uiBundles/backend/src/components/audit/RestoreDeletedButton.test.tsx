/**
 * Wiederherstellen-Knopf.
 *
 * Der Knopf steht in einer Loeschung und legt beim Klick einen neuen Datensatz
 * an — die beiden Faelle, in denen man ihn leicht versehentlich ausloest und
 * nicht wieder loswird. Also wird beides getestet: dass er nur bei
 * wiederherstellbaren Ereignissen auftaucht, und dass nach dem Erfolg kein
 * zweiter Klick eine zweite Kopie erzeugt.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RestoreDeletedButton } from "./RestoreDeletedButton";
import { describeRestore, restoreFromEvent } from "@/api/audit/restoreService";
import type { AuditEvent } from "@/types/audit";
import type { RestorePreview } from "@/api/audit/restoreService";

vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("@/api/audit/restoreService", () => ({
  describeRestore: vi.fn(),
  restoreFromEvent: vi.fn(),
}));

const mockedDescribe = vi.mocked(describeRestore);
const mockedRestore = vi.mocked(restoreFromEvent);

const ITEM_EVENT = {
  id: "evt-1",
  eventType: "learning_path.item_deleted",
  action: "deleted",
  metadata: { title: "Einführung", programId: "prog-1", status: "In Progress" },
} as unknown as AuditEvent;

const ITEM_PREVIEW: RestorePreview = {
  kind: "learning_path_item",
  headline: 'Lernpfad-Eintrag „Einführung" wieder anlegen',
  caveat: "Die Position am Ende der Liste wird vergeben, nicht die alte.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedDescribe.mockReturnValue(ITEM_PREVIEW);
  mockedRestore.mockResolvedValue({ kind: "learning_path_item", newId: "lp-new" });
});

describe("RestoreDeletedButton", () => {
  it("bietet nichts an, wenn das Ereignis nicht wiederherstellbar ist", () => {
    mockedDescribe.mockReturnValue(null);

    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    expect(screen.queryByRole("button", { name: /Wiederherstellen/ })).toBeNull();
  });

  it("bestaetigt vor dem Anlegen und zeigt, was entsteht", async () => {
    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    await userEvent.click(screen.getByRole("button", { name: /Wiederherstellen/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent('Lernpfad-Eintrag „Einführung" wieder anlegen');
    expect(dialog).toHaveTextContent(/Position am Ende/);
    // Wichtig: der Datenbank-Zugriff passiert erst hinter der Bestaetigung.
    expect(mockedRestore).not.toHaveBeenCalled();
  });

  it("legt nach der Bestaetigung an und meldet es", async () => {
    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    await userEvent.click(screen.getByRole("button", { name: /Wiederherstellen/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Wiederherstellen", hidden: false }),
    );

    await waitFor(() => expect(mockedRestore).toHaveBeenCalledWith(ITEM_EVENT));
  });

  it("laesst keinen zweiten Klick zu, der eine Kopie erzeugt", async () => {
    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    await userEvent.click(screen.getByRole("button", { name: /Wiederherstellen/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Wiederherstellen", hidden: false }),
    );

    const button = await screen.findByRole("button", { name: /Wiederhergestellt/ });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(mockedRestore).toHaveBeenCalledTimes(1);
  });

  it("bricht ab, ohne etwas anzulegen", async () => {
    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    await userEvent.click(screen.getByRole("button", { name: /Wiederherstellen/ }));
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mockedRestore).not.toHaveBeenCalled();
  });

  it("zeigt den Fehler im Dialog und behaelt den Knopf nutzbar", async () => {
    mockedRestore.mockRejectedValue(new Error("Salesforce nicht erreichbar"));
    render(<RestoreDeletedButton event={ITEM_EVENT} />);

    await userEvent.click(screen.getByRole("button", { name: /Wiederherstellen/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Wiederherstellen", hidden: false }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Salesforce nicht erreichbar");
    expect(screen.getByRole("button", { name: /^Wiederherstellen/ })).toBeEnabled();
  });
});
