# „Mein Lernen“ – Workbook MVP (Teilnehmer-Portal + Coach-Backoffice)

Stand: November 2026 · Commit `ef6c514`

Dieses Dokument beschreibt das **Workbook-MVP**: die arbeitstag-zentrierte „Mein Lernen“-Schicht für Teilnehmer (Ist-/Nächster-Schritt) und die begleitende Coach-Sicht (Übersicht, Unterstützung, Export). Es ersetzt keine Klassenbuch-Funktion und ergänzt den Wochenplan (Soll) um eine Orientierungs-/Ist-Schicht.

## 1. Kernprinzipien

| Prinzip | Bedeutung |
|---------|-----------|
| **Kein `Workbook__c`-Container** | Tage und Tasks stehen direkt auf den Teilnehmenden, ohne übergeordneten Container. |
| **Keine automatische Task-Erstellung** | Aus Wochenplan-Einträgen werden keine Tasks automatisch erzeugt. |
| **Maximal 3 Fokus-Tasks pro Tag** | Wird serverseitig in Apex erzwungen (`WorkbookService`). |
| **Täglicher Check-in mit Zeitstempel** | Idempotent über `ParticipantDateKey__c`; keine Klassenbuch-Bestätigung. |
| **Keine Punkte/Streaks** | Keine Gamification, keine harte tägliche Pflicht. |
| **Tagesabschluss optional** | Ca. 2 Minuten, nicht verpflichtend. |
| **Portal schreibt via Apex REST** | Mit serverseitiger Identitäts- und Teilnahmen-Validierung. |
| **OWD Private** | Alle vier Workbook-Objekte sind privat; Portal-Nutzer sehen eigene Datensätze über Besitzrecht, Coaches über View All Records (nicht Modify All). |

## 2. Datenmodell (vier Objekte)

