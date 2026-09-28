/**
 * Tests für die AvailabilitySlots-Komponente.
 *
 * Fokus: Delete-Button ruft Service auf, Toast, Refresh.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailabilitySlots } from "./AvailabilitySlots";
import {
  getAvailabilitySlots,
  deleteAvailabilitySlot,
} from "@/api/appointment/appointmentService";

vi.mock("@/api/appointment/appointmentService", () => ({
  getAvailabilitySlots: vi.fn(),
  createAvailabilitySlot: vi.fn(),
  updateAvailabilitySlot: vi.fn(),
  deleteAvailabilitySlot: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedGet = vi.mocked(getAvailabilitySlots);
const mockedDelete = vi.mocked(deleteAvailabilitySlot);

const SLOT = {
  id: "a0C9b0000Kx5LFtEQM",
  name: "SLOT-0000",
  userId: "0059b00000gUfkFAAS",
  userName: "Sam Dillenburg",
  dayOfWeek: "Monday" as const,
  startTime: "09:00:00.000",
  endTime: "12:00:00.000",
  type: "Coaching" as const,
  isActive: true,
  createdAt: "2026-09-28T10:00:00.000Z",
  updatedAt: "2026-09-28T10:00:00.000Z",
};

beforeEach(() => {
  mockedGet.mockReset().mockResolvedValue([SLOT]);
  mockedDelete.mockReset().mockResolvedValue(undefined);
});

describe("AvailabilitySlots", () => {
  it("lädt Slots beim Mount", async () => {
    render(<AvailabilitySlots currentUserId="0059b00000gUfkFAAS" canManage={true} />);

    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(await screen.findByText("Monday")).toBeInTheDocument();
  });

  it("rendert Delete-Button für aktive Slots", async () => {
    render(<AvailabilitySlots currentUserId="0059b00000gUfkFAAS" canManage={true} />);

    expect(await screen.findByRole("button", { name: /Löschen/i })).toBeInTheDocument();
  });

  it("ruft deleteAvailabilitySlot auf und refresht", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AvailabilitySlots currentUserId="0059b00000gUfkFAAS" canManage={true} />);

    await screen.findByRole("button", { name: /Löschen/i });
    await userEvent.click(screen.getByRole("button", { name: /Löschen/i }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith("a0C9b0000Kx5LFtEQM"));
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });

  it("bricht ab, wenn confirm() abgelehnt wird", async () => {
    render(<AvailabilitySlots currentUserId="0059b00000gUfkFAAS" canManage={true} />);

    await screen.findByRole("button", { name: /Löschen/i });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: /Löschen/i }));

    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
