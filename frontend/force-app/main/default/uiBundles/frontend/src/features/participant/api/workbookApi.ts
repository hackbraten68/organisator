/**
 * API client for "Mein Lernen" (Workbook).
 *
 * The Apex endpoint is ParticipantPortalWorkbook in the `frontend` SFDX project.
 * Identity is resolved server-side from the portal session; this client never
 * sends a participant id.
 */
import { createDataSDK } from "@salesforce/platform-sdk";

const BASE = "/services/apexrest/participant-portal/me/workbook";

export interface WorkbookDay {
	id: string | null;
	dateValue: string;
	status: string;
	focus: string | null;
	supportStatus: string | null;
	supportNote: string | null;
	selfRating: string | null;
	nextStep: string | null;
	checkInAt: string | null;
	checkInSource: string | null;
	closedAt: string | null;
	lastReopenedAt: string | null;
}

export interface WorkbookTask {
	id: string;
	title: string;
	status: string;
	plannedDate: string;
	originDayId: string | null;
	isFocus: boolean;
	needsSupport: boolean;
	supportNote: string | null;
	sortOrder: number | null;
	source: string;
	completedAt: string | null;
	learningPathEntryId: string | null;
	programWeekId: string | null;
	scheduleEntryId: string | null;
	carriedFromTaskId: string | null;
	createdAt: string | null;
}

export interface WorkbookEvidence {
	id: string;
	type: string;
	title: string | null;
	url: string | null;
	note: string | null;
	feedbackStatus: string;
	coachFeedback: string | null;
	coachFeedbackAt: string | null;
	taskId: string | null;
	learningPathEntryId: string | null;
	programWeekId: string | null;
	createdAt: string | null;
}

export interface WorkbookReview {
	id: string | null;
	weekStartDate: string;
	weekEndDate: string;
	status: string;
	proudOf: string | null;
	clearerNow: string | null;
	nextWeekFocus: string | null;
	supportWish: string | null;
	submittedAt: string | null;
	generatedAt: string | null;
	taskCount: number;
	completedTaskCount: number;
	evidenceCount: number;
	supportRequestCount: number;
	summarySnapshot: string | null;
}

export interface WorkbookToday {
	dateValue: string;
	day: WorkbookDay;
	tasks: WorkbookTask[];
	focusTasks: WorkbookTask[];
	evidence: WorkbookEvidence[];
	checkInAt: string | null;
	checkedIn: boolean;
	focusCount: number;
	openTaskCount: number;
	doneTaskCount: number;
}

export interface WorkbookWeekDay {
	dateValue: string;
	day: WorkbookDay;
	tasks: WorkbookTask[];
	focusTasks: WorkbookTask[];
	evidence: WorkbookEvidence[];
	checkInAt: string | null;
	checkedIn: boolean;
	focusCount: number;
	openTaskCount: number;
	doneTaskCount: number;
}

export interface WorkbookWeek {
	weekStart: string;
	weekEnd: string;
	days: WorkbookWeekDay[];
	totalTasks: number;
	completedTasks: number;
	checkedInDays: number;
	closedDays: number;
	evidenceCount: number;
	review: WorkbookReview | null;
}

export interface CheckInResult {
	day: WorkbookDay;
	checkInAt: string | null;
	alreadyCheckedIn: boolean;
}

export interface DayPatch {
	focus?: string;
	supportStatus?: string;
	supportNote?: string;
	selfRating?: string;
	nextStep?: string;
	status?: string;
	action?: "close" | "reopen";
}

export interface TaskInput {
	title: string;
	plannedDate?: string;
	originDayId?: string;
	isFocus?: boolean;
	needsSupport?: boolean;
	supportNote?: string;
	sortOrder?: number;
	learningPathEntryId?: string;
	programWeekId?: string;
	scheduleEntryId?: string;
}

export interface TaskPatch {
	title?: string;
	status?: string;
	isFocus?: boolean;
	needsSupport?: boolean;
	supportNote?: string;
	sortOrder?: number;
	plannedDate?: string;
	carryOverToDate?: string;
	learningPathEntryId?: string;
	programWeekId?: string;
}

