# Proposal: Wochenplan-Editor im Backoffice (Staff/Coach)

Stand: 2026-10-26. Status: Entwurf / noch nicht implementiert.

## Ziel

Staff (und zugeordnete Coaches) sollen Wochenpläne im Backoffice-Bundle
(`uiBundles/backend`) anlegen, bearbeiten, veröffentlichen und als Vorlage
speichern können. Aktuell existieren nur die Apex-Services (`ScheduleService`,
`ScheduleTemplateService`, `SchedulePublishService`,
`ScheduleEntryMaterialisationService`); die UI fehlt vollständig.

## Scope (v1)

1. **Plan-Liste** pro Programm: veröffentlichte/Entwurf-Instanzen, Status-Badge,
   Wochen-Filter (Woche 1…N), Aktionen: Öffnen, Duplizieren, Löschen (nur Draft).
2. **Plan-Editor**: Wochen-Raster (Mo–So × Zeitslots) mit Drag/Drop oder
   Formular für Einträge (Typ, Zielgruppe, Coach, Ort, Link, Pflicht, Reihenfolge).
   Merge-Key `DayOfWeek__c | Order__c | EntryKind__c` (D2) beachten; `Order__c = null`
   nur anhängen.
3. **Vorlagen**: anwenden (Deep Copy), speichern als Vorlage, Vorlagen verwalten.
4. **Veröffentlichen / Zurückziehen** mit Duplicate-Course-Guard
   (`409 DUPLICATE_COURSE_SCHEDULE`) und Bestätigungsdialog.
5. **Coach-Zuordnung** (S22-Gate): Coach sieht nur zugeordnete Programme;
   Staff sieht alles.

## Nicht in v1

- Aufgaben/Erledigt (F13 = nein, `TaskCompletion__c` entfällt).
- Individuelle Override-Workflows im Editor (K4) — nur Anzeige.
- Mobile-Optimierung (Desktop-first).

## Technische Bausteine

- **Backend-Bundle** `uiBundles/backend/src/pages/...` (neue Route `/wochenplan-editor`
  oder eingebettet in Programmdetail).
- **GraphQL/Apex**: neue `@RestResource`-Endpunkte oder bestehende Services per
  Apex-REST wrappen (`ScheduleService.upsertWeeklySchedule`,
  `upsertScheduleEntry`, `deleteScheduleEntry`, `SchedulePublishService.publish/unpublish`,
  `ScheduleTemplateService.apply/save`).
- **State**: React Query, analog zu `appointmentsApi.ts` / `programService.ts`.
- **Komponenten**: wiederverwenden der shadcn/ui-Bausteine aus
  `src/components/ui/` (Dialog, Table, Select, TimePicker).
- **Tests**: Vitest (Unit) + Playwright (E2E) analog zu `core-flows.spec.ts`.

## Offene Fragen

1. Wo im Backoffice verankern — eigene Seite oder Tab in Programmdetail?
2. Drag&Drop (react-dnd) oder reines Formular?
3. Coach-Rechte: darf ein Coach veröffentlichen oder nur Entwurf bearbeiten?
4. Audit-Events (`schedule.*`) im UI anzeigen (Verlauf)?

## Aufwand (grob)

- API-Wrapper + Types: 1 Tag
- Plan-Liste + Editor-Grundgerüst: 2 Tage
- Vorlagen + Publish-Flow: 1 Tag
- Tests + Polish: 1 Tag
- **Gesamt: ~5 Tage**

## Nächster Schritt

Entscheidung zur Frage 1 (Verankerung), dann Scaffold der Seite + API-Client.
