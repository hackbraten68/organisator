/**
 * Regressionstests für den Datenverlust in der Terminvorschlags- und
 * Verschiebepfanne.
 *
 * Ausgangslage: der Dialog verlangte genau drei ausgewählte Slots, schickte
 * aber nur den ersten an die Mutation. Zwei Termine verschwanden ersatzlos —
 * ohne Fehler, ohne Rückmeldung, und die abgeschickten Daten waren nicht
 * rekonstruierbar. Wer drei Slots anbot, bekam einen.
 *
 * Bis das fachliche Modell für Alternativtermine existiert (ein Objekt, das
 * mehrere Vorschläge hält und dem Gegenüber die Auswahl überlässt), gibt der
 * Dialog eine Zusage, die er halten kann: genau ein Termin. Der Dialog darf
 * keinen Zustand mehr erreichen, in dem eine Auswahl verworfen wird.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProposeSlotsDialog } from "./ProposeSlotsDialog";
import type { AvailabilitySlot } from "@/types/availabilitySlot";

/** Slot mit gueltigem Datum, damit er vorschlagbar ist. */
const slot = (overrides: Partial<AvailabilitySlot> & { id: string }): AvailabilitySlot => ({
	userId: "coach-1",
	name: "SLOT-0001",
	createdAt: "2026-01-01T00:00:00",
	updatedAt: "2026-01-01T00:00:00",
	dayOfWeek: "Monday",
	startTime: "09:00",
	endTime: "10:00",
	type: "Coaching",
	isActive: true,
	validFrom: "2026-03-02",
	validTo: "2026-03-31",
	...overrides,
});

const SLOTS: AvailabilitySlot[] = [
	slot({ id: "a", startTime: "09:00", endTime: "10:00" }),
	slot({ id: "b", startTime: "11:00", endTime: "12:00" }),
	slot({ id: "c", dayOfWeek: "Tuesday", startTime: "14:00", endTime: "15:00" }),
	// Ohne Datum: sichtbar, aber nicht vorschlagbar (B4).
	slot({ id: "d", startTime: "16:00", endTime: "17:00", validFrom: undefined, validTo: undefined }),
];

const setup = (onPropose = vi.fn().mockResolvedValue(undefined)) => {
	render(
		<ProposeSlotsDialog
			isOpen={true}
			onClose={vi.fn()}
			onPropose={onPropose}
			type="Coaching"
			availableSlots={SLOTS}
		/>,
	);
	return { onPropose };
};

const slotButton = (label: RegExp) =>
	screen.getByRole("button", { name: new RegExp(label.source, label.flags.replace("g", "")) });

beforeEach(() => {
	vi.restoreAllMocks();
});

describe("ProposeSlotsDialog – Auswahl", () => {
	it("fordert genau eine Auswahl und verspricht nicht mehr", () => {
		setup();

		// Kein "3" mehr im Titel, im Button und im Zaehler — die Zusage
		// waere sonst wieder eine, die der Datenweg nicht einloesen kann.
		expect(screen.getByText("Terminvorschlag für Coaching")).toBeInTheDocument();
		expect(screen.queryByText(/Terminvorschläge/)).not.toBeInTheDocument();
		expect(screen.queryByText(/\/3 ausgewählt/)).not.toBeInTheDocument();
	});

	it("laesst ohne Auswahl kein Absenden zu", () => {
		setup();

		expect(screen.getByRole("button", { name: /Termin vorschlagen/ })).toBeDisabled();
	});

	it("waehlt genau einen Slot aus", () => {
		setup();

		fireEvent.click(slotButton(/09:00/));

		expect(screen.getByRole("button", { name: /Termin vorschlagen/ })).toBeEnabled();
	});

	it("ersetzt die Auswahl, statt Slots zu sammeln", () => {
		setup();

		fireEvent.click(slotButton(/09:00/));
		fireEvent.click(slotButton(/11:00/));

		expect(slotButton(/09:00/)).toHaveAttribute("aria-pressed", "false");
		expect(slotButton(/11:00/)).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText("1/1 ausgewählt")).toBeInTheDocument();
	});

	it("hebt die Auswahl auf, wenn derselbe Slot erneut geklickt wird", () => {
		setup();

		fireEvent.click(slotButton(/09:00/));
		fireEvent.click(slotButton(/09:00/));

		expect(screen.getByRole("button", { name: /Termin vorschlagen/ })).toBeDisabled();
	});

	it("laesst Slots ohne Datum nicht auswaehlen", () => {
		setup();

		expect(screen.getByText("Kein Datum hinterlegt — nicht vorschlagbar")).toBeInTheDocument();
		expect(slotButton(/16:00/)).toBeDisabled();
	});
});

describe("ProposeSlotsDialog – Absenden", () => {
	it("schickt genau den gewaehlten Slot, ohne die anderen", async () => {
		const { onPropose } = setup();

		fireEvent.click(slotButton(/09:00/));
		fireEvent.click(screen.getByRole("button", { name: /Termin vorschlagen/ }));

		await waitFor(() => expect(onPropose).toHaveBeenCalledTimes(1));
		expect(onPropose).toHaveBeenCalledWith({
			startTime: "2026-03-02T09:00",
			endTime: "2026-03-02T10:00",
		});
	});

	it("schickt nie eine leere Liste", async () => {
		const { onPropose } = setup();

		// Der Senden-Button ist ohne Auswahl deaktiviert; zusaetzlich pruefen
		// wir, dass selbst ein erzwungenes Absenden ohne Auswahl nichts tut.
		fireEvent.click(screen.getByRole("button", { name: /Termin vorschlagen/ }));

		await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
		expect(onPropose).not.toHaveBeenCalled();
	});

	it("meldet einen Fehler des Aufrufers im Dialog", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const onPropose = vi.fn().mockRejectedValue(new Error("Netzwerk"));
		setup(onPropose);

		fireEvent.click(slotButton(/09:00/));
		fireEvent.click(screen.getByRole("button", { name: /Termin vorschlagen/ }));

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("Fehler beim Vorschlagen"),
		);
	});
});
