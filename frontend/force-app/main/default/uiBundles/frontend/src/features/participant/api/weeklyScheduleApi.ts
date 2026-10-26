/**
 * Read-only access to the signed-in participant's weekly schedule.
 *
 * The endpoint is `ParticipantPortalWeeklySchedule.getWeeklySchedule()` in the
 * `frontend` SFDX project. It resolves identity server-side and returns only
 * the entries released to the caller. Read-only (ADR-011): no create, update,
 * or delete.
 */
import { createDataSDK } from "@salesforce/platform-sdk";
import { handleApiResponse } from "@/features/authentication/utils/helpers";

/** Mirrors ParticipantPortalWeeklySchedule.ProgramWeekView. */
export interface PortalProgramWeek {
	name: string | null;
	weekNumber: number | null;
}

/** Mirrors ParticipantPortalWeeklySchedule.WeekOption. */
export interface PortalWeekOption {
	weekStart: string;
	programWeekName: string | null;
	programWeekNumber: number | null;
}

/** Mirrors ParticipantPortalWeeklySchedule.EntryView. */
export interface PortalScheduleEntry {
	key: string;
	title: string | null;
	description: string | null;
	entryKind: string | null;
	type: string | null;
	isRequired: boolean | null;
	dayOfWeek: string | null;
	dateValue: string | null;
	startTime: string | null;
	endTime: string | null;
	durationMinutes: number | null;
	targetType: string | null;
	coachName: string | null;
	location: string | null;
	meetingLink: string | null;
	order: number | null;
	isCustomized: boolean | null;
}

/** Mirrors ParticipantPortalWeeklySchedule.WeeklyScheduleResponse. */
export interface PortalWeeklySchedule {
	weekStart: string | null;
	weekEnd: string | null;
	effectiveScope: string | null;
	appliedScopes: string[] | null;
	programWeek: PortalProgramWeek | null;
	weeks: PortalWeekOption[] | null;
	entries: PortalScheduleEntry[] | null;
	code: string | null;
	message: string | null;
}

export type WeeklyScheduleErrorCode =
	| "NO_CONTACT_IDENTITY"
	| "NO_PARTICIPANT"
	| "AMBIGUOUS_PARTICIPANT"
	| "BAD_WEEK_START"
	| "INTERNAL_ERROR";

export class WeeklyScheduleError extends Error {
	readonly code: string | null;
	readonly status: number;

	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.name = "WeeklyScheduleError";
		this.status = status;
		this.code = code;
	}
}

/**
 * Fetches the weekly schedule for the signed-in participant.
 *
 * @param weekStart ISO date (Monday). Omit to use the current week.
 */
export async function fetchWeeklySchedule(weekStart?: string): Promise<PortalWeeklySchedule> {
	const sdk = await createDataSDK();
	const path = weekStart
		? `/services/apexrest/participant-portal/me/weekly-schedule?weekStart=${encodeURIComponent(weekStart)}`
		: "/services/apexrest/participant-portal/me/weekly-schedule";
	const response = await sdk.fetch!(path, {
		method: "GET",
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		let code: string | null = null;
		let message = "Wochenplan nicht verfügbar.";
		try {
			const body = await response.json();
			if (body?.code) code = body.code as string;
			if (body?.message) message = body.message as string;
		} catch {
			// Non-JSON error body: keep the generic message.
		}
		throw new WeeklyScheduleError(message, response.status, code);
	}

	const data = await handleApiResponse<PortalWeeklySchedule>(response);
	return data;
}
