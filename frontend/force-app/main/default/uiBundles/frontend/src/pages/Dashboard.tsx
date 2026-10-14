import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, MapPin, Video } from "lucide-react";
import { DashboardPlaceholder } from "../components/dashboard/dashboard-placeholder";
import { useParticipant } from "../features/participant/context/ParticipantContext";
import {
	fetchAppointments,
	AppointmentError,
	type PortalAppointment,
} from "../features/participant/api/appointmentsApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";

/**
 * The portal's start page.
 *
 * Still partly a wireframe: "Abwesenheiten" and "Dein Lernpfad" remain
 * placeholders, because neither has an endpoint yet. "Nächster Termin" is real —
 * it reads the same `/me/appointments` data as the appointments page, so no extra
 * object permission is spent on a second query.
 *
 * The greeting uses the participant record rather than the auth session because
 * `/me` resolves `User.ContactId -> Contact -> Participant__c`. The live spec
 * asserts the participant's name is on screen after login, and the session
 * identity is not guaranteed to be it.
 */

const TYPE_LABELS: Record<string, string> = {
	Coaching: "Coaching",
	CheckIn: "Check-in",
	Feedback: "Feedback",
	Behörde: "Behörde",
	Praktikum: "Praktikum",
	Sonstiges: "Sonstiges",
};

/** Statuses that mean the appointment is over, whatever the clock says. */
const SETTLED_STATUSES = new Set(["Completed", "Documented", "NoShow", "Cancelled"]);

/**
 * The next appointment worth showing.
 *
 * Anything still cancellable counts — a scheduled session that was cancelled
 * later is not "next". Among the rest, the earliest upcoming one wins.
 */
function nextAppointment(appointments: PortalAppointment[]): PortalAppointment | null {
	const upcoming = appointments.filter((appointment) => {
		if (appointment.startTime == null) return false;
		if (appointment.status != null && SETTLED_STATUSES.has(appointment.status)) return false;
		return new Date(appointment.startTime).getTime() >= Date.now();
	});
	if (upcoming.length === 0) return null;
	upcoming.sort(
		(a, b) => new Date(a.startTime as string).getTime() - new Date(b.startTime as string).getTime(),
	);
	return upcoming[0] ?? null;
}

function formatDateTime(iso: string | null): string {
	if (iso == null) return "—";
	return new Intl.DateTimeFormat("de-DE", {
		dateStyle: "long",
		timeStyle: "short",
	}).format(new Date(iso));
}

export default function Dashboard() {
	const { me } = useParticipant();
	const [next, setNext] = useState<PortalAppointment | null | undefined>(undefined);

	// `undefined` is load-in-progress, `null` is loaded-and-nothing-upcoming.
	// Collapsing the two would flash "kein Termin" on every page view.
	useEffect(() => {
		let cancelled = false;

		fetchAppointments()
			.then((appointments) => {
				if (!cancelled) setNext(nextAppointment(appointments));
			})
			.catch((err: unknown) => {
				// The dashboard must not break because the appointments block does.
				// A guest gets 403/401 here and simply keeps the placeholder.
				if (cancelled) return;
				if (err instanceof AppointmentError) {
					setNext(null);
				} else {
					setNext(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const displayName = me?.participantName ?? me?.contactName ?? null;

	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="mb-8">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">
					{displayName ? `Guten Tag, ${displayName}` : "Guten Tag"}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Hier findest du dein Programm, deine Termine und deinen Lernpfad.
				</p>
			</header>

			<div className="grid gap-6">
				<DashboardPlaceholder
					title="Dein Programm"
					description="Programmname, Betreuer:in und Zeitraum deiner Teilnahme."
					rows={3}
				/>

				<div className="grid gap-6 md:grid-cols-2">
					{next === undefined ? (
						<Card>
							<CardHeader>
								<CardTitle>Nächster Termin</CardTitle>
								<CardDescription>Terminart, Datum und Uhrzeit deines nächsten Coachings.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<Skeleton className="h-5 w-48" />
								<Skeleton className="h-5 w-64" />
							</CardContent>
						</Card>
					) : next === null ? (
						<DashboardPlaceholder
							title="Nächster Termin"
							description="Terminart, Datum und Uhrzeit deines nächsten Coachings."
							rows={2}
						/>
					) : (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CalendarDays className="size-4 text-muted-foreground" />
									Nächster Termin
								</CardTitle>
								<CardDescription>
									{next.type ? TYPE_LABELS[next.type] ?? next.type : "Termin"}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<p className="text-sm font-medium">{formatDateTime(next.startTime)}</p>
								<dl className="space-y-1 text-sm">
									<div className="flex items-center gap-2">
										{next.meetingLink ? (
											<Video className="size-3.5 text-muted-foreground" aria-hidden />
										) : (
											<MapPin className="size-3.5 text-muted-foreground" aria-hidden />
										)}
										<dd className="text-muted-foreground">
											{next.coachName ?? "Coach nicht verfügbar"}
										</dd>
									</div>
									{next.meetingLink ? (
										<dd>
											<Badge variant="outline">Link vorhanden</Badge>
										</dd>
									) : null}
								</dl>
								<Link
									to="/termine"
									className="inline-block text-sm underline underline-offset-4"
								>
									Alle Termine
								</Link>
							</CardContent>
						</Card>
					)}

					<DashboardPlaceholder
						title="Abwesenheiten"
						description="Deine gemeldeten Abwesenheiten und deren Status."
						rows={2}
					/>
					<DashboardPlaceholder
						title="Dein Lernpfad"
						description="Aktuelle Lernpfade und deine Fortschritte darin."
						rows={2}
					/>
				</div>
			</div>
		</div>
	);
}
