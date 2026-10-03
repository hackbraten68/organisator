/**
 * Read-only access to the signed-in participant's learning paths.
 *
 * The endpoint is `ParticipantPortalLearningPath.getLearningPath()` in the
 * `frontend` SFDX project. It resolves identity server-side and returns only the
 * learning paths that have been released to the caller via Apex Managed Sharing.
 */
import { createDataSDK } from "@salesforce/platform-sdk";
import { handleApiResponse } from "@/features/authentication/utils/helpers";

/** Mirrors ParticipantPortalLearningPath.LearningPathItemView. */
export interface LearningPathItem {
	learningPathId: string;
	title: string | null;
	status: string | null;
	order: number | null;
	estimatedWeeks: number | null;
}

export type LearningPathErrorCode =
	| "NO_CONTACT_IDENTITY"
	| "NO_PARTICIPANT"
	| "AMBIGUOUS_PARTICIPANT"
	| "INTERNAL_ERROR";

export class LearningPathError extends Error {
	readonly code: string | null;
	readonly status: number;

	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.name = "LearningPathError";
		this.status = status;
		this.code = code;
	}
}

/**
 * Fetches the learning paths belonging to the signed-in user.
 *
 * Throws {@link LearningPathError} with the endpoint's stable code so the UI
 * can tell "not provisioned yet" apart from "something is broken".
 */
export async function fetchLearningPaths(): Promise<LearningPathItem[]> {
	const sdk = await createDataSDK();
	const response = await sdk.fetch!("/services/apexrest/participant-portal/me/learning-path", {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		let code: string | null = null;
		let message = "Learning path data unavailable.";
		try {
			const body = await response.json();
			if (body?.code) code = body.code as string;
			if (body?.message) message = body.message as string;
		} catch {
			// Non-JSON error body: keep the generic message.
		}
		throw new LearningPathError(message, response.status, code);
	}

	const data = await handleApiResponse<{ learningPaths: LearningPathItem[] }>(response);
	return data.learningPaths ?? [];
}
