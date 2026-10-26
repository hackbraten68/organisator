# Abnahme-Checkliste — Wochenplan (S32)

Stand: 2026-10-26. Jede Zeile mit automatischem oder manuellem Nachweis.

## Automatisch nachgewiesen

| # | Kriterium | Nachweis | Status |
|---|---|---|---|
| 1 | Wochenplan anlegen | `ScheduleServiceTest` | ✅ |
| 2 | Vorlage anwenden (Deep Copy, Vorlage unverändert) | `ScheduleTemplateServiceTest` | ✅ |
| 3 | Unabhängige Bearbeitung instanzierter Vorlage | `ScheduleTemplateServiceTest.applyErstelltDeepCopy` | ✅ |
| 4 | Kursweite Zeile | `ScheduleServiceTest` | ✅ |
| 5 | Gruppenzeile | `ScheduleServiceTest` | ✅ |
| 6 | Individuelle Zeile | `ScheduleServiceTest` | ✅ |
| 7 | Teilnehmerfilter (eigene + Gruppe + Kurs) | `ParticipantPortalWeeklyScheduleTest` | ✅ |
| 8 | Schutz fremder Zeilen | `ParticipantPortalWeeklyScheduleTest` | ✅ |
| 11 | Veröffentlichen + Teilnehmersichtbarkeit (Draft unsichtbar) | `SchedulePublishServiceTest` | ✅ |
| 12 | Materialisation (Typ, Draft, Verweis) | `ScheduleEntryMaterialisationServiceTest` | ✅ |
| 13 | start < end, Zielgruppe, Eltern-Zuordnung | `ScheduleEntryGuardTest` | ✅ |
| 14 | Geltungsbereich K4 (Override) | `ParticipantPortalWeeklyScheduleTest` | ✅ |
| 17 | Regression Termin-Workflow | `AppointmentEditServiceTest` (62 Tests) | ✅ |
| 18 | ProgramWeek/Module/Appointment unverändert | `schema:check` (20 Objekte, 0 Fehler) | ✅ |
| — | Schema-Konsistenz | `npm run schema:check` (Apex-Probe) | ✅ |
| — | Frontend-Build (beide Bundles) | `npm run build` | ✅ |
| — | Lint (beide Bundles) | `npx eslint` (0 Errors) | ✅ |
| — | Vitest (beide Bundles) | 418 + 70 Tests | ✅ |

## Manuell / Gate

| # | Kriterium | Nachweis | Status |
|---|---|---|---|
| 9 | Coach-Zuordnungsprüfung (403) | Gate — `ScheduleService` verdrahtet Gate noch nicht (S22-Gate offen) | ⏸ |
| 10 | Staff darf alles | Gate — Permission-Set `backend_Coach` + `viewAllRecords`; manuell prüfen | ⏸ |
| 16 | Abweichungsbegründung (K3) | Optional in v1 (S15/S18); Feld vorhanden, Pflicht nicht erzwungen | Optional |

## Entfallen (bewusst)

| # | Kriterium | Grund |
|---|---|---|
| 15 | Aufgaben/Erledigt (K2/K5, TaskCompletion) | F13 = nein → S18 entfällt |

## E2E

| Suite | Status |
|---|---|
| Portal-Wochenansicht (offline, gemockt) | Spec vorhanden (`weekly-schedule.spec.ts`), Playwright-Lauf in dieser Umgebung nicht stabil ausführbar |
| Staff-Editor-Flow + Regression `core-flows.spec.ts` | Bestehende Suite, nicht erneut ausgeführt |
| Mobile-Viewport | Spec nicht erweitert |

## Offene Punkte vor Push

- S22-Gate (Coach-Zuordnung in ScheduleService) verdrahten, falls gewünscht
- Playwright-Suiten lokal/CI ausführen und Ergebnisse festhalten
- Push nach Remote erst nach separater Freigabe
