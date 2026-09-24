import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProgramParticipantsTab from "./ProgramParticipantsTab";
import {
  getLearningPathProgress,
  getProgram,
  listLearningPath,
  listPrograms,
} from "@/api/program/programService";
import {
  assignParticipant,
  listProgramParticipants,
  searchParticipants,
} from "@/api/participant/participantService";
import type { Program } from "@/types/program";

vi.mock("@/api/program/programService", () => ({
  getLearningPathProgress: vi.fn(),
  getProgram: vi.fn(),
  listLearningPath: vi.fn(),
  listPrograms: vi.fn(),
}));
vi.mock("@/api/participant/participantService", () => ({
  assignParticipant: vi.fn(),
  listProgramParticipants: vi.fn(),
  searchParticipants: vi.fn(),
  unassignParticipant: vi.fn(),
}));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const PROGRAM_ID = "prog-advanced";

function program(id: string, name: string): Program {
  return { id, name } as Program;
}

/**
 * A participant can only be in one program (single lookup), so assigning
 * someone who already has a different program must ask first instead of
 * silently moving them.
 */
describe("ProgramParticipantsTab move confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgram).mockResolvedValue({
      id: PROGRAM_ID,
      name: "IT Pro Advanced",
    } as never);
    vi.mocked(listPrograms).mockResolvedValue([
      program(PROGRAM_ID, "IT Pro Advanced"),
      program("prog-it", "IT Pro"),
    ]);
    vi.mocked(listProgramParticipants).mockResolvedValue([]);
    vi.mocked(searchParticipants).mockResolvedValue([
      { id: "c1", name: "Mover", programId: "prog-it" },
      { id: "c2", name: "Fresh" },
    ]);
    vi.mocked(listLearningPath).mockResolvedValue([]);
    vi.mocked(getLearningPathProgress).mockResolvedValue({
      total: 0,
      completed: 0,
      percent: 0,
    } as never);
    vi.mocked(assignParticipant).mockResolvedValue(undefined as never);
  });

  async function assignFor(name: string) {
    const user = userEvent.setup();
    render(<ProgramParticipantsTab programId={PROGRAM_ID} />);
    const row = (await screen.findByText(name)).closest("li");
    if (!row) throw new Error(`row for ${name} not found`);
    await user.click(
      within(row).getByRole("button", { name: "Assign" }),
    );
    return user;
  }

  it("asks before moving a participant from another program", async () => {
    await assignFor("Mover");

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Move participant?"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/IT Pro Advanced/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/currently assigned to IT Pro\./),
    ).toBeInTheDocument();
    expect(assignParticipant).not.toHaveBeenCalled();
  });

  it("moves on confirm and assigns directly on cancel-free path", async () => {
    const user = await assignFor("Mover");
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: "Move participant" }),
    );

    await waitFor(() => {
      expect(assignParticipant).toHaveBeenCalledWith("c1", PROGRAM_ID);
    });
  });

  it("cancelling keeps the participant where they are", async () => {
    const user = await assignFor("Mover");
    const dialog = await screen.findByRole("dialog");

    await user.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(assignParticipant).not.toHaveBeenCalled();
  });

  it("assigns participants without a program directly", async () => {
    await assignFor("Fresh");

    await waitFor(() => {
      expect(assignParticipant).toHaveBeenCalledWith("c2", PROGRAM_ID);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
