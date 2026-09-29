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

**90 Felder in 10 Objekten.** Jede Zeile nennt die Beschreibung, die in das Setup-Feld
_Description_ einzutragen ist. Sie steht identisch in `force-app/main/default/objects/` und
ist dort die Quelle der Wahrheit: legst du das Feld ohne Beschreibung an, ueberschreibt der
naechste Retrieve diese hier — und der Text ist weg.

Anfuehrungszeichen und HTML sind in Salesforce-Beschreibungen nicht erlaubt; die Texte sind
deshalb ohne solche ausgeformt. Prettier darf die Objekt-Metadaten nicht formatieren: es
bricht lange `<description>`-Elemente um, und Salesforce parst das nicht. Siehe
`.prettierignore`.

Legende: `REQUIRED` = Pflichtfeld · `UNIQUE` = eindeutig · `EXTERNAL-ID` = External ID ·
`HISTORY` = Feldhistorie aktiv · `Restrict` = Loeschen des Ziels blockiert

### Absence__c — Abwesenheit (externalSharing: Private)

> Abwesenheitsmeldung eines Teilnehmers (Krank, Urlaub, etc.)

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

> Termin zwischen Coach/Staff und Teilnehmer

| Feld API                | Label           | Typ                                                                                                                | Flags              | Beschreibung                                         |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------- |
| `CancellationReason__c` | Absagegrund     | LongTextArea, Länge 32768                                                                                          |                    | Begründung bei Absage                                |
| `Coach__c`              | Coach           | Lookup → User                                                                                                      | HISTORY            | Coach, der den Termin durchführt                     |
| `CompletedAt__c`        | Durchgeführt am | DateTime                                                                                                           | HISTORY            | Zeitpunkt der Durchführung                           |
| `ConfirmedAt__c`        | Bestätigt am    | DateTime                                                                                                           | HISTORY            | Zeitpunkt der Bestätigung                            |
| `CorrelationId__c`      | Correlation ID  | Text(36)                                                                                                           | UNIQUE EXTERNAL-ID | Booking Journey Correlation ID (First-Class Tracker) |
| `EndTime__c`            | Bis             | DateTime                                                                                                           | REQUIRED HISTORY   | Ende des Termins                                     |
| `Location__c`           | Ort             | Picklist: Vor Ort, MS Teams, Telefon, Hybrid, Extern (Default: -)                                                  |                    | Ort/Art des Termins                                  |
| `MeetingLink__c`        | Meeting Link    | Url                                                                                                                |                    | Link zum Online-Meeting (Teams, Zoom, etc.)          |
| `Notes__c`              | Notizen         | LongTextArea, Länge 32768                                                                                          |                    | Notizen zum Termin                                   |
| `Participant__c`        | Teilnehmer      | Lookup → Participant__c, Restrict                                                                                  | REQUIRED HISTORY   | Teilnehmer des Termins                               |
| `StartTime__c`          | Von             | DateTime                                                                                                           | REQUIRED HISTORY   | Beginn des Termins                                   |
| `Status__c`             | Status          | Picklist: Draft, Terminfindung, Bestätigt, Durchgeführt, Dokumentiert, Abgesagt, Nicht erschienen (Default: Draft) | REQUIRED HISTORY   | Status des Termins                                   |
| `Type__c`               | Typ             | Picklist: Coaching, Check-In, Berufsschule, Behörde, Praktikum, Sonstiges (Default: -)                             | REQUIRED HISTORY   | Art des Termins                                      |

### AuditEvent__c — Audit Event (externalSharing: Private)

> Unveraenderliches Protokoll aller fachlich relevanten Aktionen. Ein Datensatz je Aktion, geschrieben und nie wieder geaendert. Dient als Nachweis fuer den Activity-Stream und fuer das Portal: Sichtbarkeit und Empfindlichkeit steuern, wer ein Ereignis sehen darf.

