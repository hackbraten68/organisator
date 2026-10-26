/**
 * Mein Wochenplan: read-only weekly schedule for the signed-in participant.
 *
 * Data comes from `GET /me/weekly-schedule`, which returns only the entries
 * released to the caller. Read-only (ADR-011).
 */
import { useEffect, useState } from "react";
import {
	fetchWeeklySchedule,
	WeeklyScheduleError,
	type PortalWeeklySchedule,
	type PortalScheduleEntry,
} from "../features/participant/api/weeklyScheduleApi";
import { StatusAlert } from "../components/alerts/status-alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const DAY_LABELS: Record<string, string> = {
	Monday: "Montag",
	Tuesday: "Dienstag",
	Wednesday: "Mittwoch",
	Thursday: "Donnerstag",
	Friday: "Freitag",
	Saturday: "Samstag",
	Sunday: "Sonntag",
};

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TYPE_LABELS: Record<string, string> = {
	Einzelcoaching: "Einzelcoaching",
	Gruppencoaching: "Gruppencoaching",
	Feedback: "Feedback",
	"Projekt-Kick-off": "Projekt-Kick-off",
	Workshop: "Workshop",
	Selbstlernphase: "Selbstlernphase",
	Projektarbeit: "Projektarbeit",
	Sonstiges: "Sonstiges",
};

const ENTRY_KIND_LABELS: Record<string, string> = {
	Aktivität: "Aktivität",
	Aufgabe: "Aufgabe",
};

const LOCATION_LABELS: Record<string, string> = {
	Discord: "Discord",
	Zoom: "Zoom",
	Teams: "MS Teams",
	External: "Extern",
};

function formatTime(iso: string | null): string {
	if (iso == null) return "—";
	// The endpoint returns "HH:mm:ss.SSSZ"; keep HH:mm.
	return iso.slice(0, 5);
}

function groupByDay(entries: PortalScheduleEntry[]): Map<string, PortalScheduleEntry[]> {
	const map = new Map<string, PortalScheduleEntry[]>();
	for (const day of DAY_ORDER) map.set(day, []);
	for (const e of entries) {
		const day = e.dayOfWeek ?? "Monday";
		if (!map.has(day)) map.set(day, []);
		map.get(day)!.push(e);
	}
	for (const day of DAY_ORDER) {
		map.get(day)!.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}
	return map;
}

export default function WeeklySchedule() {
	const [data, setData] = useState<PortalWeeklySchedule | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = async (weekStart?: string) => {
		setLoading(true);
		setError(null);
		try {
			const result = await fetchWeeklySchedule(weekStart);
			setData(result);
		} catch (err) {
			if (err instanceof WeeklyScheduleError) {
				setError(err.message);
			} else {
				setError("Wochenplan nicht verfügbar.");
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		let cancelled = false;
		fetchWeeklySchedule()
			.then((result) => {
				if (!cancelled) setData(result);
			})
			.catch((err) => {
				if (cancelled) return;
				if (err instanceof WeeklyScheduleError) {
					setError(err.message);
				} else {
					setError("Wochenplan nicht verfügbar.");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const navigate = (weekStart: string) => load(weekStart);

	const weeks = data?.weeks ?? [];
	const currentIndex = weeks.findIndex((w) => w.weekStart === data?.weekStart);
	const canPrev = currentIndex > 0;
	const canNext = currentIndex >= 0 && currentIndex < weeks.length - 1;

	const entries = data?.entries ?? [];
	const byDay = groupByDay(entries);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<CardTitle>Mein Wochenplan</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{loading && (
						<div className="space-y-2">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-40 w-full" />
						</div>
					)}

					{!loading && error && (
						<StatusAlert variant="error">
							<span className="font-medium">Fehler:</span> {error}
						</StatusAlert>
					)}

					{!loading && !error && data && (
						<>
							<div className="flex items-center justify-between gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!canPrev}
									onClick={() => canPrev && navigate(weeks[currentIndex - 1].weekStart)}
								>
									← Vorherige Woche
								</Button>
								<div className="text-center">
									<div className="font-medium">
										{data.weekStart ?? "—"}
										{data.weekEnd ? ` – ${data.weekEnd}` : ""}
									</div>
									{data.programWeek?.name && (
										<div className="text-sm text-muted-foreground">
											{data.programWeek.name}
											{data.programWeek.weekNumber != null ? ` (Woche ${data.programWeek.weekNumber})` : ""}
										</div>
									)}
									{data.effectiveScope && (
										<Badge variant="secondary" className="mt-1">
											{data.effectiveScope === "Individual"
												? "Individueller Plan"
												: data.effectiveScope === "Group"
													? "Gruppenplan"
													: "Kursplan"}
										</Badge>
									)}
								</div>
								<Button
									variant="outline"
									size="sm"
									disabled={!canNext}
									onClick={() => canNext && navigate(weeks[currentIndex + 1].weekStart)}
								>
									Nächste Woche →
								</Button>
							</div>

							{entries.length === 0 && (
								<p className="text-sm text-muted-foreground">
									Für diese Woche sind keine Einträge vorhanden.
								</p>
							)}

							<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
								{DAY_ORDER.map((day) => {
									const dayEntries = byDay.get(day) ?? [];
									if (dayEntries.length === 0) return null;
									return (
										<Card key={day} className="border">
											<CardHeader className="pb-2">
												<CardTitle className="text-base">{DAY_LABELS[day]}</CardTitle>
											</CardHeader>
											<CardContent className="space-y-2">
												{dayEntries.map((e) => (
													<div
														key={e.key}
														className="rounded-md border p-2 text-sm"
													>
														<div className="flex items-center justify-between gap-2">
															<span className="font-medium">
																{e.title ?? TYPE_LABELS[e.type ?? ""] ?? e.type}
															</span>
															{e.isRequired && (
																<Badge variant="outline" className="text-xs">Pflicht</Badge>
															)}
														</div>
														{e.description && (
															<p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
														)}
														<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
															{e.startTime && e.endTime && (
																<span>{formatTime(e.startTime)} – {formatTime(e.endTime)}</span>
															)}
															{e.coachName && <span>Coach: {e.coachName}</span>}
															{e.location && <span>{LOCATION_LABELS[e.location] ?? e.location}</span>}
															{e.entryKind && <span>{ENTRY_KIND_LABELS[e.entryKind] ?? e.entryKind}</span>}
														</div>
														{e.meetingLink && (
															<a
																href={e.meetingLink}
																target="_blank"
																rel="noopener noreferrer"
																className="mt-1 block text-xs text-blue-600 underline"
															>
																Meeting-Link
															</a>
														)}
													</div>
												))}
											</CardContent>
										</Card>
									);
								})}
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
