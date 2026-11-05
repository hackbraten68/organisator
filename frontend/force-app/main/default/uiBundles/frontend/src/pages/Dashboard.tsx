/**
 * "Heute" — the participant-facing start page for Mein Lernen.
 *
 * The loop is intentionally small: document presence, pick up to three focus
 * tasks, ask for support, leave a link or note as evidence, and optionally close
 * the day. The weekly plan is read from the existing /me/weekly-schedule
 * endpoint so the Soll layer stays where it belongs.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
	ArrowRight,
	CalendarDays,
	CheckCircle2,
	Circle,
	Clock3,
	ExternalLink,
	LifeBuoy,
	Plus,
	Target,
} from "lucide-react";
import { StatusAlert } from "../components/alerts/status-alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { useParticipant } from "../features/participant/context/ParticipantContext";
import { cn } from "../lib/utils";
import { CATEGORY_STYLES } from "../features/weekly-plan-template/categoryStyles";
import type { EntryCategory } from "../features/weekly-plan-template/types";
import {
	checkIn,
	createEvidence,
	createTask,
	fetchToday,
	updateDay,
	updateTask,
	WorkbookError,
	type WorkbookEvidence,
	type WorkbookTask,
	type WorkbookToday,
} from "../features/participant/api/workbookApi";
import {
	fetchWeeklySchedule,
	type PortalScheduleEntry,
} from "../features/participant/api/weeklyScheduleApi";

const TASK_STATUS_LABELS: Record<string, string> = {
	Open: "Offen",
	InProgress: "In Arbeit",
	Done: "Erledigt",
	Dropped: "Verworfen",
};

const SUPPORT_LABELS: Record<string, string> = {
	None: "Kein Bedarf",
	Question: "Frage",
	Blocked: "Blockiert",
	Coaching: "Coaching",
};

const RATING_LABELS: Record<string, string> = {
	Unclear: "Noch unklar",
	WithHelp: "Mit Hilfe",
	Independent: "Selbstständig",
	Explain: "Kann es erklären",
};

function addDays(isoDate: string, days: number): string {
	const date = new Date(`${isoDate}T12:00:00`);
	date.setDate(date.getDate() + days);
	return date.toISOString().slice(0, 10);
}

function formatDateHeading(isoDate: string): string {
	return new Intl.DateTimeFormat("de-DE", {
		weekday: "long",
		day: "2-digit",
		month: "long",
	}).format(new Date(`${isoDate}T12:00:00`));
}

function formatTime(iso: string | null): string {
	if (iso == null) return "—";
	return new Intl.DateTimeFormat("de-DE", { timeStyle: "short" }).format(new Date(iso));
}

function weekdayName(isoDate: string): string {
	return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
		new Date(`${isoDate}T12:00:00`),
	);
}

function errorText(error: unknown): string {
	if (error instanceof WorkbookError) return error.message;
	if (error instanceof Error) return error.message;
	return "Mein Lernen ist gerade nicht verfügbar.";
}

export default function Dashboard() {
	const { me } = useParticipant();
	const [today, setToday] = useState<WorkbookToday | null>(null);
	const [scheduleEntries, setScheduleEntries] = useState<PortalScheduleEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [newTaskTitle, setNewTaskTitle] = useState("");
	const [newTaskFocus, setNewTaskFocus] = useState(false);
	const [supportStatus, setSupportStatus] = useState("None");
	const [supportNote, setSupportNote] = useState("");
	const [focus, setFocus] = useState("");
	const [selfRating, setSelfRating] = useState("unset");
	const [nextStep, setNextStep] = useState("");

	const [evidenceType, setEvidenceType] = useState<"Note" | "Link">("Note");
	const [evidenceTitle, setEvidenceTitle] = useState("");
	const [evidenceUrl, setEvidenceUrl] = useState("");
	const [evidenceNote, setEvidenceNote] = useState("");
	const [evidenceTaskId, setEvidenceTaskId] = useState("none");
	const [requestFeedback, setRequestFeedback] = useState(false);

	const initialized = useRef(false);

	async function loadToday(showSpinner = false) {
		if (showSpinner) setLoading(true);
		try {
			const data = await fetchToday();
			setToday(data);
			setError(null);
			if (!initialized.current) {
				initialized.current = true;
				setSupportStatus(data.day.supportStatus ?? "None");
				setSupportNote(data.day.supportNote ?? "");
				setFocus(data.day.focus ?? "");
				setSelfRating(data.day.selfRating ?? "unset");
				setNextStep(data.day.nextStep ?? "");
			}
		} catch (err: unknown) {
			setError(errorText(err));
		} finally {
			if (showSpinner) setLoading(false);
		}
	}

	useEffect(() => {
		let cancelled = false;
		loadToday(true);
		fetchWeeklySchedule()
			.then((schedule) => {
				if (!cancelled) setScheduleEntries(schedule.entries ?? []);
			})
			.catch(() => {
				if (!cancelled) setScheduleEntries([]);
			});
		return () => {
			cancelled = true;
		};
		// loadToday is stable enough for this mount-only load.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function run(
		key: string,
		action: () => Promise<unknown>,
		successMessage?: string,
	) {
		setBusy(key);
		setError(null);
		setNotice(null);
		try {
			await action();
			await loadToday();
			if (successMessage) setNotice(successMessage);
		} catch (err: unknown) {
			setError(errorText(err));
		} finally {
			setBusy(null);
		}
	}

	async function onCheckIn() {
		if (!today) return;
		await run("checkin", () => checkIn(today.dateValue));
	}

	async function onAddTask(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!today || newTaskTitle.trim().length === 0) return;
		await run(
			"add-task",
			() =>
				createTask({
					title: newTaskTitle.trim(),
					plannedDate: today.dateValue,
					isFocus: newTaskFocus,
				}),
			"Aufgabe hinzugefügt.",
		);
		setNewTaskTitle("");
		setNewTaskFocus(false);
	}

	async function onCompleteTask(task: WorkbookTask) {
		await run(`task-${task.id}`, () =>
			updateTask(task.id, { status: task.status === "Done" ? "Open" : "Done" }),
		);
	}

	async function onToggleFocus(task: WorkbookTask) {
		await run(`task-${task.id}`, () => updateTask(task.id, { isFocus: !task.isFocus }));
	}

	async function onToggleSupport(task: WorkbookTask) {
		await run(`task-${task.id}`, () =>
			updateTask(task.id, { needsSupport: !task.needsSupport }),
		);
	}

	async function onCarryOver(task: WorkbookTask) {
		if (!today) return;
		await run(
			`task-${task.id}`,
			() => updateTask(task.id, { carryOverToDate: addDays(today.dateValue, 1) }),
			"Auf morgen verschoben.",
		);
	}

	async function onSaveSupport(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!today) return;
		await run(
			"support",
			() =>
				updateDay(today.dateValue, {
					supportStatus,
					supportNote,
				}),
			"Unterstützung gespeichert.",
		);
	}

	async function onAddEvidence(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!today) return;
		await run(
			"evidence",
			() =>
				createEvidence({
					type: evidenceType,
					title: evidenceTitle.trim() || undefined,
					url: evidenceType === "Link" ? evidenceUrl.trim() : undefined,
					note: evidenceType === "Note" ? evidenceNote.trim() : undefined,
					taskId: evidenceTaskId === "none" ? undefined : evidenceTaskId,
					requestFeedback,
				}),
			"Nachweis gespeichert.",
		);
		setEvidenceTitle("");
		setEvidenceUrl("");
		setEvidenceNote("");
		setEvidenceTaskId("none");
		setRequestFeedback(false);
	}

	async function onCloseDay(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!today) return;
		await run(
			"close",
			() =>
				updateDay(today.dateValue, {
					action: "close",
					focus,
					selfRating: selfRating === "unset" ? "" : selfRating,
					nextStep,
				}),
			"Tag abgeschlossen.",
		);
	}

	async function onReopenDay() {
		if (!today) return;
		await run("reopen", () => updateDay(today.dateValue, { action: "reopen" }), "Tag wieder geöffnet.");
	}

	const displayName = me?.participantName ?? me?.contactName ?? null;
	const todaySchedule = today
		? scheduleEntries
				.filter(
					(entry) =>
						entry.dateValue === today.dateValue ||
						entry.dayOfWeek === weekdayName(today.dateValue),
				)
				.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
		: [];
	const isClosed = today?.day.status === "Closed";

	if (loading) {
		return (
			<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<Skeleton className="mb-2 h-8 w-72" />
				<Skeleton className="mb-8 h-4 w-96" />
				<div className="grid gap-6 lg:grid-cols-2 items-start">
					<Skeleton className="h-56 w-full" />
					<Skeleton className="h-56 w-full" />
					<Skeleton className="h-56 w-full" />
					<Skeleton className="h-56 w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<header className="mb-8 flex flex-wrap items-start justify-between gap-4">
				<div>
					<p className="text-sm font-medium text-muted-foreground">
						Mein Lernen · {today ? formatDateHeading(today.dateValue) : "Heute"}
					</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
						{displayName ? `Guten Tag, ${displayName}` : "Guten Tag"}
					</h1>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Dein nächster Schritt zählt. Plane höchstens drei Fokustasks, hol dir
						Hilfe, wenn du sie brauchst, und halte fest, was du gelernt hast.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link to="/wochenplan">
						Wochenplan ansehen <ArrowRight className="size-4" />
					</Link>
				</Button>
			</header>

			{error ? (
				<div className="mb-6">
					<StatusAlert>{error}</StatusAlert>
				</div>
			) : null}
			{notice ? (
				<div className="mb-6">
					<StatusAlert variant="success">{notice}</StatusAlert>
				</div>
			) : null}

			<div className="space-y-6">
				<div className="grid gap-6 lg:grid-cols-2">
					{/* Check-in */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Clock3 className="size-4 text-muted-foreground" />
								Anwesenheit heute
							</CardTitle>
							<CardDescription>
								Der Check-in dokumentiert, dass du heute da bist. Er ersetzt
								keine bestätigte Anwesenheit im Klassenbuch.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{today?.checkedIn ? (
								<div className="rounded-lg border bg-muted/30 p-4">
									<div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
										<CheckCircle2 className="size-4" />
										Eingecheckt um {formatTime(today.checkInAt)}
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										Quelle: {today.day.checkInSource ?? "Portal"}
									</p>
								</div>
							) : (
								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">
										Noch kein Check-in für heute. Ein Klick genügt.
									</p>
									<Button
										onClick={onCheckIn}
										disabled={busy !== null}
										className="gap-2"
									>
										<CheckCircle2 className="size-4" />
										{busy === "checkin" ? "Wird gespeichert…" : "Jetzt einchecken"}
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Brauchst du Unterstützung? */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<LifeBuoy className="size-4 text-muted-foreground" />
								Brauchst du Unterstützung?
							</CardTitle>
							<CardDescription>
								Ein kurzer Hinweis reicht. Deine Coaches sehen ihn im Backend.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={onSaveSupport} className="space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="support-status">Art der Unterstützung</Label>
									<Select value={supportStatus} onValueChange={setSupportStatus}>
										<SelectTrigger id="support-status" className="w-full">
											<SelectValue placeholder="Auswählen" />
										</SelectTrigger>
										<SelectContent>
											{Object.entries(SUPPORT_LABELS).map(([value, label]) => (
												<SelectItem key={value} value={value}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="support-note">Wobei genau?</Label>
									<textarea
										id="support-note"
										value={supportNote}
										onChange={(event) => setSupportNote(event.target.value)}
										maxLength={1000}
										rows={3}
										className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
										placeholder="Zum Beispiel: Ich komme bei der Authentifizierung nicht weiter."
									/>
								</div>
								<Button type="submit" disabled={busy !== null} variant="outline">
									{busy === "support" ? "Wird gespeichert…" : "Unterstützung speichern"}
								</Button>
							</form>
						</CardContent>
					</Card>
				</div>

				{/* Heute im Wochenplan */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CalendarDays className="size-4 text-muted-foreground" />
								Heute im Wochenplan
							</CardTitle>
							<CardDescription>
								Der Soll-Plan für heute. Deine Tasks sind dein Ist.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{todaySchedule.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Für heute sind keine Wochenplan-Einträge hinterlegt.
								</p>
							) : (
								<div className="space-y-2">
									{todaySchedule.map((entry) => {
										const style =
											entry.category && entry.category in CATEGORY_STYLES
												? CATEGORY_STYLES[entry.category as EntryCategory]
												: null;
										const Icon = style?.icon;
										return (
											<div
												key={entry.key}
												className={cn(
													"rounded-md border p-3 text-sm",
													style?.cellClass,
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															{Icon ? <Icon className="size-4 shrink-0" /> : null}
															<span className="font-medium">
																{entry.title ?? entry.type ?? "Eintrag"}
															</span>
															{entry.type ? (
																<span
																	className={cn(
																		"rounded-full px-2 py-0.5 text-xs font-medium",
																		style?.badgeClass ?? "bg-muted text-muted-foreground",
																	)}
																>
																	{entry.type}
																</span>
															) : null}
															{entry.isRequired ? (
																<Badge variant="outline" className="text-xs">
																	Pflicht
																</Badge>
															) : null}
														</div>
														{entry.description ? (
															<p className="mt-1 text-xs text-muted-foreground">
																{entry.description}
															</p>
														) : null}
													</div>
													<div className="shrink-0 text-xs text-muted-foreground">
														{entry.startTime ? entry.startTime.slice(0, 5) : "—"}
														{entry.endTime ? ` – ${entry.endTime.slice(0, 5)}` : ""}
													</div>
												</div>
												{entry.coachName ? (
													<p className="mt-2 text-xs text-muted-foreground">
														{entry.coachName}
														{entry.location ? ` · ${entry.location}` : ""}
													</p>
												) : null}
											</div>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Tasks */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Target className="size-4 text-muted-foreground" />
								Deine Fokustasks
							</CardTitle>
							<CardDescription>
								Höchstens drei Fokustasks pro Tag. Der Rest darf warten.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{today?.tasks.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Noch keine Aufgabe für heute. Fang mit einer kleinen an.
								</p>
							) : (
								<div className="space-y-2">
									{today?.tasks.map((task) => (
										<div
											key={task.id}
											className={`rounded-lg border p-3 ${task.isFocus ? "border-primary/40 bg-primary/5" : ""}`}
										>
											<div className="flex items-start gap-3">
												<button
													type="button"
													onClick={() => onCompleteTask(task)}
													disabled={busy !== null}
													className="mt-0.5 text-muted-foreground hover:text-primary disabled:opacity-50"
													aria-label={
														task.status === "Done"
															? "Aufgabe wieder öffnen"
															: "Aufgabe erledigen"
													}
												>
													{task.status === "Done" ? (
														<CheckCircle2 className="size-5 text-emerald-600" />
													) : (
														<Circle className="size-5" />
													)}
												</button>
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<span
															className={`text-sm font-medium ${task.status === "Done" ? "text-muted-foreground line-through" : ""}`}
														>
															{task.title}
														</span>
														{task.isFocus ? <Badge variant="secondary">Fokus</Badge> : null}
														{task.needsSupport ? (
															<Badge variant="outline" className="gap-1">
																<LifeBuoy className="size-3" /> Hilfe angefragt
															</Badge>
														) : null}
													</div>
													<p className="mt-0.5 text-xs text-muted-foreground">
														{TASK_STATUS_LABELS[task.status] ?? task.status}
														{task.supportNote ? ` · ${task.supportNote}` : ""}
													</p>
												</div>
											</div>
											<div className="mt-2 flex flex-wrap gap-2 pl-8">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => onToggleFocus(task)}
													disabled={busy !== null}
												>
													{task.isFocus ? "Fokus entfernen" : "Als Fokus"}
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() => onToggleSupport(task)}
													disabled={busy !== null}
												>
													{task.needsSupport ? "Hilfe zurücknehmen" : "Hilfe anfragen"}
												</Button>
												{task.status !== "Done" ? (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => onCarryOver(task)}
														disabled={busy !== null}
													>
														Auf morgen
													</Button>
												) : null}
											</div>
										</div>
									))}
								</div>
							)}

							<form onSubmit={onAddTask} className="space-y-3 border-t pt-4">
								<div className="space-y-1.5">
									<Label htmlFor="new-task">Neue Aufgabe</Label>
									<Input
										id="new-task"
										value={newTaskTitle}
										onChange={(event) => setNewTaskTitle(event.target.value)}
										placeholder="Was ist dein nächster kleiner Schritt?"
										maxLength={255}
									/>
								</div>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<label className="flex items-center gap-2 text-sm">
										<Checkbox
											checked={newTaskFocus}
											onCheckedChange={(value) => setNewTaskFocus(value === true)}
										/>
										Als Fokustask markieren
									</label>
									<Button
										type="submit"
										disabled={busy !== null || newTaskTitle.trim().length === 0}
										className="gap-2"
									>
										<Plus className="size-4" /> Aufgabe hinzufügen
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
					{/* Evidence */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ExternalLink className="size-4 text-muted-foreground" />
								Nachweise
							</CardTitle>
							<CardDescription>
								Halte einen Link oder eine kurze Notiz fest. Datei-Uploads folgen
								später.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-6 md:grid-cols-2">
							<form onSubmit={onAddEvidence} className="space-y-3">
								<div className="space-y-1.5">
									<Label htmlFor="evidence-type">Art</Label>
									<Select
										value={evidenceType}
										onValueChange={(value) => setEvidenceType(value as "Note" | "Link")}
									>
										<SelectTrigger id="evidence-type" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Note">Notiz</SelectItem>
											<SelectItem value="Link">Link</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="evidence-title">
										Titel {evidenceType === "Link" ? "(erforderlich)" : "(optional)"}
									</Label>
									<Input
										id="evidence-title"
										value={evidenceTitle}
										onChange={(event) => setEvidenceTitle(event.target.value)}
										placeholder="Worum geht es?"
										maxLength={255}
									/>
								</div>
								{evidenceType === "Link" ? (
									<div className="space-y-1.5">
										<Label htmlFor="evidence-url">URL</Label>
										<Input
											id="evidence-url"
											type="url"
											value={evidenceUrl}
											onChange={(event) => setEvidenceUrl(event.target.value)}
											placeholder="https://…"
										/>
									</div>
								) : (
									<div className="space-y-1.5">
										<Label htmlFor="evidence-note">Notiz</Label>
										<textarea
											id="evidence-note"
											value={evidenceNote}
											onChange={(event) => setEvidenceNote(event.target.value)}
											maxLength={2000}
											rows={4}
											className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
											placeholder="Was hast du gelernt oder gebaut?"
										/>
									</div>
								)}
								<div className="space-y-1.5">
									<Label htmlFor="evidence-task">Gehört zu Aufgabe (optional)</Label>
									<Select value={evidenceTaskId} onValueChange={setEvidenceTaskId}>
										<SelectTrigger id="evidence-task" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Keine Aufgabe</SelectItem>
											{today?.tasks.map((task) => (
												<SelectItem key={task.id} value={task.id}>
													{task.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<label className="flex items-center gap-2 text-sm">
									<Checkbox
										checked={requestFeedback}
										onCheckedChange={(value) => setRequestFeedback(value === true)}
									/>
									Coach-Feedback anfragen
								</label>
								<Button type="submit" disabled={busy !== null}>
									{busy === "evidence" ? "Wird gespeichert…" : "Nachweis speichern"}
								</Button>
							</form>

							<div className="space-y-2">
								<h3 className="text-sm font-medium">Zuletzt hinzugefügt</h3>
								{today?.evidence.length === 0 ? (
									<p className="text-sm text-muted-foreground">
										Noch keine Nachweise. Der erste Link oder die erste Notiz reicht.
									</p>
								) : (
									today?.evidence.map((evidence) => (
										<EvidenceItem key={evidence.id} evidence={evidence} />
									))
								)}
							</div>
						</CardContent>
					</Card>
				{/* Daily close: volle Breite, kompakt */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="size-4 text-muted-foreground" />
							Tagesabschluss
						</CardTitle>
						<CardDescription>
							Optional und in etwa zwei Minuten erledigt. Kein Pflichtfeld, keine
							Punktzahl.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isClosed ? (
							<div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
								<div>
									<p className="text-sm font-medium">Tag abgeschlossen</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Abgeschlossen um {formatTime(today?.day.closedAt ?? null)}
										{today?.day.nextStep ? ` · Nächster Schritt: ${today.day.nextStep}` : ""}
									</p>
								</div>
								<Button variant="outline" onClick={onReopenDay} disabled={busy !== null}>
									{busy === "reopen" ? "Wird geöffnet…" : "Tag wieder öffnen"}
								</Button>
							</div>
						) : (
							<form onSubmit={onCloseDay} className="grid gap-4 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="day-focus">Dein Fokus heute</Label>
									<Input
										id="day-focus"
										value={focus}
										onChange={(event) => setFocus(event.target.value)}
										maxLength={255}
										placeholder="Woran hast du gearbeitet?"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="self-rating">Wie sicher fühlst du dich?</Label>
									<Select value={selfRating} onValueChange={setSelfRating}>
										<SelectTrigger id="self-rating" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="unset">Keine Angabe</SelectItem>
											{Object.entries(RATING_LABELS).map(([value, label]) => (
												<SelectItem key={value} value={value}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5 md:col-span-2">
									<Label htmlFor="next-step">Dein nächster Schritt</Label>
									<textarea
										id="next-step"
										value={nextStep}
										onChange={(event) => setNextStep(event.target.value)}
										maxLength={500}
										rows={2}
										className="border-input placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
										placeholder="Womit machst du morgen weiter?"
									/>
								</div>
								<div className="md:col-span-2">
									<Button type="submit" disabled={busy !== null}>
										{busy === "close" ? "Wird abgeschlossen…" : "Tag abschließen"}
									</Button>
								</div>
							</form>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function EvidenceItem({ evidence }: { evidence: WorkbookEvidence }) {
	return (
		<div className="rounded-md border p-3 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-medium">{evidence.title ?? "Nachweis"}</span>
				<Badge variant="outline">{evidence.type === "Link" ? "Link" : "Notiz"}</Badge>
				{evidence.feedbackStatus === "Requested" ? (
					<Badge variant="secondary">Feedback angefragt</Badge>
				) : null}
			</div>
			{evidence.type === "Link" && evidence.url ? (
				<a
					href={evidence.url}
					target="_blank"
					rel="noreferrer"
					className="mt-1 inline-block break-all text-xs underline underline-offset-4"
				>
					{evidence.url}
				</a>
			) : null}
			{evidence.note ? (
				<p className="mt-1 text-xs text-muted-foreground">{evidence.note}</p>
			) : null}
			{evidence.coachFeedback ? (
				<p className="mt-2 rounded bg-muted/40 p-2 text-xs">
					Coach-Feedback: {evidence.coachFeedback}
				</p>
			) : null}
		</div>
	);
}