| Feld API              | Label              | Typ                                                                                                                                                                                                                                                                                                                                                  | Flags              | Beschreibung                                                                                                                                                                                                               |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Action__c`           | Action             | Picklist: created, updated, deleted, archived, restored, status_changed, submitted, approved, rejected, cancelled, assigned, started, stopped, checked_in, checked_out, corrected, flagged, reviewed, rescheduled, attendance_changed, document_added, answer_updated, reported, entry_created, entry_updated, entry_deleted, reordered (Default: -) | REQUIRED           | Kurzform der Aktion ohne Domaene, z. B. approved aus absence.approved. Redundant zu EventType__c, aber direkt gruppier- und sortierbar.                                                                                    |
| `ActorDisplayName__c` | Actor Display Name | Text(255)                                                                                                                                                                                                                                                                                                                                            |                    | Anzeigename des Akteurs zum Zeitpunkt des Ereignisses. Festgeschrieben, damit das Protokoll auch nach einer Namensanderung lesbar bleibt.                                                                                  |
| `ActorId__c`          | Actor Id           | Text(18)                                                                                                                                                                                                                                                                                                                                             |                    | Kennung des Akteurs, meist die Salesforce-User-Id. Bewusst Text und kein Lookup: das Ereignis muss auch dann lesbar bleiben, wenn der ausloesende User spaeter geloescht wird.                                             |
| `ActorType__c`        | Actor Type         | Picklist: staff, participant, system, integration (Default: -)                                                                                                                                                                                                                                                                                       | REQUIRED           | Art des Akteurs. system und integration haben keine Salesforce-User-Id, weshalb ActorId__c dann ein stabiler Schluessel aus dem Aufrufer ist.                                                                              |
| `ChangedFields__c`    | Changed Fields     | LongTextArea, Länge 4000                                                                                                                                                                                                                                                                                                                             |                    | Komma-getrennte Liste der Feld-API-Namen, die sich geaendert haben. fuer schnelles Filtern, ohne Changes__c parsen zu muessen.                                                                                             |
| `Changes__c`          | Changes            | LongTextArea, Länge 131072                                                                                                                                                                                                                                                                                                                           |                    | JSON mit den geaenderten Werten im Format {feld: {old: ..., new: ...}}. Enthaelt bei Abwesenheitsgruenden bewusst keine Klartextwerte — dort greift die Redaktion ueber Sensitivity__c.                                    |
| `CorrelationId__c`    | Correlation Id     | Text(36)                                                                                                                                                                                                                                                                                                                                             |                    | Gemeinsame Kennung aller Ereignisse einer zusammenhaengenden Aktion, z. B. einer Statusaenderung mit Folgeereignissen. Erlaubt die Rekonstruktion eines Ablaufs ueber mehrere Datensaetze.                                 |
| `Domain__c`           | Domain             | Picklist: workbook, absence, appointment, classbook, daily_checkin, time_tracking, authentication, participant, system, learning_path, availability (Default: -)                                                                                                                                                                                     | REQUIRED           | Fachlicher Bereich des Ereignisses, z. B. absence oder appointment. Steuert die Gruppierung in der Activity-Ansicht und ist unabhaengig vom konkreten Ereignistyp.                                                         |
| `EventType__c`        | Event Type         | Text(80)                                                                                                                                                                                                                                                                                                                                             | REQUIRED           | Ereignistyp im Format <domaene>.<aktion>, z. B. absence.approved. Die vollstaendige Matrix der erlaubten Werte steht in docs/activity-coverage.md; neue Typen werden dort ergaenzt, bevor sie hier verwendet werden.       |
| `Metadata__c`         | Metadata           | LongTextArea, Länge 131072                                                                                                                                                                                                                                                                                                                           |                    | Zusaetzliche Kontextdaten als JSON, die nicht in Changes__c gehoeren, z. B. betroffene Feldlisten oder Parameter eines Fehlschlags.                                                                                        |
| `OccurredAt__c`       | Occurred At        | DateTime                                                                                                                                                                                                                                                                                                                                             | REQUIRED           | Zeitpunkt, zu dem die fachliche Aktion eingetreten ist. Nicht der Schreibzeitpunkt des Datensatzes: ein spaeter nachgereichter Import kann beide unterscheiden.                                                            |
| `ParentId__c`         | Parent Id          | Text(80)                                                                                                                                                                                                                                                                                                                                             |                    | Id des uebergeordneten Datensatzes, ohne Objektraegersymbol. Paart mit ParentType__c.                                                                                                                                      |
| `ParentType__c`       | Parent Type        | Text(80)                                                                                                                                                                                                                                                                                                                                             |                    | Objekt-API-Name des uebergeordneten Datensatzes, z. B. der Kontakt hinter einem Termin. Erlaubt die Gruppierung, wenn die Aektion streng genommen einem anderen Objekt als SubjectType__c gehoert.                         |
| `ParticipantId__c`    | Participant Id     | Lookup → Participant__c, Restrict                                                                                                                                                                                                                                                                                                                    |                    | Bezug zum Teilnehmer, bei dem die Aktion ausgeloest wurde. Denormalisiert, damit Ereignisse ohne Join und ohne Index auf den Textfeldern auswertbar sind. Leer, wenn die Aktion nicht einem Teilnehmer zuzuordnen ist.     |
| `Reason__c`           | Reason             | LongTextArea, Länge 1000                                                                                                                                                                                                                                                                                                                             |                    | Freitextbegruendung der Aktion, z. B. der Ablehnungsgrund. Nur belegt, wenn die ausloesende Funktion bewusst eine Begruendung uebergibt.                                                                                   |
| `RequestId__c`        | Request Id         | Text(36)                                                                                                                                                                                                                                                                                                                                             | UNIQUE EXTERNAL-ID | Kennung des ausloesenden Requests, meist ein GUID aus dem Client. Bindet das Ereignis an einen konkreten HTTP-Aufruf, falls mehrerekoennig ueber AuditOutbox__c zustellbar sind.                                           |
| `SchemaVersion__c`    | Schema Version     | Number (3,0)                                                                                                                                                                                                                                                                                                                                         | REQUIRED           | Version des beim Schreiben verwendeten Ereignisformats. Erlaubt spaeter das Auslesen alter Ereignisse, auch wenn sich die Struktur von Changes__c oder Metadata__c weiterentwickelt.                                       |
| `Sensitivity__c`      | Sensitivity        | Picklist: normal, personal, restricted (Default: -)                                                                                                                                                                                                                                                                                                  | REQUIRED           | Empfindlichkeit des Inhalts. restricted verhindert die Ausgabe sensibler Werte an Berechtigte, die nur das Ereignis sehen duerfen — etwa Abwesenheitsgruende. Steuert die Redaktion, nicht die Sichtbarkeit.               |
| `Source__c`           | Source             | Picklist: web, mobile, api, import, automation, integration, migration (Default: -)                                                                                                                                                                                                                                                                  | REQUIRED           | Weg, auf dem die Aktion eingegangen ist. Unterscheidet direkte Bedienung (web, mobile) von Integrationen (api, import, migration) und erlaubt damit die Bewertung der Datenqualitaet.                                      |
| `SubjectId__c`        | Subject Id         | Text(18)                                                                                                                                                                                                                                                                                                                                             | REQUIRED           | Id des geaenderten Datensatzes, ohne Objektraegersymbol. Paart mit SubjectType__c und wird dort zusammen ausgewertet.                                                                                                      |
| `SubjectType__c`      | Subject Type       | Text(80)                                                                                                                                                                                                                                                                                                                                             | REQUIRED           | Objekt-API-Name des geaenderten Datensatzes, z. B. Participant__c. Freitext, damit auch Standardobjekte wie Opportunity protokolliert werden koennen ohne feste Auswahlliste.                                              |
| `Visibility__c`       | Visibility         | Picklist: staff, participant, restricted (Default: -)                                                                                                                                                                                                                                                                                                | REQUIRED           | Wer das Ereignis sehen darf. staff nur intern, participant auch im Portal, restricted nur fuer einen eingeschraenkten Personenkreis. Orthogonal zu Sensitivity__c: ein Ereignis kann sichtbar und trotzdem redigiert sein. |

### AuditOutbox__c — Audit Outbox (externalSharing: Private)

> Warteschlange fuer die zuverlaessige Zustellung von Audit-Ereignissen. Haelt ein Ereignis fest, wenn der direkte Schreibpfad scheitert, und wiederholt den Versuch mit Backoff. Nur Hintergrundinfrastruktur, nie durch Nutzer:innen pflegbar.

| Feld API           | Label          | Typ                                                     | Flags    | Beschreibung                                                                                                                                                                                                                                                                 |
| ------------------ | -------------- | ------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CorrelationId__c` | Correlation Id | Text(36)                                                |          | Gemeinsame Kennung aller Ereignisse einer zusammenhaengenden Aktion, identisch zur Semantik in AuditEvent__c.CorrelationId__c. Wird beim Erzeugen des Payloads uebernommen, damit auch nach der Zustellung der Zusammenhang zwischen den Ereignissen rekonstruierbar bleibt. |
| `Error__c`         | Error          | LongTextArea, Länge 32768                               |          | Letzte Fehlermeldung des Zustellversuchs. Dient der Diagnose; wird bei Erfolg nicht beachtet und nicht geleert, damit der Verlauf nachvollziehbar bleibt.                                                                                                                    |
| `EventType__c`     | Event Type     | Text(255)                                               | REQUIRED | Ereignistyp des eingereihten Ereignisses, identisch zur Semantik in AuditEvent__c.EventType__c. Hier zur Nachverfolgung des Zustellversuchs.                                                                                                                                 |
| `NextRetryAt__c`   | Next Retry At  | DateTime                                                |          | Zeitpunkt des naechsten Versuchs. Leer, solange der Eintrag nicht erneut versucht wird. Wird nach einem Fehlversuch aus dem Backoff berechnet.                                                                                                                               |
| `ParticipantId__c` | Participant Id | Text(18)                                                |          | Bezug zum Teilnehmer als Text-Id, kein Lookup: der Eintrag kann auch dann noch ausgewertet werden, wenn das Ereignis selbst noch nicht existiert.                                                                                                                            |
| `Payload__c`       | Payload        | LongTextArea, Länge 32768                               |          | Vollstaendiges AuditEvent__c als JSON, einschliesslich CorrelationId und Sensitivity. Aus diesem Feld wird der eigentliche Audit-Datensatz erzeugt.                                                                                                                          |
| `RetryCount__c`    | Retry Count    | Number (3,0)                                            | REQUIRED | Bisherige Fehlversuche. Bestimmt zusammen mit NextRetryAt__c den Backoff und setzt eine Obergrenze fuer Eintraege, die dauerhaft scheitern.                                                                                                                                  |
| `Status__c`        | Status         | Picklist: PENDING, PROCESSED, FAILED (Default: PENDING) | REQUIRED | Zustand des Zustellversuchs. pending wartet, delivered ist angekommen, failed ist endgueltig gescheitert. Steuert, ob ein weiterer Versuch erfolgt.                                                                                                                          |
| `SubjectId__c`     | Subject Id     | Text(18)                                                |          | Id des betroffenen Datensatzes ohne Objektraegersymbol. Wie in AuditEvent__c, damit die Zustellung ohne Ladevorgang auskommt.                                                                                                                                                |

