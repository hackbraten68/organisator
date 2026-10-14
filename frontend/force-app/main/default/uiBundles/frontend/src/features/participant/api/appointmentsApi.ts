/**
 * Read-only access to the signed-in participant's appointments.
 *
 * The endpoint is `ParticipantPortalAppointments.getAppointments()` in the
 * `frontend` SFDX project. It resolves identity server-side and returns only the
 * appointments that have been released to the caller via Apex Managed Sharing.
 *
 * Read-only, like `/me` (ADR-011). Booking is not implemented and a participant
 * has no write access to `Appointment__c` at all.
 */
import { createDataSDK } from "@salesforce/platform-sdk";
import { handleApiResponse } from "@/features/authentication/utils/helpers";

/** Mirrors ParticipantPortalAppointments.AppointmentItemView. */
export interface PortalAppointment {
	appointmentId: string;
	startTime: string | null;
	endTime: string | null;
	status: string | null;
	type: string | null;
	location: string | null;
	meetingLink: string | null;
	cancellationReason: string | null;
	/**
	 * `null` in two cases, and the UI has to tell them apart from "there is a
	 * coach":
	 *
	 *   - `Coach__c` was never set — nobody assigned yet.
	 *   - `Coach__c` is set but no `Coach_Profile__c` points back at that User, so
	 *     there is no name to show. That is a data gap on the coach side, not a
	 *     portal failure, and it is reported as such rather than papered over.
	 *
	 * The endpoint resolves the name through `Coach_Profile__c.User__c` instead of
	 * reading `User.Name`, because a portal member has no rights on `User`.
	 */
	coachName: string | null;
}

export type AppointmentErrorCode =
	| "NO_CONTACT_IDENTITY"
	| "NO_PARTICIPANT"
	| "AMBIGUOUS_PARTICIPANT"
	| "INTERNAL_ERROR";

export class AppointmentError extends Error {
	readonly code: string | null;
	readonly status: number;

	constructor(message: string, status: number, code: string | null) {
		super(message);
		this.name = "AppointmentError";
		this.status = status;
		this.code = code;
	}
}

/**
 * Fetches the appointments belonging to the signed-in user, most recent first.
 *
 * Throws {@link AppointmentError} with the endpoint's stable code so the UI can
 * tell "not provisioned yet" apart from "something is broken".
 */
export async function fetchAppointments(): Promise<PortalAppointment[]> {
	const sdk = await createDataSDK();
	const response = await sdk.fetch!("/services/apexrest/participant-portal/me/appointments", {
		method: "GET",
		headers: {
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		let code: string | null = null;
		let message = "Termindaten nicht verfügbar.";
		try {
			const body = await response.json();
			if (body?.code) code = body.code as string;
			if (body?.message) message = body.message as string;
		} catch {
			// Non-JSON error body: keep the generic message.
		}
		throw new AppointmentError(message, response.status, code);
	}

	const data = await handleApiResponse<{ appointments: PortalAppointment[] }>(response);
	return data.appointments ?? [];
}
