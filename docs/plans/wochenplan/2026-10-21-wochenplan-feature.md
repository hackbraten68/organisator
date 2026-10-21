# Plan: Interaktive Wochenansicht (Wochenplan) für Teilnehmende

> **Status:** Freigegebene Implementierungsgrundlage  
> **Stand:** 2026-10-21  
> **Gültigkeit:** Verbindlich für Feldvertrag, Abhängigkeiten und Umsetzungsreihenfolge  
> **Änderungen:** Fachliche oder technische Abweichungen müssen in diesem Dokument und gegebenenfalls in einer ADR dokumentiert werden.

**Datum:** 2026-10-21
**Branch:** `dev`, letzter Commit `43d3a8b` (Montagspaket committet, nicht deploybar)
**Status:** Analyse abgeschlossen, am 2026-10-21 nach dem Fachgespräch (fachliche Seite / Infra)
revidiert — **Abschnitt 0b** enthält die sechs Korrekturen am Datenmodell (maßgebliche Fassung).
**Keine Implementierung** — dieser Plan ist die Rückmeldung vor der Umsetzung (Schritt 1–6 des
Ausgangs-Prompts). Entscheidungen F1–F15 sind offen, siehe Abschnitt 12.

---

## 0. Die fünf Befunde, die alles Weitere bestimmen

1. **Die Kurs-Hierarchie heißt anders und ist flacher als angenommen.**
   „Kurs" = `Program__c`, „Wochenmodul" = `Module__c` — aber `Module__c` hat **nur** `Program__c`,
   `Order__c`, `Description__c`. **Keine Woche, kein Datum.** `Program__c` hat **kein** Start-/Enddatum,
   nur `DurationWeeks__c` (ein Zähler). Eine navigierbare „Kurswoche" existiert als Entität **nicht**.

2. **Es gibt keine Gruppen.** Repo-weit 0 Treffer für `Group__c`, `Participant_Group__c`,
   `Sales_Channel__c`, Kohorten-/Batch-Felder. Die geforderte Zielgruppe „bestimmte Gruppe" ist damit
   **eine neue Entität**, nicht eine Erweiterung. Das ist die größte offene Frage (F1).

3. **Termine sind heute 1:1 Teilnehmer↔Coach.** `Appointment__c.Participant__c` ist **required**
   (Lookup, Restrict), `Coach__c` zeigt auf **User** (nicht auf `Coach_Profile__c`). Kursweite und
   gruppenbezogene Aktivitäten (Workshop, Selbstlernphase) passen **strukturell nicht** in dieses Modell.
   Ein Termin ist immer „ein Coaching-Termin für genau einen Teilnehmer".

4. **`Appointment__c` hat keinen Kursbezug.** Kein `Program__c`, kein `Module__c`, kein Wochenfeld.
   Die Verknüpfung „welcher Termin gehört zu welcher Kurswoche" existiert nicht.

5. **Die Coach↔Programm-Zuordnung ist nicht persistent.** `programService.ts:132` ist ein
   In-Memory-`Record<string, string[]>` im Browser, geseedet über einen Namensvergleich
   (`coachNamesFor`, Z. 134–142). `Coach_Profile__c` hat kein Program-Feld. „Coaches dürfen die für
   sie zugeordneten Wochenpläne bearbeiten" ist damit **serverseitig nicht prüfbar** (F7).

**Konsequenz:** Der Feature-Auftrag ist in dieser Form eine **Erweiterung mit drei neuen
Entitäten-Ebenen**, nicht ein Ausbau vorhandener Logik. Die Terminlogik selbst bleibt
unangetastet (kein zweites Kalendersystem), aber der Wochenplan braucht eine eigene Planungsebene
**über** der Terminsebene.

---

## 0b. Abgleich mit dem Fachgespräch (2026-10-21)

**Ergebnis: zu rund 80 % deckungsgleich.** Die drei Ebenen, die Vorlagen-Logik (Kopie statt Link) und
das Verhältnis Planzeile ↔ Termin bleiben wie entworfen. Sechs Stellen passen nicht und sind hier
korrigiert. **Dieser Abschnitt ist die maßgebliche Fassung**; die Objektdefinitionen in 4.1 sind
entsprechend nachgezogen.

### Was das Gespräch festlegt

| Aussage | Konsequenz |
|---|---|
| „Module ist die Überschrift aus der Agenda" | `Module__c` bleibt der wiederverwendbare Inhalt (Description: „Reuseable program content template") |
| „ProgramWeek ist die AZAV/PowerPoint-Präsentations-Namenebene der Kursansicht" | `ProgramWeek__c` = **thematische** Kurswoche (Dek/Modul + Nummer), nicht zwingend eine Kalenderwoche |
| „WeeklySchedule = der Layer mit tagesspezifischen Tasks" | `WeeklySchedule__c` = Plan-Instanz einer Woche **für einen Geltungsbereich** |
| „ScheduleEntry = einzelne Tasks pro Tag + individuelle Termine (z. B. Feedback), die keinem Template entsprechen" | `ScheduleEntry__c` deckt **Aufgaben und Termine** ab; `SourceTemplateEntry__c` darf null sein |
| „Templates auf Basis der AZAV-Kurswochen" | `ScheduleTemplate__c` bindet an `ProgramWeek__c` (nicht primär an `Module__c`) |
| „Änderungen sind dennoch möglich" + „Änderung an der Vorlage verändert andere Pläne nicht" | Deep Copy + Provenienz — **bestätigt** |
| „die wöchentlichen Gruppentermine nicht vergessen" | Gruppentermine = Einträge mit Geltungsbereich Gruppe |
| „Zusätzliche Termine bei Teilnehmern, die Probleme haben" | `TargetType = Individual` ohne Template-Herkunft — **bestätigt** |
| „ein Eintrag, der die geplanten Todos und Tasks vordefiniert, plus ein Feld für zusätzliche individuelle Aufgaben, wenn wir die Lernzeile schon vorher als erfüllt sehen" | **Aufgaben-/Erledigt-Semantik fehlte** → K2/K5 |
| „es muss klar sein, dass wir und warum wir vom Standard abgewichen sind" | **Abweichungs-Begründung fehlte** → K3 |
| „Bauchweh bei Kurswochen, die zu sehr von der AZAV-Wochenthematik abweichen" (Teilnehmer macht SAA statt DevOps) | **Teilnehmer-spezifische Abweichung fehlte** → K4 |
| „Ziel: ähnliche Fälle veränderter Abläufe sammeln, ggf. angepassten oder neuen Kurs planen" | Deviations müssen strukturiert erfasst werden (Grund + Audit) → Datenbasis für Export/Baseline |
| „Export-Funktion im Plan berücksichtigt … Baseline finden" | Datenmodell muss Export tragen (K3/K4); Export selbst v2 |

### Die sechs Korrekturen

**K1 — `ProgramWeek__c` ist thematisch; das Kalenderdatum hängt an der Plan-Instanz.**
Der Entwurf hatte `ProgramWeek__c.StartDate__c` (required) und `DayOffset__c` relativ dazu. Nach dem
Gespräch ist die Kurswoche die **AZAV-Themenebene**; konkrete Daten hängen an der Instanz.
→ Kalenderdatum auf `WeeklySchedule__c.StartDate__c`; `ScheduleEntry__c.DayOffset__c` wird gegen den
Wochenstart der **Instanz** gerechnet. Eine AZAV-Woche bleibt dadurch in mehreren Durchläufen nutzbar.

