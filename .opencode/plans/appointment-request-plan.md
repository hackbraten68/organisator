# Termin-Anfrage: Teilnehmer fordert an, Coach schlägt vor

Entscheidung vom 2026-10-07, Umsetzungsplan. Grundlage sind **gemessene** Befunde am
Codebestand, keine Annahmen — jede unten genannte Datei und Feldnummer wurde geprüft.

Der Ablauf, um den es geht:

```
Teilnehmer                    Coach                        System
─────────────────────────────────────────────────────────────────────────
"Ich brauche einen Termin"
  → Status Open ────────────→  Warteschlange (alle Coaches)
                                 mit Wartealter
                               wählt genau einen Termin
  ← Status Proposed ─────────  Status Proposed
    sieht den Termin
  "Annehmen" / "Ablehnen"
    Annahme → Appointment__c  angelegt, Status Confirmed
```

---

## 1. Was das Datenmodell heute schon kann

| Frage | Befund |
|---|---|
| Kann eine Anfrage ohne Uhrzeit ein `Appointment__c` sein? | **Nein.** `StartTime__c` und `EndTime__c` sind `required=true` (`objects/Appointment__c/fields/`). Eine Anfrage hat per Definition keinen Termin. |
| Wer ist der Coach am Termin? | `Appointment__c.Coach__c` zeigt auf **`User`** (`<referenceTo>User</referenceTo>`, Relationship `CoachedAppointments`). Ein Coach ist also ein Login — das ist für die Warteschlange die entscheidende Eigenschaft. |
| Gibt es eine Coach-Zuordnung am Teilnehmer? | `Participant__c.Coach_Profile__c`, Lookup, Relationship `Coach_Profiles`, gepflegt über `UpdateParticipant.graphql:26`. **Für die Warteschlange wird sie nicht gebraucht** — alle Coaches sehen alle offenen Anfragen. |
| Ist `Coach_Profile__c` einem Login zugeordnet? | Nein — die Felder sind Capacity, Discord, Email, GitHub, Role, Status. Bei einer Warteschlange ist das egal; bei einer 1:1-Zuordnung wäre es ein Loch. |
| Gibt es schon einen passenden Status? | `Appointment__c.Status__c` ist eine **restricted** Picklist: Draft (Default), Finding, Confirmed, Completed, Documented, Cancelled, NoShow. `Finding` wird heute vom Vorschlagpfad gesetzt. |
| Wie kommt der Coach an den Termin, den er vorschlägt? | `AvailabilitySlot__c` (User, DayOfWeek, ValidFrom/ValidTo, IsActive) plus `src/utils/slotDateTime.ts` aus B4. Slot ohne Datum wird nicht vorgeschlagen. |
| Wie liest das Portal heute Daten? | Über Apex REST: `/services/apexrest/participant-portal/me` (`frontend/.../participantApi.ts:63`). Es gibt also einen Präzedenzfall, an dem wir uns orientieren. |

**Damit ist die Richtung klar: neues Objekt.** `AppointmentRequest__c` trägt die Anfrage,
`Appointment__c` entsteht erst bei Annahme.

---

## 2. Datenmodell `AppointmentRequest__c`

| Feld | Typ | Pflicht | Zweck |
|---|---|---|---|
| `Participant__c` | Lookup | ja | wer angefragt hat. Relationship `AppointmentRequests` |
| `Type__c` | Picklist, restricted | ja | Terminart. **Werte identisch zu `Appointment__c.Type__c`** — siehe Befund 6.1 |
| `Message__c` | Long Text Area (1000) | nein | was der Teilnehmer braucht. Optional, damit der Button „Ich brauche einen Termin" allein genügt |
| `Status__c` | Picklist, restricted | ja, Default `Open` | `Open`, `Proposed`, `Accepted`, `Declined`, `Cancelled` |
| `ProposedStartTime__c` | DateTime | nein | gesetzt, wenn ein Coach antwortet |
| `ProposedEndTime__c` | DateTime | nein | dito |
| `ProposedBy__c` | Lookup auf `User` | nein | wer vorgeschlagen hat |
| `ProposedByName__c` | Text (80) | nein | Snapshot. Der Teilnehmer darf keine `User`-Rechte bekommen und sieht trotzdem, wer vorgeschlagen hat |
| `RespondedAt__c` | DateTime | nein | wann der Coach geantwortet hat |
| `DeclineReason__c` | Text (255) | nein | Teilnehmer kann einen Grund angeben |
| `Appointment__c` | Lookup | nein | der bei Annahme erzeugte Termin, Relationship `OriginatingRequest` |

