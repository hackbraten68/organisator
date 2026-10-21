/**
 * Tests für den dritten Tab "Verfügbarkeit" in ParticipantAppointmentsTab.
 *
 * Der Tab soll nur für canManage=true (Coach/Admin) sichtbar sein.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParticipantAppointmentsTab } from "./ParticipantAppointmentsTab";
import { listAppointments } from "@/api/appointment/appointmentService";
import { editAppointment } from "@/api/appointment/appointmentEditService";
import { listAssignableUsers } from "@/api/user/userService";
import { toast } from "sonner";
import type { Appointment } from "@/types/appointment";

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

/**
 * Der Bearbeitungspfad laeuft ueber den Apex-Einstiegspunkt. Die Mock-
 * Fehlerklasse entspricht der echten: die Komponente prueft `instanceof`, und
 * ein Fehler aus einem anderen Modul wuerde als "unbekannter Fehler"
 * behandelt — die Meldung des Servers ginge dann verloren.
 */
vi.mock("@/api/appointment/appointmentEditService", () => ({
  editAppointment: vi.fn(),
  AppointmentEditError: class AppointmentEditError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = "AppointmentEditError";
      this.code = code;
      this.status = status;
    }
  },
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

/** Die Komponente importiert den Toast direkt aus "sonner". */
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./AvailabilitySlots", () => ({
  AvailabilitySlots: () => <div data-testid="availability-slots" />,
}));

const mockedList = vi.mocked(listAppointments);
const mockedUsers = vi.mocked(listAssignableUsers);
const mockedEdit = vi.mocked(editAppointment);

/** Ein Termin in der Zukunft — die Liste trennt anstehend und vergangen. */
function inDays(days: number, hours = 0): string {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();
}

const DRAFT_APPOINTMENT: Appointment = {
  id: "a0C9b0000Kx5LFtEQM",
  name: "TERM-0042",
  participantId: "a059b00000gdNKkAAM",
  participantName: "Test",
  coachId: "0059b00000gUfkFAAS",
  coachName: "Sam Dillenburg",
  type: "Coaching",
  status: "Draft",
  // Ende nach dem Anfang: der Dialog laesst ein Speichern nur zu, wenn die
  // Endzeit nach der Startzeit liegt. Ein Termin ohne Dauer waere kein
  // gueltiger Termin, sondern ein Blockierer fuer den eigenen Test.
  startTime: inDays(30),
  endTime: inDays(30, 1),
  location: "Zoom",
  meetingLink: "https://teams.microsoft.com/l/meetup-join/x",
  notes: "Erster Termin",
  createdAt: inDays(1),
  updatedAt: inDays(1),
};

beforeEach(() => {
  mockedList.mockReset().mockResolvedValue({ appointments: [], hasNextPage: false });
  mockedUsers.mockReset().mockResolvedValue([]);
  mockedEdit.mockReset().mockResolvedValue({
    id: DRAFT_APPOINTMENT.id,
    name: DRAFT_APPOINTMENT.name,
    status: "Draft",
  });
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

  it("bietet im Anlegen-Dialog kein Bearbeiten an", async () => {
    await openForm();

    // "Termin bearbeiten" gab es im Dialogtitel, aber editingAppointment
    // wurde nirgends gesetzt. Der Titel bleibt weg, bis das Bearbeiten
    // entweder verdrahtet oder als Produktentscheidung gestrichen ist.
    expect(screen.queryByText("Termin bearbeiten")).not.toBeInTheDocument();
  });
});

/**
 * Der Bearbeitungspfad (Entscheidung D1).
 *
 * Verbindlich entscheidet der Server: der Einstiegspunkt liest den aktuellen
 * Status aus der Datenbank und lehnt alles ausser Draft mit 409 ab. Der Client
 * filtert nur nach Bequemlichkeit — ein Termin, der zwischen der Anzeige und
 * dem Absenden den Status gewechselt hat, wird trotzdem abgelehnt.
 */
describe("ParticipantAppointmentsTab – Termin bearbeiten", () => {
  async function renderWith(appointments: Appointment[]) {
    mockedList.mockResolvedValue({ appointments, hasNextPage: false });
    render(
      <ParticipantAppointmentsTab
        participantId="a059b00000gdNKkAAM"
        participantName="Test"
        canManage={true}
      />
    );
    return screen.findByText("TERM-0042");
  }

  async function openEditMenu() {
    await userEvent.click(screen.getByRole("button", { name: /Aktionen für Termin/i }));
  }

  it("bietet Bearbeiten fuer einen Entwurf an", async () => {
    await renderWith([DRAFT_APPOINTMENT]);
    await openEditMenu();

    expect(await screen.findByRole("menuitem", { name: "Bearbeiten" })).toBeInTheDocument();
  });

  it("bietet Bearbeiten nicht fuer einen bestaetigten Termin an", async () => {
    await renderWith([{ ...DRAFT_APPOINTMENT, status: "Confirmed" }]);
    await openEditMenu();

    // Das Menue ist offen: "Verschieben" gibt es fuer einen bestaetigten
    // Termin. "Bearbeiten" nicht — Draft ist der einzige bearbeitbare Zustand.
    expect(await screen.findByRole("menuitem", { name: "Verschieben" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Bearbeiten" })).not.toBeInTheDocument();
  });

  it("oeffnet den Bearbeitungsdialog mit den Werten des Termins", async () => {
    await renderWith([DRAFT_APPOINTMENT]);
    await openEditMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Bearbeiten" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Termin bearbeiten");
    // Der Dialog zeigt den Termin, nicht einen leeren Formular.
    expect(document.querySelector<HTMLTextAreaElement>("#notes")?.value).toBe("Erster Termin");
  });

  it("schickt die Aenderung an den serverseitigen Einstiegspunkt", async () => {
    await renderWith([DRAFT_APPOINTMENT]);
    await openEditMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Bearbeiten" }));

    const notes = await screen.findByRole("dialog").then(() =>
      document.querySelector<HTMLTextAreaElement>("#notes")
    );
    if (!notes) throw new Error("notizenfeld nicht gefunden");
    await userEvent.clear(notes);
    await userEvent.type(notes, "Neue Notiz");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    await waitFor(() => expect(mockedEdit).toHaveBeenCalledTimes(1));
    const [id, payload] = mockedEdit.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe(DRAFT_APPOINTMENT.id);
    expect(payload).toMatchObject({ notes: "Neue Notiz", type: "Coaching" });
    // Die Zeit braucht eine Zone: DateTime verträgt keinen Offset-losen Wert.
    expect(String(payload.startTime)).toMatch(/Z$|[+-]\d{2}:\d{2}$/);
  });

  it("meldet einen Termin, der nicht bearbeitet werden darf, mit der Meldung des Servers", async () => {
    const { AppointmentEditError } = await import("@/api/appointment/appointmentEditService");
    mockedEdit.mockRejectedValue(
      new AppointmentEditError(
        "APPOINTMENT_NOT_EDITABLE",
        "Ein Termin kann nur im Status Draft bearbeitet werden. Aktueller Status: Confirmed.",
        409
      )
    );
    await renderWith([DRAFT_APPOINTMENT]);
    await openEditMenu();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Bearbeiten" }));

    const notes = await screen.findByRole("dialog").then(() =>
      document.querySelector<HTMLTextAreaElement>("#notes")
    );
    if (!notes) throw new Error("notizenfeld nicht gefunden");
    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining("Status Draft"))
    );
    // Der Dialog bleibt offen: die Eingabe soll nicht verloren gehen.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
