# Datenmodell

Kompakte Referenz des Academy-Layers. Fokus auf Custom Objects, Kernfelder, Relationen.

## Überblick

```text
Contact (Standard)
└── Participant__c (1:1)
    ├── Program__c (Lookup)
    ├── Coach_Profile__c (Lookup)
    └── Learning_Path__c (1:N)
        └── Module__c (über Program/konzeptionell, siehe unten)
```

> **Hinweis:** `Project__c` existiert nicht im aktuellen Datenmodell.

## Kernobjekte

### Program__c
Programm/Kursangebot.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `Name` | Text (Auto) | Ja | Program Name |
| `Description__c` | Long Text Area(32768) | Nein |  |
| `DurationWeeks__c` | Number(2,0) | Nein | z. B. 12, 18, 24 |
| `Status__c` | Picklist | Nein | Draft, Active, Archived (Default: Draft) |

### Participant__c
Akademie-Teilnehmer:in, Rolle zum Kontakt.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `Name` | Text | Ja |  |
| `Contact__c` | Lookup(Contact) | Ja | Master-Identität |
| `Program__c` | Lookup(Program__c) | Nein | Zugewiesenes Programm |
| `Coach_Profile__c` | Lookup(Coach_Profile__c) | Nein | Zugewiesener Coach |
| `Status__c` | Picklist | Nein | Default: Onboarding |
| `Email__c` | Email | Nein |  |
| `Discord__c` | Text(255) | Nein |  |
| `GitHub__c` | Text(255) | Nein |  |
| `StartDate__c` | Date | Nein |  |
| `ExpectedEndDate__c` | Date | Nein |  |

### Coach_Profile__c
Coach-Profil.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `Name` | Text | Ja |  |
| `Capacity__c` | Number(2,0) | Nein |  |
| `Discord__c` | Text(255) | Nein |  |
| `Email__c` | Email | Nein |  |
| `GitHub__c` | Text(255) | Nein |  |
| `Role__c` | Picklist/Text | Nein |  |
| `Status__c` | Picklist | Nein |  |

### Learning_Path__c
Lernpfad pro Participant & Program.

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `Name` | Text(Auto)/Title | Ja | Title orientiert |
| `Participant__c` | Lookup(Participant__c) | Ja |  |
| `Program__c` | Lookup(Program__c) | Ja |  |
| `Title__c` | Text(255) | Ja |  |
| `Order__c` | Number(3,0) | Nein | Sortierung |
| `Status__c` | Picklist | Nein | Planned, In Progress, Completed (Default: Planned) |
| `Estimated_Weeks__c` | Number(2,0) | Nein | **Unterstrich** im API-Name (org-truth) |

### Module__c
Modul (z. B. IT Fundamentals, Linux, Azure).

| Feld | Typ | Pflicht | Bemerkung |
|---|---|---|---|
| `Name` | Text | Ja |  |
| `Program__c` | Lookup(Program__c) | Ja | Zugehörigkeit zum Programm |
| `Order__c` | Number(3,0) | Nein | Reihenfolge im Curriculum |
| `Description__c` | Long Text Area(32768) | Nein |  |

## Weitere Objekte (Auszug)

Weitere Custom Objects im Repo/Org (abhängig von Deploy-Status): `Absence__c`, `Appointment__c`, `AvailabilitySlot__c`, `AuditEvent__c`, `AuditOutbox__c`.

Detaillierte Feldlisten inkl. exakter API-Names siehe [`backend/docs/AGENTS.md`](../backend/docs/AGENTS.md#current-state) (Felder, Typen). Für neue Felder immer manuell anlegen → retrieven → [`schema:check`](../backend/scripts/schema-check.mjs).

## Beziehungen (Kardinalität)

| Beziehung | Kardinalität | Zweck |
|---|---|---|
| Contact ↔ Participant__c | 1:1 | Academy-Rolle zum realen Kontakt |
| Participant__c ↔ Learning_Path__c | 1:N | Lernpfade des Teilnehmers |
| Program__c ↔ Module__c | 1:N | Curriculum je Programm |
| Program__c ↔ Participant__c | 1:N (Lookup) | Zuweisung Programm |
| Coach_Profile__c ↔ Participant__c | 1:N (Lookup) | Zuweisung Coach |

## Identity-Filter (Portal)

Portal-API filtert **nie** nach clientseitiger ID. Identity basiert auf `User.ContactId` → `Participant__c.Contact__c`. Siehe [`docs/ARCHITECTURE.md#3-identity--authentifizierung-experience-cloud-portal`](ARCHITECTURE.md#3-identity--authentifizierung-experience-cloud-portal).

## Schema-Regeln (Kurz)

- Neue Custom Fields: **Setup → anlegen → retrieve** (nie per Deploy). Bereits existierende dürfen deployed werden.
- Case beachten (UI API GraphQL case-sensitive).
- `schema:check` nach Schema-Änderungen laufen lassen: `cd backend && npm run schema:check`.
- Lookup-Relationships: Relationship Name korrekt setzen (wird in Setup-Worklist generiert).