**Kein Feld für das Warten:** das Alter kommt aus `CreatedDate`, es gibt keinen Scheduled
Job in beiden Projekten (verifiziert) und es soll laut Entscheidung auch keinen geben.

### Zustandsmaschine

| Von | Nach | Wer | Was passiert |
|---|---|---|---|
| — | `Open` | Teilnehmer | Anfrage mit Typ und optionaler Nachricht |
| `Open` | `Proposed` | Coach | genau ein Termin, `ProposedBy` = sein `UserId`, `RespondedAt` |
| `Proposed` | `Accepted` | Teilnehmer | `Appointment__c` wird angelegt (Status `Confirmed`), `Appointment__c`-Feld der Anfrage gesetzt |
| `Proposed` | `Declined` | Teilnehmer | `DeclineReason` optional. Die Anfrage ist zu; eine neue ist möglich |
| `Open` | `Cancelled` | Teilnehmer | Zurückziehen, ohne dass ein Coach zugesehen hat |
| `Proposed` | `Cancelled` | Teilnehmer | Zurückziehen, nachdem ein Coach schon vorgeschlagen hat |

**Kein Weg zurück.** Aus `Accepted`, `Declined` und `Cancelled` geht nichts mehr. Ein
erneuter Bedarf ist eine neue Anfrage. `Expired` gibt es bewusst nicht — die Entscheidung
war „offen lassen mit Alter".

**Nur eine offene Anfrage je Teilnehmer:** `Open` und `Proposed` gelten als offen. Die
Prüfung gehört **in den Schreibpfad**, nicht ins UI — zwei Tabs oder zwei Geräte
umgehen eine nur im Button erzwungene Sperre.

---

## 3. Schreibpfad: Apex, nicht UI API

Der heutige Audit-Schreibpfad läuft clientseitig über die Session des angemeldeten
Coaches (`api/audit/auditApiService.ts:212` → GraphQL-Mutation) — genau die Konstruktion,
an der S3 festgemacht wurde: die Rechte belong clientseitig, und jeder Coach kann
beliebige Datensätze schreiben. Für Anfragen wäre das schlimmer als nur unschön:

**Zwei Coaches können dieselbe Anfrage beantworten.** Wer zuerst schreibt, gewinnt; der
zweite überschreibt still den Vorschlag des ersten. Bei einer UI-API-Mutation ohne
Bedingung gibt es keine Sperre.

Daher: **eine Apex-REST-Ressource für den gesamten Anfrage-Schreibpfad**, mit
`SELECT ... FOR UPDATE` in der Transaktion und einem bedingten Update
(`WHERE Status__c = :expectedStatus`). Beide Prüfungen sind nötig — das `FOR UPDATE`
verhindert das gleichzeitige Lesen, die Status-Bedingung schützt davor, dass ein zweiter
Aufruf einen bereits beantworteten Datensatz überschreibt.

| Route | Rolle | Wirkung |
|---|---|---|
| `GET /services/apexrest/appointment-requests/open` | Coach | Warteschlange, alle `Open`, mit Alter |
| `POST …/open` | Teilnehmer | Anfrage anlegen, prüft „nur eine offene" |
| `POST …/{id}/propose` | Coach | genau ein Termin, setzt `Proposed` |
| `POST …/{id}/accept` | Teilnehmer | legt `Appointment__c` an, setzt `Accepted` |
| `POST …/{id}/decline` | Teilnehmer | `Declined` mit Grund |
| `POST …/{id}/cancel` | Teilnehmer | `Cancelled` |
| `GET …/mine` | Teilnehmer | die eigene Anfrage mit Status und Vorschlag |

Die Identität kommt aus `UserInfo.getUserId()` — `StaffIdentity.resolve()`
(`classes/StaffIdentity.cls:146`) ist der etablierte Weg, die eigene Identität zu
ermitteln, und `ParticipantPortalData`-Präzedenz gilt für den Portalpfad.

---

## 4. Rechte

Das ist der Teil, der ohne E1 **nicht** sauber wird. Stand der Recherche:

- `Participant_Portal_Access` hat heute **keine** Objekt- oder Schreiberechte auf
  `Appointment__c` — der Portalpfad ist Greenfield.
