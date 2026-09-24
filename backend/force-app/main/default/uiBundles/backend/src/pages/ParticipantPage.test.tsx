import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ParticipantPage from "./ParticipantPage";
import { listParticipants, updateParticipant } from "@/api/participant/participantService";
import { listPrograms } from "@/api/program/programService";
import { listCoaches } from "@/api/coach/coachService";
import type { Participant } from "@/types/participant";

vi.mock("@/api/participant/participantService", () => ({
  listParticipants: vi.fn(),
  updateParticipant: vi.fn(),
}));
vi.mock("@/api/program/programService", () => ({
  listPrograms: vi.fn(),
}));
vi.mock("@/api/coach/coachService", () => ({
  listCoaches: vi.fn(),
}));
vi.mock("@/components/participants/ParticipantLearningPath", () => ({
  default: () => null,
}));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedList = vi.mocked(listParticipants);
const mockedUpdate = vi.mocked(updateParticipant);

const BEFORE: Participant = {
  id: "p1",
  name: "Max Mustermann",
  status: "Onboarding",
  email: "max@example.com",
  github: "maxm",
};

const AFTER: Participant = { ...BEFORE, status: "Active" };

/**
 * Regression test: changing the status and saving must keep showing the new
 * status immediately (form + table) without a remount. Previously the list
 * refresh after save reset the editable copy to the stale pre-save values.
 */
describe("ParticipantPage status save", () => {
  it("shows the saved status immediately without a reload", async () => {
    const user = userEvent.setup();
    mockedList.mockResolvedValueOnce([BEFORE]).mockResolvedValue([AFTER]);
    mockedUpdate.mockResolvedValue(AFTER);
    vi.mocked(listPrograms).mockResolvedValue([]);
    vi.mocked(listCoaches).mockResolvedValue([]);

    render(<ParticipantPage />);

    // Initial load: needs-attention row visible with old status.
    await screen.findByRole("table");
    expect(statusOfRow("Max Mustermann", "Onboarding")).toBeInTheDocument();

    // Change status in the details form (first combobox = Status).
    const statusSelect = screen.getAllByRole("combobox")[0];
    await user.click(statusSelect);
    await user.click(await screen.findByRole("option", { name: "Active" }));

    await user.click(
      await screen.findByRole("button", { name: /save participant/i }),
    );

    // Mutation sent with the new status.
    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledOnce();
    });
    expect(mockedUpdate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ status: "Active" }),
    );

    // Form keeps the saved status (no snap-back to stale data) ...
    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Active");
    });

    // ... and the refreshed table shows it too.
    await waitFor(() => {
      expect(statusOfRow("Max Mustermann", "Active")).toBeInTheDocument();
    });
  });
});

function statusOfRow(name: string, status: string): HTMLElement {
  const table = screen.getByRole("table");
  const row = within(table).getByText(name).closest("tr");
  if (!row) throw new Error(`row for ${name} not found`);
  return within(row).getByText(status);
}
