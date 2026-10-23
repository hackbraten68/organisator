# Feldvertrag: Wochenplan-Objekte (Setup-Spec)

> **Status:** Freigegebene Implementierungsgrundlage  
> **Stand:** 2026-10-21  
> **Gültigkeit:** Verbindlich für Feldvertrag, Abhängigkeiten und Umsetzungsreihenfolge  
> **Änderungen:** Fachliche oder technische Abweichungen müssen in diesem Dokument und gegebenenfalls in einer ADR dokumentiert werden.
> **Bearbeitungsstand:** 2026-10-21 — Abschnitt 0 (K1–K4) aus der Org-Prüfung ergänzt; F1 = ja entschieden; Feldanzahlen korrigiert; Setup-Eingabe steht aus.

**Datum:** 2026-10-21
**Zweck:** Ausführbarer Vertrag für das Anlegen der neuen Objekte in **Classic Setup**.
**Bezug:** `2026-10-21-wochenplan-feature.md` Abschnitt 0b (Fachgespräch-Revision) und 4.1 (Datenmodell).
**Ausführende:** Infra (Objekte/Struktur in Classic Setup) → anschließend Verbraucherseite (Apex, UI, Tests).

> **Zwei Regeln, die alles bestimmen**
> 1. **Kein Deploy für Feld-/Objektanlage.** `backend/docs/AGENTS.md:1016` — „Never create a custom field
>    through a deploy. Create it in Setup, then retrieve." Ein per Deploy angelegtes Feld erscheint im
>    `FieldDefinition`, **nie** im Runtime-Schema. Neue Objekte genauso (Z. 1027–1030).
> 2. **Nach dem Retrieve prüfen, nicht nach dem grünen Deploy.** `sf sobject describe` muss jedes Feld
>    zeigen (siehe `backend/docs/runtime-schema-healthcheck.md`).

---

## 0. Korrekturen aus der Org-Prüfung (2026-10-21)

Vor dem Anlegen in Setup wurde das Repository gegen `hubSandbox` geprüft (Tooling API,
`sobject describe`, Objekt-Metadaten im Bestand). Vier Abweichungen zwischen diesem Vertrag und
der Org-Wahrheit wurden dabei gefunden und entschieden. **Diese Entscheidungen sind verbindlich.**

| # | Fund | Org-Wahrheit | Entscheidung |
|---|---|---|---|
| K1 | Sharing-Referenz (§1) | `Appointment__c` ist `sharingModel=ReadWrite`, `externalSharingModel=Private` — **nicht** „Private/Private (wie `Appointment__c`)" | Die neuen Objekte spiegeln den Bestand: `sharingModel=ReadWrite`, `externalSharingModel=Private`. `sharingModel` steuert den Zugriff über Standard-Lookups; alle Repo-Objekte nutzen ReadWrite. **Das org-weite Default (OWD) ist davon unberührt** und bleibt Handarbeit in Setup (siehe unten) |
| K2 | Feldzahlen | §3–§8 dieser Tabellen sind maßgeblich: 5 / 13 / 5 / 22 / 5 / 3 / 3 | Der Schrittkatalog nannte „6" (§5) und „24" (§6) — korrigiert. Jedes Objekt hat zusätzlich ein Name-Feld (Text bzw. AutoNumber) |
| K3 | `Appointment__c.Type__c` (§9) | Org-Werte: `Coaching`, `CheckIn`, `Feedback`, `Behörde`, `Praktikum`, `Sonstiges` | Der Werteliste in §9 fehlte dieser Abgleich: `Feedback` und `Sonstiges` **existieren bereits**, ein „Ergänzen" scheitert an `restricted = true`. §9 ist präzisiert. Offen bleibt das Mapping `ScheduleEntry__c.Type__c` → `Appointment__c.Type__c` (F9) |
| K4 | `DayOfWeek__c` (§6) | `AvailabilitySlot__c.DayOfWeek__c` kennt **nur** Monday–Friday | „Identisch zum Muster" meint den Namensstil (API-Name = Label, englische Wochentage), nicht die Wertemenge. `ScheduleEntry__c.DayOfWeek__c` hat **7** Werte (Monday–Sunday) |

**Relationship-Namen — geprüft, nicht beanstandet.** Der Vertrag nennt sie nur für
`ProgramWeek__c.Program__c`/`.Module__c`, `WeeklySchedule__c.ProgramWeek__c`,
`Appointment__c.ScheduleEntry__c` und `Learning_Path__c.Module__c`. Der Bestand belegt, dass
derselbe Relationship-Name auf demselben Kindobjekt zweimal vergeben werden darf:
`Learning_Path__c` nutzt `Learning_Paths` **sowohl** für `Participant__c` **als auch** für
`Program__c` — im Org deployed und funktionsfähig. Für die übrigen Lookups ergänzt dieser Vertrag
die Namen systematisch (§0a) statt sie wegzulassen: kein Objekt im Bestand verzichtet auf einen
Relationship-Namen.

