# Proposal: Wochenplan-Editor im Backoffice (Staff/Coach)

Stand: 2026-10-30. Status: Implementiert und deployt (Commit `3309756`).

## Ziel

Staff (und zugeordnete Coaches) können Wochenpläne im Backoffice-Bundle
(`uiBundles/backend`) anlegen, bearbeiten, veröffentlichen und als Vorlage
speichern. Die Apex-Services (`ScheduleService`, `ScheduleTemplateService`,
`SchedulePublishService`, `ScheduleEntryMaterialisationService`,
`ScheduleGridService`) und die UI sind implementiert; Einträge und Raster werden
dialogbasiert bearbeitet (Drag/Drop und Inline-Editing bleiben Folgearbeit).

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

## Offene Fragen (Status)

1. Verankerung: implementiert als shared Grid in Plan-/Template-Editor, Template-Detail und Print; Sidebar-Nesting `Wochenplan → Vorlagen`.
2. Drag&Drop: bewusst nicht in v1; Einträge und Raster werden dialogbasiert bearbeitet.
3. Coach-Rechte: serverseitige Prüfung in `ScheduleService`; Frontend-Rechteprüfung bleibt offen.
4. Audit-Events (`schedule.*`): Backend-Events vorhanden; UI-Verlauf nicht Teil dieses Scopes.

## Aufwand (grob)

- API-Wrapper + Types: 1 Tag
- Plan-Liste + Editor-Grundgerüst: 2 Tage
- Vorlagen + Publish-Flow: 1 Tag
- Tests + Polish: 1 Tag
- **Gesamt: ~5 Tage**

## Bewusst offene Punkte

- Slot-Eindeutigkeit (`Tag + Reihenfolge + Art`) ist absichtlich noch nicht aufgelöst.
- Drag & Drop / Inline-Editing bleibt Folgearbeit.
- Coach-Gate in `ScheduleService` ist noch nicht vollständig verdrahtet.
- Frontend-Rollenprüfung bleibt bewusst außerhalb des MVP.
