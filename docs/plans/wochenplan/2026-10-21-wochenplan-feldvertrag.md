# Feldvertrag: Wochenplan-Objekte (Setup-Spec)

> **Status:** Freigegebene Implementierungsgrundlage  
> **Stand:** 2026-10-21  
> **Gültigkeit:** Verbindlich für Feldvertrag, Abhängigkeiten und Umsetzungsreihenfolge  
> **Änderungen:** Fachliche oder technische Abweichungen müssen in diesem Dokument und gegebenenfalls in einer ADR dokumentiert werden.

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

## 1. Konventionen (aus dem Bestand abgeleitet, nicht erfunden)

| Thema | Konvention im Repo | Für die neuen Objekte |
|---|---|---|
| API-Namen | Custom Objects `X__c`, Custom Fields `Field__c` | CamelCase wie `AvailabilitySlot__c`/`AuditEvent__c` (die jüngeren Objekte) — **nicht** `Learning_Path__c`-Schreibweise |
| Labels | deutsch, z. B. `Status__c` = „Status", `Type__c` = „Typ" | deutsche Labels |
| Picklist-Werte | **API-Name = Label, keine Übersetzung** (belegt: `Appointment__c.Type__c` = `Behörde`, `Praktikum`; `Status__c` = `Draft`…; `AuditEvent__c.Domain__c` = `workbook`, `absence`…) | **keine deutschen Picklist-Labels** — die UI-Übersetzung kommt ins Frontend-Mapping (`src/types/schedule.ts`) |
| Picklist `restricted` | `true` (Status, Type, Domain, Action) | `true` |
| Beziehungen | **ausnahmslos Lookup** (0 Master-Detail im gesamten Modell) | Lookup, `deleteConstraint` = `Restrict` bei Kind-Beziehungen, `SetNull` bei optionalen |
| Name-Feld | Text für Inhaltsobjekte (`Program__c`, `Module__c`, `Participant__c`), AutoNumber für Vorgänge (`Appointment__c` `TERM-{0000}`, `AvailabilitySlot__c` `SLOT-{0000}`, `Learning_Path__c` `LP-{0000}`) | Text für `ProgramWeek__c`/`WeeklySchedule__c`/`ScheduleTemplate__c`/`ScheduleEntry__c`/`ParticipantGroup__c`; AutoNumber für `TaskCompletion__c`/`ParticipantGroupMember__c` |
| `enableHistory` | true bei `Appointment__c`, `Absence__c`, `AvailabilitySlot__c` | true für die Planobjekte (Planhistorie ist fachlich relevant) |
| Sharing | `sharingModel` Private, `externalSharingModel` Private (wie `Appointment__c`) | Private / Private |

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
| `EntryKind__c` | Art | Picklist (restricted) | erforderlich: `Aktivität`, `Aufgabe` (K2) |
| `Type__c` | Typ | Picklist (restricted) | erforderlich: `Einzelcoaching`, `Gruppencoaching`, `Feedback`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`, `Projektarbeit`, `Sonstiges` |
| `IsRequired__c` | Pflicht | Checkbox | Default `false` — Pflichtbestandteil des AZAV-Standards (K2) |
| `DayOfWeek__c` | Wochentag | Picklist (restricted) | erforderlich: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` — **identisch zum Muster von `AvailabilitySlot__c.DayOfWeek__c`** |
| `Date__c` | Datum | Date | optional — in Vorlagenzeilen leer, in Planzeilen serverseitig aus `WeeklySchedule__c.StartDate__c` + Wochentag berechnet |
| `StartTime__c` | Von | Time | optional — bei Aufgaben leer |
| `EndTime__c` | Bis | Time | optional — bei Aufgaben leer |
| `DurationMinutes__c` | Dauer (Minuten) | Number (4,0) | optional — Alternative zu `EndTime__c` |
| `TargetType__c` | Zielgruppe | Picklist (restricted) | erforderlich: `Course`, `Group`, `Individual` |
| `ParticipantGroup__c` | Teilnehmergruppe | Lookup → `ParticipantGroup__c` | optional, `SetNull` — nur bei `TargetType = Group` |
| `Participant__c` | Teilnehmer | Lookup → `Participant__c` | optional, `Restrict` — nur bei `TargetType = Individual` |
| `Coach_Profile__c` | Coach | Lookup → `Coach_Profile__c` | optional, `SetNull` — **fachliche** Coach-Entität (nicht `User`; `Appointment__c.Coach__c` zeigt auf `User`) |
| `Location__c` | Ort | Picklist (restricted) | optional: `Discord`, `Zoom`, `Teams`, `External`, `Präsenz` |
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
| `Appointment__c` | `Type__c` | Picklist (restricted) | **Werte ergänzen**, bestehende behalten: `Einzelcoaching`, `Gruppencoaching`, `Projekt-Kick-off`, `Workshop`, `Selbstlernphase`, `Projektarbeit` |
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
  --metadata CustomObject:Appointment__c \
  --metadata CustomObject:Learning_Path__c \
  --metadata CustomObject:AuditEvent__c \
  --output-dir . --force
```

Das Ergebnis landet unter `backend/force-app/main/default/objects/…` und ist **byte-identisch** mit dem,
was in Setup steht (so der Nachweis in AGENTS.md Z. 1012–1014).

**Abnahme-Checkliste nach dem Retrieve**

1. `sf sobject describe` zeigt **jedes** neue Feld (der Kontrolltest: ein deploytes Feld fehlt dort).
2. `git status` zeigt nur neue/geänderte `objects/…`-Ordner — keine unbeabsichtigten Änderungen an
   bestehenden Feldern (besonders `AuditEvent__c` und `Appointment__c`).
3. Picklist-Werte: API-Name = Label, `restricted = true`, Default-Wert wie oben.
4. `deleteConstraint`: `Restrict` an allen Kind-Beziehungen, `SetNull` an optionalen.
5. Commit: `chore(salesforce): Wochenplan-Objekte aus Setup retrieved` — **ohne** Deploy-Anspruch.

---

## 12. Vor dem Anlegen zu klären (mit Empfehlung, damit nichts blockiert)

| Frage | Empfehlung | Wirkung auf den Vertrag |
|---|---|---|
| **F1** Gruppen/Kohorten | **anlegen** | Ohne sie fehlen Zieltyp `Group`, Gruppentermine und die `Group`-Filterung. Sind sie nicht vorgesehen, fallen Objekt 6+7 und die `ParticipantGroup__c`-Felder in 4, 6, 7 weg. |
| **F13** Erledigt-Semantik in v1? | **anlegen** (`TaskCompletion__c`) | „Lernzeile schon als erfüllt" (fachliche Seite) ist sonst nicht abbildbar; ein späteres Nachrüsten eines neuen Objekts ist teurer als jetzt. |
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
