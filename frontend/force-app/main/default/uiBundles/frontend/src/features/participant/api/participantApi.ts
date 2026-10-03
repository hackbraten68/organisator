/**
 * Read-only access to the signed-in participant's own portal data.
 *
 * The endpoint is `ParticipantPortalData` in the `frontend` SFDX project. It
 * resolves identity server-side as
 * `User.ContactId -> Participant__c WHERE Contact__c = :contactId` and never
 * accepts a participant id from the client, so there is nothing to filter on
 * the client and no id to tamper with.
 *
 * The class runs `with sharing` precisely because `Participant__c` has an
 * external org-wide default of `Private`. `ParticipantPortalSharingService`
 * releases exactly one row per portal user, so the server-side contact filter
 * is not the only thing standing between the caller and every other
 * participant row — it is the second of two independent layers, the first
 * being the share itself. See ADR-012 and
 * backend/docs/portal/portal-access-plan.md.
 */
import { createDataSDK } from "@salesforce/platform-sdk";
import { handleApiResponse } from "@/features/authentication/utils/helpers";

/** Mirrors ParticipantPortalData.ParticipantView. */
export interface Me {
	participantId: string;
	contactId: string;
	participantName: string | null;
	participantStatus: string | null;
	programName: string | null;
	coachName: string | null;
	startDate: string | null;
	expectedEndDate: string | null;
	contactName: string | null;
	contactEmail: string | null;
}

/** Error codes the endpoint can return (PortalIdentityException). */
export type MeErrorCode =
	| "NO_CONTACT_IDENTITY"
	| "NO_PARTICIPANT"
	| "AMBIGUOUS_PARTICIPANT"
	| "INTERNAL_ERROR";

export class MeError extends Error {
	readonly code: string | null;
	readonly status: number;

	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.name = "MeError";
		this.status = status;
		this.code = code;
	}
}

/**
 * Fetches the participant record belonging to the signed-in user.
 *
 * Throws {@link MeError} with the endpoint's stable code so the UI can tell
 * "not provisioned yet" apart from "something is broken" — the endpoint never
 * leaks the raw Apex exception.
 */
export async function fetchMe(): Promise<Me> {
	const sdk = await createDataSDK();
	const response = await sdk.fetch!("/services/apexrest/participant-portal/me", {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		let code: string | null = null;
		let message = "Portal data unavailable.";
		try {
			const body = await response.json();
			if (body?.code) code = body.code as string;
			if (body?.message) message = body.message as string;
		} catch {
			// Non-JSON error body: keep the generic message. The endpoint is
			// documented to never return the raw exception, so there is nothing
			// better to show and nothing technical worth leaking into the UI.
		}
		throw new MeError(message, response.status, code);
	}

	return handleApiResponse<Me>(response);
}