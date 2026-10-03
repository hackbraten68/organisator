import { DashboardPlaceholder } from "../components/dashboard/dashboard-placeholder";
import { useParticipant } from "../features/participant/context/ParticipantContext";

/**
 * The portal's start page.
 *
 * It is deliberately a wireframe: each block marks a card that will later carry
 * real participant data (appointments, absences, learning path). Nothing here
 * fetches anything beyond `/me`, which the app shell already loads, so no
 * endpoint and no object permission is added for a page that only draws boxes.
 *
 * Future data needs `Appointment__c` and `Absence__c` CRUD/FLS in
 * `Participant_Portal_Access`; `with sharing` is not sufficient (see
 * `frontend/AGENTS.md`, "And access still needs an *object* grant").
 *
 * The greeting uses the participant record rather than the auth session because
 * `/me` resolves `User.ContactId -> Contact -> Participant__c`. The live spec
 * asserts the participant's name is on screen after login, and the session
 * identity is not guaranteed to be it.
 */
export default function Dashboard() {
	const { me } = useParticipant();

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

			{/* One full-width card, then a two-column grid. Fixed, not data-driven:
			    these are placeholders, so the count is layout, not content. */}
			<div className="grid gap-6">
				<DashboardPlaceholder
					title="Dein Programm"
					description="Programmname, Betreuer:in und Zeitraum deiner Teilnahme."
					rows={3}
				/>

				<div className="grid gap-6 md:grid-cols-2">
					<DashboardPlaceholder
						title="Nächster Termin"
						description="Terminart, Datum und Uhrzeit deines nächsten Coachings."
						rows={2}
					/>
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