### AvailabilitySlot__c — Verfügbarkeits-Slot (externalSharing: Private)

> Verfügbarkeits-Slot für Coach/Staff (Terminfindung)

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

> Die Person eines Coachs mit den fuer die Betreuung relevanten Stammdaten. Unterscheidet sich vom Contact: der Contact ist die Privatperson, das Coach-Profil die berufliche Rolle in der Academy.

| Feld API      | Label    | Typ                                                                      | Flags | Beschreibung              |
| ------------- | -------- | ------------------------------------------------------------------------ | ----- | ------------------------- |
| `Capacity__c` | Capacity | Number (2,0)                                                             |       | Coach Capacity            |
| `Discord__c`  | Discord  | Text(255)                                                                |       | Coach Discord User Handle |
| `Email__c`    | Email    | Email                                                                    |       | Coach Email               |
| `GitHub__c`   | GitHub   | Text(255)                                                                |       | Coach GitHub Username     |
| `Role__c`     | Role     | Picklist: Lead IT Coach, Kubernetes Coach, AWS Coach, Staff (Default: -) |       | Coach Role                |
| `Status__c`   | Status   | Checkbox                                                                 |       | Coach active status       |

### Learning_Path__c — Learning Path (externalSharing: Private)

> Participant-specific curriculum item

