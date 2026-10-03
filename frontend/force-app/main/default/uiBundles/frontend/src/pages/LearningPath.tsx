/**
 * Lernpfad page: read-only list of the signed-in participant's learning paths.
 *
 * Data comes from `GET /me/learning-path`, which returns only the learning
 * paths released to the caller via Apex Managed Sharing. The page is
 * read-only — no create, update, or delete operations.
 */
import { useEffect, useState } from "react";
import {
	fetchLearningPaths,
	LearningPathError,
	type LearningPathItem,
} from "../features/participant/api/learningPathApi";
import { StatusAlert } from "../components/alerts/status-alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
	Planned: "Geplant",
	"In Progress": "In Bearbeitung",
	Completed: "Abgeschlossen",
};

export default function LearningPathPage() {
	const [items, setItems] = useState<LearningPathItem[] | null>(null);
	const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetchLearningPaths()
			.then((data) => {
				if (!cancelled) setItems(data);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				if (err instanceof LearningPathError) {
					setError({ message: err.message, code: err.code });
				} else {
					setError({ message: "Learning path data unavailable.", code: null });
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
				<title>Lernpfad | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Lernpfad</h1>
				<Card>
					<CardHeader>
						<CardTitle>Deine Lernpfade</CardTitle>
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
				<title>Lernpfad | Organisator</title>
				<h1 className="mb-6 text-2xl font-bold">Lernpfad</h1>
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
			<title>Lernpfad | Organisator</title>
			<h1 className="mb-6 text-2xl font-bold">Lernpfad</h1>

			{items && items.length === 0 ? (
				<StatusAlert variant="info">
					<span className="font-medium">Noch keine Lernpfade hinterlegt</span>
				</StatusAlert>
			) : (
				<div className="space-y-4">
					{items?.map((item) => (
						<Card key={item.learningPathId}>
							<CardHeader>
								<CardTitle className="flex items-center justify-between gap-4">
									<span>{item.title ?? "Unbenannt"}</span>
									{item.status ? (
										<Badge
											variant={item.status === "Completed" ? "default" : "secondary"}
										>
											{STATUS_LABELS[item.status] ?? item.status}
										</Badge>
									) : null}
								</CardTitle>
							</CardHeader>
							<CardContent>
								<dl className="divide-y">
									{item.order != null ? (
										<div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
											<dt className="text-sm text-muted-foreground">Reihenfolge</dt>
											<dd className="text-sm font-medium sm:col-span-2">
												{item.order}
											</dd>
										</div>
									) : null}
									{item.estimatedWeeks != null ? (
										<div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-4">
											<dt className="text-sm text-muted-foreground">
												Geschätzte Dauer
											</dt>
											<dd className="text-sm font-medium sm:col-span-2">
												{item.estimatedWeeks}{" "}
												{item.estimatedWeeks === 1 ? "Woche" : "Wochen"}
											</dd>
										</div>
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
