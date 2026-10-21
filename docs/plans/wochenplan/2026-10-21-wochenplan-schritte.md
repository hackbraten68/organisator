# Schrittkatalog: Wochenplan (Small Steps)

> **Status:** Freigegebene Implementierungsgrundlage  
> **Stand:** 2026-10-21  
> **Gültigkeit:** Verbindlich für Feldvertrag, Abhängigkeiten und Umsetzungsreihenfolge  
> **Änderungen:** Fachliche oder technische Abweichungen müssen in diesem Dokument und gegebenenfalls in einer ADR dokumentiert werden.
> **Bearbeitungsstand:** Spur 0 (S0.1–S0.5) ist erledigt — Commit `43d3a8b` vom 2026-10-21.
> Die Spuren A, B, C, D und E stehen aus.

**Datum:** 2026-10-21
**Bezug:** `2026-10-21-wochenplan-feature.md` (Phasen 0–8), `2026-10-21-wochenplan-feldvertrag.md` (Setup-Spec)
**Regel:** Jeder Schritt ist **eigenständig commitbar** und **eigenständig verifizierbar**. Ein Schritt
wird erst begonnen, wenn sein Vorgänger grün ist. Kein Schritt enthält mehr als eine fachliche Aussage.

**Vier Spuren:**

| Spur | Inhalt | Startet wann | Braucht die Org? |
|---|---|---|---|
| **0** | Laufender Vorgang (Montagspaket) | sofort | nein |
| **A** | Objekte in Setup + Metadaten | sofort (Infra) | ja (das ist der Punkt) |
| **B** | Verbraucherseite ohne Org-Bezug (Typen, UI, Tests) | sofort | **nein** |
| **C/D/E** | Apex-Services, Activity, Nachweis & Doku | nach A | ja |

**Zwei harte Abhängigkeiten:**
1. **S15 (Materialisation) braucht D2.** Materialisation schreibt `Appointment__c` — der Kollisionsschutz
   (Trigger auf `Appointment__c`) muss existieren, sonst schreibt der Wochenplan am Schutz vorbei.
2. **S17–S19 (Apex-Tests, Rechte) brauchen S2** (Objekte sind in der Org und im Repo).

---

## Spur 0 — Laufender Vorgang (Montagspaket)

Blockiert nichts am Wochenplan, ist aber die Release-Grenze: der Wochenplan bleibt bis D2 prep-only.

| # | Schritt | Dateien | Fertig, wenn | Commit |
|---|---|---|---|---|
| S0.1 | Debug-Scratch löschen | `src/components/appointments/__debug.test.tsx`, `__debug2.test.tsx` | Dateien weg, `git status` zeigt sie nicht mehr | (entfällt — untracked) |
| S0.2 | jsdom-Patch | `vitest.setup.ts` | `Element.prototype.matches` liefert für `:modal`/`:fullscreen`/`:popover-open` `false`; Kommentar mit Ursache (nwsapi-Rekursion, floating-ui) und Verweis auf die Diagnose | Teil des nächsten Commits |
| S0.3 | 5 Edit-Tests grün | `ParticipantAppointmentsTab.test.tsx` | Menü über **Rolle + sichtbaren Namen** adressiert, **keine** Fake Timer, **kein** Mocking des Dropdowns, **kein** erhöhter Timeout | Teil des nächsten Commits |
| S0.4 | Voller Lauf | — | `npx vitest run` → **406/406 grün** (48 Testdateien; 409 minus 3 gelöschte Debug-Tests) | — |
| S0.5 | Montagspaket committen | 13 geänderte + 8 neue Dateien (21) | Commit-Text nennt: kein Deploy, Release-Grenze RG, Bearbeitung bis Kollisionsschutz gesperrt | `feat(appointments): Draft-Gate im Apex-Bearbeitungspfad (nicht deploybar)` |

> **Danach:** D2 (Kollisionsschutz) — eigener Track, im Wochenplan-Plan Abschnitt 13, Phase 2.

---

## Spur A — Objekte in Setup (Infra)

Quelle: `2026-10-21-wochenplan-feldvertrag.md`. **Kein Deploy für Anlage oder Feldanlage**
(`backend/docs/AGENTS.md:1016`).

