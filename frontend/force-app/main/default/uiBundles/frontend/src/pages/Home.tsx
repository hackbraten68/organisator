/**
 * Portal start page: the signed-in participant's own account overview.
 *
 * This is the first page that shows participant data, and it is deliberately
 * thin — one record, read-only, resolved server-side from the session
 * (see `fetchMe`). It exists to prove the whole vertical cut in one screen:
 * `User -> Contact -> Participant__c -> Apex -> React`.
 */
import { useEffect, useState } from "react";
import { fetchMe, MeError, type Me } from "../features/participant/api/participantApi";
import { StatusAlert } from "../components/alerts/status-alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";

/**
 * Localises the picklist values from Participant__c.Status__c for display.
 * Unknown values pass through unchanged so a new picklist entry is still
 * readable instead of rendering as a blank.
 */
const STATUS_LABELS: Record<string, string> = {
	Active: "Aktiv",
	Onboarding: "Im Onboarding",
	Paused: "Pausiert",
	Completed: "Abgeschlossen",
};

function formatDate(value: string | null): string | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(parsed);
}

/** Rows with a label and a value; entries without a value are dropped. */
function DetailRow({ label, value }: { label: string; value: string | null }) {
	if (!value) return null;
	return (
		<div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium sm:col-span-2">{value}</dd>
		</div>
	);
}

export default function HomePage() {
	const [me, setMe] = useState<Me | null>(null);
	const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetchMe()
			.then((data) => {
				if (!cancelled) setMe(data);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof MeError) {
					setError({ message: err.message, code: err.code });
				} else {
					setError({ message: "Portal data unavailable.", code: null });
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
				<title>Mein Konto | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Mein Konto</h1>
				<Card>
					<CardHeader>
						<CardTitle>Deine Daten</CardTitle>
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

	// Two distinct failure modes, and they need different wording. "Not
	// provisioned" is a normal state a staff member can fix; "something broke"
	// is not. Collapsing them into one message would leave a participant
	// waiting for data that is never coming.
	if (error) {
		const notProvisioned = error.code === "NO_PARTICIPANT" || error.code === "NO_CONTACT_IDENTITY";
		return (
			<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
				<title>Mein Konto | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Mein Konto</h1>
				<StatusAlert variant="error">
					<span className="font-medium">
						{notProvisioned ? "Noch kein Portalzugang" : "Daten konnten nicht geladen werden"}
					</span>{" "}
					{notProvisioned
						? "Dein Zugang ist eingerichtet, aber es ist noch kein Teilnehmerprofil hinterlegt. Melde dich bei deiner Kursleitung."
						: "Bitte versuche es später noch einmal. Wenn das so bleibt, wende dich an deine Kursleitung."}
				</StatusAlert>
			</main>
		);
	}

	const status = me?.participantStatus ?? null;

	return (
		<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<title>Mein Konto | Organisator</title>
			<h1 className="mb-6 text-2xl font-bold">
				{me?.participantName ?? me?.contactName ?? "Mein Konto"}
			</h1>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-4">
						<span>Deine Daten</span>
						{status ? (
							<Badge variant={status === "Active" ? "default" : "secondary"}>
								{STATUS_LABELS[status] ?? status}
							</Badge>
						) : null}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="divide-y">
						<DetailRow label="Programm" value={me?.programName ?? null} />
						<DetailRow label="Coach" value={me?.coachName ?? null} />
						<DetailRow label="Start" value={formatDate(me?.startDate ?? null)} />
						<DetailRow label="Voraussichtliches Ende" value={formatDate(me?.expectedEndDate ?? null)} />
						<DetailRow label="E-Mail" value={me?.contactEmail ?? null} />
					</dl>
				</CardContent>
			</Card>
		</main>
	);
}