| Feld API             | Label           | Typ                                                          | Flags    | Beschreibung                                                                                                                                                                               |
| -------------------- | --------------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Estimated_Weeks__c` | Estimated Weeks | Number (2,0)                                                 |          | Geplante Dauer in Wochen als Planungswert. Keine Ist-Zeit: Abweichungen ergeben sich aus Terminen und Lernfortschritt, nicht aus diesem Feld.                                              |
| `Order__c`           | Order           | Number (3,0)                                                 |          | Position in der Reihenfolge des Lernpfads. Fortlaufend ab 1; bestimmt die Anzeigereihenfolge und ist der Grund fuer das reorder-Ereignis.                                                  |
| `Participant__c`     | Participant     | Lookup → Participant__c, SetNull                             |          | Teilnehmer, fuer den dieses Lernpfad-Element gilt. Pflichtfeld: ein Element ohne Teilnehmer gehoert zu niemandem und waere ein Datenhaufen.                                                |
| `Program__c`         | Program         | Lookup → Program__c, SetNull                                 |          | Programm, in dessen Rahmen das Element liegt. Stellt sicher, dass Lernpfad und Programm zusammenpassen; wird gegen Program__c des Teilnehmers abgeglichen.                                 |
| `Status__c`          | Status          | Picklist: Planned, In Progress, Completed (Default: Planned) |          | Bearbeitungsstand dieses Elements beim Teilnehmer. Planned bis zum Start, In Progress waehrenddessen, Completed bei Abschluss.                                                             |
| `Title__c`           | Title           | Text(255)                                                    | REQUIRED | Bezeichnung des Elements in der Lernpfad-Ansicht, z. B. AWS SAA. Kann vom Namen des verknuepften Programms abweichen, wenn der Teilnehmer eine kuerzere oder praezisere Bezeichnung sieht. |

### Module__c — Module (externalSharing: Private)

> Reuseable program content template

| Feld API         | Label       | Typ                           | Flags    | Beschreibung                                                                                                                    |
| ---------------- | ----------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Description__c` | Description | LongTextArea, Länge 32768     |          | Inhaltliche Beschreibung des Moduls fuer Teilnehmer: welche Themen behandelt werden und was als Ergebnis erwartet wird.         |
| `Order__c`       | Order       | Number (3,0)                  |          | Reihenfolge der Module innerhalb des Programms, fortlaufend ab 1. Die Anzeigereihenfolge im Kursplan ergibt sich allein daraus. |
| `Program__c`     | Program     | Lookup → Program__c, Restrict | REQUIRED | Lookup Relationship → Related To: Program__c                                                                                    |

