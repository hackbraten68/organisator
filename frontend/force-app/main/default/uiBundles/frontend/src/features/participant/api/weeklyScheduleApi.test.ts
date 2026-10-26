import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

vi.mock("@salesforce/platform-sdk", () => ({
	createDataSDK: async () => ({ fetch: fetchMock }),
}));

import { fetchWeeklySchedule, WeeklyScheduleError } from "./weeklyScheduleApi";

const ENDPOINT = "/services/apexrest/participant-portal/me/weekly-schedule";

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const entry = (overrides: Record<string, unknown> = {}) => ({
	key: "Monday|1|Aktivität",
	title: "Einzelcoaching",
	description: "Beschreibung",
	entryKind: "Aktivität",
	type: "Einzelcoaching",
	isRequired: true,
	dayOfWeek: "Monday",
	dateValue: "2026-10-26",
	startTime: "10:00:00.000Z",
	endTime: "11:00:00.000Z",
	durationMinutes: 60,
	targetType: "Individual",
	coachName: "Sabine Beispiel",
	location: "Zoom",
	meetingLink: "https://zoom.example.invalid/x",
	order: 1,
	isCustomized: false,
	...overrides,
});

const schedule = (overrides: Record<string, unknown> = {}) => ({
	weekStart: "2026-10-26",
	weekEnd: "2026-11-01",
	effectiveScope: "Course",
	appliedScopes: ["Course"],
	programWeek: { name: "Woche 5", weekNumber: 5 },
	weeks: [{ weekStart: "2026-10-26", programWeekName: "Woche 5", programWeekNumber: 5 }],
	entries: [entry()],
	code: null,
	message: null,
	...overrides,
});

beforeEach(() => {
	fetchMock.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("fetchWeeklySchedule – Erfolgsfall", () => {
	it("fragt den Endpoint read-only ohne weekStart ab", async () => {
		fetchMock.mockResolvedValue(jsonResponse(schedule()));

		await fetchWeeklySchedule();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [path, init] = fetchMock.mock.calls[0];
		expect(path).toBe(ENDPOINT);
		expect(init.method).toBe("GET");
		expect(init.body).toBeUndefined();
	});

	it("haengt weekStart als Query-Parameter an", async () => {
		fetchMock.mockResolvedValue(jsonResponse(schedule()));

		await fetchWeeklySchedule("2026-10-26");

		const [path] = fetchMock.mock.calls[0];
		expect(path).toBe(`${ENDPOINT}?weekStart=2026-10-26`);
	});

	it("liefert den Wochenplan unveraendert durch", async () => {
		const s = schedule();
		fetchMock.mockResolvedValue(jsonResponse(s));

		await expect(fetchWeeklySchedule()).resolves.toEqual(s);
	});

	it("behaelt null bei optionalen Feldern", async () => {
		fetchMock.mockResolvedValue(jsonResponse(schedule({ entries: [entry({ coachName: null, location: null, meetingLink: null, description: null })] })));
		const [row] = (await fetchWeeklySchedule()).entries ?? [];
		expect(row.coachName).toBeNull();
		expect(row.location).toBeNull();
		expect(row.meetingLink).toBeNull();
		expect(row.description).toBeNull();
	});

	it("gibt eine leere Liste zurueck, wenn kein entries-Array geliefert wird", async () => {
		fetchMock.mockResolvedValue(jsonResponse(schedule({ entries: null })));
		const result = await fetchWeeklySchedule();
		expect(result.entries).toBeNull();
	});

	it("enthaelt keine Salesforce-IDs in der Response", async () => {
		fetchMock.mockResolvedValue(jsonResponse(schedule()));
		const result = await fetchWeeklySchedule();
		// Keine Salesforce-Record-IDs im Body: kein Feld mit dem Namen
		// "id" (case-insensitive) auf irgendeiner Ebene.
		function hasIdKey(value: unknown): boolean {
			if (value === null || typeof value !== "object") return false;
			if (Array.isArray(value)) return value.some(hasIdKey);
			return Object.keys(value as Record<string, unknown>).some(
				(k) => k.toLowerCase() === "id" || hasIdKey((value as Record<string, unknown>)[k]),
			);
		}
		expect(hasIdKey(result)).toBe(false);
	});
});

describe("fetchWeeklySchedule – Fehler", () => {
	it("reicht Code und Status durch (400)", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ code: "BAD_WEEK_START", message: "weekStart muss ein Montag sein." }, 400));
		const error = await fetchWeeklySchedule("2026-10-27").catch((e) => e);
		expect(error).toBeInstanceOf(WeeklyScheduleError);
		expect(error.code).toBe("BAD_WEEK_START");
		expect(error.status).toBe(400);
	});

	it("reicht Code und Status durch (401)", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ code: "NO_CONTACT_IDENTITY", message: "x" }, 401));
		const error = await fetchWeeklySchedule().catch((e) => e);
		expect(error.code).toBe("NO_CONTACT_IDENTITY");
		expect(error.status).toBe(401);
	});

	it("reicht Code und Status durch (403)", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ code: "PORTAL_ACCESS_NOT_GRANTED", message: "x" }, 403));
		const error = await fetchWeeklySchedule().catch((e) => e);
		expect(error.code).toBe("PORTAL_ACCESS_NOT_GRANTED");
		expect(error.status).toBe(403);
	});

	it("reicht neutralen 500 durch", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ code: "INTERNAL_ERROR", message: "Schedule data unavailable." }, 500));
		const error = await fetchWeeklySchedule().catch((e) => e);
		expect(error.code).toBe("INTERNAL_ERROR");
		expect(error.status).toBe(500);
	});

	it("faellt auf eigene Meldung zurueck, wenn der Body kein JSON ist", async () => {
		fetchMock.mockResolvedValue(new Response("<html>nope</html>", { status: 500, headers: { "content-type": "text/html" } }));
		const error = await fetchWeeklySchedule().catch((e) => e);
		expect(error).toBeInstanceOf(WeeklyScheduleError);
		expect(error.code).toBeNull();
		expect(error.message).toBe("Wochenplan nicht verfügbar.");
	});

	it("wird zum TypeError bei Netzwerkfehler", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
		await expect(fetchWeeklySchedule()).rejects.toThrow(TypeError);
	});
});
