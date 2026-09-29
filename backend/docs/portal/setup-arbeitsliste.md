# Setup-Arbeitsliste — Academy-Datenmodell in `hubSandbox`

**Stand:** 2026-09-30
**Zweck:** vollstaendige Liste aller Custom-Felder, die in Setup **von Hand** angelegt werden
muessen, weil ein Deploy sie nicht ins Runtime-Schema bringt.

## Warum manuell

Die Regel aus `../AGENTS.md` (Finding 12) gilt uneingeschraenkt. Sie war bislang nur an
Scratch-Orgs belegt (E1-E3, alle 2026-09-29). Offen war, ob sie auch fuer Sandboxes gilt,
weil die Ablehnung deployter Custom Fields ein Scratch-Org-Spezifikum sein koennte.

Kontrollversuch am 2026-09-30 in `hubSandbox` mit `Program__c` (3 Felder, Wurzelobjekt
ohne Lookups):

```text
sf project deploy start     -> Status: Succeeded, 4 Komponenten "Created"
sf data query               -> ERROR: No such column 'Description__c' on entity 'Program__c'
Tooling API FieldDefinition -> Description__c, DurationWeeks__c, Status__c  (sind vorhanden)
sf sobject describe         -> 9 Felder, davon 0 mit __c
```

Exakt der dokumentierte Fehlerfall: Deploy-Report, Metadata API und Tooling API melden die
Felder, SOQL und `sobject describe` kennen sie nicht. **Deployment success is not evidence.**

**Ergebnis: die Regel gilt auch in Sandboxes.** Es gibt keinen Weg daran vorbei. Die 90
Felder unten muessen in Setup angelegt und anschliessend retrieviert werden.

## Anlagereihenfolge

Lookups erzwingen eine Reihenfolge. Ein Lookup-Feld laesst sich erst anlegen, wenn sein
Zielfeld existiert:

| #   | Objekt                | Felder | Lookup-Voraussetzung             |
| --- | --------------------- | -----: | -------------------------------- |
| 1   | `AuditOutbox__c`      |      9 | — (Wurzelobjekt)                 |
| 2   | `AvailabilitySlot__c` |      8 | — (Wurzelobjekt)                 |
| 3   | `Coach_Profile__c`    |      6 | — (Wurzelobjekt)                 |
| 4   | `Program__c`          |      3 | — (Wurzelobjekt)                 |
| 5   | `Module__c`           |      3 | `Program__c`                     |
| 6   | `Participant__c`      |      9 | `Coach_Profile__c`, `Program__c` |
| 7   | `Absence__c`          |     11 | `Participant__c`                 |
| 8   | `Appointment__c`      |     13 | `Participant__c`                 |
| 9   | `AuditEvent__c`       |     22 | `Participant__c`                 |
| 10  | `Learning_Path__c`    |      6 | `Participant__c`, `Program__c`   |

Pro Objekt: erst das Objekt **ohne** Lookups anlegen, dann die Wurzelobjekte, dann die
Lookup-Felder ergaenzen.

Die vier Wurzelobjekte koennen in beliebiger Reihenfolge und unabhaengig entstehen.

## Feldliste

**90 Felder in 10 Objekten.**

Legende: `REQUIRED` = Pflichtfeld · `UNIQUE` = eindeutig · `EXTERNAL-ID` = External ID ·
`HISTORY` = Feldhistorie aktiv · `Restrict` = Loeschen des Ziels blockiert

### Absence__c — Abwesenheit (externalSharing: Private)

| Feld API          | Label           | Typ                                                                               | Flags            | Beschreibung                                          |
| ----------------- | --------------- | --------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `ApprovedAt__c`   | Genehmigt am    | DateTime                                                                          | HISTORY          | Zeitpunkt der Genehmigung                             |
| `ApprovedBy__c`   | Genehmigt von   | Lookup → User                                                                     | HISTORY          | Coach/Staff, der genehmigt hat                        |
| `CoachComment__c` | Coach-Kommentar | LongTextArea, Länge 32768                                                         |                  | Begründung bei Ablehnung durch Coach/Staff            |
| `EndDate__c`      | Bis             | Date                                                                              | REQUIRED HISTORY | Letzter Tag der Abwesenheit                           |
| `Participant__c`  | Teilnehmer      | Lookup → Participant__c, Restrict                                                 | REQUIRED HISTORY | Teilnehmer, der die Abwesenheit meldet                |
| `Reason__c`       | Grund           | LongTextArea, Länge 32768                                                         |                  | Begründung (optional, sensitiv - Audit redaktioniert) |
| `RejectedAt__c`   | Abgelehnt am    | DateTime                                                                          | HISTORY          | Zeitpunkt der Ablehnung                               |
| `RejectedBy__c`   | Abgelehnt von   | Lookup → User                                                                     | HISTORY          | Coach/Staff, der abgelehnt hat                        |
| `StartDate__c`    | Von             | Date                                                                              | REQUIRED HISTORY | Erster Tag der Abwesenheit                            |
| `Status__c`       | Status          | Picklist: Submitted, Approved, Rejected, Cancelled (Default: Submitted)           | REQUIRED HISTORY | Status der Abwesenheitsmeldung                        |
| `Type__c`         | Typ             | Picklist: Krank, Urlaub, Berufsschule, Praktikum, Behörde, Sonstiges (Default: -) | REQUIRED         | Art der Abwesenheit (verweist auf AbsenceType__mdt)   |

