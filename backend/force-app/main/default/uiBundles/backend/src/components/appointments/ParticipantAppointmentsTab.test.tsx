/**
 * Tests für den dritten Tab "Verfügbarkeit" in ParticipantAppointmentsTab.
 *
 * Der Tab soll nur für canManage=true (Coach/Admin) sichtbar sein.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticipantAppointmentsTab } from "./ParticipantAppointmentsTab";
import { listAppointments } from "@/api/appointment/appointmentService";
import { listAssignableUsers } from "@/api/user/userService";

vi.mock("@/api/appointment/appointmentService", () => ({
  listAppointments: vi.fn(),
  createAppointment: vi.fn(),
  confirmAppointment: vi.fn(),
  completeAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  updateAppointmentAttendance: vi.fn(),
  getAvailabilitySlots: vi.fn(),
  createAvailabilitySlot: vi.fn(),
  updateAvailabilitySlot: vi.fn(),
  deleteAvailabilitySlot: vi.fn(),
}));

vi.mock("@/api/user/userService", () => ({
  listAssignableUsers: vi.fn(),
}));

vi.mock("@/hooks/useAuditActor", () => ({
  useAuditActorInit: () => ({
    actor: { id: "0059b00000gUfkFAAS", type: "staff", displayName: "Sam Dillenburg" },
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./AvailabilitySlots", () => ({
  AvailabilitySlots: () => <div data-testid="availability-slots" />,
}));

const mockedList = vi.mocked(listAppointments);
const mockedUsers = vi.mocked(listAssignableUsers);

beforeEach(() => {
  mockedList.mockReset().mockResolvedValue({ appointments: [], hasNextPage: false });
  mockedUsers.mockReset().mockResolvedValue([]);
});

describe("ParticipantAppointmentsTab – Verfügbarkeit-Tab", () => {
  it("rendert Verfügbarkeit-Tab nur bei canManage=true", async () => {
    render(
      <ParticipantAppointmentsTab
        participantId="a059b00000gdNKkAAM"
        participantName="Test"
        canManage={true}
      />
    );

    expect(await screen.findByRole("tab", { name: /Verfügbarkeit/i })).toBeInTheDocument();
  });

  it("rendert Verfügbarkeit-Tab nicht bei canManage=false", async () => {
    render(
      <ParticipantAppointmentsTab
        participantId="a059b00000gdNKkAAM"
        participantName="Test"
        canManage={false}
      />
    );

    expect(screen.queryByRole("tab", { name: /Verfügbarkeit/i })).not.toBeInTheDocument();
  });
});
