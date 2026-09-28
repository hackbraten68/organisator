/**
 * Regressionstests: `AppointmentFormDialog` kennt nur noch den Coach.
 *
 * Fachliche Regel: eine Person ist Admin, Coach oder Teilnehmer. Ein Termin
 * hat genau eine Betreuungszuordnung (`Coach__c`). Ein Staff-Feld oder ein
 * zweiter Betreuer-Picker darf nicht (mehr) existieren.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentFormDialog } from "./AppointmentFormDialog";
import type { AppointmentInput } from "@/types/appointment";

const onClose = vi.fn();
const onSubmit = vi.fn().mockResolvedValue(undefined);

const COACHES = [
  { id: "0059b00000gUfkFAAS", name: "Sam Dillenburg" },
  { id: "0059b00000gUfkFAT", name: "Alex Beispiel" },
];

function renderDialog(initialData?: Partial<AppointmentInput>, coaches = COACHES) {
  return render(
    <AppointmentFormDialog
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      initialData={initialData}
      availableCoaches={coaches}
      title="Termin anlegen"
    />
  );
}

beforeEach(() => {
  onClose.mockReset();
  onSubmit.mockReset().mockResolvedValue(undefined);
});

describe("AppointmentFormDialog – kein Staff", () => {
  it("rendert keinen Staff-Picker", () => {
    renderDialog();

    expect(screen.queryByText(/Staff/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Staff/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Staff/i)).not.toBeInTheDocument();
  });

  it("rendert den Coach-Picker mit den uebergebenen Coaches", async () => {
    renderDialog();

    expect(screen.getByLabelText(/Coach/i)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Coach/i));

    expect((await screen.findAllByText("Sam Dillenburg")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Alex Beispiel")).length).toBeGreaterThan(0);
  });

  it("zeigt einen Empty State, wenn keine Coaches verfuegbar sind", async () => {
    renderDialog(undefined, []);

    await userEvent.click(screen.getByLabelText(/Coach/i));

    // Radix spiegelt SelectItems in einem versteckten native <select>,
    // daher kann der Text mehrfach auftreten.
    expect((await screen.findAllByText("Keine Coaches verfügbar")).length).toBeGreaterThan(0);
  });
});

describe("AppointmentFormDialog – Submit", () => {
  async function fillRequiredFields() {
    await userEvent.type(screen.getByLabelText(/Teilnehmer/i), "a059b00000gdNKkAAM");

    const [start, end] = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')
    );
    if (!start || !end) throw new Error("datetime-local inputs not found");
    await userEvent.type(start, "2026-09-30T10:00");
    await userEvent.type(end, "2026-09-30T11:00");
  }

  it("sendet coachId, aber kein staffId", async () => {
    renderDialog();

    await fillRequiredFields();

    await userEvent.click(screen.getByLabelText(/Coach/i));
    const options = await screen.findAllByRole("option", { name: "Sam Dillenburg" });
    await userEvent.click(options[options.length - 1]);

    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0][0] as AppointmentInput;
    expect(payload.coachId).toBe("0059b00000gUfkFAAS");
    expect(payload.participantId).toBe("a059b00000gdNKkAAM");
    expect(payload).not.toHaveProperty("staffId");
  });

  it("befuellt initialData ohne Staff-Feld", async () => {
    renderDialog({
      participantId: "a059b00000gdNKkAAM",
      coachId: "0059b00000gUfkFAAS",
      type: "CheckIn",
      startTime: "2026-10-02T14:00",
      endTime: "2026-10-02T15:00",
    });

    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0][0] as AppointmentInput;
    expect(payload.type).toBe("CheckIn");
    expect(payload.coachId).toBe("0059b00000gUfkFAAS");
    expect(payload).not.toHaveProperty("staffId");
  });

  it("verlangt weiterhin einen Coach", async () => {
    renderDialog();

    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    expect(await screen.findByText("Coach ist erforderlich")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