### Appointment__c — Termin (externalSharing: Private)

| Feld API                | Label           | Typ                                                                                                                | Flags              | Beschreibung                                         |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------- |
| `CancellationReason__c` | Absagegrund     | LongTextArea, Länge 32768                                                                                          |                    | Begründung bei Absage                                |
| `Coach__c`              | Coach           | Lookup → User                                                                                                      | HISTORY            | Coach, der den Termin durchführt                     |
| `CompletedAt__c`        | Durchgeführt am | DateTime                                                                                                           | HISTORY            | Zeitpunkt der Durchführung                           |
| `ConfirmedAt__c`        | Bestätigt am    | DateTime                                                                                                           | HISTORY            | Zeitpunkt der Bestätigung                            |
| `CorrelationId__c`      | Correlation ID  | Text                                                                                                               | UNIQUE EXTERNAL-ID | Booking Journey Correlation ID (First-Class Tracker) |
| `EndTime__c`            | Bis             | DateTime                                                                                                           | REQUIRED HISTORY   | Ende des Termins                                     |
| `Location__c`           | Ort             | Picklist: Vor Ort, MS Teams, Telefon, Hybrid, Extern (Default: -)                                                  |                    | Ort/Art des Termins                                  |
| `MeetingLink__c`        | Meeting Link    | Url                                                                                                                |                    | Link zum Online-Meeting (Teams, Zoom, etc.)          |
| `Notes__c`              | Notizen         | LongTextArea, Länge 32768                                                                                          |                    | Notizen zum Termin                                   |
| `Participant__c`        | Teilnehmer      | Lookup → Participant__c, Restrict                                                                                  | REQUIRED HISTORY   | Teilnehmer des Termins                               |
| `StartTime__c`          | Von             | DateTime                                                                                                           | REQUIRED HISTORY   | Beginn des Termins                                   |
| `Status__c`             | Status          | Picklist: Draft, Terminfindung, Bestätigt, Durchgeführt, Dokumentiert, Abgesagt, Nicht erschienen (Default: Draft) | REQUIRED HISTORY   | Status des Termins                                   |
| `Type__c`               | Typ             | Picklist: Coaching, Check-In, Berufsschule, Behörde, Praktikum, Sonstiges (Default: -)                             | REQUIRED HISTORY   | Art des Termins                                      |

### AuditEvent__c — Audit Event (externalSharing: Private)

