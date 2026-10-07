/**
 * Tests für den dritten Tab "Verfügbarkeit" in ParticipantAppointmentsTab.
 *
 * Der Tab soll nur für canManage=true (Coach/Admin) sichtbar sein.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

/**
 * AppointmentFormDialog rendert selbst ein vollstaendiges Dialog (Radix
 * portalisiert in document.body). Ein umschliessendes Dialog erzeugt ein
 * zweites Portal, einen zweiten Header und eine zweite Fokusfalle — der
 * aeussere Dialog ist sichtbar, aber nicht bedienbar, weil der innere die
 * Fokusfalle haelt.
 */
describe("ParticipantAppointmentsTab – Termin-Formular", () => {
  async function openForm() {
    render(
      <ParticipantAppointmentsTab
        participantId="a059b00000gdNKkAAM"
        participantName="Test"
        canManage={true}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Termin anlegen/i }));
    return screen.findByRole("dialog");
  }

  it("haelt nur eine Dialog-Overlay im DOM", async () => {
    await openForm();

    // Nicht getAllByRole: Radix setzt aria-hidden auf den aeusseren Dialog,
    // sobald der innere offen ist. Die a11y-Abfrage sieht ihn nicht, der
    // Screenreader-Benutzer ebenfalls nicht — aber die zweite Fokusfalle und
    // der unsichtbare Overlay existieren. Deshalb direkt im DOM zaehlen.
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("zeigt den Formular-Titel genau einmal", async () => {
    await openForm();

    // Radix gibt jedem DialogContent einen aria-labelledby auf den Titel;
    // zwei Titel bedeuten zwei Header und damit zwei Screenreader-Regionen.
    expect(screen.getAllByText("Termin anlegen", { selector: "h2" })).toHaveLength(1);
  });
});
