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

const PARTICIPANT_ID = "a059b00000gdNKkAAM";
const PARTICIPANT_NAME = "Tara Bergmann";

const COACHES = [
  { id: "0059b00000gUfkFAAS", name: "Sam Dillenburg" },
  { id: "0059b00000gUfkFAT", name: "Alex Beispiel" },
];

function renderDialog(
  initialData?: Partial<AppointmentInput>,
  coaches = COACHES,
  participantId: string = PARTICIPANT_ID,
) {
  return render(
    <AppointmentFormDialog
      isOpen
      onClose={onClose}
      onSubmit={onSubmit}
      participantId={participantId}
      participantName={PARTICIPANT_NAME}
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

/** Nur Zeitfelder — der Teilnehmer kommt aus den Props, nicht aus dem Formular. */
async function fillRequiredFields() {
  const [start, end] = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')
  );
  if (!start || !end) throw new Error("datetime-local inputs not found");
  await userEvent.type(start, "2026-09-30T10:00");
  await userEvent.type(end, "2026-09-30T11:00");
}

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

describe("AppointmentFormDialog – Teilnehmer kommt aus dem Seitenkontext", () => {
  it("zeigt den Teilnehmernamen und kein Eingabefeld fuer die rohe ID", () => {
    renderDialog();

    expect(screen.getByText(PARTICIPANT_NAME)).toBeInTheDocument();
    // Kein Freitext-Input mehr: die Salesforce-ID ist nicht tippbar.
    expect(screen.queryByPlaceholderText(/Teilnehmer ID/i)).not.toBeInTheDocument();
    // Der Dialog laeuft im Portal, daher document- und nicht container-query.
    const field = document.querySelector("#participantId");
    expect(field).not.toBeNull();
    expect(field?.tagName).not.toBe("INPUT");
    expect(field).toHaveTextContent(PARTICIPANT_NAME);
  });

  it("bietet die Teilnehmer-ID zum Kopieren an", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: /Teilnehmer-ID kopieren/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PARTICIPANT_ID));
  });

  it("sendet die Teilnehmer-ID aus den Props, nicht aus dem Formular", async () => {
    renderDialog();

    await fillRequiredFields();
    await userEvent.click(screen.getByLabelText(/Coach/i));
    const options = await screen.findAllByRole("option", { name: "Sam Dillenburg" });
    await userEvent.click(options[options.length - 1]);
    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0][0] as AppointmentInput).participantId).toBe(PARTICIPANT_ID);
  });

  it("meldet einen fehlenden Seitenkontext, statt ein leeres Feld zu akzeptieren", async () => {
    renderDialog(undefined, COACHES, "");

    await userEvent.click(screen.getByRole("button", { name: /Speichern/i }));

    expect(await screen.findByText("Kein Teilnehmer ausgewählt")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("AppointmentFormDialog – Submit", () => {
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
    expect(payload.participantId).toBe(PARTICIPANT_ID);
    expect(payload).not.toHaveProperty("staffId");
  });

  it("befuellt initialData ohne Staff-Feld", async () => {
    renderDialog({
      participantId: "a059b00000OTHER",
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
    // Der Termin bringt seine eigene Zuordnung mit; die Props überschreiben sie nicht.
    expect(payload.participantId).toBe("a059b00000OTHER");
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
