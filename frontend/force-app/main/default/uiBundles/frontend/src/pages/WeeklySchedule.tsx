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
	} from "../features/participant/api/weeklyScheduleApi";
import { StatusAlert } from "../components/alerts/status-alert";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import ScheduleGrid from "../components/schedule/ScheduleGrid";
import { normalizeGridConfig } from "../features/schedule-grid/gridConfig";
import type { ScheduleEntry } from "../types/schedule";
import type { EntryCategory, ScheduleScope } from "../types/schedule";

const SCOPE_LABELS: Record<string, string> = {
	Course: "Kurs",
	Group: "Gruppe",
	Individual: "Individuell",
};

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
	const gridConfig = normalizeGridConfig(data?.gridConfig ?? null);
	const gridEntries: ScheduleEntry[] = entries.map((entry, index) => ({
		id: entry.key ?? String(index),
		title: entry.title ?? entry.type ?? "Eintrag",
		description: entry.description,
		entryKind: (entry.entryKind ?? "Aktivität") as ScheduleEntry["entryKind"],
		type: entry.type ?? "",
		isRequired: entry.isRequired ?? false,
		dayOfWeek: entry.dayOfWeek ?? "Monday",
		startTime: entry.startTime,
		endTime: entry.endTime,
		durationMinutes: entry.durationMinutes,
		targetType: (entry.targetType ?? "Course") as ScheduleScope,
		participantGroupId: null,
		participantId: null,
		coachProfileId: null,
		coachName: entry.coachName,
		location: entry.location,
		meetingLink: entry.meetingLink,
		order: entry.order,
		deviationReason: null,
		notes: null,
		isCustomized: entry.isCustomized ?? false,
		timeSlotId: entry.timeSlotId,
		category: (entry.category as EntryCategory) ?? null,
	}));
	const appliedScopes =
		data?.appliedScopes && data.appliedScopes.length > 0
			? data.appliedScopes
			: data?.effectiveScope
				? [data.effectiveScope]
				: [];

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
									{appliedScopes.length > 0 && (
										<div className="mt-1 flex flex-wrap items-center justify-center gap-1">
											<span className="text-xs text-muted-foreground">Angewendet:</span>
											{appliedScopes.map((scope) => (
												<Badge key={scope} variant="secondary" className="text-xs">
													{SCOPE_LABELS[scope] ?? scope}
												</Badge>
											))}
										</div>
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

							{entries.length > 0 && (
								<div className="overflow-x-auto">
									<ScheduleGrid config={gridConfig} entries={gridEntries} showFormatColumn={false} />
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