| Feld API              | Label              | Typ                                                                                                                                                                                                                                                                                                                                                  | Flags              | Beschreibung |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------ |
| `Action__c`           | Action             | Picklist: created, updated, deleted, archived, restored, status_changed, submitted, approved, rejected, cancelled, assigned, started, stopped, checked_in, checked_out, corrected, flagged, reviewed, rescheduled, attendance_changed, document_added, answer_updated, reported, entry_created, entry_updated, entry_deleted, reordered (Default: -) | REQUIRED           |              |
| `ActorDisplayName__c` | Actor Display Name | Text                                                                                                                                                                                                                                                                                                                                                 |                    |              |
| `ActorId__c`          | Actor Id           | Text                                                                                                                                                                                                                                                                                                                                                 |                    |              |
| `ActorType__c`        | Actor Type         | Picklist: staff, participant, system, integration (Default: -)                                                                                                                                                                                                                                                                                       | REQUIRED           |              |
| `ChangedFields__c`    | Changed Fields     | LongTextArea, Länge 4000                                                                                                                                                                                                                                                                                                                             |                    |              |
| `Changes__c`          | Changes            | LongTextArea, Länge 131072                                                                                                                                                                                                                                                                                                                           |                    |              |
| `CorrelationId__c`    | Correlation Id     | Text                                                                                                                                                                                                                                                                                                                                                 |                    |              |
| `Domain__c`           | Domain             | Picklist: workbook, absence, appointment, classbook, daily_checkin, time_tracking, authentication, participant, system, learning_path, availability (Default: -)                                                                                                                                                                                     | REQUIRED           |              |
| `EventType__c`        | Event Type         | Text                                                                                                                                                                                                                                                                                                                                                 | REQUIRED           |              |
| `Metadata__c`         | Metadata           | LongTextArea, Länge 131072                                                                                                                                                                                                                                                                                                                           |                    |              |
| `OccurredAt__c`       | Occurred At        | DateTime                                                                                                                                                                                                                                                                                                                                             | REQUIRED           |              |
| `ParentId__c`         | Parent Id          | Text                                                                                                                                                                                                                                                                                                                                                 |                    |              |
| `ParentType__c`       | Parent Type        | Text                                                                                                                                                                                                                                                                                                                                                 |                    |              |
| `ParticipantId__c`    | Participant Id     | Lookup → Participant__c, Restrict                                                                                                                                                                                                                                                                                                                    |                    |              |
| `Reason__c`           | Reason             | LongTextArea, Länge 1000                                                                                                                                                                                                                                                                                                                             |                    |              |
| `RequestId__c`        | Request Id         | Text                                                                                                                                                                                                                                                                                                                                                 | UNIQUE EXTERNAL-ID |              |
| `SchemaVersion__c`    | Schema Version     | Number (3,0)                                                                                                                                                                                                                                                                                                                                         | REQUIRED           |              |
| `Sensitivity__c`      | Sensitivity        | Picklist: normal, personal, restricted (Default: -)                                                                                                                                                                                                                                                                                                  | REQUIRED           |              |
| `Source__c`           | Source             | Picklist: web, mobile, api, import, automation, integration, migration (Default: -)                                                                                                                                                                                                                                                                  | REQUIRED           |              |
| `SubjectId__c`        | Subject Id         | Text                                                                                                                                                                                                                                                                                                                                                 | REQUIRED           |              |
| `SubjectType__c`      | Subject Type       | Text                                                                                                                                                                                                                                                                                                                                                 | REQUIRED           |              |
| `Visibility__c`       | Visibility         | Picklist: staff, participant, restricted (Default: -)                                                                                                                                                                                                                                                                                                | REQUIRED           |              |

### AuditOutbox__c — Audit Outbox (externalSharing: Private)

| Feld API           | Label          | Typ                                                     | Flags    | Beschreibung |
| ------------------ | -------------- | ------------------------------------------------------- | -------- | ------------ |
| `CorrelationId__c` | Correlation Id | Text                                                    |          |              |
| `Error__c`         | Error          | LongTextArea, Länge 32768                               |          |              |
| `EventType__c`     | Event Type     | Text                                                    | REQUIRED |              |
| `NextRetryAt__c`   | Next Retry At  | DateTime                                                |          |              |
| `ParticipantId__c` | Participant Id | Text                                                    |          |              |
| `Payload__c`       | Payload        | LongTextArea, Länge 32768                               |          |              |
| `RetryCount__c`    | Retry Count    | Number (3,0)                                            | REQUIRED |              |
| `Status__c`        | Status         | Picklist: PENDING, PROCESSED, FAILED (Default: PENDING) | REQUIRED |              |
| `SubjectId__c`     | Subject Id     | Text                                                    |          |              |

### AvailabilitySlot__c — Verfügbarkeits-Slot (externalSharing: Private)

| Feld API       | Label       | Typ                                                                    | Flags    | Beschreibung                     |
| -------------- | ----------- | ---------------------------------------------------------------------- | -------- | -------------------------------- |
| `DayOfWeek__c` | Wochentag   | Picklist: Montag, Dienstag, Mittwoch, Donnerstag, Freitag (Default: -) | REQUIRED | Wochentag                        |
| `EndTime__c`   | Bis         | Time                                                                   | REQUIRED | Ende des Slots (Uhrzeit)         |
| `IsActive__c`  | Aktiv       | Checkbox                                                               |          | Slot ist aktiv und buchbar       |
| `StartTime__c` | Von         | Time                                                                   | REQUIRED | Beginn des Slots (Uhrzeit)       |
| `Type__c`      | Typ         | Picklist: Coaching, Check-In, Allgemein (Default: General)             | REQUIRED | Art der Verfügbarkeit            |
| `User__c`      | Coach/Staff | Lookup → User                                                          | HISTORY  | Coach/Staff, dem der Slot gehört |
| `ValidFrom__c` | Gültig ab   | Date                                                                   |          | Gültig ab (Datum)                |
| `ValidTo__c`   | Gültig bis  | Date                                                                   |          | Gültig bis (Datum)               |

