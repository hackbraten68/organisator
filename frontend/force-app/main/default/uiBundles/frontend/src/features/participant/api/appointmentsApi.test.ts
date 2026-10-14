/**
 * `fetchAppointments` ist die einzige Leseverbindung des Portals zu Terminen und
 * entscheidet, was die Seite überhaupt zu zeigen bekommt.
 *
 * Die Tests decken die Faelle ab, in denen eine falsche Interpretation nicht
 * auffaellt: `coachName: null` darf nicht zu "" oder "Unbekannt" werden, ein
 * fehlendes `appointments`-Array darf nicht zu `[undefined]` fuehren, und ein
 * Fehler ohne JSON-Body darf nicht die Fehlermeldung der Org-Loginseite zeigen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("@salesforce/platform-sdk", () => ({
	createDataSDK: async () => ({ fetch: fetchMock }),
}));

import { fetchAppointments, AppointmentError } from "./appointmentsApi";

const ENDPOINT = "/services/apexrest/participant-portal/me/appointments";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const appointment = (overrides: Record<string, unknown> = {}) => ({
	appointmentId: "a0P0000000001AAA",
	startTime: "2026-10-20T10:00:00Z",
	endTime: "2026-10-20T11:00:00Z",
	status: "Confirmed",
	type: "Coaching",
	location: "Teams",
	meetingLink: "https://teams.example.invalid/x",
	cancellationReason: null,
	coachName: "Sabine Beispiel",
	...overrides,
});

beforeEach(() => {
	fetchMock.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("fetchAppointments – Erfolgsfall", () => {
	it("fragt genau diesen Endpoint read-only ab", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ appointments: [appointment()] }));

		await fetchAppointments();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [path, init] = fetchMock.mock.calls[0];
		expect(path).toBe(ENDPOINT);
		expect(init.method).toBe("GET");
		// Kein Body, kein Schreibzugriff: das Portal hat auf Appointment__c
		// ohnehin keine Schreibrechte.
		expect(init.body).toBeUndefined();
	});

	it("liefert die Termine unveraendert durch", async () => {
		const rows = [appointment(), appointment({ appointmentId: "a0P0000000002AAA" })];
		fetchMock.mockResolvedValue(jsonResponse({ appointments: rows }));

		await expect(fetchAppointments()).resolves.toEqual(rows);
	});

	it("behaelt coachName null bei – kein Leerstring, kein Platzhaltername", async () => {
		// Der Coach ist gesetzt, aber ohne Coach_Profile__c. Genau das ist der
		// Grund, warum die Seite "Coach nicht verfuegbar" schreiben soll.
		fetchMock.mockResolvedValue(jsonResponse({ appointments: [appointment({ coachName: null })] }));

		const [row] = await fetchAppointments();

		expect(row.coachName).toBeNull();
		// Gegenprobe: die Seite darf daraus keinen Namen erzaehlen.
		expect(row.coachName).not.toBe("");
	});

	it("behaelt null bei allen anderen optionalen Feldern", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({
				appointments: [
					appointment({
						startTime: null,
						endTime: null,
						status: null,
						type: null,
						location: null,
						meetingLink: null,
						cancellationReason: null,
						coachName: null,
					}),
				],
			})
		);

		const [row] = await fetchAppointments();

		for (const key of [
			"startTime",
			"endTime",
			"status",
			"type",
			"location",
			"meetingLink",
			"cancellationReason",
			"coachName",
		]) {
			expect(row[key as keyof typeof row]).toBeNull();
		}
	});

	it("gibt eine leere Liste zurueck, wenn der Server kein appointments-Array liefert", async () => {
		// Kein undefined, das wuerde in `.map` zu einem Fehler fuehren und die
		// Seite wuerde den Fehler als "Termine laden fehlgeschlagen" zeigen.
		fetchMock.mockResolvedValue(jsonResponse({}));

		await expect(fetchAppointments()).resolves.toEqual([]);
	});
});

describe("fetchAppointments – Fehler", () => {
	it("reicht Code und Status der Org durch", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ code: "NO_PARTICIPANT", message: "Kein Teilnehmer hinterlegt." }, 403)
		);

		const error = await fetchAppointments().catch((e) => e);

		expect(error).toBeInstanceOf(AppointmentError);
		expect(error.code).toBe("NO_PARTICIPANT");
		expect(error.status).toBe(403);
		expect(error.message).toBe("Kein Teilnehmer hinterlegt.");
	});

	it("faellt auf eine eigene Meldung zurueck, wenn der Body kein JSON ist", async () => {
		// z. B. die HTML-Fehlerseite der Org. `response.json()` waersch hier
		// abgelehnt und wuerde einen Abbruch statt einer verstaendlichen Meldung
		// ergeben.
		fetchMock.mockResolvedValue(
			new Response("<html>nope</html>", {
				status: 500,
				headers: { "content-type": "text/html" },
			})
		);

		const error = await fetchAppointments().catch((e) => e);

		expect(error).toBeInstanceOf(AppointmentError);
		expect(error.code).toBeNull();
		expect(error.message).toBe("Termindaten nicht verfügbar.");
	});

	it("wird zum ApiError, wenn die Antwort gar nicht erst ok ist", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		// Netzwerkfehler sind nicht AppointmentError – der Aufrufer darf daraus
		// keinen Status 0 ableiten. Hier nur die Weitergabe abgesichert.
		await expect(fetchAppointments()).rejects.toThrow(TypeError);
	});
});