**Defaults, die der Vertrag nicht festlegt.** Drei Required-Picklists brauchen in Setup zwingend
einen Default-Wert, der Vertrag nennt ihn nicht. Vorgeschlagen und in den Metadaten so gesetzt,
bis der Fachentscheid vorliegt: `ScheduleEntry__c.EntryKind__c` = `Aktivität`,
`ScheduleEntry__c.Type__c` = `Einzelcoaching`, `ScheduleEntry__c.DayOfWeek__c` = `Monday`.

**Von Hand in Setup, nicht im Metadatum:** das org-weite Default (OWD) je Objekt
(Setup → Sharing Settings → „Private", intern **und** extern). Das ist kein Metadatum
(`backend/docs/AGENTS.md`, Sicherheitsregel 1), überlebt kein Sandbox-Refresh und wird in
`backend/docs/g1-manual-checklist.md` vermerkt.

## 0a. Relationship-Namen der neuen Objekte

Regel: der Relationship-Name benennt die **Kinder** auf dem Elternobjekt (Plural des Objekts, das
den Lookup deklariert). Der Namensraum liegt je Elternobjekt, deshalb darf derselbe Name auf
verschiedenen Elternobjekten vorkommen — so wie `Learning_Path__c` es tut.

| Kindobjekt | Lookup | Relationship-Name | Elternobjekt |
|---|---|---|---|
| `ProgramWeek__c` | `Program__c` | `Program_Weeks` | `Program__c` |
| `ProgramWeek__c` | `Module__c` | `Program_Weeks` | `Module__c` |
| `WeeklySchedule__c` | `ProgramWeek__c` | `Weekly_Schedules` | `ProgramWeek__c` |
| `WeeklySchedule__c` | `ParticipantGroup__c` | `Weekly_Schedules` | `ParticipantGroup__c` |
| `WeeklySchedule__c` | `Participant__c` | `Weekly_Schedules` | `Participant__c` |
| `WeeklySchedule__c` | `PublishedBy__c` | `Weekly_Schedules` | `User` |
| `WeeklySchedule__c` | `AppliedTemplate__c` | `Weekly_Schedules` | `ScheduleTemplate__c` |
| `ScheduleTemplate__c` | `ProgramWeek__c` | `Schedule_Templates` | `ProgramWeek__c` |
| `ScheduleTemplate__c` | `Program__c` | `Schedule_Templates` | `Program__c` |
| `ScheduleTemplate__c` | `Module__c` | `Schedule_Templates` | `Module__c` |
| `ScheduleEntry__c` | `WeeklySchedule__c` | `Schedule_Entries` | `WeeklySchedule__c` |
| `ScheduleEntry__c` | `ScheduleTemplate__c` | `Schedule_Entries` | `ScheduleTemplate__c` |
| `ScheduleEntry__c` | `ParticipantGroup__c` | `Schedule_Entries` | `ParticipantGroup__c` |
| `ScheduleEntry__c` | `Participant__c` | `Schedule_Entries` | `Participant__c` |
| `ScheduleEntry__c` | `Coach_Profile__c` | `Schedule_Entries` | `Coach_Profile__c` |
| `ScheduleEntry__c` | `SourceTemplateEntry__c` | `Source_Entries` | `ScheduleEntry__c` |
| `TaskCompletion__c` | `ScheduleEntry__c` | `Task_Completions` | `ScheduleEntry__c` |
| `TaskCompletion__c` | `Participant__c` | `Task_Completions` | `Participant__c` |
| `ParticipantGroup__c` | `Program__c` | `Participant_Groups` | `Program__c` |
| `ParticipantGroup__c` | `Coach_Profile__c` | `Participant_Groups` | `Coach_Profile__c` |
| `ParticipantGroupMember__c` | `ParticipantGroup__c` | `Participant_Group_Members` | `ParticipantGroup__c` |
| `ParticipantGroupMember__c` | `Participant__c` | `Participant_Group_Members` | `Participant__c` |

> **Einzige Abweichung von der Regel:** `Source_Entries` statt `Schedule_Entries` für den
> Selbstbezug. Auf `ScheduleEntry__c` trügen beide Namen sonst fremde Kinder; `Source_Entries`
> benennt die Herkunft, `Schedule_Entries` die Planzeilen unter einem Plan.

## 1. Konventionen (aus dem Bestand abgeleitet, nicht erfunden)

| Thema | Konvention im Repo | Für die neuen Objekte |
|---|---|---|
| API-Namen | Custom Objects `X__c`, Custom Fields `Field__c` | CamelCase wie `AvailabilitySlot__c`/`AuditEvent__c` (die jüngeren Objekte) — **nicht** `Learning_Path__c`-Schreibweise |
| Labels | deutsch, z. B. `Status__c` = „Status", `Type__c` = „Typ" | deutsche Labels |
| Picklist-Werte | **API-Name = Label, keine Übersetzung** (belegt: `Appointment__c.Type__c` = `Behörde`, `Praktikum`; `Status__c` = `Draft`…; `AuditEvent__c.Domain__c` = `workbook`, `absence`…) | **deutsche API-Werte**, wie die Objekt-Tabellen §3–§8 sie festlegen — so auch im Bestand (`Behörde`, `Praktikum`); entschieden 2026-10-21. Das Frontend-Mapping `src/types/schedule.ts` bleibt der Ort für Anzeigetext, Reihenfolge und Begriffe |
| Picklist `restricted` | `true` (Status, Type, Domain, Action) | `true` |
| Beziehungen | **ausnahmslos Lookup** (0 Master-Detail im gesamten Modell) | Lookup, `deleteConstraint` = `Restrict` bei Kind-Beziehungen, `SetNull` bei optionalen |
| Name-Feld | Text für Inhaltsobjekte (`Program__c`, `Module__c`, `Participant__c`), AutoNumber für Vorgänge (`Appointment__c` `TERM-{0000}`, `AvailabilitySlot__c` `SLOT-{0000}`, `Learning_Path__c` `LP-{0000}`) | Text für `ProgramWeek__c`/`WeeklySchedule__c`/`ScheduleTemplate__c`/`ScheduleEntry__c`/`ParticipantGroup__c`; AutoNumber für `TaskCompletion__c`/`ParticipantGroupMember__c` |
| `enableHistory` | true bei `Appointment__c`, `Absence__c`, `AvailabilitySlot__c` | true für die Planobjekte (Planhistorie ist fachlich relevant) |
| `trackHistory` (feldweise) | operativen Feldern true, Langtexten false (`Appointment__c.Notes__c` false) | true für Status, Zeiten, Daten, Ziel, Flags, Zahlen und Lookups; false für `Description__c`, `Notes__c`, `DeviationReason__c` |
| Sharing | `sharingModel` **ReadWrite**, `externalSharingModel` Private — Bestand: `Appointment__c`, `AvailabilitySlot__c` (K1) | ReadWrite / Private |

**Präzisierung gegenüber Plan-Abschnitt 4.1** (hier gilt die genauere Fassung):

- `ProgramWeek__c`: **kein** `Title__c` — das Name-Feld **ist** der Titel (Text 255).
- `ScheduleEntry__c`: **kein** `Title__c` — das Name-Feld **ist** der Titel (Text 255).
- `ScheduleEntry__c`: **kein** `DayOffset__c` (Number) — stattdessen `DayOfWeek__c` als Picklist
  (Monday…Sunday) **wie `AvailabilitySlot__c.DayOfWeek__c` bereits im Bestand**, plus das daraus
  **berechnete** `Date__c` (Date) gegen `WeeklySchedule__c.StartDate__c`. Montag = 0 … Sonntag = 6.

---

## 2. Anlage-Reihenfolge (Abhängigkeiten)

```
1  ParticipantGroup__c            (nur wenn F1 = ja; sonst Schritt überspringen)
2  ParticipantGroupMember__c      (Lookup auf 1)
3  ProgramWeek__c                 (Lookup auf Program__c, Module__c)
4  WeeklySchedule__c              (Lookup auf 3, optional auf 1, Participant__c)
5  ScheduleTemplate__c            (Lookup auf 3, Program__c, Module__c)
6  ScheduleEntry__c               (Lookup auf 4, 5, 1, Participant__c, Coach_Profile__c, selbst)
7  TaskCompletion__c              (Lookup auf 6, Participant__c)
8  Bestands-Objekte erweitern: Appointment__c.ScheduleEntry__c, Learning_Path__c.Module__c,
   Appointment__c.Type__c (Werte), AuditEvent__c.Domain__c (Wert 'schedule')
9  Retrieve + Commit
```

`ProgramCoach__c` (F7, Coach↔Programm) ist **nicht** Teil dieses Vertrags — es ist ein eigener
Baustein, der parallel zum Wochenplan entstehen kann und erst für die Rechteprüfung gebraucht wird.

---

## 3. Objekt 1 — `ProgramWeek__c` (Kurswoche / AZAV-Woche)

| Setup-Attribut | Wert |
|---|---|
| Label | Kurswoche |
| Plural | Kurswochen |
| Name-Feld | Text (255), Label „Kurswoche", erforderlich |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `Program__c` | Program | Lookup → `Program__c` | erforderlich, `Restrict`, relationshipName `Program_Weeks` |
| `Module__c` | Modul | Lookup → `Module__c` | erforderlich, `Restrict`, relationshipName `Program_Weeks` |
| `Number__c` | Woche | Number (2,0) | erforderlich — Wochenindex 1..n. Eindeutigkeit je `Program__c` wird serverseitig geprüft (kein `externalId` möglich: dessen Eindeutigkeit ist orgweit) |
| `Description__c` | Beschreibung | Long Text Area (32768, 3) | optional — didaktische Beschreibung der Woche |
| `Status__c` | Status | Picklist (restricted) | `Draft` (Default), `Active`, `Completed` |

**Kein Datumsfeld** (K1): das Kalenderdatum hängt an der Plan-Instanz.

## 4. Objekt 2 — `WeeklySchedule__c` (Wochenplan-Instanz)

| Setup-Attribut | Wert |
|---|---|
| Label | Wochenplan |
| Plural | Wochenpläne |
| Name-Feld | Text (255), Label „Wochenplan", erforderlich |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `ProgramWeek__c` | Kurswoche | Lookup → `ProgramWeek__c` | erforderlich, `Restrict`, relationshipName `Weekly_Schedules` |
| `ScopeType__c` | Geltungsbereich | Picklist (restricted) | erforderlich: `Course` (Standard), `Group`, `Individual` (K4) |
| `ParticipantGroup__c` | Teilnehmergruppe | Lookup → `ParticipantGroup__c` | optional, `SetNull` — nur bei `ScopeType = Group` |
| `Participant__c` | Teilnehmer | Lookup → `Participant__c` | optional, `Restrict` — nur bei `ScopeType = Individual` |
| `StartDate__c` | Woche beginnt | Date | erforderlich — Montag der kalendarischen Woche **dieser** Instanz |
| `EndDate__c` | Woche endet | Date | optional |
| `Status__c` | Status | Picklist (restricted) | erforderlich: `Draft` (Default), `Published` |
| `PublishedAt__c` | Veröffentlicht am | Date/Time | optional |
| `PublishedBy__c` | Veröffentlicht von | Lookup → `User` | optional, `SetNull` |
| `AppliedTemplate__c` | Angewendete Vorlage | Lookup → `ScheduleTemplate__c` | optional, `SetNull` — **nur Provenienz, keine Verbindung** |
| `TemplateAppliedAt__c` | Vorlage angewendet am | Date/Time | optional |
| `DeviationReason__c` | Abweichungsbegründung | Long Text Area (32768, 4) | optional — Begründung, warum diese Instanz vom Standard abweicht (K3) |
| `Notes__c` | Notizen | Long Text Area (32768, 4) | optional |

## 5. Objekt 3 — `ScheduleTemplate__c` (Wochenplan-Vorlage)

| Setup-Attribut | Wert |
|---|---|
| Label | Wochenplan-Vorlage |
| Plural | Wochenplan-Vorlagen |
| Name-Feld | Text (255), Label „Wochenplan-Vorlage", erforderlich |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `ProgramWeek__c` | Kurswoche | Lookup → `ProgramWeek__c` | optional, `SetNull` — Regelfall: Vorlage für eine AZAV-Kurswoche |
| `Program__c` | Program | Lookup → `Program__c` | optional, `SetNull` — Vorlage für ein ganzes Programm (z. B. wiederkehrende Gruppentermine) |
| `Module__c` | Modul | Lookup → `Module__c` | optional, `SetNull` — fachliche Zuordnung, falls modulübergreifend |
| `Description__c` | Beschreibung | Long Text Area (32768, 3) | optional |
| `Status__c` | Status | Picklist (restricted) | erforderlich: `Active` (Default), `Inactive` |

> Die drei Bindungsfelder sind **additiv** angelegt: F14 (Wochen- vs. Kursvorlage) wird dadurch **nicht**
> vorweggenommen, sondern **beides** ermöglicht.

## 6. Objekt 4 — `ScheduleEntry__c` (Planzeile: Aufgabe oder Termin)

| Setup-Attribut | Wert |
|---|---|
| Label | Planzeile |
| Plural | Planzeilen |
| Name-Feld | Text (255), Label „Titel", erforderlich |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `WeeklySchedule__c` | Wochenplan | Lookup → `WeeklySchedule__c` | optional, `Restrict` — null = Vorlagenzeile |
| `ScheduleTemplate__c` | Vorlage | Lookup → `ScheduleTemplate__c` | optional, `Restrict` — null = Planzeile. **Genau eines** von beiden muss gesetzt sein (Prüfung im Trigger) |
| `Description__c` | Beschreibung | Long Text Area (32768, 4) | optional — trägt die Standard-Aufgabenbeschreibung (editierbar) |
| `EntryKind__c` | Art | Picklist (restricted) | erforderlich: `Aktivität`, `Aufgabe` (K2) — Default `Aktivität` (Vorschlag, §0) |
| `Type__c` | Typ | Picklist (restricted) | erforderlich: `Einzelcoaching`, `Gruppencoaching`, `Feedback`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`, `Projektarbeit`, `Sonstiges` — Default `Einzelcoaching` (Vorschlag, §0) |
| `IsRequired__c` | Pflicht | Checkbox | Default `false` — Pflichtbestandteil des AZAV-Standards (K2) |
| `DayOfWeek__c` | Wochentag | Picklist (restricted) | erforderlich: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` — **7 Werte**; Namensstil wie `AvailabilitySlot__c.DayOfWeek__c`, dessen Wertemenge nur Monday–Friday umfasst (K4) — Default `Monday` (Vorschlag, §0) |
| `Date__c` | Datum | Date | optional — in Vorlagenzeilen leer, in Planzeilen serverseitig aus `WeeklySchedule__c.StartDate__c` + Wochentag berechnet |
| `StartTime__c` | Von | Time | optional — bei Aufgaben leer |
| `EndTime__c` | Bis | Time | optional — bei Aufgaben leer |
| `DurationMinutes__c` | Dauer (Minuten) | Number (4,0) | optional — Alternative zu `EndTime__c` |
| `TargetType__c` | Zielgruppe | Picklist (restricted) | erforderlich: `Course`, `Group`, `Individual` — Default `Course` |
| `ParticipantGroup__c` | Teilnehmergruppe | Lookup → `ParticipantGroup__c` | optional, `SetNull` — nur bei `TargetType = Group` |
| `Participant__c` | Teilnehmer | Lookup → `Participant__c` | optional, `Restrict` — nur bei `TargetType = Individual` |
| `Coach_Profile__c` | Coach | Lookup → `Coach_Profile__c` | optional, `SetNull` — **fachliche** Coach-Entität (nicht `User`; `Appointment__c.Coach__c` zeigt auf `User`) |
| `Location__c` | Ort | Picklist (restricted) | optional: `Discord`, `Zoom`, `Teams`, `External` — **kein `Präsenz`**: es gibt keine Präsenzkurse (Entscheidung 2026-10-23, deckt sich mit dem Feature-Plan) |
| `MeetingLink__c` | Meeting Link | URL | optional |
| `SourceTemplateEntry__c` | Aus Vorlageneintrag | Lookup → `ScheduleEntry__c` | optional, `SetNull` — Herkunftsnachweis der Kopie |
| `IsCustomized__c` | Angepasst | Checkbox | Default `false` — nachträglich geändert |
| `Order__c` | Reihenfolge | Number (3,0) | optional — Reihenfolge innerhalb des Tages |
| `DeviationReason__c` | Abweichungsbegründung | Long Text Area (32768, 4) | optional (K3) |
| `Notes__c` | Notizen | Long Text Area (32768, 4) | optional |

## 7. Objekt 5 — `TaskCompletion__c` (Aufgabenerfüllung pro Teilnehmer, K5)

| Setup-Attribut | Wert |
|---|---|
| Label | Aufgabenerfüllung |
| Plural | Aufgabenerfüllungen |
| Name-Feld | AutoNumber `TC-{0000}`, Label „Aufgabenerfüllung" |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `ScheduleEntry__c` | Planzeile | Lookup → `ScheduleEntry__c` | erforderlich, `Restrict` |
| `Participant__c` | Teilnehmer | Lookup → `Participant__c` | erforderlich, `Restrict` |
| `Status__c` | Status | Picklist (restricted) | erforderlich: `Offen` (Default), `Erfüllt`, `Entfällt` |
| `CompletedAt__c` | Erfüllt am | Date/Time | optional |
| `DeviationReason__c` | Abweichungsbegründung | Long Text Area (32768, 4) | optional — z. B. „vorher schon erfüllt (Vorkenntnisse)" |

## 8. Objekt 6 + 7 — Gruppen (nur wenn F1 = ja)

**`ParticipantGroup__c`**

| Setup-Attribut | Wert |
|---|---|
| Label | Teilnehmergruppe |
| Plural | Teilnehmergruppen |
| Name-Feld | Text (255), Label „Teilnehmergruppe", erforderlich |
| Sharing | Private / Private, `enableHistory` = true |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `Program__c` | Program | Lookup → `Program__c` | optional, `SetNull` |
| `Coach_Profile__c` | Coach | Lookup → `Coach_Profile__c` | optional, `SetNull` |
| `Description__c` | Beschreibung | Long Text Area (32768, 3) | optional |

**`ParticipantGroupMember__c`**

| Setup-Attribut | Wert |
|---|---|
| Label | Gruppenzuordnung |
| Plural | Gruppenzuordnungen |
| Name-Feld | AutoNumber `PGM-{0000}` |
| Sharing | Private / Private |

| API-Name | Label | Typ | Details |
|---|---|---|---|
| `ParticipantGroup__c` | Teilnehmergruppe | Lookup → `ParticipantGroup__c` | erforderlich, `Restrict` |
| `Participant__c` | Teilnehmer | Lookup → `Participant__c` | erforderlich, `Restrict` |
| `Order__c` | Reihenfolge | Number (3,0) | optional |

---

## 9. Erweiterungen bestehender Objekte (ebenfalls Setup, nicht Deploy)

| Objekt | Feld | Typ | Details |
|---|---|---|---|
| `Appointment__c` | `ScheduleEntry__c` | Lookup → `ScheduleEntry__c` | optional, `SetNull`, Label „Planzeile", relationshipName `Appointments` — additive Verknüpfung Termin → Planzeile |
| `Learning_Path__c` | `Module__c` | Lookup → `Module__c` | optional, `SetNull`, Label „Modul", relationshipName `Learning_Paths` (K6) — beseitigt die Inkonsistenz zwischen `docs/DATA_MODEL.md` / `backend/docs/AGENTS.md` (dort ist die Kante gezeichnet) und dem Metadatum |
| `Appointment__c` | `Type__c` | Picklist (restricted) | **Werte ergänzen**, bestehende behalten. Org-Stand: `Coaching`, `CheckIn`, `Feedback`, `Behörde`, `Praktikum`, `Sonstiges` — `Feedback` und `Sonstiges` existieren bereits und dürfen **nicht** erneut angelegt werden (`restricted = true`, K3). Neu anzulegen: `Einzelcoaching`, `Gruppencoaching`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`, `Projektarbeit`. Offen: das Mapping `ScheduleEntry__c.Type__c` → `Appointment__c.Type__c` (F9) — späterer Block |
| `AuditEvent__c` | `Domain__c` | Picklist (restricted) | **Wert ergänzen**: `schedule` (die bestehenden Werte sind kleingeschrieben: `appointment`, `learning_path`, `availability` …) |

> `Appointment__c.Type__c` und `AuditEvent__c.Domain__c` sind **Feldänderungen** an gesunden Feldern und
> damit grundsätzlich deploybar (AGENTS.md Z. 1021–1024). **Erst nach** dem Setup-Durchgang deployen,
> damit die Änderung auf einem gesunden Feld sitzt — und `restricted = true` beachten: bestehende Werte
> dürfen nicht entfernt oder umbenannt werden.

---

## 10. Was **nicht** deploybar ist (manuell in Setup, dann in `g1-manual-checklist.md` dokumentieren)

| Artefakt | Warum | Folge |
|---|---|---|
| `CustomValidationRule` | nicht im `@salesforce/cli`-Registry; die XML-Dateien im Repo brechen jeden Deploy (`AGENTS.md` Z. 1160–1166) | **nicht** ins Repo legen; Formeln in `g1-manual-checklist.md` dokumentieren |
| `ApexSharingReason` (`Portal_Access__c`) | nicht deploybar | bleibt wie heute |
| Criteria-Based Sharing Rules / Sharing Sets | nicht deploybar; matchen hier ohnehin 0 Zeilen | Planobjekte bekommen **keine** Sharing-Rows → serverseitige Filterung (Plan 6.2) |
| Org-Wide Defaults, Profile | nie deploybar | Rechte ausschließlich über Permission Sets im Repo |
| Neue Objekte/Felder generell | Runtime-Schema (AGENTS.md Z. 1016) | Setup + Retrieve |

---

## 11. Retrieve und Commit

```bash
cd backend
sf project retrieve start --metadata CustomObject:ProgramWeek__c \
  --metadata CustomObject:WeeklySchedule__c \
  --metadata CustomObject:ScheduleTemplate__c \
  --metadata CustomObject:ScheduleEntry__c \
  --metadata CustomObject:TaskCompletion__c \
  --metadata CustomObject:ParticipantGroup__c \
  --metadata CustomObject:ParticipantGroupMember__c \
  --output-dir . --force
```

> **Nur die sieben neuen Objekte.** `Appointment__c`, `Learning_Path__c` und `AuditEvent__c` sind
> **nicht** Teil dieses Abrufs: sie gehören in den späteren Block (S1.7, nach dem D2-Commit) und
> würden beim Abruf Fremdänderungen an bestehenden Feldern mitziehen (Regel in S1.9).

Das Ergebnis landet unter `backend/force-app/main/default/objects/…` und ist **byte-identisch** mit dem,
was in Setup steht (so der Nachweis in AGENTS.md Z. 1012–1014).

**Abnahme-Checkliste nach dem Retrieve**

1. `sf sobject describe` zeigt **jedes** neue Feld (der Kontrolltest: ein deploytes Feld fehlt dort).
2. `git status` zeigt nur neue/geänderte `objects/…`-Ordner — keine unbeabsichtigten Änderungen an
   bestehenden Feldern (besonders `AuditEvent__c` und `Appointment__c`).
3. Picklist-Werte: API-Name = Label, `restricted = true`, Default-Wert wie oben.
4. `deleteConstraint`: `Restrict` an allen Kind-Beziehungen, `SetNull` an optionalen.
5. `scripts/schema-check.apex` führt eine **feste Objektliste**. Die sieben neuen Objekte kommen
   **nach** dem Anlegen dort hinein — erst dann prüft `npm run schema:check` sie mit. Vorher
   bleibt der Check grün und für diese Objekte blind; die fehlenden Objekte würden als
   `NEWOBJ|…|FAIL|object not present in the runtime schema` gemeldet, was bis zum Anlegen ein
   dauerhaft roter Check wäre (AGENTS.md: ein dauerhaft roter Check wird nicht mehr gelesen).
   Der Tooling-API-Nachweis (`FieldDefinition` je Objekt) deckt die Lücke bis dahin ab.
6. Commit: `chore(salesforce): Wochenplan-Objekte aus Setup retrieved` — **ohne** Deploy-Anspruch.

---

## 12. Vor dem Anlegen zu klären (mit Empfehlung, damit nichts blockiert)

| Frage | Empfehlung | Wirkung auf den Vertrag |
|---|---|---|
| **F1** Gruppen/Kohorten | **anlegen** — entschieden 2026-10-21 | Ohne sie fehlen Zieltyp `Group`, Gruppentermine und die `Group`-Filterung. Sind sie nicht vorgesehen, fallen Objekt 6+7 und die `ParticipantGroup__c`-Felder in 4, 6, 7 weg. |
| **F13** Erledigt-Semantik in v1? | **anlegen** (`TaskCompletion__c`) — entschieden 2026-10-21 | „Lernzeile schon als erfüllt" (fachliche Seite) ist sonst nicht abbildbar; ein späteres Nachrüsten eines neuen Objekts ist teurer als jetzt. |
| **F14** Wochen- vs. Kursvorlage | **beide Bindungen anlegen** | Die Debatte wird nicht vorweggenommen; `ProgramWeek__c` + `Program__c` sind je ein Feld. |
| **F5** Publish-Semantik | **`Status__c` Draft/Published** auf `WeeklySchedule__c` | Wie in 4 spez'd. Ob Änderungen nach Veröffentlichung sofort oder erst nach erneuter Freigabe sichtbar sind, ist eine Produktentscheidung (im Code abbildbar, ohne Schemaänderung). |
| **F3** Durchlauf-Ebene | **nicht anlegen** | `WeeklySchedule__c.StartDate__c` trägt die Kalenderwoche je Instanz; eine eigene Durchlauf-Entität erst, wenn Durchläufe auch Teilnehmerlisten tragen. |
| **F7** Coach↔Programm | **separat** | `ProgramCoach__c` ist eigener Baustein, nicht Teil dieses Vertrags. |

**Was ich nach dem Retrieve brauche:** eine Liste der angelegten Objekte mit ihren
`DeveloperName`/API-Namen und ein bestätigtes `sf sobject describe` — dann setze ich die
Verbraucherseite (Apex-Services, `src/api/schedule/*`, `src/types/schedule.ts`, UI) exakt darauf.

---

## 13. Abgrenzung: was dieser Vertrag **nicht** enthält

- Keine Apex-Klassen, kein UI, keine Tests → Plan `2026-10-21-wochenplan-feature.md`, Phasen 2–7.
- Keine Permission-Set-Änderungen → Phase 3 des Plans (`backend_Coach`:
  `objectPermissions`/`fieldPermissions` für die neuen Objekte, **Pflichtfelder auslassen**;
  `Participant_Portal_Access`: read + `classAccesses`).
- Keine `ProgramCoach__c` → F7, eigener Baustein.
- Keine Termin-Materialisierung → Phase 2 (`ScheduleEntryMaterialisationService`) und dort die noch
  offene Frage F8 (Verschieben eines bestätigten Termins).

## 14. Prüfungen und Regeln (Text, nicht im Repo)

`CustomValidationRule` existiert **nicht** in der `@salesforce/cli`-Registry — nachgemessen am
2026-10-21: `INVALID_TYPE: Unknown type:CustomValidationRule`. XML-Dateien dafür im Repo brechen
**jeden** Deploy (`unable to find matching parent xml file for ValidationRule`,
`backend/docs/AGENTS.md`). Die Regeln stehen deshalb hier als **Text**; die Umsetzung liegt in
den Services und im Trigger (S14–S18).

Werden sie zusätzlich in Classic Setup angelegt, entstehen zwei Implementierungen derselben
Wahrheit: die Setup-Regel greift beim UI-Schreibvorgang und meldet einen anderen Fehler als der
vertraglich vereinbarte Fehlercode des Apex-Pfads. Deshalb: **eine** Stelle je Prüfung.

### 14.1 Prüfungen mit Umsetzungsort

| Prüfung | Regel | Umsetzung |
|---|---|---|
| Wochenindex ≥ 1 | `Number__c < 1` → „Die Wochennummer muss mindestens 1 sein." | S14 |
| Kurswoche je Program eindeutig | `Program__c` + `Number__c`, serverseitig — **kein** `externalId`, dessen Eindeutigkeit ist orgweit (§3) | S14 |
| Gruppenmitgliedschaft eindeutig | `ParticipantGroup__c` + `Participant__c`, serverseitig (F16 offen) | S14 |
| Scope ↔ Zielgruppe | 14.2 | S14 |
| `EndDate__c` ≥ `StartDate__c` | `AND(NOT(ISBLANK(EndDate__c)), EndDate__c < StartDate__c)` → „Das Ende der Woche darf nicht vor dem Startdatum liegen." | S14 |
| Genau eine Elternzuordnung | 14.3 | S15 |
| `TargetType__c` ↔ Zielgruppe | 14.2 (mit den Feldnamen des Eintrags) | S15 |
| `Date__c` berechnet | `StartDate__c` der Instanz + Offset aus `DayOfWeek__c` (Montag=0 … Sonntag=6); in Vorlagenzeilen leer | S15 |
| Zeitangaben | 14.4 | S15 |
| Veröffentlichungsvertrag | `Status__c = Published` ⇒ `PublishedAt__c` und `PublishedBy__c` gesetzt; bei `Draft` leer. Beide Felder werden ausschließlich vom Service gepflegt | S17 |
| Planzeile × Teilnehmer eindeutig | `ScheduleEntry__c` + `Participant__c`, serverseitig | S18 |
| `TaskCompletion__c` nur für Aufgaben | `ScheduleEntry__c.EntryKind__c = Aufgabe` | S18 |
| `Erfüllt` ⇒ `CompletedAt__c` | `AND(ISPICKVAL(Status__c, "Erfüllt"), ISBLANK(CompletedAt__c))` → „Bei erfüllten Aufgaben muss „Erfüllt am" gesetzt sein." | S18 |

### 14.2 Scope- und Zielgruppenprüfung

| `ScopeType__c` / `TargetType__c` | Erforderlich | Muss leer bleiben |
|---|---|---|
| `Course` | – | `ParticipantGroup__c`, `Participant__c` |
| `Group` | `ParticipantGroup__c` | `Participant__c` |
| `Individual` | `Participant__c` | `ParticipantGroup__c` |

```text
OR(
    AND(
        ISPICKVAL(ScopeType__c, "Course"),
        OR(NOT(ISBLANK(ParticipantGroup__c)), NOT(ISBLANK(Participant__c)))
    ),
    AND(
        ISPICKVAL(ScopeType__c, "Group"),
        OR(ISBLANK(ParticipantGroup__c), NOT(ISBLANK(Participant__c)))
    ),
    AND(
        ISPICKVAL(ScopeType__c, "Individual"),
        OR(ISBLANK(Participant__c), NOT(ISBLANK(ParticipantGroup__c)))
    )
)
```

Meldung: „Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum
ausgewählten Teilnehmer."

### 14.3 Genau eine Elternzuordnung

```text
OR(
    AND(ISBLANK(WeeklySchedule__c), ISBLANK(ScheduleTemplate__c)),
    AND(NOT(ISBLANK(WeeklySchedule__c)), NOT(ISBLANK(ScheduleTemplate__c)))
)
```

Meldung: „Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein."

### 14.4 Zeitangaben

```text
OR(
    AND(ISBLANK(StartTime__c), NOT(ISBLANK(EndTime__c))),
    AND(NOT(ISBLANK(StartTime__c)), NOT(ISBLANK(EndTime__c)), EndTime__c <= StartTime__c),
    DurationMinutes__c < 1
)
```

Meldung: „Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer
muss positiv sein."

### 14.5 Bewusst nicht umgesetzt (mit Begründung)

| Vorschlag | Entscheidung | Warum |
|---|---|---|
| Technische Schlüsselfelder `MembershipKey__c`, `ProgramWeekKey__c`, `CompletionKey__c` (Text, Unique, External ID) | **nein** | §3 entscheidet die Eindeutigkeit serverseitig, weil die Eindeutigkeit eines `externalId` **orgweit** ist. Drei zusätzliche Felder wären eine zweite Wahrheit und nur vom Service setzbar |
| `EndDate__c` als Formelfeld `StartDate__c + 6` | **nein** | Ein Formelfeld ist nicht überschreibbar — die UI (S9) könnte es nicht setzen. Der Vertrag führt es als normales optionales Datum (verkürzte Woche zulässig); die Kopplung prüft S14 |
| „Genau eine Bindung" bei `ScheduleTemplate__c` (`ProgramWeek__c` xor `Program__c` xor `Module__c`) | **nein** | F14/F6 sind entschieden: **beide** Bindungen werden angelegt, die Präzedenz fällt erst in der UI (S9/S16). Eine Regel würde die offene Debatte vorwegnehmen |
| Dieselben Regeln zusätzlich in Classic Setup anlegen | **nein** | Zwei Implementierungen derselben Wahrheit mit unterschiedlichen Fehlermeldungen (Einleitung) |
| `PublishedAt__c`/`PublishedBy__c` frei editierbar | **nein** | Beide werden ausschließlich vom Publishing-Service gepflegt (S17) |
| `DeviationReason__c` verpflichtend bei `IsCustomized__c`/`Entfällt` | **nein, in v1 optional** | F18 — die Pflicht lässt sich später ohne Schemaänderung erzwingen |