### Coach_Profile__c — Coach Profile (externalSharing: Private)

| Feld API      | Label    | Typ                                                                      | Flags | Beschreibung              |
| ------------- | -------- | ------------------------------------------------------------------------ | ----- | ------------------------- |
| `Capacity__c` | Capacity | Number (2,0)                                                             |       | Coach Capacity            |
| `Discord__c`  | Discord  | Text                                                                     |       | Coach Discord User Handle |
| `Email__c`    | Email    | Email                                                                    |       | Coach Email               |
| `GitHub__c`   | GitHub   | Text                                                                     |       | Coach GitHub Username     |
| `Role__c`     | Role     | Picklist: Lead IT Coach, Kubernetes Coach, AWS Coach, Staff (Default: -) |       | Coach Role                |
| `Status__c`   | Status   | Checkbox                                                                 |       | Coach active status       |

### Learning_Path__c — Learning Path (externalSharing: Private)

| Feld API             | Label           | Typ                                                          | Flags    | Beschreibung |
| -------------------- | --------------- | ------------------------------------------------------------ | -------- | ------------ |
| `Estimated_Weeks__c` | Estimated Weeks | Number (2,0)                                                 |          |              |
| `Order__c`           | Order           | Number (3,0)                                                 |          |              |
| `Participant__c`     | Participant     | Lookup → Participant__c, SetNull                             |          |              |
| `Program__c`         | Program         | Lookup → Program__c, SetNull                                 |          |              |
| `Status__c`          | Status          | Picklist: Planned, In Progress, Completed (Default: Planned) |          |              |
| `Title__c`           | Title           | Text                                                         | REQUIRED |              |

### Module__c — Module (externalSharing: Private)

| Feld API         | Label       | Typ                           | Flags    | Beschreibung                                 |
| ---------------- | ----------- | ----------------------------- | -------- | -------------------------------------------- |
| `Description__c` | Description | LongTextArea, Länge 32768     |          |                                              |
| `Order__c`       | Order       | Number (3,0)                  |          |                                              |
| `Program__c`     | Program     | Lookup → Program__c, Restrict | REQUIRED | Lookup Relationship → Related To: Program__c |

### Participant__c — Participant (externalSharing: Private)

| Feld API             | Label           | Typ                                                                                    | Flags    | Beschreibung                |
| -------------------- | --------------- | -------------------------------------------------------------------------------------- | -------- | --------------------------- |
| `Coach_Profile__c`   | Coach Profile   | Lookup → Coach_Profile__c, SetNull                                                     |          |                             |
| `Contact__c`         | Contact         | Lookup → Contact, Restrict                                                             | REQUIRED |                             |
| `Discord__c`         | Discord         | Text                                                                                   |          | Discord User Handle         |
| `Email__c`           | Email           | Email                                                                                  |          | Student Email Addres        |
| `ExpectedEndDate__c` | ExpectedEndDate | Date                                                                                   |          | Student's Expected End Date |
| `GitHub__c`          | GitHub          | Text                                                                                   |          | Github Username             |
| `Program__c`         | Program         | Lookup → Program__c, SetNull                                                           |          |                             |
| `StartDate__c`       | StartDate       | Date                                                                                   |          | Student's Start Date        |
| `Status__c`          | Status          | Picklist: Onboarding, Active, Paused, Graduated, Placed, Dropped (Default: Onboarding) |          | Current Student Status      |

### Program__c — Program (externalSharing: Private)

| Feld API           | Label         | Typ                                                | Flags | Beschreibung                       |
| ------------------ | ------------- | -------------------------------------------------- | ----- | ---------------------------------- |
| `Description__c`   | Description   | LongTextArea, Länge 32768                          |       | Detailed Description of the Course |
| `DurationWeeks__c` | DurationWeeks | Number (2,0)                                       |       | Course Duration in Weeks           |
| `Status__c`        | Status        | Picklist: Draft, Active, Archived (Default: Draft) |       | Current Status of Program          |

## Nach der Anlage

```bash
cd backend
npm run schema:check
```

Exit 0 heisst: Runtime-Schema stimmt mit `force-app/main/default/objects/` ueberein. Erst dann
Apex deployen und Seed laufen lassen.

Zum Abgleich des Ergebnisses:

```bash
sf project retrieve start \
  --metadata CustomObject:Program__c --metadata CustomObject:Participant__c \
  --target-org hubSandbox
```

Byte-identisches XML nach dem Retrieve ist der Beleg, dass Setup und Repository dieselbe
Sache beschreiben.