| # | Schritt | Inhalt | Fertig, wenn |
|---|---|---|---|
| S1.1 | `ProgramWeek__c` | Setup: Label „Kurswoche", Name Text(255), Felder `Program__c` (Lookup, Restrict), `Module__c` (Lookup, Restrict), `Number__c` (Number 2,0, required), `Description__c`, `Status__c` (Draft/Active/Completed) | `sobject describe` zeigt alle 5 Felder |
| S1.2 | `WeeklySchedule__c` | Setup: 13 Felder laut Vertrag §4, davon `ScopeType__c` (Course/Group/Individual), `StartDate__c` required, `DeviationReason__c` | describe vollständig |
| S1.3 | `ScheduleTemplate__c` | Setup: 6 Felder laut Vertrag §5 | describe vollständig |
| S1.4 | `ScheduleEntry__c` | Setup: 24 Felder laut Vertrag §6 (`EntryKind__c`, `DayOfWeek__c` Monday…Sunday, `Date__c` berechnet, `TargetType__c`, `SourceTemplateEntry__c`, `IsCustomized__c`, `DeviationReason__c`) | describe vollständig |
| S1.5 | `TaskCompletion__c` | Setup: 5 Felder laut Vertrag §7 | describe vollständig |
| S1.6 | `ParticipantGroup__c` + `ParticipantGroupMember__c` | **nur wenn F1 = ja** | describe vollständig |
| S1.7 | Bestand erweitern | `Appointment__c.ScheduleEntry__c` (Lookup, SetNull), `Learning_Path__c.Module__c` (Lookup, SetNull) | beide in `sobject describe` sichtbar |
| S1.8 | Retrieve | `sf project retrieve start --metadata CustomObject:…` (Befehl im Vertrag §11) | XML liegt unter `backend/force-app/main/default/objects/`, **byte-identisch** zu Setup |
| S1.9 | Metadaten committen | nur `objects/…`-Änderungen | `git status` zeigt **keine** unbeabsichtigten Feldänderungen an bestehenden Objekten |

**Regel für S1.9:** Werden bestehende Felder unbeabsichtigt mitverändert (z. B. `Appointment__c` durch
den Retrieve), **nicht** mitcommitten, sondern gezielt zurücknehmen.

---

## Spur B — Verbraucherseite ohne Org-Bezug (parallel ab sofort)

Alles hier läuft gegen den **Feldvertrag als Vertrag**, nicht gegen die Org. Die Services werden in den
Tests gemockt (Repo-Muster: `vi.mock("@/api/…/service")`, kein MSW im Repo).

| # | Schritt | Dateien | Fertig, wenn |
|---|---|---|---|
| S4 | Typen | `src/types/schedule.ts` | `ScheduleEntryType`, `ScheduleEntryKind`, `ScheduleTargetType`, `ScheduleScopeType`, `WeeklyScheduleStatus`, `ScheduleEntry`, `ScheduleEntryInput`, `WeeklySchedule`, `ScheduleTemplate` + Label-Maps (deutsch, wie `APPOINTMENT_STATUS_LABELS`) |
| S5 | Typ-Pflege-Test | `src/types/schedule.test.ts` | alle Typen haben eine Label-Zuordnung; Label-Liste ≠ leer (Muster `appointmentPicklist.test.ts`) |
| S6 | GraphQL-Schicht | `src/api/schedule/query/*.graphql`, `src/api/schedule/scheduleService.ts`, `scheduleTemplateService.ts` | **eine Operation pro Datei**, `?raw`-Import, `cacheControl: 'no-cache'` über `executeGraphQL`; Read-Funktionen decken Liste + Detail ab |
| S7 | Wochenraster | `src/components/schedules/WeeklyScheduleGrid.tsx` + `.test.tsx` | 7 Tage (Mo–So), Tages-Offset aus `DayOfWeek__c`, Gruppierung nach Zielgruppe, **Textlabel zusätzlich zum Symbol** (nicht nur Farbe), `role="grid"`-Semantik, Tastaturbedienung |
| S8 | Eintrags-Dialog | `src/components/schedules/ScheduleEntryDialog.tsx` + `.test.tsx` | Formularfelder laut Feldvertrag, abhängige Zielgruppenauswahl (Kurs/Gruppe/Teilnehmer), Zeit **oder** Dauer, Validierung, Radix-Dialog-Fokusfalle, `aria-label`s |
| S9 | Editor | `src/components/schedules/WeeklyScheduleEditor.tsx` + `.test.tsx` | Kopf mit Status/Aktionen (Vorlage anwenden, Veröffentlichen), Raster, Entry-Liste je Tag, Tastaturwege für alle Aktionen, Loading/Empty/Error, 403/409 sichtbar |
| S10 | Wochenliste im Kurs | `src/components/schedules/ProgramWeeksTab.tsx` + `.test.tsx` | Liste der Kurswochen, „Kurswoche anlegen", „Wochenplan anlegen", 6. Tab in `ProgramDetailPage` (`src/pages/programs/ProgramDetailPage.tsx`) |
| S11 | Portal-Ansicht (UI) | `frontend/…/src/features/participant/components/WeeklyScheduleView.tsx` + `.test.tsx` | Tagesraster + gestapelte Mobilansicht, Herkunftslabel (Standard/Gruppe/individuell), Erledigt-Status, Detail-Dialog **ohne** Bearbeitung, Loading/Empty/Error, Screenreader-Labels |
| S12 | Portal-Route | `frontend/…/src/routes.tsx`, `src/pages/WeeklySchedule.tsx` | Route `/wochenplan` + Navigationslink, Standard = aktuelle Woche |
| S13 | Portal-Client | `frontend/…/src/features/participant/api/weeklyScheduleApi.ts` + `.test.ts` | `sdk.fetch` gegen `/services/apexrest/participant-portal/me/weekly-schedule`, Fehlercodes typisiert (Muster `appointmentsApi.ts`) |