Alle Objekte leben im **Backend-Projekt** (`backend/force-app/.../objects/`) und sind im Repo versioniert. Neue Felder wurden manuell in Setup angelegt und danach per `sf project retrieve` ins Source geholt (siehe [Schema-Regeln](#schema-regeln)).

### 2.1 `Workbook_Day__c` (Arbeitstag)

Zentrales Objekt für den Ist-/Nächster-Schritt eines Tages.

| Feld | Typ | Pflicht | Bemerkung |
|------|-----|---------|-----------|
| `Participant__c` | Lookup(`Participant__c`) | Ja | Cascade Delete |
| `Date__c` | Date | Ja | Kalendertag |
| `ParticipantDateKey__c` | Text(255), Unique + External ID | Ja | Idempotenz-Schlüssel `<User>|<Date>` |
| `Status__c` | Picklist | Ja | Offene Werte: Open, Closed |
| `Focus__c` | Text(255) | Nein | Fokus des Tages |
| `SelfRating__c` | Picklist/Text | Nein | Selbstbewertung |
| `NextStep__c` | Text(255) | Nein | Nächster Schritt |
| `SupportStatus__c` | Picklist | Nein | Unterstützungsstatus (z. B. None, Requested) |
| `SupportNote__c` | Long Text Area | Nein | Notiz für Coach |
| `CheckInAt__c` | DateTime | Nein | Zeitstempel des Check-ins |
| `CheckInSource__c` | Text(50) | Nein | Quelle (z. B. Portal, App) |
| `ClosedAt__c` | DateTime | Nein | Zeitpunkt Abschluss |
| `LastReopenedAt__c` | DateTime | Nein | Zeitpunkt Wiedereröffnung |

Validierungsregeln:
- `CheckIn_At_Source_Together` – CheckInAt und CheckInSource zusammen oder gar nicht.
- `Closed_Requires_ClosedAt` – Bei Status Closed muss ClosedAt gesetzt sein.
- `Reopened_Requires_ReopenedAt` – Bei Wiederöffnung muss LastReopenedAt gesetzt sein.

### 2.2 `Workbook_Task__c` (Tages-Task)

Ein Task gehört zu genau einem Tag und einem Teilnehmenden.

| Feld | Typ | Pflicht | Bemerkung |
|------|-----|---------|-----------|
| `Participant__c` | Lookup(`Participant__c`) | Ja | Cascade Delete |
| `OriginDay__c` | Lookup(`Workbook_Day__c`) | Ja | Herkunftstag |
| `PlannedDate__c` | Date | Ja | Geplanter Tag (wird bei Carry-over verschoben) |
| `Title__c` | Text(255) | Ja | Titel |
| `Status__c` | Picklist | Ja | Offen / Erledigt / Entfällt |
| `IsFocus__c` | Checkbox | Ja | Fokus-Task (max. 3 pro Tag) |
| `CompletedAt__c` | DateTime | Nein | Zeitpunkt Erledigt |
| `CarriedFromTask__c` | Lookup(`Workbook_Task__c`) | Nein | Ursprungs-Task bei Carry-over |
| `ScheduleEntry__c` | Lookup(`ScheduleEntry__c`) | Nein | Bezug Wochenplan-Eintrag (optional, SetNull) |
| `LearningPathEntry__c` | Lookup(`LearningPathEntry__c`) | Nein | Bezug Lernpfad-Eintrag (optional, SetNull) |
| `ProgramWeek__c` | Lookup(`ProgramWeek__c`) | Nein | Bezug Kurswoche (optional, SetNull) |
| `SupportNote__c` | Long Text Area | Nein | Coach-Notiz |
| `NeedsSupport__c` | Checkbox | Nein | Unterstützung gewünscht |
| `SortOrder__c` | Number | Nein | Sortierung |

Validierungsregeln:
- `Done_Requires_CompletedAt` – Status Erledigt braucht CompletedAt.
- `Focus_Not_Dropped` – Fokus-Task darf nicht auf „Entfällt“ gesetzt werden.

Carry-over verschiebt `PlannedDate__c` auf den nächsten Tag; es wird **kein neuer Task erstellt**.

### 2.3 `Workbook_Evidence__c` (Nachweise / Feedback)

Belege, die ein Teilnehmender einstellt, sowie Coach-Feedback dazu.

| Feld | Typ | Pflicht | Bemerkung |
|------|-----|---------|-----------|
| `Participant__c` | Lookup(`Participant__c`) | Ja | Cascade Delete |
| `Task__c` | Lookup(`Workbook_Task__c`) | Nein | Zugehöriger Task (optional, SetNull) |
| `Title__c` | Text(255) | Ja | Titel |
| `Type__c` | Picklist | Ja | Art des Nachweises |
| `URL__c` | URL | Nein | Link / Datei-Referenz |
| `Note__c` | Long Text Area | Nein | Beschreibung |
| `FeedbackStatus__c` | Picklist | Nein | Feedback-Status des Coaches |
| `CoachFeedback__c` | Long Text Area | Nein | Rückmeldung Coach |
| `CoachFeedbackBy__c` | Lookup(User) | Nein | Coach, der feedback gegeben hat |
| `CoachFeedbackAt__c` | DateTime | Nein | Zeitpunkt |
| `LearningPathEntry__c` | Lookup(`LearningPathEntry__c`) | Nein | Bezug Lernpfad (optional, SetNull) |
| `ProgramWeek__c` | Lookup(`ProgramWeek__c`) | Nein | Bezug Kurswoche (optional, SetNull) |

Validierungsregeln:
- `Link_Requires_Title_URL` – Bei URL-Typ sind Titel und URL Pflicht.
- `Note_Requires_Note` – Bei Text-Typ ist Note Pflicht.
- `Given_Feedback_Complete` – Bei gegebenem Feedback sind Coach, Datum und Feedback-Text Pflicht.

### 2.4 `Workbook_Week_Review__c` (Wochenrückblick)

Wöchentliche Zusammenfassung, startet immer montags.

| Feld | Typ | Pflicht | Bemerkung |
|------|-----|---------|-----------|
| `Participant__c` | Lookup(`Participant__c`) | Ja | Cascade Delete |
| `ParticipantWeekKey__c` | Text(255), Unique + External ID | Ja | Idempotenz-Schlüssel `<User>|<KW>` |
| `WeekStartDate__c` | Date | Ja | Montag der Woche |
| `WeekEndDate__c` | Date | Ja | Freitag der Woche |
| `Status__c` | Picklist | Ja | Entwurf / Abgeschlossen |
| `SubmittedAt__c` | DateTime | Nein | Zeitpunkt Abgabe |
| `SummarySnapshot__c` | Long Text Area | Nein | Momentaufnahme (JSON/Text) |
| `TaskCount__c` | Number | Nein | Anzahl Tasks Woche |
| `CompletedTaskCount__c` | Number | Nein | Erledigte Tasks |
| `EvidenceCount__c` | Number | Nein | Nachweise |
| `SupportRequestCount__c` | Number | Nein | Unterstützungswünsche |
| `ProudOf__c` | Long Text Area | Nein | Worauf bin ich stolz? |
| `SupportWish__c` | Long Text Area | Nein | Wunsch an den Coach |
| `ClearerNow__c` | Long Text Area | Nein | Was ist jetzt klarer? |
| `NextWeekFocus__c` | Long Text Area | Nein | Fokus nächste Woche |

Validierungsregeln:
- `Review_End_After_Start` – Ende nach Beginn.
- `Submitted_Review_Complete` – Abgeschlossene Reviews müssen vollständig sein.

## 3. Portal (Teilnehmer-Seite – Experience Cloud / UI Bundle `frontend`)

URL: `https://techandteach--devhub.sandbox.my.site.com/organisatorv1` (Primärer Picasso-Pfad `/organisatorv1`).

### 3.1 Seiten

| Pfad | Zweck |
|------|-------|
| `/heute` | Heute-Widget: Check-in, aktueller Tag, Fokus, Nächster Schritt |
| `/woche` | Wochenansicht: **Mo–Fr (5 Arbeitstage)**; Check-in-Status pro Tag; Tagesabschluss-Status; Wochenrückblick-Formular |

### 3.2 Check-in

- Auf der Seite `/heute` (und pro Tag in `/woche`).
- Nur **aktueller Tag** (Zeitzone `Europe/Berlin`).
- Idempotent: Mehrfaches Speichern desselben Tages überschpert nicht, sondern aktualisiert denselben Datensatz (`ParticipantDateKey__c`).
- Zeitsempel `CheckInAt__c` + Quelle `CheckInSource__c`.

### 3.3 API-Client (`workbookApi.ts`)

`frontend/force-app/main/default/uiBundles/frontend/src/features/participant/api/workbookApi.ts`

- `getWorkbookToday()` → heutiger Tag
- `getWorkbookWeek(date)` → Woche (Mo–Fr)
- `checkIn(date, source)` → Check-in setzen
- `closeDay(dayId)` / `reopenDay(dayId)` → Tagesabschluss toggeln
- `saveFocus(dayId, focus)` / `saveNextStep(dayId, nextStep)` / `saveSelfRating(dayId, rating)` → Tagesfelder
- `saveTask(...)` / `completeTask(taskId)` / `carryOver(taskId, newDate)` → Tasks

### 3.4 Apex REST (`ParticipantPortalWorkbook.cls`)

`frontend/force-app/main/default/classes/ParticipantPortalWorkbook.cls`

- Endpoint: `/services/apexrest/participant-workbook/...`
- Serverseitige Identitäts-Validierung: `User.ContactId → Contact → Participant__c`
- Alle Schreib- und Lese-Operationen validieren den aktiven Participant-Kontext.
- Best-effort-Audit (`AuditEvent__c`) – Portal-Nutzer haben kein Create-Recht auf `AuditEvent__c`, deshalb wird das Audit nur versucht, nie hart gefehlt.

### 3.5 Berechtigungen (Portal)

`frontend/force-app/main/default/permissionsets/Participant_Portal_Access.permissionset-meta.xml`

- CRUD auf `Workbook_Day__c`, `Workbook_Task__c`, `Workbook_Evidence__c`, `Workbook_Week_Review__c` (Lesen/Schreiben auf eigene Datensätze über Besitzrecht + Sharing).
- `classAccesses` für `ParticipantPortalWorkbook` (und bestehende Portal-Klassen).
- Kein `View All Records` für Portal (Least Privilege).

## 4. Backoffice (Coach-Seite – UI Bundle `backend`)

Internes Backoffice-UI-Bundle unter `backend/force-app/main/default/uiBundles/backend`.

### 4.1 Dashboard (`Home.tsx`)

Der Backend-Dashboard ist jetzt ein **kompakter Starting Point** mit:

- **Metrik-Zeile** (oben): Teilnehmer gesamt, Aktiv, Braucht Aufmerksamkeit, Onboarding.
- **Schnellzugriff-Grid**: Buttons/Links zu Teilnehmer, Wochenplan, Programme, Vorlagen.
- **Drei kompakte Karten** (Mo–Fr relevant, keine Wochenenden):
  1. **Braucht Aufmerksamkeit** – Teilnehmende mit fehlenden Onboarding-Daten (kompakt, max. 5, Link „Alle“).
  2. **Lifecycle-Übersicht** – Status-Verteilung der Teilnehmenden (kompakt).
  3. **Zuletzt hinzugefügt** – Kürzlich erstellte Teilnehmende mit Datum (kompakt, Link „Alle“).

Das Dashboard leitet per Buttons/Links auf die einzelnen Kernfunktionen und Subseiten weiter; es ist keine Endanwendung selbst.

### 4.2 `WorkbookSupportWidget`

`backend/force-app/main/default/uiBundles/backend/src/components/workbook/WorkbookSupportWidget.tsx`

- Globales Coach-Widget auf dem Dashboard.
- Zeigt Check-ins, Unterstützungsanfragen und Feedbackwünsche für den aktuellen Tag.
- Enthält keine Off-Day/Feiertag-Funktion mehr (siehe Abschnitt 8).

### 4.3 `ParticipantWorkbookTab`

`backend/force-app/main/default/uiBundles/backend/src/components/workbook/ParticipantWorkbookTab.tsx`

- Coach-Ansicht für einen einzelnen Teilnehmenden.
- Zeigt die Tagesübersicht (Status, Check-in, Fokus, Nächster Schritt, Abschluss).
- Keine Off-Day-Checkbox mehr (entfernt).

### 4.4 API-Service (`workbookService.ts`)

`backend/force-app/main/default/uiBundles/backend/src/api/workbook/workbookService.ts`

- `getWorkbookSupportOverview(today)` → Check-ins, Support-Tasks, Feedback-Evidence für den Tag.
- `getWorkbookDayOverview(participantId, date)` → Einzelner Tag mit Tasks und Evidence.
- `getParticipantWorkbook(participantId)` → Komplette Teilnehmer-Wochenübersicht.
- `getWorkbookExport(participantId, from, to)` → CSV-Export für Coach.

### 4.5 CSV-Export

Coach kann Teilnehmer-Einträge als CSV exportieren (Tage, Tasks, Nachweise, Check-ins). Liefert über UI API GraphQL + clientseitiges CSV.

### 4.6 Berechtigungen (Coach)

`backend/force-app/main/default/permissionsets/backend_Coach.permissionset-meta.xml`

- `Workbook_Day__c`: `allowRead=true`, `allowCreate=false`, `allowEdit=false`, `allowDelete=false`, `modifyAllRecords=false`.
- Coaches sehen alle Teilnehmenden über **View All Records** (nicht Modify All).
- Kein `classAccesses` für `CoachWorkbookService` mehr (Klasse entfernt, siehe Abschnitt 8).

## 5. Wochenansicht (Mo–Fr)

Die Wochenansicht (`/woche`) zeigt **nur Montag bis Freitag** (5 Arbeitstage), keine Samstag/Sonntag.

- **Apex (`WorkbookService.getWeek`)**: Iteriert nur noch 5 Tage (von 7 auf 5 reduziert).
- **Frontend (`WeekView.tsx`)**: Grid `lg:grid-cols-5` statt `lg:grid-cols-7`.
- **Zusammenfassungskarten**: Beziehen sich automatisch auf die 5 Arbeitstage (Check-ins, abgeschlossene Tage, Tasks).
- Datum wird auf den Montag der Woche normalisiert.

## 6. Woche-Rückblick

- Startet immer **Montag**.
- Speichert einen Zusammenfassungs-Snapshot (`SummarySnapshot__c`) sowie die Zähler `TaskCount__c`, `CompletedTaskCount__c`, `EvidenceCount__c`, `SupportRequestCount__c`.
- Freitextfelder: `ProudOf__c`, `SupportWish__c`, `ClearerNow__c`, `NextWeekFocus__c`.
- Idempotent über `ParticipantWeekKey__c`.

## 7. Deployment

Beide SFDX-Projekte deployen in dieselbe Org. Reihenfolge:

1. **Backend zuerst** (Metadata + internes UI-Bundle)
2. **Frontend danach** (Experience Cloud + Portal UI-Bundle)

### UI-Bundles bauen

```bash
cd frontend/force-app/main/default/uiBundles/frontend && npm run build
cd backend/force-app/main/default/uiBundles/backend && npm run build
```

### Selektiv deployen (HubSandbox)

```bash
# Apex + Permission Sets (Frontend)
cd frontend && sf project deploy start \
  --source-dir force-app/main/default/classes/WorkbookService.cls \
  --source-dir force-app/main/default/permissionsets/Participant_Portal_Access.permissionset-meta.xml \
  --target-org hubSandbox --test-level NoTestRun --wait 10

# Permission Sets (Backend)
cd backend && sf project deploy start \
  --source-dir force-app/main/default/permissionsets/backend_Coach.permissionset-meta.xml \
  --target-org hubSandbox --test-level NoTestRun --wait 10

# UI-Bundles
cd backend && sf project deploy start --source-dir force-app/main/default/uiBundles/backend --target-org hubSandbox
cd frontend && sf project deploy start --source-dir force-app/main/default/uiBundles/frontend --target-org hubSandbox
```

### Experience Cloud publishen

```bash
cd backend
sf community publish --name Organisator --target-org hubSandbox
sf community publish --name frontend --target-org hubSandbox
```

> Wichtig: Nach jedem Deploy Browser-Cache leeren oder Inkognito-Fenster nutzen, damit das neue UI-Bundle geladen wird.

### Tests

```bash
# Frontend UI-Bundle (Vitest)
cd frontend/force-app/main/default/uiBundles/frontend && npx vitest run

# Backend UI-Bundle (Vitest)
cd backend/force-app/main/default/uiBundles/backend && npx vitest run

# Apex (Beispiel)
sf apex run test --target-org hubSandbox --test-level RunLocalTests --wait 10
```

## 8. Entscheidungen & Entferntes (Changelog innerhalb des MVP)

### Entfernt: Off-Day / Feiertag-Funktion

- **Warum:** Teilnehmer wollten die Funktion vorerst nicht; die beiden Felder `OffDay__c` / `OffDayReason__c` auf `Workbook_Day__c` sollen nicht aktiv genutzt werden.
- **Was entfernt wurde:**
  - Apex: `WorkbookService.setOffDay()` + alle `OffDay__c`/`OffDayReason__c`-Referenzen in `getWeek`/`toDayView`/`findDay`/`findOwnedDay`.
  - Apex-Klasse `CoachWorkbookService.cls` gelöscht (quell- und org-seitig).
  - Portal API: `offDay` / `offDayReason` aus `WorkbookDay`-Interface entfernt.
  - Portal UI (`WeekView.tsx`): Off-Day-Badge entfernt.
  - Backend UI (`ParticipantWorkbookTab.tsx`, `workbookService.ts`): Off-Day-Checkbox, `setParticipantOffDay`, `createDataSDK`-Import entfernt.
  - Permission Sets: `OffDay`-Field-Perms entfernt; Coach `Workbook_Day__c` wieder auf `allowCreate=false`/`allowEdit=false`; `CoachWorkbookService`-`classAccesses` entfernt.
- **Noch in der Org:** Die Felder `OffDay__c` / `OffDayReason__c` können in der Org noch existieren (wurden nicht per Destructive Changes gelöscht), werden aber vom Code nicht mehr referenziert. Sie können bei Bedarf später wieder aktiviert werden.

### Nicht Teil des MVP

- Keine automatische Task-Erstellung aus Wochenplan-Einträgen.
- Kein `Workbook__c`-Container-Objekt.
- Keine Punkte/Streaks.
- Keine harte tägliche Check-in-Pflicht.
- Kein Off-Day/Feiertag im Code (siehe oben).
- Teilnehmer-Wochenansicht zeigt nur Mo–Fr (Samstag/Sonntag pending, falls später gewünscht).

## 9. Schema-Regeln (Wichtig für Änderungen)

- Neue Custom Fields **niemals per `sf project deploy`** erstellen.
- Immer: **Manuell in Setup → Object Manager anlegen → `sf project retrieve` ins Source holen.**
- Anschließend `cd backend && npm run schema:check` laufen lassen (Exit 0 = OK).
- UI API GraphQL ist case-sensitive – exakte API-Namen verwenden.
- Validierungsregeln werden in Classic Setup angelegt (nicht im CLI-Registry), deshalb nicht im Repo unter `validationRules/` für neue Objekte ablegen, wenn der Preflight scheitern würde (siehe `TROUBLESHOOTING.md` #7).

## 10. Verwandte Dokumente

| Dokument | Bezug |
|----------|-------|
| [`docs/DATA_MODEL.md`](DATA_MODEL.md) | Academy-Kernobjekte (Participant, Program, Learning_Path, …) – hier ergänzt um die vier Workbook-Objekte |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Monorepo, Ownership, Identity, Experience Cloud, Deployment |
| [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Schema, Deploy, Experience Cloud, Playwright |
| [`docs/ONBOARDING.md`](ONBOARDING.md) | Erster Setup-Pfad |
| [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md) | Deep-Dive: Architektur, Naming, Schema-Regeln, Troubleshooting |
| [`frontend/AGENTS.md`](../frontend/AGENTS.md) | Experience Cloud URL-Architektur, Login/Logout, Live-Tests |