export interface EvidenceInput {
	type: "Link" | "Note";
	title?: string;
	url?: string;
	note?: string;
	taskId?: string;
	learningPathEntryId?: string;
	programWeekId?: string;
	requestFeedback?: boolean;
}

export interface EvidencePatch {
	title?: string;
	url?: string;
	note?: string;
	feedbackStatus?: "None" | "Requested";
}

export interface ReviewPatch {
	proudOf?: string;
	clearerNow?: string;
	nextWeekFocus?: string;
	supportWish?: string;
	status?: "Draft" | "Submitted";
}

export class WorkbookError extends Error {
	readonly code: string | null;
	readonly status: number;

	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.name = "WorkbookError";
		this.status = status;
		this.code = code;
	}
}

async function request<T>(
	path: string,
	init: { method: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown },
): Promise<T> {
	const sdk = await createDataSDK();
	const response = await sdk.fetch!(path, {
		method: init.method,
		headers: {
			Accept: "application/json",
			...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});

	let data: unknown = null;
	try {
		data = await response.json();
	} catch {
		// Some failure responses have no JSON body.
	}

	if (!response.ok) {
		const failure = (data ?? {}) as { code?: string; message?: string };
		throw new WorkbookError(
			failure.message ?? "Mein Lernen ist gerade nicht verfügbar.",
			response.status,
			failure.code ?? null,
		);
	}

	return data as T;
}

export async function fetchToday(): Promise<WorkbookToday> {
	const data = await request<{ today: WorkbookToday }>(`${BASE}/today`, { method: "GET" });
	return data.today;
}

export async function fetchWeek(weekStart: string): Promise<WorkbookWeek> {
	const data = await request<{ week: WorkbookWeek }>(
		`${BASE}/week?weekStart=${encodeURIComponent(weekStart)}`,
		{ method: "GET" },
	);
	return data.week;
}

export async function checkIn(date: string): Promise<CheckInResult> {
	return request<CheckInResult>(`${BASE}/days/${encodeURIComponent(date)}/check-in`, {
		method: "PUT",
	});
}

export async function updateDay(date: string, patch: DayPatch): Promise<WorkbookDay> {
	const data = await request<{ day: WorkbookDay }>(
		`${BASE}/days/${encodeURIComponent(date)}`,
		{ method: "PUT", body: patch },
	);
	return data.day;
}

export async function createTask(input: TaskInput): Promise<WorkbookTask> {
	const data = await request<{ task: WorkbookTask }>(`${BASE}/tasks`, {
		method: "POST",
		body: input,
	});
	return data.task;
}

export async function updateTask(id: string, patch: TaskPatch): Promise<WorkbookTask> {
	const data = await request<{ task: WorkbookTask }>(
		`${BASE}/tasks/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: patch },
	);
	return data.task;
}

export async function createEvidence(input: EvidenceInput): Promise<WorkbookEvidence> {
	const data = await request<{ evidence: WorkbookEvidence }>(`${BASE}/evidence`, {
		method: "POST",
		body: input,
	});
	return data.evidence;
}

export async function updateEvidence(
	id: string,
	patch: EvidencePatch,
): Promise<WorkbookEvidence> {
	const data = await request<{ evidence: WorkbookEvidence }>(
		`${BASE}/evidence/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: patch },
	);
	return data.evidence;
}

export async function fetchReview(weekStart: string): Promise<WorkbookReview> {
	const data = await request<{ review: WorkbookReview }>(
		`${BASE}/reviews?weekStart=${encodeURIComponent(weekStart)}`,
		{ method: "GET" },
	);
	return data.review;
}

export async function updateReview(
	weekStart: string,
	patch: ReviewPatch,
): Promise<WorkbookReview> {
	const data = await request<{ review: WorkbookReview }>(
		`${BASE}/reviews/${encodeURIComponent(weekStart)}`,
		{ method: "PUT", body: patch },
	);
	return data.review;
}