- Die Sharing Rule `PortalParticipantSeesOwnRecord`, die
  `Participant_Portal_Access.permissionset-meta.xml:65` referenziert, liegt in **keinem**
  Projekt. Das ist Gate G1b und unabhängig von diesem Feature.

Was das Feature selbst braucht:

| Beteiligter | Rechte |
|---|---|
| Portalnutzer | `AppointmentRequest__c`: create, read, update. **Kein** `viewAllRecords`, **kein** delete. Plus Kriterien-basierte Sharing Rule wie bei `Participant__c` |
| Coach (`backend_Coach`) | `AppointmentRequest__c`: read, update (nicht create, nicht delete) |
| beide | Feldrechte auf `Type__c`, `Status__c`, `ProposedStartTime__c`, `ProposedEndTime__c`, `Message__c`, `DeclineReason__c` |

**Zu verifizieren, bevor das gebaut wird:** Apex-DML erzwingt FLS auch in `with sharing`.
Ein Portalnutzer ohne Objektberechtigung kann daher auch über Apex keinen Datensatz
anlegen. Ob `with sharing` + `AccessLevel.SYSTEM_MODE` die FLS-Prüfung umgeht oder wir
die Objektberechtigung schlicht geben müssen, ist im Repo nicht belegt und muss an einem
Prototyp verifiziert werden — nicht angenommen.

Unabhängig davon gilt: **`defaultSharing>Private`** (Paket P3) gehört in denselben Deploy,
sonst hängt die neue Sharing Rule an einem OWD, den niemand dokumentiert hat.

---

## 5. Oberfläche

### Portal (Teilnehmer)

1. Startseite bekommt einen Block „Termin anfragen". Button **„Ich brauche einen Termin"**.
2. Dialog: Terminart (Pflicht) + freie Notiz (optional). Ein Klick genügt, wenn der
   Button ohne offene Anfrage sichtbar ist.
3. Statusanzeige:
   - `Open` → „Anfrage gesendet, wir melden uns" + Wartezeit
   - `Proposed` → der eine Termin, Name des Coachs, zwei Buttons **Annehmen** / **Ablehnen**
   - `Accepted` → der Termin mit Ort oder Link
   - `Declined` → Grund, falls angegeben, plus neuer Button
   - `Cancelled` → neutraler Hinweis
4. Solange `Open` oder `Proposed`: der Anfrage-Button ist deaktiviert mit sichtbarem
   Grund. Das ist nur Anzeige — die eigentliche Sperre sitzt im Schreibpfad.

### Backoffice (Coach)

1. Neuer Tab **„Anfragen"** neben den Teilnehmer-Tabs: Liste aller offenen Anfragen mit
   Teilnehmer, Terminart, Nachricht, **Wartezeit** und Alter.
2. „Vorschlagen" öffnet den bestehenden `ProposeSlotsDialog` mit genau einer Auswahl
   (B3, seit `6b20b6a`). Kein neuer Dialog nötig.
3. Nach dem Vorschlag verschwindet die Anfrage aus der Liste und erscheint beim
   Teilnehmer.

---

## 6. Nebenbefunde, die dabei auffielen

**6.1 — Terminart und Ort im UI stimmen nicht mit der Org überein. Beides ist am
2026-10-07 behoben.** Die Picklists sind `restricted`, ein unbekannter Wert wird also
vom Org abgelehnt — der Dialog baut den Termin, das Speichern scheitert.

- `Appointment__c.Type__c` kennt `Coaching, CheckIn, Feedback, Behörde, Praktikum,
  Sonstiges`. Das Bundle bot `Berufsschule` — ein **Absence**-Typ, der in die
  Terminliste gewandert war. `Feedback` war über die Oberfläche gar nicht erreichbar.
  → Bundle auf `Feedback` umgestellt.
