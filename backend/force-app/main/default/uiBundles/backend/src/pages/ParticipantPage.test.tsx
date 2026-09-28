import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
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
vi.mock("@/components/participants/ParticipantActivity", () => ({
  default: () => <div data-testid="activity-stub" />,
}));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Router harness: the page reads selection (?tab/?event) and navigation
 * from react-router, so every render needs a Router context.
 */
function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/participants" element={<ParticipantPage />} />
        <Route path="/participants/:participantId" element={<ParticipantPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

beforeEach(() => {
  vi.clearAllMocks();
});

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

    renderAt("/participants");

    await screen.findAllByText("Max Mustermann");
    expect(screen.getAllByText("Onboarding").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Bearbeiten" }));

    const statusSelect = screen.getAllByRole("combobox")[0];
    await user.click(statusSelect);
    await user.click(await screen.findByRole("option", { name: "Active" }));

    await user.click(
      await screen.findByRole("button", { name: /teilnehmer speichern/i }),
    );

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledOnce();
    });
    expect(mockedUpdate).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ status: "Active" }),
    );

    await waitFor(() => {
      expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Active");
    });

    await waitFor(() => {
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });
  });
});

/**
 * Tab layout: sticky header always visible, activity lazy-loads only when
 * the Verlauf tab is opened (no audit fetch on initial page load).
 */
describe("ParticipantPage tabs", () => {
  async function renderLoadedPage(path = "/participants") {
    const user = userEvent.setup();
    mockedList.mockResolvedValue([BEFORE]);
    vi.mocked(listPrograms).mockResolvedValue([]);
    vi.mocked(listCoaches).mockResolvedValue([]);
    renderAt(path);
    await screen.findAllByText("Max Mustermann");
    return user;
  }

  it("shows sticky header with name and status on the overview tab", async () => {
    await renderLoadedPage();

    expect(
      screen.getByRole("heading", { name: "Max Mustermann" }),
    ).toBeInTheDocument();
    expect(screen.getByText("max@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("activity-stub")).not.toBeInTheDocument();
  });

  it("mounts the activity only when the Verlauf tab is opened", async () => {
    const user = await renderLoadedPage();

    await user.click(screen.getByRole("tab", { name: /verlauf/i }));

    expect(await screen.findByTestId("activity-stub")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Max Mustermann" }),
    ).toBeInTheDocument();
  });
});

/**
 * Deep links: canonical /participants/:id route, ?tab= preselection, and
 * graceful fallback for unknown ids.
 */
describe("ParticipantPage deep links", () => {
  async function renderLoadedPage(path: string) {
    mockedList.mockResolvedValue([BEFORE]);
    vi.mocked(listPrograms).mockResolvedValue([]);
    vi.mocked(listCoaches).mockResolvedValue([]);
    renderAt(path);
    await screen.findAllByText("Max Mustermann");
  }

  it("selects the participant from the route id", async () => {
    await renderLoadedPage("/participants/p1");

    expect(
      screen.getByRole("heading", { name: "Max Mustermann" }),
    ).toBeInTheDocument();
  });

  it("opens the Verlauf tab (with activity) directly via ?tab=", async () => {
    await renderLoadedPage("/participants/p1?tab=verlauf");

    expect(await screen.findByTestId("activity-stub")).toBeInTheDocument();
  });

  it("falls back to the first participant for unknown route ids", async () => {
    const { toast } = await import("@/components/ui/sonner");
    await renderLoadedPage("/participants/unknown-id");

    expect(
      screen.getByRole("heading", { name: "Max Mustermann" }),
    ).toBeInTheDocument();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Teilnehmer nicht gefunden",
      expect.anything(),
    );
  });
});