**K2 — `ScheduleEntry__c` braucht eine Aufgaben-Semantik, nicht nur einen Kalendereintrag.**
Fachliche Seite: „ein Eintrag, der die geplanten Todos und Tasks vordefiniert". Ein Eintrag ist entweder
**Aktivität/Termin** (Zeit, Ort, Coach) oder **Aufgabe** (Sacharbeit, ggf. ohne Uhrzeit).
→ neu `EntryKind__c` (`Aktivität` | `Aufgabe`) und `IsRequired__c` (Pflichtbestandteil des
AZAV-Standards). Die Standard-Aufgabenbeschreibung liegt in `Description__c` und ist editierbar
(fachliche Seite: „die Module sind der AZAV Standard auch mit der Aufgaben- und Task-Beschreibung").

**K3 — Abweichungsbegründung wird strukturiert erfasst.**
→ `WeeklySchedule__c.DeviationReason__c` (Abweichung der Woche als Ganzes) und
`ScheduleEntry__c.DeviationReason__c` (Abweichung eines Eintrags). Damit ist die Anforderung der fachlichen Seite „klar sein, dass
wir und warum wir vom Standard abgewichen sind" beantwortbar **und** die Datenbasis für die
Baseline-Sammlung geliefert.

**K4 — Teilnehmer-spezifische Abweichung braucht einen eigenen Plan-Geltungsbereich.**
Der Entwurf hatte **einen** Plan pro Kurswoche. Sams Beispiel (Teilnehmer macht SAA statt DevOps)
braucht eine zweite, abweichende Instanz derselben Woche.
→ `WeeklySchedule__c.ScopeType__c` = `Course` | `Group` | `Individual` (mit `ParticipantGroup__c` /
`Participant__c`). Der Standard ist die Instanz mit `ScopeType = Course`. Eine Abweichung ist eine
**eigene Instanz** (Copy-on-Deviation) — kein Sonderfall im Standard.
→ Auflösung in der Teilnehmeransicht: **individuelle Instanz schlägt Gruppeninstanz schlägt
Standard**; eine abweichende Instanz überschreibt nur die Einträge, die sie selbst führt.

**K5 — Der Erledigt-Status ist ein Zustand *pro Teilnehmer*, also eine eigene Zuordnung.**
„Wenn wir die Lernzeile schon vorher als erfüllt sehen" ist eine Tatsache über **Teilnehmer × Aufgabe**.
→ neu `TaskCompletion__c` (`ScheduleEntry__c`, `Participant__c`, `Status__c` = `Offen`/`Erfüllt`/
`Entfällt`, `CompletedAt__c`, `DeviationReason__c`).

**K6 — Die Lernzeile braucht die Verbindung zum AZAV-Modul.**
„Lernzeile" ist `Learning_Path__c` (Description: „Participant-specific curriculum item"). Sie hat
**keinen** Lookup auf `Module__c` — genau das fehlt, um zu wissen, in welcher Kurswoche ein
Teilnehmer steht (und damit, welche Woche die „aktuelle relevante" ist).
→ neu `Learning_Path__c.Module__c` (Lookup → `Module__c`, optional). Das beseitigt zugleich die
belegte Inkonsistenz zwischen `docs/DATA_MODEL.md` / `backend/docs/AGENTS.md` (dort ist die Kante
`Learning_Path__c → Module__c` gezeichnet) und dem tatsächlichen Metadatum.

### Der Streitpunkt „Wochen- vs. Kursvorlage" — auflösbar

| | Wochen-Template (pro AZAV-Woche) | Kurs-Template (gesamte Dauer) |
|---|---|---|
| Standardisierung (fachliche Seite) | jede Woche einzeln → mehr Pflege | ein Standard für alles |
| Teilnehmer-Abweichung (Infra) | Abweichung = eigene Instanz, Standard bleibt heil | Basislinie wird von jeder Abweichung angekratzt |
| wiederkehrende Gruppentermine | je Woche mitschreiben | einmal definieren |

**Empfehlung: Wochen-Templates als Regel** (Bindung an `ProgramWeek__c`), **plus optionales
Kurs-Template** für wiederkehrende Muster (die wöchentlichen Gruppentermine), das auf alle Wochen
eines Programms angewendet wird. Beide nutzen denselben Deep-Copy-Mechanismus; das Kurs-Template ist
nur ein Template mit Zielbereich „Programm". Damit bleiben das Standardisierungsziel der fachlichen
Seite (der Standard **ist** die Wochenvorlage) und die Abweichungsangst der Infra (Standard bleibt
heil) gleichzeitig erfüllt, und die Gruppentermine kosten keine Wochenpflege.

### Rollenverteilung (aus dem Gespräch)

Die Infra baut die Objekte/Struktur, die fachliche Seite liefert die AZAV-Inhalte, die
Abweichungsbegründung und den Standard. Konsequenz für den Plan: Abschnitt 4 ist ein **Feldvertrag**,
der in Classic Setup ausgeführt wird (ein Deploy ist ausgeschlossen), und der von hier aus zu liefernde
Teil ist die Verbraucherseite (Apex-Services, UI, Tests). Vor dem Anlegen der Objekte muss der
Feldvertrag abgestimmt sein, sonst entsteht Namensdrift zwischen Setup und Code.

---

## 1. Bestehende relevante Architektur

### 1.1 Namensmapping Feature-Begriff → Repo-Objekt

| Begriff aus dem Auftrag | Im Repo | Lücke |
|---|---|---|
| Kurs / Course | `Program__c` (Label „Program", Description „Course Program") | kein Start-/Enddatum, keine Wochen |
| Wochenmodul / CourseWeek / ModuleWeek | `Module__c` (Description: „Reuseable program content template") | keine Woche, kein Datum, keine Instanz |
| Termin | `Appointment__c` (Label „Termin") | kein Kurs-/Wochenbezug, `Participant__c` required |
| Teilnehmer | `Participant__c` → `Contact` (1:1, `ParticipantContactUniqueness.trigger`) | — |
| Coach | `Coach_Profile__c` → `User__c`; `Appointment__c.Coach__c` → **User** | Coach↔Program fehlt |
| Terminbereich | `Appointment__c.StartTime__c`/`EndTime__c`; `AvailabilitySlot__c.ValidFrom__c`/`ValidTo__c` | keine Ebene „Woche" |
| Termin-/Aktivitätstyp | `Appointment__c.Type__c` (restricted: Coaching, CheckIn, Feedback, Behörde, Praktikum, Sonstiges) | 6 Werte, fachlich zu eng |
| Gruppen | — | **existiert nicht** |
| Vorlage | — | **existiert nicht** (nur `Module__c` als „Template" im Sinn von Inhaltsdefinition) |
| Veröffentlichung | — | **existiert nicht** (nur Standard-CMS `ContentVersion` für Abwesenheitsdokumente) |
| Activity-Tracking | `AuditEvent__c` + `AuditOutbox__c`, UI in `src/components/audit/` | `Domain__c` kennt kein `schedule` |
| Terminbereich (UI) | `ParticipantAppointmentsTab.tsx` (Backend) / `pages/Appointments.tsx` (Portal) | beide flache Listen, kein Wochenraster |

### 1.2 Terminlogik (Bestand, unverändert zu übernehmen)

- `Appointment__c`: `StartTime__c`, `EndTime__c` (required), `Status__c` (Draft/Finding/Confirmed/
  Completed/Cancelled/NoShow, restricted, `trackHistory=true`), `Type__c`, `Location__c`
  (Discord/Zoom/Teams/External), `MeetingLink__c`, `Notes__c`, `CancellationReason__c`,
  `ConfirmedAt__c`, `CompletedAt__c`, `CorrelationId__c`.
- Schreibwege: **zwei** — UI-API-Mutationen (Client, `src/api/appointment/query/*.graphql`) und
  `AppointmentEditService` (Apex REST, `with sharing`, Draft-Gate D1, Feld-Whitelist, Audit in derselben
  Transaktion, 404/409). `UpdateAppointment.graphql` wurde im Montagspaket gelöscht, damit der
  Bearbeitungspfad **einen** Einstiegspunkt hat.
- Lifecycle (`Confirm`, `Complete`, `Cancel`, `Reschedule`, `Attendance`) bleibt **außerhalb** des
  allgemeinen Bearbeitungspfads (D1) und wird vom Wochenplan **nicht** angefasst.
- Validierungsregeln (3 Stück) existieren nur in Classic Setup, nicht im Repo
  (`backend/docs/g1-manual-checklist.md:102–107`).
- **Kein Kollisionsschutz im Repo** (D2 offen) — `AppointmentEditService.cls:37–41` verweist auf
  einen Trigger, den es noch nicht gibt.

### 1.3 Datenweg

```
Komponente → src/api/<domain>/<domain>Service.ts → src/api/<domain>/query/*.graphql (?raw)
          → src/api/graphqlClient.ts (executeGraphQL, cacheControl 'no-cache')
          → createDataSDK().graphql.query/.mutate   |   sdk.fetch → /services/apexrest/...
```
- `src/api/graphqlClient.ts:27–55` — einziger GraphQL-Zugang, `no-cache` ist Pflicht.
- Kein React Query, kein Redux, kein MSW. State: `useAsyncData` (Hook, kein Cache),
  `reload`-Zähler-Muster, `useState`/`useEffect`.
- Apex REST: **eine Klasse pro Endpunkt** (`frontend/AGENTS.md`), `global with sharing`,
  Antwortklasse whitelisted, Fehler über eigene Exception-Klasse mit Status + Code
  (Suffix `Exception` ist Pflicht).

### 1.4 Berechtigungen

- **Keine Frontend-Rechteprüfung.** 0 Treffer für `usePermission|hasPermission|can()`. Der einzige
  Schalter ist das Prop `canManage` (in `ParticipantPage.tsx` **immer** `true`).
- Permission Sets: `backend_Access` (nur `ApiEnabled` + `classAccesses`), `backend_Coach`
  (15 `objectPermissions`, davon 12 mit `viewAllRecords=true`; 59 `fieldPermissions`;
  `AuditEvent__c` append-only), `Participant_Portal_Access` (read-only, `viewAllRecords=false`,
  `viewAllFields=false`, 4 `classAccesses`).
- **Keine Sharing Rules, keine Sharing Sets im Repo.** Row-Level entsteht über verwaltetes Sharing
  (`ParticipantPortalSharingService` + 4 `*PortalSharing.trigger`, Row-Cause `Portal_Access__c`).
  `SharingReason`/`SharingCriteriaRule` sind **nicht deploybar**.
- Serverseitige Identität: `UserInfo.getUserId()` → `User.ContactId` → `Contact` → `Participant__c`.

### 1.5 Activity-Tracking

- `AuditEvent__c`: `EventType__c` (`<domäne>.<aktion>`), `Action__c` (23 Werte, u. a. `created`,
  `updated`, `deleted`, `entry_created`, `entry_updated`, `entry_deleted`, `reordered`),
  `Domain__c` (12 Werte, **restricted**, **kein** `schedule`), `ActorType__c`, `Visibility__c`
  (staff/participant/restricted), `Sensitivity__c`, `ParticipantId__c`, `Changes__c`/`Metadata__c` (JSON).
- Schreiben: transaktional in Apex (Muster `AppointmentEditService.cls:507`, Savepoint + Rollback bei
  Audit-Fehler → 500 `AUDIT_FAILED`) oder clientseitig via UI-API.
- Anzeige: `src/components/audit/ActivityTimeline.tsx`, `src/components/participants/ParticipantActivity.tsx`.
  Projektionsregeln in `src/api/audit/activityProjection.ts` (~50 Regeln, **Default-Deny** für
  unbekannte Eventtypen) + `docs/activity-coverage.md` (Domänen-Matrix).

### 1.6 UI-Bausteine

- Backend-Bundle (`uiBundles/backend`): 35 Komponenten in `src/components/ui/` (accordion, calendar,
  datePicker, dialog, dropdown-menu, empty-state, skeleton, table, tabs, sonner, select, input …).
  `react-day-picker` 9.14, `date-fns` 4.1, `radix-ui` 1.4.
- Portal-Bundle (`uiBundles/frontend`): 24 UI-Komponenten, `date-fns` 4.1, `radix-ui`, `react-day-picker`
  vorhanden (Kalender/DatePicker dort **ungenutzt**).
- Wochen-Navigation existiert bereits: `ParticipantAppointmentsTab.tsx:37,47–49,229–231,292–303`
  (`weekOffset`, `startOfWeek(..., { weekStartsOn: 1 })`, Chevron-Buttons) + Wochenfilter über
  `startTimeFrom`/`startTimeTo` (`appointmentService.ts:167–180`).
- Kein Wochen-/Monatsraster, kein Grid-Kalender, kein Drag-and-drop-Baustein (0 Treffer).
- **Kein i18n** — hartcodierte Strings, Sprachmix DE (Termine, Abwesenheiten) / EN (Programme, Dashboard).
  Portal durchgängig DE.

### 1.7 Bindende Repo-Regeln (AGENTS.md)

1. **Nie ein Custom Field per Deploy anlegen** — in Classic Setup anlegen, dann retrieven
   (`backend/docs/AGENTS.md:1016`). Gilt für neue Felder *und* neue Objekte. Ein **gesundes** Feld
   zu ändern (deploybar) ist erlaubt (Z. 1021–1024).
2. `CustomValidationRule` ist nicht deploybar; die XML-Dateien im Repo brechen jeden Deploy
   (Z. 1160–1166).
3. Permission Sets: **Pflichtfelder dürfen nicht** in `fieldPermissions` stehen (Deploy-Fehler, der
   das ganze Set zurückrollt). `fieldPermissions` für required-Felder → „You cannot deploy to a
   required field".
4. Exception-Klassen müssen auf `Exception` enden.
5. Apex-Tests: `@TestSetup` + **Marker-Feld** statt Vertrauen in Statics (Z. 1122–1151).
   `seeAllData` ist verboten.
6. Nach org-weiten Änderungen **die ganze Suite** laufen lassen (Z. 1112–1115).
7. Kommentare im Backend-Bundle **deutsch** (ae/oe/ue), in Portal-Apex-Klassen **englisch**.

---

## 2. Lücken — was es nicht gibt

| Erwartet | Status |
|---|---|
| `Course` / `CourseWeek` / `ModuleWeek` | gibt es nicht; `Program__c` / `Module__c` ohne Wochenbezug |
| Gruppe / Kohorte / Batch | **gibt es nicht** |
| Gruppenzuordnung Teilnehmer↔Gruppe | **gibt es nicht** |
| Vorlage / Template (persistiert) | **gibt es nicht** |
| Publish-/Freigabemechanismus | **gibt es nicht** |
| Kurswoche als Entität mit Datum | **gibt es nicht** |
| Teilnehmer↔Kurswoche-Zuordnung | **gibt es nicht** (`Learning_Path__c.Estimated_Weeks__c` ist ein Zähler) |
| Coach↔Programm (persistent) | **gibt es nicht** (flüchtiger Client-Seed) |
| Wochenraster / Grid-Kalender | **gibt es nicht** |
| Drag-and-drop-Baustein | **gibt es nicht** |
| Serverseitige Rollenprüfung im Frontend | **gibt es nicht** |
| `AuditEvent__c.Domain__c = 'schedule'` | **gibt es nicht** (restricted Picklist) |
| Portaler Endpunkt für Wochen/Wochenplan | **gibt es nicht** |

---

## 3. Betroffene Dateien und Komponenten

### Neu (Backend-Projekt `backend/`)
```
force-app/main/default/objects/ProgramWeek__c/          NEU
force-app/main/default/objects/WeeklySchedule__c/       NEU
force-app/main/default/objects/ScheduleEntry__c/        NEU
force-app/main/default/objects/ScheduleTemplate__c/     NEU
force-app/main/default/objects/ParticipantGroup__c/     NEU (nur bei F1 = ja)
force-app/main/default/objects/ParticipantGroupMember__c/  NEU (nur bei F1 = ja)
force-app/main/default/objects/TaskCompletion__c/      NEU (K5)
force-app/main/default/objects/Learning_Path__c/fields/Module__c.field-meta.xml   NEU (K6, Lookup)
force-app/main/default/objects/Appointment__c/fields/ScheduleEntry__c.field-meta.xml   NEU (Lookup)
force-app/main/default/classes/ScheduleService.cls              NEU
force-app/main/default/classes/ScheduleTemplateService.cls      NEU
force-app/main/default/classes/SchedulePublishService.cls      NEU
force-app/main/default/classes/ScheduleEntryMaterialisationService.cls  NEU
force-app/main/default/classes/ScheduleServiceTest.cls          NEU
force-app/main/default/classes/ScheduleAccessTest.cls           NEU
force-app/main/default/triggers/ScheduleEntryGuard.trigger      NEU
force-app/main/default/permissionsets/backend_Coach.permissionset-meta.xml  ÄNDERUNG
```

### Neu (Frontend-Bundle `uiBundles/backend` — Staff/Coach)
```
src/api/schedule/scheduleService.ts                NEU
src/api/schedule/scheduleTemplateService.ts        NEU
src/api/schedule/query/*.graphql                   NEU (1 Operation pro Datei)
src/api/schedule/scheduleEditService.ts            NEU (Apex-Transport, Muster appointmentEditService.ts)
src/types/schedule.ts                              NEU
src/components/schedules/ProgramWeeksTab.tsx      NEU (Tab in ProgramDetailPage)
src/components/schedules/WeeklyScheduleEditor.tsx NEU
src/components/schedules/ScheduleEntryDialog.tsx   NEU
src/components/schedules/ScheduleTemplateDialog.tsx NEU
src/components/schedules/WeeklyScheduleGrid.tsx    NEU (Tagesraster Mo–So)
src/components/schedules/*.test.tsx                NEU
src/pages/programs/ProgramDetailPage.tsx          ÄNDERUNG (6. Tab)
src/api/audit/activityProjection.ts               ÄNDERUNG (neue Eventtypen, sonst Default-Deny)
```

### Neu (Frontend-Bundle `uiBundles/frontend` — Teilnehmer)
```
src/pages/WeeklySchedule.tsx                       NEU
src/features/participant/api/weeklyScheduleApi.ts  NEU
src/features/participant/components/WeeklyScheduleView.tsx  NEU
src/routes.tsx                                     ÄNDERUNG (Route /wochenplan + Navigation)
```

### Neu (Portal-Apex, Projekt `frontend/`)
```
force-app/main/default/classes/ParticipantPortalWeeklySchedule.cls   NEU
force-app/main/default/classes/ParticipantPortalWeeklyScheduleTest.cls NEU
force-app/main/default/permissionsets/Participant_Portal_Access.permissionset-meta.xml  ÄNDERUNG
```

### Bestehend, wird gelesen (nicht geändert)
```
backend/.../classes/AppointmentEditService.cls        (Draft-Gate, Whitelist, Audit-Muster)
backend/.../classes/ParticipantPortalSharingService.cls  (Sharing-Muster)
backend/.../classes/StaffIdentity.cls
backend/.../uiBundles/backend/src/components/appointments/ParticipantAppointmentsTab.tsx
backend/.../uiBundles/backend/src/api/appointment/appointmentService.ts
backend/.../uiBundles/backend/src/api/graphqlClient.ts
backend/.../uiBundles/frontend/src/pages/Appointments.tsx
backend/.../uiBundles/frontend/src/features/participant/api/appointmentsApi.ts
```

### Dokumentation (Phase 8)
```
docs/DATA_MODEL.md                                   (Root; Struktur ergänzen)
backend/docs/AGENTS.md                              (Metadaten-Ownership, Namenskonventionen)
backend/docs/activity-coverage.md                    (Domänen-Matrix „Schedule")
backend/docs/ux-walkthrough.md                       (enthält „Keine Wochenübersicht" → aktualisieren)
backend/docs/design-system.md                        (neue UI-Muster)
backend/docs/coach-access.md                         (Coach-Zuordnung)
```

---

## 4. Vorgeschlagenes Datenmodell

### 4.1 Neue Objekte

**`ProgramWeek__c`** — die konkrete Kurswoche (das fehlende Gegenstück zu `DurationWeeks__c`).

| Feld | Typ | Anmerkung |
|---|---|---|
| `Program__c` | Lookup → `Program__c` | required, Restrict |
| `Number__c` | Number(2,0) | required — Wochenindex 1..n |
| `Module__c` | Lookup → `Module__c` | required — die AZAV-Woche (Deck/Agenda-Überschrift) (**K1**) |
| `Title__c` | Text(255) | required — Präsentations-/Themenname (AZAV) |
| `Description__c` | LongTextArea | didaktische Beschreibung der Woche |
| `Status__c` | Picklist restricted | `Draft` (default) / `Active` / `Completed` |

*Kein Startdatum auf diesem Objekt* (**K1**): das Kalenderdatum hängt an der Plan-Instanz
(`WeeklySchedule__c.StartDate__c`), damit dieselbe AZAV-Woche in mehreren Durchläufen nutzbar bleibt.

**`WeeklySchedule__c`** — der Wochenplan einer Kurswoche (die „Instanz").

| Feld | Typ | Anmerkung |
|---|---|---|
| `ProgramWeek__c` | Lookup → `ProgramWeek__c` | required, Restrict |
| `ScopeType__c` | Picklist required | `Course` (Standard) / `Group` / `Individual` (**K4**) |
| `ParticipantGroup__c` | Lookup → `ParticipantGroup__c` | nur bei `ScopeType = Group` |
| `Participant__c` | Lookup → `Participant__c` | nur bei `ScopeType = Individual` |
| `Name__c` | Text(255) | required |
| `StartDate__c` | Date | required — Montag der kalendarischen Woche **dieser Instanz** (**K1**) |
| `EndDate__c` | Date | optional |
| `Status__c` | Picklist restricted | `Draft` (default) / `Published` |
| `PublishedAt__c` | DateTime | |
| `PublishedBy__c` | Lookup → `User` | |
| `AppliedTemplate__c` | Lookup → `ScheduleTemplate__c` | optional — **nur Provenienz, keine Verbindung** |
| `TemplateAppliedAt__c` | DateTime | |
| `DeviationReason__c` | LongTextArea | Abweichung dieser Instanz vom Standard (**K3**) |
| `Notes__c` | LongTextArea | |

**`ScheduleTemplate__c`** — die Vorlage.

| Feld | Typ | Anmerkung |
|---|---|---|
| `Name__c` | Text(255) | required |
| `Description__c` | LongTextArea | |
| `ProgramWeek__c` | Lookup → `ProgramWeek__c` | optional — Vorlage für eine AZAV-Kurswoche (**Regelfall**) |
| `Program__c` | Lookup → `Program__c` | optional — Vorlage für ein ganzes Programm (z. B. wiederkehrende Gruppentermine) |
| `Module__c` | Lookup → `Module__c` | optional — rein fachliche Zuordnung, falls eine Vorlage modulübergreifend gilt |
| `Status__c` | Picklist restricted | `Active` (default) / `Inactive` |

**`ScheduleEntry__c`** — **ein** Entitätstyp für Vorlagen- und Planzeilen (keine Doppelstruktur).

| Feld | Typ | Anmerkung |
|---|---|---|
| `WeeklySchedule__c` | Lookup → `WeeklySchedule__c` | optional (null = Vorlagenzeile) |
| `ScheduleTemplate__c` | Lookup → `ScheduleTemplate__c` | optional (null = Planzeile) |
| `Title__c` | Text(255) | required |
| `Description__c` | LongTextArea | |
| `Type__c` | Picklist required | erweiterbare Aktivitätstypen (siehe 4.4) |
| `EntryKind__c` | Picklist required | `Aktivität` / `Aufgabe` (**K2**) |
| `IsRequired__c` | Checkbox | Pflichtbestandteil des AZAV-Standards (**K2**) |
| `DayOffset__c` | Number(1,0) | required, 0..6 relativ zum Wochenstart |
| `Date__c` | Date | in Planzeilen serverseitig aus `ProgramWeek__c.StartDate__c + DayOffset__c` gesetzt |
| `StartTime__c` | Time | optional |
| `EndTime__c` | Time | optional |
| `DurationMinutes__c` | Number(4,0) | optional — Alternative zu `EndTime__c` |
| `TargetType__c` | Picklist required | `Course` / `Group` / `Individual` |
| `ParticipantGroup__c` | Lookup → `ParticipantGroup__c` | nur bei `TargetType = Group` |
| `Participant__c` | Lookup → `Participant__c` | nur bei `TargetType = Individual` |
| `Coach_Profile__c` | Lookup → `Coach_Profile__c` | optional — **fachliche** Coach-Entität (nicht User) |
| `Location__c` | Picklist | optional (Discord/Zoom/Teams/External) |
| `MeetingLink__c` | Url | |
| `SourceTemplateEntry__c` | Lookup → `ScheduleEntry__c` | optional — Herkunft: aus welcher Vorlagenzeile kopiert |
| `IsCustomized__c` | Checkbox | default false — „nachträglich angepasst" |
| `Order__c` | Number(3,0) | Reihenfolge innerhalb des Tages |
| `DeviationReason__c` | LongTextArea | Abweichung dieses Eintrags vom Standard (**K3**) |
| `Notes__c` | LongTextArea | |

**`ParticipantGroup__c` / `ParticipantGroupMember__c`** — **nur falls F1 = ja**.
`ParticipantGroup__c`: `Name__c` (required), `Program__c` (optional), `Coach_Profile__c` (optional),
`Description__c`. `ParticipantGroupMember__c`: `ParticipantGroup__c` (required, Restrict),
`Participant__c` (required, Restrict), `Order__c`.
*Alternative, falls 1:1 bestätigt:* statt des Join-Objekts ein Lookup `Participant__c.ParticipantGroup__c`.

**`TaskCompletion__c`** — der Erledigt-Status pro Teilnehmer (**K5**).

| Feld | Typ | Anmerkung |
|---|---|---|
| `ScheduleEntry__c` | Lookup → `ScheduleEntry__c` | required, Restrict |
| `Participant__c` | Lookup → `Participant__c` | required, Restrict |
| `Status__c` | Picklist required | `Offen` (default) / `Erfüllt` / `Entfällt` |
| `CompletedAt__c` | DateTime | |
| `DeviationReason__c` | LongTextArea | „vorher schon erfüllt (Vorkenntnisse)" o. ä. (**K3/K5**) |

**Erweiterung am Lernpfad:** `Learning_Path__c.Module__c` — Lookup → `Module__c`, optional (**K6**).
Beseitigt die belegte Inkonsistenz zwischen `docs/DATA_MODEL.md` / `backend/docs/AGENTS.md` (dort ist
die Kante `Learning_Path__c → Module__c` gezeichnet) und dem tatsächlichen Metadatum, und macht die
„Lernzeile" (fachliche Seite) ansprechbar.

**Erweiterung am Termin:** `Appointment__c.ScheduleEntry__c` — Lookup → `ScheduleEntry__c`, optional,
SetNull. Richtung: **Termin → Planzeile**. Nur additive Erweiterung; die Termin-Semantik
(1 Teilnehmer, Status, Anwesenheit) bleibt unangetastet.

### 4.2 Beziehung zu den bestehenden Terminen (die zentrale Antwort)

```
Program__c  (Kurs)
 └── Module__c                    (Wochenmodul-Definition, unverändert)
      └── ProgramWeek__c          (konkrete Kurswoche, NEU)
           └── WeeklySchedule__c  (Wochenplan-Instanz, NEU)
                └── ScheduleEntry__c   (Planzeile, NEU)
                     └─(optional, materialisiert)─ Appointment__c   [Appointment__c.ScheduleEntry__c]

ScheduleTemplate__c (Vorlage, NEU)
 └── ScheduleEntry__c   (Vorlagenzeile: WeeklySchedule__c = null, ScheduleTemplate__c ≠ null)
```

**Regeln, die „zwei Wahrheiten" verhindern:**

1. **Zeit führt die Planzeile.** `ScheduleEntry__c.StartTime__c`/`EndTime__c` (bzw. `Date__c`) sind die
   einzige Zeitquelle des Wochenplans. `Appointment__c.StartTime__c` ist beim Materialisieren eine
   **Kopie**; jede Plan-Änderung schreibt den Termin mit (serverseitig, transaktional). Es gibt kein
   „von Hand am Termin verschoben, Plan zeigt noch den alten Stand".
2. **Status und Anwesenheit führt der Termin.** `Appointment__c.Status__c`, `ConfirmedAt__c`,
   `CompletedAt__c`, `CancellationReason__c` bleiben ausschließlich am Termin.
3. **Ein Termin hat höchstens eine Planzeile** (`Appointment__c.ScheduleEntry__c`, unique durch
   Logik). Eine Planzeile mit `TargetType = Individual` hat höchstens einen Termin.
4. **Kurs- und Gruppeneinträge erzeugen bewusst keinen Termin.** Sonst entstünde je Eintrag ein
   Termin pro Teilnehmer (N-Fan-out) — und `Appointment__c.Participant__c` wäre für
   kursweite Aktivitäten semantisch falsch. Kurs-/Gruppeneinträge sind **Planaktivitäten**
   (Selbstlernphase, Workshop, Kick-off) ohne Teilnehmer- und ohne Anwesenheitsbezug.
5. **Die Teilnehmer-Wochenansicht ist die Vereinigung zweier klar getrennter Ebenen:**
   Planzeilen der Woche (nach Zielgruppe gefiltert) ∪ eigene `Appointment__c` der Woche.
   Eine materialisierte Planzeile erscheint **nicht doppelt** (sie wird über ihre Planzeile
   ausgegeben, nicht zusätzlich über den Termin).
6. **Bestandstermine ohne Planbezug** bleiben sichtbar und sind normale Termine — kein Migrations-
   oder Doppelpflege-Bedarf.
7. **Geltungsbereich einer Kurswoche (K4):** Zu einer Kurswoche können mehrere Plan-Instanzen
   existieren — der Standard (`ScopeType = Course`) und ggf. abweichende Instanzen für eine Gruppe
   oder einen Teilnehmer. In der Teilnehmeransicht gilt: **individuelle Instanz vor Gruppeninstanz
   vor Standard**; eine abweichende Instanz überschreibt nur die Einträge, die sie selbst führt.
8. **Lernpfad als Anker (K6):** `Learning_Path__c.Module__c` verbindet den Teilnehmer mit der
   AZAV-Woche. Daraus folgt die „aktuelle relevante Woche" der Teilnehmeransicht:
   `Learning_Path__c` (aktueller Eintrag, `Status = In Progress`) → `Module__c` → `ProgramWeek__c` →
   `WeeklySchedule__c` (passender Geltungsbereich) → `ScheduleEntry__c` (+ `TaskCompletion__c` für
   den Erledigt-Status).

### 4.3 Vorlage vs. konkreter Wochenplan (Kopierlogik)

- **Deep Copy beim Anwenden.** `ScheduleTemplateService.apply(template, programWeek)` liest die
  Vorlagenzeilen und erzeugt je eine `ScheduleEntry__c` mit `WeeklySchedule__c = programWeek.schedule`,
  `ScheduleTemplate__c = null`, `SourceTemplateEntry__c = <Vorlagenzeile>`, `IsCustomized__c = false`.
- **Keine Live-Beziehung.** `WeeklySchedule__c.AppliedTemplate__c` ist ein reiner Provenienzverweis.
  Eine spätere Änderung an der Vorlage kann einen bereits angewendeten Plan **nicht** erreichen.
  → Anforderung 9 ist **strukturell** erfüllt, nicht nur konventionell.
- **Angepasste Zeilen** werden erkannt über `IsCustomized__c` (gesetzt, sobald Titel, Zeit, Tag,
  Zielgruppe oder Coach nach dem Anwenden geändert werden) und über `SourceTemplateEntry__c`
  (Herkunft sichtbar). Zeilen ohne Herkunft sind „eigene Einträge".
- **Erneutes Anwenden** ist ein bewusster, benannter Schritt („Vorlage erneut anwenden" → Rückfrage,
  welche Zeilen ersetzt werden). Kein automatischer Sync.
- **Anwendungsbereich (K1/0b):** Vorlagen binden an `ProgramWeek__c` (AZAV-Kurswoche — Regelfall)
  oder an `Program__c` (gesamter Kurs, für wiederkehrende Muster wie die wöchentlichen
  Gruppentermine). Beide nutzen denselben Deep-Copy-Mechanismus; das Kurs-Template ist nur ein
  Template mit Zielbereich „Programm". Begründung der Empfehlung in Abschnitt 0b.

### 4.4 Typisierung der Aktivitätstypen

Vorschlag: **eine** fachliche Typenliste auf `ScheduleEntry__c.Type__c`
(erweiterbar, `restricted=false` wäre ideal — die Picklist-Werte sind dann ohne Deploy änderbar):

`Einzelcoaching`, `Gruppencoaching`, `Feedback`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`,
`Projektarbeit`, `Sonstiges`.

- `Appointment__c.Type__c` (restricted) wird um die **fehlenden fachlichen** Werte erweitert
  (`Einzelcoaching`, `Gruppencoaching`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`,
  `Projektarbeit`); `Coaching` bleibt als Sammelwert erhalten, `Behörde`/`Praktikum` bleiben
  fachlich bestehen.
- **Mapping-Regel** (in `ScheduleEntryMaterialisationService` dokumentiert): materialisierte Termine
  übernehmen den Typ 1:1; ist der Zielwert auf `Appointment__c.Type__c` nicht vorhanden, wird der
  Materialisationsversuch mit `422 TYPE_NOT_MATERIALISABLE` abgelehnt — kein stiller Fallback.
- Keine Custom Metadata Types: Das Repo hat **keine** CMDTs, und ein neues CMDT wäre ein neues
  Custom-Objekt mit Custom-Feldern → fällt unter die Setup-Pflicht (AGENTS.md Z. 1016).

### 4.5 Veröffentlichungsmechanismus (neu, minimal)

Es gibt keinen Publish-Mechanismus. Vorschlag, bewusst klein:

- `WeeklySchedule__c.Status__c` = `Draft` / `Published` (+ `PublishedAt__c`, `PublishedBy__c`).
- **Teilnehmersehen nur `Published`** (serverseitige Filterung im Portal-Endpunkt).
- `ProgramWeek__c.Status__c` = `Draft` / `Active` / `Completed` steuert, ob die Woche im Portal
  überhaupt auftaucht.
- Veröffentlichen ist ein **benannter, serverseitiger Schritt** (`SchedulePublishService`), mit
  Vorprüfung („Plan vollständig?"), Audit-Event `schedule.published` und idempotentem Verhalten.
- **Offen (F5):** Was passiert mit Änderungen an einem bereits veröffentlichten Plan? Vorschlag:
  Änderungen bleiben erhalten, werden aber erst nach erneuter Veröffentlichung für Teilnehmende
  sichtbar (`PublishedAt`-Snapshot). Das muss fachlich bestätigt werden.

---

## 5. Migrationsweg

**Bestandsdaten: keine Migration.** Alle neuen Objekte sind additiv; `Appointment__c` wird nur um ein
optionales Lookup ergänzt. Bestehende Termine bleiben gültig und erscheinen unverändert in der
Wochenansicht.

**Metadaten: Setup-Detour, kein Deploy.** Wegen AGENTS.md Z. 1016 (custom field per Deploy erscheint
nicht im Runtime-Schema) gilt für **alle** neuen Objekte und Felder:

1. Objekte in Classic Setup anlegen (Plural, Name-Feld, Sharing, `enableHistory` nach Bedarf).
2. Felder in Setup anlegen (Typ, required, Picklist-Werte, `deleteConstraint`).
3. `sf project retrieve start` → XML landet in `backend/force-app/main/default/objects/…` (byte-identisch
   zu Setup, so der Nachweis in AGENTS.md Z. 1012–1014).
4. **Erst danach** Änderungen an bestehenden, gesunden Feldern deploybar: `Appointment__c.Type__c`
   (Werte ergänzen), `Appointment__c.ScheduleEntry__c` (neues Feld → **muss** über Setup),
   `AuditEvent__c.Domain__c` (Wert `schedule` ergänzen; `restricted` beachten).
5. `AuditEvent__c.Domain__c` und `Action__c` sind restricted Picklists — die Ergänzung ist eine
   **Feldänderung** (deploybar), aber vor dem Deploy gegen die Org prüfen.
6. Permission Sets (`backend_Coach`, `Participant_Portal_Access`) sind **im Repo** und deploybar —
   `objectPermissions`/`fieldPermissions` ergänzen, **Pflichtfelder auslassen**.
7. Keine `CustomValidationRule`-XML im Repo (bricht jeden Deploy) → Validierungen entweder im
   Apex-Service/Trigger oder in Classic Setup + `g1-manual-checklist.md`.

**Reihenfolge:** Setup → Retrieve → Commit der Metadaten → Apex → Rechte → UI.

---

## 6. Berechtigungslogik

### 6.1 Rollen (bestehende Mechanismen, keine neuen Rollen)

| Rolle | Bestehende Grundlage | Neue Rechte |
|---|---|---|
| Staff | `backend_Access` + `backend_Coach` | CRUD auf den neuen Objekten |
| Coach | `backend_Coach` (mit `viewAllRecords` auf 12 Objekten) | CRUD auf den neuen Objekten, **fachlich** auf zugeordnete Pläne begrenzt |
| Teilnehmende | `Participant_Portal_Access` (read-only, `viewAllRecords=false`) | read auf den neuen Objekten + `classAccesses` für den neuen Portal-Endpunkt |

### 6.2 Serverseitige Prüfung (Pflicht — die Oberfläche zählt nicht)

- **Coach-Zuordnung ist heute nicht persistent** (`programCoachSeed`, `programService.ts:132`).
  Für „Coaches dürfen die für sie zugeordneten Wochenpläne bearbeiten" braucht es einen persistenten,
  serverseitig prüfbaren Bezug → **`ProgramCoach__c` (Program__c + Coach_Profile__c)** als eigener
  Baustein (F7). Der flüchtige Seed ist dann zu ersetzen (Bestandskorrektur, additiv).
- Prüfmuster: `without sharing` + explizite Abfrage der eigenen Zuordnungen + harte Prüfung, dass der
  Zielplan zum eigenen Programm gehört. **Kein** Vertrauen in `canManage`.
- **Teilnehmer-Isolation:** Der Portal-Endpunkt löst den Teilnehmer über
  `UserInfo.getUserId()` → `Contact` → `Participant__c` und filtert **serverseitig**:
  - **Plan-Instanzen (K4):** individuelle Instanz (`ScopeType = Individual`, `Participant__c` = der
    Teilnehmer) → Gruppeninstanz (`ScopeType = Group`, Teilnehmer ist Mitglied) → Standardinstanz
    (`ScopeType = Course`, Teilnehmer gehört zum Programm). Die individuelle Instanz überschreibt
    nur die Einträge, die sie selbst führt; der Rest bleibt sichtbar.
  - **Einträge (Zielgruppe):** `TargetType = Course` → Teilnehmer gehört zum Programm;
    `TargetType = Group` → Teilnehmer ist in der Gruppe; `TargetType = Individual` →
    `Participant__c = :participantId`.
  **Ein Teilnehmer darf nie Zeilen mit fremdem `Participant__c` sehen** — auch nicht indirekt über
  eine Gruppenzuordnung, die er nicht hat.
- **Gruppen-Einträge und Row-Level:** Kurs-/Gruppeneinträge passen nicht in das bestehende
  Sharing-Modell (das kennt nur `Participant__c`-gebundene Objekte). Deshalb: **keine** Sharing-Rows für
  Planobjekte, sondern serverseitige Filterung im Portal-Endpunkt (`without sharing` + whitelisted
  Response). `Participant_Portal_Access` erhält read ohne `viewAllRecords`.
  → Risiko: ein Fehler im Filter leakt. Deshalb ist der Isolationstest ein **hartes**
  Abnahmekriterium (siehe Abschnitt 11), und der Filter wird zentral in einer Methode gebaut,
  nicht verteilt.
- **Staff/Coach-Lesen:** Coaches dürfen Pläne der Programme lesen, für die sie eingeteilt sind; Staff
  alle. Umsetzung in `ScheduleService` über die Coach-Zuordnung.

### 6.3 Was die Oberfläche nur darf

- `canManage` bleibt ein reiner **UI**-Schalter (so wie heute) und ist **keine** Sicherheitsgrenze.
- Aktionen, die der Server ablehnt (z. B. Coach darf fremden Plan nicht ändern → 403), müssen im UI
  sauber als Fehler behandelt werden, nicht still verschwinden.

---

## 7. Backend / API

### 7.1 Neue Apex-Klassen (Projekt `backend/`, Service-Layer-Muster wie `AppointmentEditService`)

| Klasse | Zweck |
|---|---|
| `ScheduleService` | CRUD für `WeeklySchedule__c`/`ScheduleEntry__c`, Geschäftsregeln, Zielgruppenprüfung, Coach-Zuordnungsprüfung, Audit im selben Commit (Savepoint + Rollback) |
| `ScheduleTemplateService` | `apply()` = Deep Copy, `listTemplates()`, `preview()` |
| `SchedulePublishService` | `publish()`/`unpublish()` mit Vorprüfung + Audit |
| `ScheduleEntryMaterialisationService` | Anlegen/Aktualisieren des `Appointment__c` aus einer Planzeile (serverseitig, transaktional), Typ-Mapping, Draft-Status |
| `ScheduleEntryGuard.trigger` | before insert/update: genau eine Eltern-Zuordnung, `Date__c` aus `ProgramWeek__c` + `DayOffset__c`, `IsCustomized__c`-Pflege, Plausibilität (Start < Ende, Zielgruppe ↔ Teilnehmer/Gruppe) |
| `ProgramCoachService` | persistente Coach↔Programm-Zuordnung (F7) |

**Einstiegspunkte (Apex REST, je Endpunkt eine Klasse, `global with sharing` für Staff-Pfade):**
- `/services/apexrest/schedule/*` — Lesen/Bearbeiten (Staff/Coach)
- `/services/apexrest/schedule-template/*` — Vorlagen
- `/services/apexrest/schedule-publish/*` — Veröffentlichen
- `/services/apexrest/participant-portal/me/weekly-schedule` (Projekt `frontend/`) — Teilnehmer-Lesesicht

**Fehlerformat** wie im Bestand: eigene Exception-Klasse pro Domäne mit `statusCode` + `code`
(`BAD_REQUEST`, `SCHEDULE_NOT_FOUND`, `NOT_ASSIGNED`, `ENTRY_TARGET_INVALID`, `TEMPLATE_NOT_FOUND`,
`TYPE_NOT_MATERIALISABLE`, `NOT_EDITABLE`, `AUDIT_FAILED`).

### 7.2 Frontend-Transport (Backend-Bundle)

- Lesen: UI-API-GraphQL wie der Rest (`src/api/schedule/query/*.graphql`, **eine Operation pro Datei**,
  `?raw`-Import) oder Apex REST. Empfehlung: **Apex REST** für alle Schreibpfade (analog
  `appointmentEditService.ts` — Draft-Gate, Feld-Whitelist, typisierte Fehler) und GraphQL für reine
  Listenabfragen.
- Typen: `src/types/schedule.ts` mit `camelCase`, `ScheduleEntryType`-Union + `SCHEDULE_ENTRY_TYPE_LABELS`,
  `ScheduleTargetType`, `WeeklyScheduleStatus`, `ScheduleEntry`, `ScheduleEntryInput`, `ScheduleFilters`.

### 7.3 Materialisation — Regeln

- Ein `ScheduleEntry__c` mit `TargetType = Individual` → genau ein `Appointment__c` (Status startet
  **`Draft`**, wie `CreateAppointment.graphql` es bereits fest verdrahtet), `Coach__c` = `Coach_Profile__c.User__c`,
  `ScheduleEntry__c` = Verweis. Materialisation läuft **serverseitig** (kein Client-Round-Trip pro Teilnehmer).
- Terminänderungen aus dem Plan laufen über **dieselbe** Servicelogik wie der bestehende
  Bearbeitungspfad → das D1-Draft-Gate gilt auch hier.
- **Offen (F8):** Was passiert, wenn der Termin bereits `Confirmed` ist? Empfehlung: Plan-Änderung an
  Zeit/Titel erlaubt, aber der Terminstatus bleibt unangetastet und die Abweichung wird im Audit
  protokolliert; oder 409. Fachlich entscheiden (Wechselwirkung mit D1/D2).

---

## 8. Staff-/Coach-Oberfläche

**Einordnung:** `ProgramDetailPage` hat heute 5 Tabs (`overview`, `modules`, `participants`, `coaches`,
`settings`). Der Wochenplan gehört fachlich zum **Programm** (Kurs → Wochen → Plan), nicht zum
Teilnehmer. Deshalb:

- **Neuer Tab „Wochenpläne"** in `ProgramDetailPage` → `ProgramWeeksTab`:
  Liste der `ProgramWeek__c` des Programms (Nummer, Startdatum, Modul, Status, Plan-Status),
  „Kurswoche anlegen", „Wochenplan anlegen".
- **Route** `/programs/:programId/weeks/:weekNumber/plan` → `WeeklyScheduleEditor`
  (tiefer Link,teilbar, Back-Navigation).
- **`WeeklyScheduleEditor`:**
  - Kopf: Kurswoche, Wochen-Datumspan, Status, Aktionen „Vorlage anwenden", „Veröffentlichen",
    „Zurück zu den Wochen".
  - **Tagesraster** Mo–So (7 Spalten, Desktop) / gestapelte Tagesliste (Mobil) — `WeeklyScheduleGrid`.
  - **Eintragstypen** unterscheidbar: Kurs (Kurs-Symbol), Gruppe (Gruppen-Symbol), Individuell
    (Personen-Symbol) — Textlabel zusätzlich zum Symbol (nicht nur Farbe, Barrierefreiheit).
  - **Eintrag** zeigt: Typ, Titel, Zeit, Zielgruppe, Coach, Ort/Link, Herkunftsbadge
    („aus Vorlage" / „angepasst"), bei materialisiertem Termin der Terminstatus.
- **`ScheduleEntryDialog`** (Erstellen/Bearbeiten) — Formular, keine Drag-only-Bearbeitung:
  Titel, Beschreibung, Typ, Tag (`DayOffset__c` als Wochentag-Auswahl), Datum (bei `ProgramWeek__c`
  vorbelegt, read-only), Start/Ende **oder** Dauer, Zielgruppe (Kurs/Gruppe/Teilnehmer) mit
  abhängiger Auswahl (Gruppenliste bzw. Teilnehmerliste), Coach (aus `listAssignableUsers()` bzw.
  `Coach_Profile__c`), Ort/Link, Notizen. Validierung vor dem Submit + serverseitige Fehlerabbildung.
- **Tastaturbedienung:** alle Aktionen als fokussierbare Buttons; Raster mit
  `role="grid"`/`gridcell` bzw. Listen-Semantik, Pfeiltasten optional; Dialoge mit Radix-Fokusfalle
  (Radix Dialog vorhanden); Monats-/Wochenwechsel als Buttons mit `aria-label`.
- **Zustände:** `EmptyState` (keine Woche / kein Plan / leere Woche), `Skeleton` (Laden),
  `StatusAlert` (Fehler) — Muster aus `ParticipantAppointmentsTab.tsx`.
- **Serverseitig gesichert:** jede Aktion prüft die Coach-/Staff-Zuordnung; 403 → verständliche
  Meldung, kein stilles Verschwinden.

---

## 9. Teilnehmeransicht (Portal-Bundle)

- **Route** `/wochenplan` in `uiBundles/frontend/src/routes.tsx` + Navigationslink
  (Portal ist durchgängig DE, `Appointments.tsx` ist die Referenz für Labels).
- **Standard:** die aktuelle relevante Woche = die Kurswoche, in der der Teilnehmer laut Lernpfad steht
  (`Learning_Path__c` mit `Status = In Progress` → `Module__c` → `ProgramWeek__c` → passende
  `WeeklySchedule__c` nach Geltungsbereich, **K6/K4**); ersatzweise die nächste kommende;
  Wochenwechsel über Chevron-Buttons (Muster aus `ParticipantAppointmentsTab.tsx:292–303`, `date-fns`
  ist im Portal vorhanden).
- **Zusammensetzung der Woche:** individuelle Instanz → Gruppeninstanz → Kursstandard; dazu die
  eigenen `Appointment__c` der Woche. Jeder Eintrag zeigt seine Herkunft (Standard / Gruppe /
  individuell) und — bei Aufgaben — den Erledigt-Status aus `TaskCompletion__c`.
- **Darstellung:** Tagesraster (Desktop/Tablet) mit Spalten Mo–So, Zeitangaben, unterscheidbare
  Einträge für Kurs/Gruppe/Individuell; auf Mobil gestapelte Tagesabschnitte.
- **Interaktiv:** Klick auf einen Eintrag öffnet einen Detail-Dialog (Radix Dialog, im Portal vorhanden)
  mit Typ, Titel, Zeit, Ort/Link, Coach-Name, Zielgruppe-Bezeichnung — **keine** Bearbeitung.
- **Nur relevante Einträge:** die Filterung ist **serverseitig** (Abschnitt 6.2). Die UI zeigt
  keine fremden Termine; die Herkunft der Zielgruppe wird als Label angezeigt („Für alle im Kurs",
  „Für deine Gruppe", „Für dich").
- **Zustände:** Laden (Skeleton), leer (EmptyState: „Diese Woche stehen keine Termine an"), Fehler
  (verständliche Meldung + Wiederholen), **403/401** (kein Portalzugang).
- **Tastatur:** Raster-Einträge sind fokussierbar (`button`/`tabindex`), Dialog mit Fokusfalle,
  Screenreader-Labels (`aria-label` je Eintrag: „Gruppencoaching, Titel, 14:00 bis 15:00 Uhr").
- **Datenschutz:** Der Portal-Bundle bekommt **keinen** Schreibpfad. `Participant_Portal_Access`
  bleibt read-only.

---

## 10. Activity-Tracking

**Keine zweite Tracking-Lösung.** Nutzung von `AuditEvent__c` (+ `AuditOutbox__c` für Zuverlässigkeit,
falls der bestehende Mechanismus das verlangt).

**Neue Eventtypen** (Format `<domäne>.<aktion>`, wie im Bestand):

| Event | `Action__c` | `Domain__c` | Erzeugung |
|---|---|---|---|
| `schedule.created` | `created` | `schedule` | `ScheduleService` |
| `schedule.template_applied` | `created` | `schedule` | `ScheduleTemplateService.apply()` |
| `schedule.entry_created` | `entry_created` | `schedule` | `ScheduleService` |
| `schedule.entry_updated` | `entry_updated` | `schedule` | `ScheduleService` |
| `schedule.entry_deleted` | `entry_deleted` | `schedule` | `ScheduleService` |
| `schedule.entry_assigned` | `assigned` | `schedule` | Zuweisung Zielgruppe/Teilnehmer |
| `schedule.published` | `updated` | `schedule` | `SchedulePublishService` |

- `Domain__c` ist **restricted** → Wert `schedule` muss ergänzt werden (Setup/Deploy-Feldänderung).
- `Action__c` enthält `entry_created`, `entry_updated`, `entry_deleted`, `assigned`, `created`,
  `updated` bereits → **keine** Picklist-Erweiterung nötig.
- `EventType__c` Text(80), `SubjectType__c` = `ScheduleEntry__c`/`WeeklySchedule__c`, `SubjectId__c`,
  `ParticipantId__c` bei Individual-Einträgen, `Visibility__c` = `staff` (Planereignisse) bzw.
  `participant` bei Veröffentlichung, `Sensitivity__c` = `normal`, `CorrelationId__c` = Request-Korrelation.
- **Serverseitig und transaktional** (Muster `AppointmentEditService.cls:507`, Savepoint + Rollback →
  `AUDIT_FAILED`), nicht clientseitig.
- **Projection:** `src/api/audit/activityProjection.ts` (~50 Regeln, **Default-Deny**) → neue
  Eventtypen eintragen, sonst sind sie im Stream unsichtbar. Kategorie/Audience zuordnen.
- **`backend/docs/activity-coverage.md`**: neue Domänenzeile „Schedule" mit Event-/Audience-/Correlation-/
  Deep-Link-Spalten.

---

## 11. Tests

### 11.1 Apex (Projekt `backend/`)

`ScheduleServiceTest`, `ScheduleAccessTest`, `ParticipantPortalWeeklyScheduleTest` (Projekt `frontend/`):

1. Wochenplan anlegen; 2. Vorlage anwenden; 3. **Unabhängige Bearbeitung einer instanziierten
Vorlage** (Vorlage ändern → Plan unverändert; Plan ändern → Vorlage unverändert); 4. kursweite Zeile;
5. Gruppenzeile; 6. individuelle Zeile; 7. Teilnehmerfilter (nur eigene + eigene Gruppe + Kurs);
8. **Schutz vor Zugriff auf Zeilen anderer Teilnehmer**; 9. Coach-Zuordnungsprüfung (403);
10. Staff darf alles; 11. Veröffentlichen + Teilnehmersichtbarkeit (Draft unsichtbar, Published sichtbar);
12. Materialisation: Typ-Mapping, Draft-Start, `Appointment__c.ScheduleEntry__c` gesetzt;
13. `start < end`, Zielgruppe-Plausibilität, genau eine Eltern-Zuordnung;
14. **Geltungsbereich (K4):** individuelle Instanz überschreibt nur eigene Einträge, Standard bleibt
    sichtbar; Gruppeninstanz nur für Mitglieder;
15. **Aufgaben/Erledigt (K2/K5):** `EntryKind__c` trennt Aufgabe vs. Termin; `TaskCompletion__c`
    setzt `Erfüllt` mit Zeitstempel und Grund; „vorher schon erfüllt" abbildbar;
16. **Abweichungsbegründung (K3):** `DeviationReason__c` auf Instanz und Eintrag wird erzwungen,
    wenn eine individuelle Instanz ohne Begründung angelegt wird;
17. **Regression**: bestehender Termin-Workflow (`AppointmentEditService`, `Confirm`/`Complete`/`Cancel`/
    `Reschedule`) unverändert; 18. `ProgramWeek__c`/`Module__c`/`Appointment__c` unverändert.
`@TestSetup` + **Marker-Feld** (AGENTS.md Z. 1122–1151), `seeAllData` verboten.

### 11.2 Frontend Backend-Bundle (Vitest + RTL)

`WeeklyScheduleEditor.test.tsx`, `ScheduleEntryDialog.test.tsx`, `WeeklyScheduleGrid.test.tsx`,
`ProgramWeeksTab.test.tsx`: anlegen/bearbeiten/entfernen; Zielgruppenwechsel; Validierung;
**Tastaturbedienung der Hauptaktionen** (Enter/Space/Escape, Fokusreihenfolge); Loading-, Empty-,
Error-State; serverseitige 403/409-Fehler werden angezeigt; `activityProjection`-Test für die neuen
Eventtypen.

### 11.3 Frontend Portal-Bundle (Vitest + RTL)

`weeklyScheduleApi.test.ts` (Fehlercodes, read-only), `WeeklyScheduleView.test.tsx`:
Tagesraster; nur relevante Einträge; Wochenwechsel; leere Woche; Loading-/Error-State;
**mobile Darstellung** (Viewport-/Klassen-Assertions); Tastaturbedienung; kein Schreibpfad vorhanden.

### 11.4 E2E (Playwright)

Backend-Bundle `e2e/`: Staff-Editor-Flow (Woche → Plan → Vorlage anwenden → Eintrag anlegen →
veröffentlichen) und **Regression des bestehenden Termin-Flows** (`e2e/core-flows.spec.ts`).
Portal-Bundle `e2e/`: Portal-Wochenansicht (angemeldet) + Mobil-Viewport.

### 11.5 Läufe

`npx vitest run` in **beiden** Bundles, `npm run build`, Lint. Nach org-weiten Änderungen die ganze
Suite (AGENTS.md Z. 1112–1115).

---

## 12. Offene fachliche Fragen (bewusst nicht versteckt entschieden)

| # | Frage | Empfehlung / Blockiert |
|---|---|---|
| **F1** | **Gibt es Gruppen/Kohorten?** Woher kommen sie, wer pflegt sie, wie werden Teilnehmer zugeordnet? | **Größte Lücke.** Ohne Antwort kein Zieltyp „Gruppe" und keine Teilnehmerfilterung. Vorschlag: `ParticipantGroup__c` + `ParticipantGroupMember__c`, programmbezogen. |
| **F2** | ~~Was ist eine „Kurswoche" genau?~~ **Aus dem Fachgespräch geklärt (K1):** `ProgramWeek__c` = AZAV-Themenebene, Kalenderdatum an der Plan-Instanz. Offen bleibt nur: | Teilnehmer→Woche über `Learning_Path__c` (K6, Empfehlung) oder rein über `Participant__c.Program__c` + Datum? |
| **F3** | Gibt es mehrere Durchläufe desselben Programms (Kohorten mit je eigenem Startdatum)? | Offen. Der Entwurf trägt es bereits: je Durchlauf eine `WeeklySchedule__c` mit eigenem `StartDate__c` (K1) — eine eigene Durchlauf-Entität ist erst nötig, wenn Durchläufe auch Teilnehmer-/Gruppenlisten tragen. |
| **F4** | Sollen Kurs-/Gruppeneinträge je Teilnehmer materialisiert werden (N Termine)? | **Empfehlung: nein** — Planaktivität ohne Termin (sonst N-Fan-out und `Participant__c` required). |
| **F5** | Was genau wird veröffentlicht, und was gilt für Änderungen nach der Veröffentlichung? | Vorschlag: `Status__c` Draft/Published + Snapshot-Semantik (`PublishedAt__c`). |
| **F6** | Vorlagen: pro Modul, pro Programm oder generisch? Wer darf sie pflegen? | Vorschlag: optional an `Module__c` gebunden, sonst generisch; Pflege = Staff. |
| **F7** | Welcher Coach darf welchen Plan bearbeiten? | **Serverseitig nicht prüfbar**, weil die Coach↔Programm-Zuordnung nur ein Browser-Seed ist. Vorschlag: `ProgramCoach__c` persistent. |
| **F8** | Was passiert, wenn ein Plan-Eintrag mit **bestätigtem** Termin verschoben/geändert wird? | Wechselwirkung mit D1 (Draft-Gate) und D2 (Kollisionsschutz). Vorschlag: 409 oder Status-Reset mit Audit — fachlich entscheiden. |
| **F9** | Welche Aktivitätstypen sind final? Verhältnis zu `Appointment__c.Type__c`? | Vorschlag in 4.4, `Behörde`/`Praktikum` beibehalten. |
| **F10** | Soll `Program__c` ein Start-/Enddatum bekommen (heute nur `DurationWeeks__c`)? | Folgefrage aus F2. |
| **F11** | AZAV-Dokumentationspflichten: welche Felder sind fachlich nötig (Methodik, Anwesenheitsnachweis, Ort)? | Aus dem Repo **nicht** belegbar → Modell erweiterbar bauen, offene Punkte dokumentieren. |
| **F12** | Soll der Termin-Editor (`AppointmentFormDialog`) den Wochenplan berücksichtigen (Termin in eine Woche einordnen)? | Vorschlag: ja, als optionaler Verweis, ohne D1/D2 zu umgehen. |
| **F13** | **Aufgaben-Erledigung:** Ist `TaskCompletion__c` (K5) v1 oder v2? Und sind „Todos und Tasks" wirklich ohne Termin? | Empfehlung **v1**: „Lernzeile schon als erfüllt" (fachliche Seite) ist sonst nicht abbildbar, und die Entität nachträglich zu ergänzen ist teurer. `EntryKind__c` trennt Aufgabe vs. Termin. |
| **F14** | **Vorlagenumfang:** Wochen-Template (pro AZAV-Woche) oder Kurs-Template (gesamte Dauer)? | Empfehlung in 0b: Wochen-Templates als Regel + optionales Kurs-Template für wiederkehrende Gruppentermine. **Fachliche Bestätigung nötig.** |
| **F15** | **Export/Baseline** (Sam: „Export-Funktion im Plan berücksichtigt", „Baseline finden") | Das Datenmodell trägt sie (K3/K4 + `AuditEvent__c.Changes__c`). Soll der Export **in v1** mitgeliefert werden oder erst v2? |

---

## 13. Schrittweiser Implementierungsplan

### Phase 0 — Entscheidungen (kein Code)
1. F1–F12 klären; mindestens F1, F2, F4, F5, F7 sind **Voraussetzung** für Phase 1.
2. Dieses Plan-Dokument freigeben lassen; Entscheidungen in `docs/DATA_MODEL.md` und
   `backend/docs/AGENTS.md` (Namenskonvention) festhalten.

> **Die ausführbare Aufteilung in kleine Schritte steht in
> `2026-10-21-wochenplan-schritte.md`** (Schrittkatalog S0.1–S32 mit Abhängigkeiten,
> Verifikation und Commit-Grenzen). Der Setup-Vertrag für die Infra steht in
> `2026-10-21-wochenplan-feldvertrag.md`.

### Phase 0b — Feldvertrag abstimmen (Infra baut die Objekte)
- Abschnitt 4 (Stand nach 0b) ist der **Feldvertrag**: Feldnamen, Typen, required, Picklist-Werte,
  `deleteConstraint`. Die Objekte werden in Classic Setup angelegt (**kein Deploy**, AGENTS.md Z. 1016) und
  retrievet sie; ich baue die Verbraucherseite (Apex, UI, Tests) gegen diesen Vertrag.
- Vor dem Anlegen abstimmen: F13 (Erledigt-Semantik in v1?), F14 (Vorlagenumfang), F5 (Publish),
  F1 (Gruppen), F6 (Vorlagenbindung an `ProgramWeek__c`).
- Die Infra liefert den ersten lauffähigen Stand; danach erst die UI- und Testarbeit aufsetzen, um
  Namensdrift zwischen Setup und Code zu vermeiden.

### Phase 1 — Datenmodell (Setup, nicht deploybar)
3. Objekte in Classic Setup anlegen (Abschnitt 4.1), Felder mit Typ/required/Picklist/`deleteConstraint`.
4. `Appointment__c.ScheduleEntry__c` in Setup anlegen; `Appointment__c.Type__c` und
   `AuditEvent__c.Domain__c` um Werte ergänzen.
5. Retrieve → XML ins Repo; Commit „Metadaten: Wochenplan-Objekte".
6. Keine Datenmigration (additiv).

### Phase 2 — Backend-Servicelogik
7. `ScheduleService` (CRUD, Regeln, Audit im selben Commit, Savepoint).
8. `ScheduleTemplateService.apply()` = Deep Copy + Provenienz.
9. `ScheduleEntryGuard.trigger` (Eltern-Zuordnung, `Date__c`, Plausibilität).
10. `SchedulePublishService` (Draft/Published + Vorprüfung).
11. `ScheduleEntryMaterialisationService` (Termin anlegen/mitziehen, Typ-Mapping).
12. `ProgramCoachService` (F7) — **vor** Phase 6, weil die Rechteprüfung darauf aufsetzt.

### Phase 3 — Rechte
13. `backend_Coach`: `objectPermissions`/`fieldPermissions` für die neuen Objekte (**Pflichtfelder
    auslassen**), `classAccesses` für die neuen Apex-Klassen.
14. `Participant_Portal_Access`: read + `classAccesses` für den Portal-Endpunkt.
15. Serverseitige Rollen- und Teilnehmerprüfung in `ScheduleService` + Portal-Endpunkt.

### Phase 4 — Staff-/Coach-UI (Backend-Bundle)
16. `src/types/schedule.ts`, `src/api/schedule/*` (Service, Queries, Apex-Transport).
17. `ProgramWeeksTab` (6. Tab in `ProgramDetailPage`).
18. `WeeklyScheduleEditor` + `WeeklyScheduleGrid` (Tagesraster, responsiv).
19. `ScheduleEntryDialog`, `ScheduleTemplateDialog` (Formulare, Tastaturbedienung, Zustände).

### Phase 5 — Teilnehmeransicht (Portal-Bundle)
20. `ParticipantPortalWeeklySchedule` (Apex, `without sharing` + harte Filterung, whitelisted Response).
21. `weeklyScheduleApi.ts`, `WeeklyScheduleView`, `pages/WeeklySchedule.tsx`, Route + Navigation.
22. Loading-/Empty-/Error-/401-States, Screenreader-Labels, Mobil-Darstellung.

### Phase 6 — Activity-Tracking
23. Eventtypen im Apex-Audit schreiben; `activityProjection.ts` erweitern;
    `docs/activity-coverage.md` aktualisieren.

### Phase 7 — Tests und Nachweis
24. Apex-Testmatrix (Abschnitt 11.1), Frontend-Tests (11.2/11.3), E2E (11.4).
25. `npx vitest run` in beiden Bundles, Build, Lint; **Regression Terminbereich** (Anforderung 14).

### Phase 8 — Dokumentation
26. `docs/DATA_MODEL.md`, `backend/docs/AGENTS.md`, `activity-coverage.md`, `ux-walkthrough.md`,
    `design-system.md`, `coach-access.md`.

### Abhängigkeit zum laufenden Montag/Dienstag-Vorgang

- Das **Montagspaket** (D1-Draft-Gate, Apex `AppointmentEditService`, Frontend-Transport, UI) ist
  committet als `43d3a8b` — **nicht deploybar**, die Release-Grenze RG bleibt in Kraft. Die fünf
  Edit-Tests sind grün (48 Testdateien, 406/406). Die Testumgebungs-Reparatur (jsdom/nwsapi) und
  der Create-Fehlervertrag stehen in `backend/docs/portal/architecture-decisions.md` (ADR-014,
  Folgepunkt vom 2026-10-21).
- **D2 (Kollisionsschutz)** ist offen. Jeder Pfad dieses Features, der Termine schreibt
  (Materialisation, Verschieben, Coach-Wechsel), berührt dieselbe Stelle. Die Regel steht in
  `backend/docs/portal/architecture-decisions.md` (ADR-016 — Terminüberschneidungen zentral beim
  Schreiben verhindern); die Umsetzung steht aus.
- Empfohlene Reihenfolge: **Montag committen (erledigt, `43d3a8b`) → D2 (Dienstag) → Wochenplan
  als eigener Epic.**
- Ausnahme: Die **reine Planphase** (Phasen 1–4 ohne Materialisation) ist unkritisch und kann
  parallel entstehen, sofern die Termin-Schreibpfade nicht aktiviert werden.
- Der Wochenplan darf das D1-Draft-Gate **nicht** umgehen: materialisierte Termine starten als
  `Draft` und laufen für Zeitänderungen durch dieselbe Servicelogik.

---

## 14. Kurzfassung der Antwort auf die acht Ausgangsfragen

1. **Architektur:** `Program__c`/`Module__c` (Kurs/Wochenmodul, ohne Wochenbezug), `Appointment__c`
   (Termin, 1:1 Teilnehmer↔Coach, kein Kursbezug), GraphQL/UI-API + Apex REST, verwaltetes Sharing,
   `AuditEvent__c` als Activity-Stream, `ParticipantAppointmentsTab` mit vorhandener Wochen-Navigation.
2. **Betroffene Dateien:** siehe Abschnitt 3 (5–7 neue Objekte, 5 neue Apex-Klassen, ~12 neue
   Frontend-Dateien in beiden Bundeln, 1 neuer Portal-Endpunkt, 2 Permission Sets, 6 Dokumente).
3. **Datenmodell (Stand nach 0b):** `Program__c` → `Module__c` → `ProgramWeek__c` (AZAV-Themenebene)
   → `WeeklySchedule__c` (Plan-Instanz, mit Geltungsbereich Kurs/Gruppe/Teilnehmer) →
   `ScheduleEntry__c` (Aufgabe oder Termin) ; `ScheduleTemplate__c` → `ScheduleEntry__c` (eine
   Entität für Vorlage und Plan, Kopie statt Link); `TaskCompletion__c` (Erledigt-Status pro
   Teilnehmer); optional `ParticipantGroup__c`(+Member); `Appointment__c.ScheduleEntry__c` und
   `Learning_Path__c.Module__c` als additive Verknüpfungen.
4. **Beziehungen:** Zeit führt die Planzeile, Status/Anwesenheit führt der Termin, ein Termin hat
   höchstens eine Planzeile, Kurs-/Gruppeneinträge erzeugen bewusst keinen Termin, Teilnehmeransicht =
   individuelle Instanz → Gruppeninstanz → Standard ∪ eigene Termine; „aktuelle Woche" aus dem
   Lernpfad.
5. **Migrationsweg:** keine Datenmigration; Metadaten über Classic Setup + Retrieve (AGENTS.md Z. 1016);
   Permission Sets und Feld-Picklist-Erweiterungen deploybar; Validierungsregeln nicht ins Repo.
6. **Berechtigungen:** `backend_Coach` (CRUD) + `Participant_Portal_Access` (read, kein
   `viewAllRecords`); serverseitige Coach-Zuordnungsprüfung (erfordert **persistente**
   Coach↔Programm-Zuordnung) und serverseitige Zielgruppenfilterung im Portal-Endpunkt.
7. **Offene Fragen:** F1–F15, davon F1 (Gruppen), F5 (Publish), F7 (Coach-Zuordnung) und F13
   (Erledigt-Semantik in v1?) als Blocker für Phase 1; F2 ist durch das Fachgespräch geklärt (K1).
8. **Plan:** Phasen 0, 0b, 1–8 in Abschnitt 13, mit Testmatrix in Abschnitt 11.