- `Appointment__c.Location__c` kennt `Discord, Zoom, Teams, External`. Das Bundle bot
  `OnSite, Teams, Phone, Hybrid, External`, und `AppointmentFormDialog.tsx:50` fiel für
  neue Termine auf **`OnSite`** zurück — **jeder neu angelegte Termin** wäre an der
  restricted Picklist gescheitert. Entscheidung vom 2026-10-07: Org-Picklist um
  `OnSite` (Default, Label „Vor Ort"), `Phone` und `Hybrid` erweitert, UI unverändert.
  `Discord` und `Zoom` bleiben für Bestandstermine gültig, werden aber nicht mehr
  angeboten.

Damit das nicht stillebens zurückkommt: `src/types/appointmentPicklist.test.ts` hält
`APPOINTMENT_TYPES`, `APPOINTMENT_STATUSES` und `APPOINTMENT_LOCATIONS` gegen die
Deploy-Metadaten. Die Listen stehen nicht mehr an drei Stellen im Code, sondern nur noch
in `src/types/appointment.ts`. `Discord` und `Zoom` sind als `LEGACY_ORG_VALUES` mit
Begründung eingetragen — benannt, nicht global erlaubt.

Die neue `AppointmentRequest__c.Type__c` übernimmt dieselbe Quelle, sonst
wiederholt sich der Fehler am neuen Objekt.

**6.2 — `Finding` wird heute von zwei Bedeutungen benutzt.** `rescheduleAppointment` setzt
Status `Finding`, das im Vokabular „Termin wird gesucht" heißt. In der neuen Kette ist
`Finding` die logische Nachfolge von `Proposed`, sobald der Termin existiert. Beides in
einem Feld ohne Herkunftsschema ist genau die Art Marker, an der später niemand mehr
erkennt, was ein Status bedeutet.

---

## 7. Tests

| Ebene | Umfang |
|---|---|
| Apex (`sf apex run test`, **ORG nötig**) | Zustandsmaschine vollständig: jeder Übergang, jeder verbotene Übergang. Die Regel „nur eine offene Anfrage" unter zwei gleichzeitigen Anlagen. Zwei Coaches auf derselben Anfrage: der zweite bekommt einen Fehler und überschreibt nichts. Rollen: ein Portalnutzer sieht nur seine eigene Anfrage |
| Portal-Bundle | Statusanzeige für jeden Status, Button-Sperre bei offener Anfrage, Ablehnen mit und ohne Grund, Fehlerpfade |
| Backoffice-Bundle | Warteschlange mit Wartezeit, Vorschlag mit genau einem Slot, Anfrage verschwindet nach dem Vorschlag |
| Kanonisch | Die Liste der `Type__c`-Werte für die Anfrage wird gegen die `Appointment__c`-Metadaten geprüft — das Muster liefert `appointmentPicklist.test.ts` mit |

---

## 8. Reihenfolge und Aufwand

| # | Schritt | Aufwand | Braucht |
|---|---|---|---|
| 1 | `AppointmentRequest__c` als Metadaten, `defaultSharing>Private`, Berechtigungen | S | Gate G1b beantwortet |
| 2 | Apex-Ressource mit `FOR UPDATE` und bedingtem Update, inkl. Tests | M | Sandbox für `sf apex run test` |
| 3 | Portal: Block, Dialog, Statusanzeige, Annehmen/Ablehnen | M | Schritt 2 |
| 4 | Backoffice: Warteschlange mit Wartealter, Anbindung an `ProposeSlotsDialog` | M | Schritt 2 |
| 5 | 6.1 beheben (`Type__c` und `Location__c` konsistent, mit Wächtertest) | XS | ✅ erledigt 2026-10-07 |

Schritt 5 war unabhängig und ist vorgezogen worden. Er hat sich als schwerer erwiesen
als im Plan absehbar: nicht die Terminart, sondern der Ort — dort scheiterte **jeder**
neu angelegte Termin.

---

## 9. Was dieser Plan offen lässt

- **E1 bleibt die Wurzel.** Solange Coaches über `viewAllRecords` alles sehen, ist die
  Warteschlange ein Arbeitsauftrag und keine Zuständigkeit. Das Feature funktioniert
  trotzdem — aber es behebt nicht das Berechtigungsproblem.
- **Die Sharing Rule für `AppointmentRequest__c`** ist neu zu schreiben. Das Muster steht
  in `ParticipantPortalSharingService.cls:1-30` dokumentiert; die Rule
  `PortalParticipantSeesOwnRecord` selbst fehlt im Repo.
- **Ob FLS im Apex-Portalpfad eine Objektberechtigung erzwingt**, ist vor Schritt 3 an
  einem Prototyp zu klären. Wird es getestet statt angenommen, kostet es einen Tag und
  spart eine Fehlannahme in der Architektur.
- **Der Coach, der vorschlagen hat, ist als `User` gespeichert.** Ob später eine
  Coach-Profil-Zuordnung gewünscht ist, entscheidet sich dann, wenn `Coach_Profile__c`
  überhaupt eine Rolle im Terminmodell bekommt — heute hat es keine.