> **S6-Einschränkung:** `src/api/graphql-operations-types.ts` ist codegen-generiert; neue Queries auf
> neue Objekte laufen erst durch Codegen, **nachdem** S1 abgeschlossen ist. Die Queries selbst können
> vorher geschrieben werden (reine Strings), der generierte Typ folgt später.

---

## Spur C — Backend-Services (nach S1.8/S1.9)

Muster: `AppointmentEditService.cls` (global with sharing, Feld-Whitelist, Audit in derselben
Transaktion, Savepoint + Rollback, eigene Exception-Klasse mit Status + Code).

| # | Schritt | Dateien | Fertig, wenn |
|---|---|---|---|
| S14 | `ScheduleService.cls` | CRUD für `WeeklySchedule__c`/`ScheduleEntry__c`: Zielgruppen-Plausibilität, genau eine Eltern-Zuordnung, `Date__c`-Berechnung aus `StartDate__c` + `DayOfWeek__c`, `IsCustomized__c`-Pflege, Audit `schedule.entry_created/updated/deleted` | Apex-Klasse kompiliert, `with sharing`, Fehlercodes `SCHEDULE_NOT_FOUND`, `ENTRY_TARGET_INVALID`, `NOT_ASSIGNED` |
| S15 | `ScheduleEntryGuard.trigger` | before insert/update: Eltern-Zuordnung, `Date__c`, Start < Ende, `TargetType` ↔ `Participant__c`/`ParticipantGroup__c`, `IsRequired__c`-Pflege | Guard-Tests grün |
| S16 | `ScheduleTemplateService.cls` | `apply(template, programWeek)` = **Deep Copy** inkl. `SourceTemplateEntry__c` + `IsCustomized__c = false`; `AppliedTemplate__c` nur Provenienz | Kopier-Test: Vorlage ändern → Plan unverändert |
| S17 | `SchedulePublishService.cls` | `publish()` mit Vorprüfung, `PublishedAt__c`/`PublishedBy__c`, Audit `schedule.published` | Draft unsichtbar / Published sichtbar |
| S18 | `TaskCompletion`-Logik | in `ScheduleService`: `TaskCompletion__c` je Teilnehmer × Aufgabe, `Status__c`, `CompletedAt__c`, `DeviationReason__c` | „vorher schon erfüllt" abbildbar |
| S19 | `ScheduleEntryMaterialisationService.cls` | **erst nach D2**: materialisiert `Appointment__c` (Status `Draft`, `Coach__c` = `Coach_Profile__c.User__c`, `ScheduleEntry__c`-Verweis), Typ-Mapping mit `TYPE_NOT_MATERIALISABLE` | Materialisation + Termin-Update im selben Commit; **kein** zweiter Schreibpfad am Termin |
| S20 | Portal-Endpunkt | `frontend/…/classes/ParticipantPortalWeeklySchedule.cls` | `without sharing`, Teilnehmer über `UserInfo.getUserId()` → `Contact` → `Participant__c`, Filter: individuelle Instanz → Gruppeninstanz → Standard, Response whitelisted | Teilnehmer sieht nie fremde Zeilen |
| S21 | Rechte | `backend_Coach.permissionset-meta.xml`, `Participant_Portal_Access.permissionset-meta.xml` | `objectPermissions`/`fieldPermissions` für die neuen Objekte, **Pflichtfelder ausgeschlossen**, `classAccesses` für die neuen Klassen, Portal read **ohne** `viewAllRecords` | Deploy erfolgreich, Exit-Code prüfen (AGENTS.md: „Succeeded" im Output ist kein Beweis) |
| S22 | Coach-Zuordnung | `ProgramCoach__c` (F7) | persistent, serverseitig prüfbar; der flüchtige `programCoachSeed` (`programService.ts:132`) wird ersetzt | Coach-Auflösung läuft über die Org |

---

## Spur D — Activity-Tracking

| # | Schritt | Dateien | Fertig, wenn |
|---|---|---|---|
| S23 | Picklist | `AuditEvent__c.Domain__c` um `schedule` erweitern (Feldänderung auf gesundem Feld → deploybar), `Action__c` unverändert (Werte `entry_created/updated/deleted`, `assigned`, `created`, `updated` existieren bereits) | Deploy grün, `describe` zeigt `schedule` |
| S24 | Eventtypen im Code | in S14/S16/S17 verdrahtet | jeder fachliche Schreibvorgang erzeugt **genau ein** `AuditEvent__c`; Audit-Fehler → Rollback + `AUDIT_FAILED` |
| S25 | Projection | `src/api/audit/activityProjection.ts` | neue Eventtypen eingetragen — sonst **Default-Deny**, die Events bleiben unsichtbar |
| S26 | Coverage-Doku | `backend/docs/activity-coverage.md` | Zeile „Schedule" mit Event-/Audience-/Correlation-/Deep-Link-Spalten |

---

## Spur E — Nachweis, Doku, Abnahme

| # | Schritt | Inhalt | Fertig, wenn |
|---|---|---|---|
| S27 | Apex-Testmatrix | `ScheduleServiceTest.cls`, `ScheduleAccessTest.cls` (Projekt `backend/`), `ParticipantPortalWeeklyScheduleTest.cls` (Projekt `frontend/`) | 18 Fälle aus Plan-Abschnitt 11.1, `@TestSetup` + Marker-Feld, kein `seeAllData` |
| S28 | Frontend-Tests | Vitest in beiden Bundles | S5, S7–S13 grün; Portal-Tests decken Teilnehmerfilter, Wochenwechsel, leere Woche, Loading/Error, Mobil, Tastatur ab |
| S29 | E2E | `backend/…/e2e/` (Staff-Editor-Flow + **Regression `core-flows.spec.ts`**), `frontend/…/e2e/` (Portal-Wochenansicht + Mobil-Viewport) | Playwright grün |
| S30 | Läufe | `npx vitest run` in **beiden** Bundles, `npm run build`, Lint | alles grün, **keine** Verschlechterung der 409er-Suite |
| S31 | Doku | `docs/DATA_MODEL.md` (Root), `backend/docs/AGENTS.md` (Ownership/Namenskonvention), `backend/docs/ux-walkthrough.md` (dort steht „Keine Wochenübersicht"), `backend/docs/design-system.md`, `backend/docs/coach-access.md` | Struktur, Namenskonvention, UX-Stand und Coach-Zugriff dokumentiert |
| S32 | Abnahme | Checkliste der 16 Akzeptanzkriterien aus dem Ausgangs-Prompt | jede Zeile mit Test oder manuellem Nachweis belegt |

---

## Reihenfolge und Parallelisierung

```
Sofort:  S0.1 → S0.2 → S0.3 → S0.4 → S0.5        (Montagspaket, blockiert nichts)
Sofort:  S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11 → S12 → S13   (Spur B, ohne Org)
Sofort:  S1.1 … S1.9                              (Spur A, Infra)
Danach:  S14 → S15 → S16 → S17 → S18 → S20 → S21 → S22   (Spur C)
         S19 erst nach D2
Dparallel: S23 → S24 → S25 → S26                   (Spur D)
Zum Schluss: S27 → S28 → S29 → S30 → S31 → S32   (Spur E)
```

**Kritischer Pfad:** S1.9 (Metadaten im Repo) → S14 → S27.
**Längster Nebenschritt:** S19 (Materialisation) wartet auf D2.
**Sofort nutzbar ohne jede Org:** S4–S13 — also der komplette UI-Teil inklusive Tests.

## Abbruch- und Klärungsregeln

- **F1 (Gruppen) offen** → S1.6, `ParticipantGroup__c`-Felder in S1.2/S1.4 und die Gruppenauswahl in S8
  entfallen; S20 filtert ohne Gruppenebene. Alles andere bleibt gültig.
- **F13 (Erledigt-Semantik) = nein** → S1.5 und S18 entfallen; S11 zeigt keinen Erledigt-Status.
  **Empfehlung: anlegen** (späteres Nachrüsten eines neuen Objekts ist teurer).
- **F14 (Wochen- vs. Kursvorlage)** → beide Bindungen sind in S1.3 angelegt; die Entscheidung fällt erst
  in der UI (S9, Aktion „Vorlage anwenden") und ändert kein Schema.
- **F8 (Verschieben bestätigter Termine)** → betrifft S19; bis zur Entscheidung gilt der Entwurf
  (Zeit am Termin wird mitgezogen, Status bleibt unangetastet, Abweichung im Audit).
- **Jeder Schritt, der eine bestehende Fachlogik berührt, muss den Bestand mitnehmen:** Regressionstest
  für den Terminbereich (Akzeptanzkriterium 14) gehört in S28/S29, nicht ans Ende.
