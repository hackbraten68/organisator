import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Home from "./Home";
import {
  listParticipants,
  listRecentParticipants,
} from "@/api/participant/participantService";
import {
  getWorkbookSupportOverview,
  getWorkbookDayOverview,
} from "@/api/workbook/workbookService";

vi.mock("@/api/participant/participantService", () => ({
  listParticipants: vi.fn(),
  listRecentParticipants: vi.fn(),
}));

vi.mock("@/api/workbook/workbookService", () => ({
  getWorkbookSupportOverview: vi.fn(),
  getWorkbookDayOverview: vi.fn(),
}));

const mockedListParticipants = vi.mocked(listParticipants);
const mockedListRecentParticipants = vi.mocked(listRecentParticipants);
const mockedGetWorkbookSupportOverview = vi.mocked(getWorkbookSupportOverview);
const mockedGetWorkbookDayOverview = vi.mocked(getWorkbookDayOverview);

describe("Home dashboard", () => {
  it("renders the dashboard overview and recent participant list", async () => {
    mockedListParticipants.mockResolvedValue([
      {
        id: "p-1",
        name: "Max Mustermann",
        status: "Onboarding",
        startDate: "2026-09-01",
      },
      {
        id: "p-2",
        name: "Lisa Meyer",
        status: "Active",
        programId: "program-1",
        coachId: "coach-1",
        github: "lisam",
        discord: "lisa",
      },
    ]);
    mockedListRecentParticipants.mockResolvedValue([
      {
        id: "p-1",
        name: "Max Mustermann",
        status: "Onboarding",
        createdAt: "2026-09-20T10:00:00.000Z",
      },
    ]);
    mockedGetWorkbookSupportOverview.mockResolvedValue({
      checkIns: [],
      supportTasks: [],
      feedbackEvidence: [],
    });
    mockedGetWorkbookDayOverview.mockResolvedValue({
      date: "2026-09-20",
      totalDays: 0,
      closedDays: 0,
      openDays: 0,
      checkedInCount: 0,
      taskCount: 0,
      doneTaskCount: 0,
      focusTaskCount: 0,
      supportTaskCount: 0,
      evidenceCount: 0,
      days: [],
      tasks: [],
      evidence: [],
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Lifecycle-Übersicht")).toBeInTheDocument();
    expect(screen.getByText("Zuletzt hinzugefügt")).toBeInTheDocument();
    expect(screen.getAllByText("Braucht Aufmerksamkeit").length).toBeGreaterThan(0);
  });
});
