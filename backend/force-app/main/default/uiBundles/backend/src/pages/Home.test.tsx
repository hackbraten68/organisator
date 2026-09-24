import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Home from "./Home";
import {
  listParticipants,
  listRecentParticipants,
} from "@/api/participant/participantService";

vi.mock("@/api/participant/participantService", () => ({
  listParticipants: vi.fn(),
  listRecentParticipants: vi.fn(),
}));

const mockedListParticipants = vi.mocked(listParticipants);
const mockedListRecentParticipants = vi.mocked(listRecentParticipants);

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

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Lifecycle overview")).toBeInTheDocument();
    expect(screen.getByText("Recent participants")).toBeInTheDocument();
    expect(screen.getAllByText("Needs attention").length).toBeGreaterThan(0);
  });
});
