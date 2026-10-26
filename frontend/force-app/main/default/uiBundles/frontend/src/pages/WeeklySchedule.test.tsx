import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WeeklySchedule from "./WeeklySchedule";

const fetchMock = vi.fn();

vi.mock("../features/participant/api/weeklyScheduleApi", () => ({
	fetchWeeklySchedule: (...args: unknown[]) => fetchMock(...args),
	WeeklyScheduleError: class WeeklyScheduleError extends Error {
		code: string | null;
		status: number;
		constructor(message: string, status: number, code: string | null) {
			super(message);
			this.name = "WeeklyScheduleError";
			this.status = status;
			this.code = code;
		}
	},
}));

const schedule = (overrides: Record<string, unknown> = {}) => ({
	weekStart: "2026-10-26",
	weekEnd: "2026-11-01",
	effectiveScope: "Course",
	appliedScopes: ["Course"],
	programWeek: { name: "Woche 5", weekNumber: 5 },
	weeks: [{ weekStart: "2026-10-26", programWeekName: "Woche 5", programWeekNumber: 5 }],
	entries: [
		{
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
		},
	],
	code: null,
	message: null,
	...overrides,
});

beforeEach(() => {
	fetchMock.mockReset();
});

describe("WeeklySchedule page", () => {
	it("zeigt Ladezustand initial", () => {
		fetchMock.mockReturnValue(new Promise(() => {}));
		render(<WeeklySchedule />);
		// Skeleton vorhanden
		expect(document.querySelector(".animate-pulse") ?? document.querySelector("[class*='skeleton']")).toBeTruthy();
	});

	it("zeigt Eintraege nach erfolgreichem Laden", async () => {
		fetchMock.mockResolvedValue(schedule());
		render(<WeeklySchedule />);
		await waitFor(() => expect(screen.getByText("Einzelcoaching")).toBeInTheDocument());
		expect(screen.getByText(/Sabine Beispiel/)).toBeInTheDocument();
		expect(screen.getByText("Mein Wochenplan")).toBeInTheDocument();
	});

	it("zeigt leere Woche", async () => {
		fetchMock.mockResolvedValue(schedule({ entries: [] }));
		render(<WeeklySchedule />);
		await waitFor(() => expect(screen.getByText(/Für diese Woche sind keine Einträge vorhanden/)).toBeInTheDocument());
	});

	it("zeigt Fehlermeldung bei 500", async () => {
		const { WeeklyScheduleError } = await import("../features/participant/api/weeklyScheduleApi");
		fetchMock.mockRejectedValue(new WeeklyScheduleError("Schedule data unavailable.", 500, "INTERNAL_ERROR"));
		render(<WeeklySchedule />);
		await waitFor(() => expect(screen.getByText("Schedule data unavailable.")).toBeInTheDocument());
	});
});