### Participant__c — Participant (externalSharing: Private)

> Participant Object

| Feld API             | Label           | Typ                                                                                    | Flags    | Beschreibung                                                                                                                                                                                                                                                                              |
| -------------------- | --------------- | -------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Coach_Profile__c`   | Coach Profile   | Lookup → Coach_Profile__c, SetNull                                                     |          | Betreuender Coach. Null ist zulaessig und bedeutet noch keine Betreuung zugewiesen, nicht unbekannt.                                                                                                                                                                                      |
| `Contact__c`         | Contact         | Lookup → Contact, Restrict                                                             | REQUIRED | Die Person hinter dieser Teilnehmerrolle. Pflichtfeld und eindeutig: genau ein Participant__c je Contact, serverseitig erzwungen. Name und E-Mail stammen immer von hier, nicht aus den Feldern dieses Objekts. Loeschen des Contacts ist blockiert, solange ein Teilnehmer daran haengt. |
| `Discord__c`         | Discord         | Text(255)                                                                              |          | Discord User Handle                                                                                                                                                                                                                                                                       |
| `Email__c`           | Email           | Email                                                                                  |          | Student Email Addres                                                                                                                                                                                                                                                                      |
| `ExpectedEndDate__c` | ExpectedEndDate | Date                                                                                   |          | Student's Expected End Date                                                                                                                                                                                                                                                               |
| `GitHub__c`          | GitHub          | Text(255)                                                                              |          | Github Username                                                                                                                                                                                                                                                                           |
| `Program__c`         | Program         | Lookup → Program__c, SetNull                                                           |          | Programm, in dem die Person eingeschrieben ist. Null bedeutet: angemeldet, aber noch keinem Programm zugeordnet — der Zustand direkt nach der Anlage.                                                                                                                                     |
| `StartDate__c`       | StartDate       | Date                                                                                   |          | Student's Start Date                                                                                                                                                                                                                                                                      |
| `Status__c`          | Status          | Picklist: Onboarding, Active, Paused, Graduated, Placed, Dropped (Default: Onboarding) |          | Current Student Status                                                                                                                                                                                                                                                                    |

### Program__c — Program (externalSharing: Private)

> Course Program

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
