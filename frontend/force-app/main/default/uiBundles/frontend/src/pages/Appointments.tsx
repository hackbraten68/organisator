/**
 * Meine Termine: read-only list of the signed-in participant's appointments.
 *
 * Data comes from `GET /me/appointments`, which returns only the appointments
 * released to the caller via Apex Managed Sharing. The page is read-only — no
 * create, update, or delete operations, and the portal permission set grants no
 * write access to `Appointment__c` at all.
 *
 * Cancelled appointments stay in the list. A participant needs to see that a
 * session was cancelled and why; making it disappear reads as "nothing happened".
 */
import { useEffect, useState } from "react";
import {
	fetchAppointments,
	AppointmentError,
	type PortalAppointment,
} from "../features/participant/api/appointmentsApi";
import { StatusAlert } from "../components/alerts/status-alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
	Draft: "Entwurf",
	Finding: "Termin wird gesucht",
	Confirmed: "Bestätigt",
	Completed: "Durchgeführt",
	Documented: "Dokumentiert",
	Cancelled: "Abgesagt",
	NoShow: "Nicht erschienen",
};

const TYPE_LABELS: Record<string, string> = {
	Coaching: "Coaching",
	CheckIn: "Check-in",
	Feedback: "Feedback",
	Behörde: "Behörde",
	Praktikum: "Praktikum",
	Sonstiges: "Sonstiges",
};

const LOCATION_LABELS: Record<string, string> = {
	Discord: "Discord",
	Zoom: "Zoom",
	Teams: "MS Teams",
	External: "Extern",
};

/** Statuses that describe something that already happened. */
const PAST_STATUSES = new Set(["Completed", "Documented", "NoShow"]);

function isPast(appointment: PortalAppointment): boolean {
	if (appointment.startTime == null) return false;
	if (appointment.status != null && PAST_STATUSES.has(appointment.status)) return true;
	return new Date(appointment.startTime).getTime() < Date.now();
}

function formatDateTime(iso: string | null): string {
	if (iso == null) return "—";
	return new Intl.DateTimeFormat("de-DE", {
		dateStyle: "long",
		timeStyle: "short",
	}).format(new Date(iso));
}

/**
 * The coach line.
 *
 * A null `coachName` is not rendered as "Coach": that would pass for a real name
 * and hide the gap it stands for. Two different situations end up here — nobody
 * assigned yet, and a coach without a `Coach_Profile__c` — and the second is a
 * data problem on the coaching side worth surfacing.
 */
function coachLabel(coachName: string | null): string {
	return coachName ?? "Coach nicht verfügbar";
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium sm:col-span-2">{children}</dd>
		</div>
	);
}

export default function AppointmentsPage() {
	const [items, setItems] = useState<PortalAppointment[] | null>(null);
	const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetchAppointments()
			.then((data) => {
				if (!cancelled) setItems(data);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof AppointmentError) {
					setError({ message: err.message, code: err.code });
				} else {
					setError({ message: "Termindaten nicht verfügbar.", code: null });
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	if (loading) {
		return (
			<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
				<title>Meine Termine | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Meine Termine</h1>
				<Card>
					<CardHeader>
						<CardTitle>Deine Termine</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-5 w-64" />
						<Skeleton className="h-5 w-40" />
					</CardContent>
				</Card>
			</main>
		);
	}

	if (error) {
		const notProvisioned = error.code === "NO_PARTICIPANT" || error.code === "NO_CONTACT_IDENTITY";
		return (
			<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
				<title>Meine Termine | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Meine Termine</h1>
				<StatusAlert variant="error">
					<span className="font-medium">
						{notProvisioned ? "Noch kein Portalzugang" : "Daten konnten nicht geladen werden"}
					</span>{" "}
					{notProvisioned
						? "Dein Zugang ist eingerichtet, aber es ist noch kein Teilnehmerprofil hinterlegt. Melde dich bei deiner Kursleitung."
						: "Bitte versuche es später noch einmal. Wenn das so bleibt, wende dich an deiner Kursleitung."}
				</StatusAlert>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<title>Meine Termine | Organisator</title>
			<h1 className="mb-6 text-2xl font-bold">Meine Termine</h1>

			{items && items.length === 0 ? (
				<StatusAlert variant="info">
					<span className="font-medium">Noch keine Termine hinterlegt</span>{" "}
					Sobald deine Kursleitung einen Termin anlegt, findest du ihn hier.
				</StatusAlert>
			) : (
				<div className="space-y-4">
					{items?.map((appointment) => (
						<Card key={appointment.appointmentId}>
							<CardHeader>
								<CardTitle className="flex items-center justify-between gap-4">
									<span>{formatDateTime(appointment.startTime)}</span>
									{appointment.status ? (
										<Badge variant={appointment.status === "Cancelled" ? "destructive" : isPast(appointment) ? "secondary" : "default"}>
											{STATUS_LABELS[appointment.status] ?? appointment.status}
										</Badge>
									) : null}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<dl className="divide-y">
									<DetailRow label="Coach">{coachLabel(appointment.coachName)}</DetailRow>
									{appointment.type ? (
										<DetailRow label="Art">
											{TYPE_LABELS[appointment.type] ?? appointment.type}
										</DetailRow>
									) : null}
									{appointment.location ? (
										<DetailRow label="Ort">
											{LOCATION_LABELS[appointment.location] ?? appointment.location}
										</DetailRow>
									) : null}
									{appointment.startTime != null && appointment.endTime != null ? (
										<DetailRow label="Bis">{formatDateTime(appointment.endTime)}</DetailRow>
									) : null}
									{appointment.meetingLink ? (
										<DetailRow label="Link">
											<a
												href={appointment.meetingLink}
												target="_blank"
												rel="noreferrer"
												className="underline underline-offset-4"
											>
												Meeting öffnen
											</a>
										</DetailRow>
									) : null}
									{appointment.cancellationReason ? (
										<DetailRow label="Absagegrund">
											{appointment.cancellationReason}
										</DetailRow>
									) : null}
								</dl>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</main>
	);
}
