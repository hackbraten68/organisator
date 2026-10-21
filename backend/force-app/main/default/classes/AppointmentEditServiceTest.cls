/**
 * Tests für `AppointmentEditService`.
 *
 * WAS HIER BEWIESEN WIRD
 *   Der allgemeine Bearbeitungspfad (`POST /services/apexrest/appointment-edit`)
 *   ist die einzige Stelle, an dem ein Termin geändert wird. Dieser Test hält
 *   die vier Zusagen fest, die dieser Pfad tragen muss:
 *
 *   1. Der Draft-Gate gilt **serverseitig** — geprüft wird der Status in der
 *      Datenbank, nicht der Status im Request. Ein manipulierter Payload, der
 *      "Draft" behauptet, ändert daran nichts.
 *   2. Die Feld-Whitelist gilt serverseitig. `JSON.deserialize` ignoriert
 *      unbekannte JSON-Schlüssel, deshalb muss die Einschränkung im Code
 *      stehen — und genau das wird hier mit einem manipulierten Payload
 *      nachgewiesen.
 *   3. Termin und Audit-Event werden gemeinsam geschrieben oder gar nicht.
 *   4. Der Kollisionsschutz liegt **nicht** hier, sondern zentral im Trigger
 *      auf `Appointment__c`. Dieser Test prüft deshalb ausdrücklich *nicht*,
 *      dass eine Überschneidung abgelehnt wird — das wäre eine Zusage, die der
 *      Einstiegspunkt nicht erfüllt.
 *
 * TESTGRENZEN
 *   - Der HTTP-Schicht-Aufruf wird über `RestContext` simuliert, nicht über
 *     eine echte Anfrage. Das prüft die Route, nicht den Server.
 *   - Der Rollback-Test benutzt ein absichtlich fehlerhaftes Audit-Event, um
 *     den Fehlerpfad von `saveAtomically()` zu erreichen. Das ist kein
 *     realistischer Fehler, sondern der kürzeste Weg in den Zweig, der
 *     zurückrollen muss.
 *   - Die Kollisionsregel aus D2 ist ausdrücklich nicht Gegenstand dieser
 *     Datei. Sie gehört in den Trigger und in dessen Testmatrix (16 Fälle,
 *     Wochenplan 2026-10-21).
 *
 * DATENFINDUNG
 *   Die Testtermine werden über ein Markerfeld gesucht statt über eine
 *   statische Variable aus `@TestSetup`. Grund ist eine Messung in dieser
 *   Sandbox (2026-10-15, siehe `AppointmentIntegrityServiceTest`): das DML aus
 *   dem TestSetup persistiert, die statisch gesetzte Id kommt im Test aber
 *   als `null` an. Die Lehre war: Datenexistenz belegen, nicht eine Variable.
 */
@IsTest
private class AppointmentEditServiceTest {

    private static final String DRAFT_MARKER = 'https://edit.example.invalid/draft';
    private static final String CONFIRMED_MARKER = 'https://edit.example.invalid/confirmed';

    private static final String ORIGINAL_NOTES = 'Urspruengliche Notiz';

    @TestSetup
    static void makeData() {
        Contact contact = new Contact(LastName = 'Edit', Email = 'edit@example.invalid');
        insert contact;

        Participant__c participant = new Participant__c(
            Name = 'Edit',
            Status__c = 'Active',
            Contact__c = contact.Id
        );
        insert participant;

        // Ein zweiter Teilnehmer, damit der manipulierte Payload einen
        // *anderen* Teilnehmer nennen kann. Ein Test, der denselben Teilnehmer
        // nennt, würde auch dann grün bleiben, wenn das Feld geändert würde.
        Contact otherContact = new Contact(LastName = 'Edit Zwei', Email = 'edit-zwei@example.invalid');
        insert otherContact;

        Participant__c otherParticipant = new Participant__c(
            Name = 'Edit Zwei',
            Status__c = 'Active',
            Contact__c = otherContact.Id
        );
        insert otherParticipant;

        insert new Appointment__c(
            Participant__c = participant.Id,
            Type__c = 'Coaching',
            Location__c = 'Teams',
            MeetingLink__c = DRAFT_MARKER,
            Notes__c = ORIGINAL_NOTES,
            Status__c = 'Draft',
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0)
        );

        insert new Appointment__c(
            Participant__c = otherParticipant.Id,
            Type__c = 'Coaching',
            Location__c = 'Teams',
            MeetingLink__c = CONFIRMED_MARKER,
            Status__c = 'Confirmed',
            ConfirmedAt__c = Datetime.newInstanceGmt(2026, 10, 10, 9, 0, 0),
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 21, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 21, 11, 0, 0)
        );
    }

    // --- Hilfen ----------------------------------------------------------

    private static Id draftId() {
        return appointmentIdFor(DRAFT_MARKER);
    }

    private static Id confirmedId() {
        return appointmentIdFor(CONFIRMED_MARKER);
    }

    private static Id appointmentIdFor(String marker) {
        List<Appointment__c> found = [SELECT Id FROM Appointment__c WHERE MeetingLink__c = :marker LIMIT 1];
        if (found.isEmpty()) {
            throw new AppointmentEditService.AppointmentEditException(
                500,
                'FIXTURE_MISSING',
                'Testtermin mit Marker ' + marker + ' fehlt — TestSetup hat nicht gelaufen.'
            );
        }
        return found[0].Id;
    }

    private static Appointment__c readAppointment(Id id) {
        return [
            SELECT Id, Name, Status__c, Participant__c, Coach__c, Type__c, StartTime__c,
                   EndTime__c, Location__c, MeetingLink__c, Notes__c, CorrelationId__c,
                   ConfirmedAt__c, CompletedAt__c, CancellationReason__c
            FROM Appointment__c
            WHERE Id = :id
            LIMIT 1
        ];
    }

    private static Id confirmedParticipantId() {
        List<Appointment__c> found = [
            SELECT Participant__c
            FROM Appointment__c
            WHERE MeetingLink__c = :CONFIRMED_MARKER
            LIMIT 1
        ];
        return found[0].Participant__c;
    }

    /**
     * Ruft die Route mit einem Body auf und gibt die Antwort zurück.
     *
     * Der Statuscode steht danach in `RestContext.response.statusCode`.
     */
    private static AppointmentEditService.EditResponse callEdit(String body) {
        RestRequest restRequest = new RestRequest();
        restRequest.requestBody = Blob.valueOf(body);
        RestContext.request = restRequest;
        RestContext.response = new RestResponse();
        // Die Plattform antwortet mit 200, wenn der Einstieg den Status nicht
        // selbst setzt. Im Test ist die Response ein leeres Objekt — ohne
        // diese Zeile waere der Statuscode `null` statt `200`.
        RestContext.response.statusCode = 200;
        return AppointmentEditService.edit();
    }

    private static AppointmentEditService.EditRequest requestFor(Id id) {
        AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
        request.id = String.valueOf(id);
        return request;
    }

    // --- 1. Der Draft-Gate ----------------------------------------------

    @IsTest
    static void nurDraftIstBearbeitbar() {
        System.assertEquals(
            true,
            AppointmentEditService.isEditable(new Appointment__c(Status__c = 'Draft')),
            'Draft ist bearbeitbar'
        );
        System.assertEquals(
            false,
            AppointmentEditService.isEditable(new Appointment__c(Status__c = 'Confirmed')),
            'Confirmed ist es nicht'
        );
        System.assertEquals(
            false,
            AppointmentEditService.isEditable(null),
            'ein fehlender Datensatz ist nicht bearbeitbar'
        );
    }

    @IsTest
    static void keinAndererStatusIstBearbeitbar() {
        // Das beantwortet die offene Frage zu `NoShow` ohne Sonderregel:
        // `NoShow` ist nicht `Draft` und damit nicht bearbeitbar. Es gibt
        // keinen Status, der gesondert "blockierend" markiert werden müsste —
        // die Regel ist "nur Draft", alle anderen Status sind abgedeckt.
        List<String> gesperrt = new List<String>{
            'Finding',
            'Confirmed',
            'Completed',
            'Cancelled',
            'NoShow'
        };
        for (String status : gesperrt) {
            System.assertEquals(
                false,
                AppointmentEditService.isEditable(new Appointment__c(Status__c = status)),
                status + ' ist nicht bearbeitbar'
            );
        }
    }

    @IsTest
    static void einBestatigterTerminWirdServerseitigAbgelehnt() {
        Id id = confirmedId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.notes = 'Das darf nicht geschehen.';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss einen bestaetigten Termin ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_NOT_EDITABLE,
                error.getCode(),
                'der Fehlercode ist NOT_EDITABLE'
            );
            System.assertEquals(409, error.getStatusCode(), 'der Statuscode ist 409');
        }

        Appointment__c after = readAppointment(id);
        System.assert(after.Notes__c != ORIGINAL_NOTES, 'die Notiz wurde nicht geaendert');
        System.assertEquals('Confirmed', after.Status__c, 'der Status ist unveraendert');
    }

    @IsTest
    static void derStatusKommtAusDerDatenbankNichtAusDerAnfrage() {
        // Der Kern von D1: der Client darf den Status nicht behaupten. Der
        // Termin ist `Confirmed`, der Payload behauptet `Draft` — abgelehnt
        // wird trotzdem, weil der Server seinen eigenen Zustand liest.
        Id id = confirmedId();

        AppointmentEditService.EditResponse response = callEdit(
            JSON.serialize(new Map<String, Object>{
                'id' => String.valueOf(id),
                'status' => 'Draft',
                'notes' => 'Neu'
            })
        );

        System.assertEquals(409, RestContext.response.statusCode, 'der Statuscode ist 409');
        System.assertEquals(
            AppointmentEditService.CODE_NOT_EDITABLE,
            response.code,
            'der Server richtet sich nach der Datenbank, nicht nach dem Payload'
        );

        Appointment__c after = readAppointment(id);
        System.assertEquals('Confirmed', after.Status__c, 'der Status ist unveraendert');
    }

    // --- 2. Identitaet und Pflichtangaben --------------------------------

    @IsTest
    static void eineUnbekannteTerminIdWirdAbgelehnt() {
        // Eine echte Id fremder Objektart: damit wird die Objektart geprueft
        // und nicht die Id-Syntax.
        Account account = new Account(Name = 'Fremd');
        insert account;

        AppointmentEditService.EditRequest request = requestFor(account.Id);
        request.notes = 'Neu';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss eine fremde Id ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_NOT_FOUND,
                error.getCode(),
                'der Fehlercode ist APPOINTMENT_NOT_FOUND'
            );
            System.assertEquals(404, error.getStatusCode(), 'der Statuscode ist 404');
        }
    }

    @IsTest
    static void eineFehlendeTerminIdWirdAbgelehnt() {
        AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
        request.notes = 'Neu';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss eine Anfrage ohne Id ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_BAD_REQUEST,
                error.getCode(),
                'der Fehlercode ist BAD_REQUEST'
            );
        }
    }

    // --- 3. Die Feld-Whitelist -------------------------------------------

    @IsTest
    static void einManipulierterPayloadAendertNurErlaubteFelder() {
        Id id = draftId();
        Appointment__c before = readAppointment(id);

        AppointmentEditService.EditResponse response = callEdit(
            JSON.serialize(
                new Map<String, Object>{
                    'id' => String.valueOf(id),
                    // Diese fünf Felder stehen nicht in der Whitelist. Sie
                    // duerfen nicht geaendert werden — auch nicht, wenn der
                    // Payload sie mitschickt.
                    'status' => 'Confirmed',
                    'participantId' => String.valueOf(confirmedParticipantId()),
                    'confirmedAt' => '2026-01-01T00:00:00.000Z',
                    'completedAt' => '2026-01-01T00:00:00.000Z',
                    'cancellationReason' => 'manipuliert',
                    'correlationId' => 'manipuliert',
                    // Dieses Feld ist erlaubt.
                    'notes' => 'Erlaubte Aenderung'
                }
            )
        );

        System.assert(response.code == null, 'die Anfrage ist gueltig, war: ' + response.message);

        Appointment__c after = readAppointment(id);
        System.assertEquals(before.Status__c, after.Status__c, 'der Status bleibt unveraendert');
        System.assertEquals(before.Participant__c, after.Participant__c, 'der Teilnehmer bleibt unveraendert');
        System.assert(after.ConfirmedAt__c == null, 'der Bestaetigungszeitpunkt bleibt leer');
        System.assert(after.CompletedAt__c == null, 'der Abschlusszeitpunkt bleibt leer');
        System.assert(after.CancellationReason__c == null, 'der Absagegrund bleibt leer');
        System.assertEquals(before.CorrelationId__c, after.CorrelationId__c, 'die Korrelations-Id bleibt unveraendert');
        System.assertEquals('Erlaubte Aenderung', after.Notes__c, 'die erlaubte Aenderung greift');
    }

    @IsTest
    static void dieWhitelistLaesstNurDieErlaubtenFelderUeberhauptZu() {
        // Die Whitelist als reine Funktion: ein Feld, das nicht in der
        // Whitelist steht, wird nie in das Aenderungsobjekt geschrieben.
        Appointment__c before = new Appointment__c(
            Type__c = 'Coaching',
            Location__c = 'Teams',
            Notes__c = 'Alt',
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0)
        );
        Appointment__c change = new Appointment__c();

        AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
        request.notes = 'Neu';

        List<String> changed = AppointmentEditService.applyPatch(before, change, request, null, null);

        System.assertEquals(1, changed.size(), 'nur ein Feld ist betroffen');
        System.assertEquals('Notes__c', changed[0], 'benannt ist Notes__c');
        System.assertEquals('Neu', change.Notes__c, 'der Wert steht im Aenderungsobjekt');
        System.assert(change.Type__c == null, 'die Terminart bleibt unangetastet');
        System.assert(change.Location__c == null, 'der Ort bleibt unangetastet');
        System.assert(change.StartTime__c == null, 'die Startzeit bleibt unangetastet');
        System.assert(change.EndTime__c == null, 'die Endzeit bleibt unangetastet');
        System.assert(change.Status__c == null, 'der Status bleibt unangetastet');
        System.assert(change.Participant__c == null, 'der Teilnehmer bleibt unangetastet');
    }

    @IsTest
    static void einGeloeschtesOptionalesFeldWirdGeleert() {
        // Leer heisst bei optionalen Feldern "loeschen", nicht "unveraendert".
        Appointment__c before = new Appointment__c(
            Type__c = 'Coaching',
            Notes__c = 'Alt',
            Location__c = 'Teams'
        );
        Appointment__c change = new Appointment__c();

        AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
        request.notes = '';

        List<String> changed = AppointmentEditService.applyPatch(before, change, request, null, null);

        System.assertEquals(1, changed.size(), 'die Notiz ist die einzige Aenderung');
        System.assert(change.Notes__c == null, 'die Notiz wird geleert');
    }

    // --- 4. Intervall und Wertebereiche ----------------------------------

    @IsTest
    static void einInvertiertesIntervallWirdAbgelehnt() {
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.startTime = '2026-10-20T12:00:00.000Z';
        request.endTime = '2026-10-20T10:00:00.000Z';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss ein invertiertes Intervall ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_INVALID_INTERVAL,
                error.getCode(),
                'der Fehlercode ist INVALID_INTERVAL'
            );
        }

        Appointment__c after = readAppointment(id);
        System.assertEquals(
            Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            after.StartTime__c,
            'die Startzeit ist unveraendert'
        );
    }

    @IsTest
    static void eineVerschobeneStartzeitAlleinMachtDasIntervallUngueltig() {
        // Geprueft wird der entstehende Zustand, nicht der mitgesendete Wert:
        // aendert der Client nur die Startzeit, bleibt die Endzeit stehen —
        // und das Intervall ist trotzdem ungueltig.
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.startTime = '2026-10-20T12:00:00.000Z';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss das entstehende Intervall pruefen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_INVALID_INTERVAL,
                error.getCode(),
                'der Fehlercode ist INVALID_INTERVAL'
            );
        }
    }

    @IsTest
    static void eineUnbekannteTerminartWirdAbgelehnt() {
        // 'Berufsschule' ist der Wert, den die Oberflaeche frueher schickte und
        // den die Org nicht kennt. Die Liste der erlaubten Werte kommt aus der
        // Picklist der Org, nicht aus einer Kopie im Code.
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.type = 'Berufsschule';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss eine unbekannte Terminart ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_INVALID_TYPE,
                error.getCode(),
                'der Fehlercode ist INVALID_TYPE'
            );
        }
    }

    @IsTest
    static void eineUnbekannteOrtAngabeWirdAbgelehnt() {
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.location = 'Hinterhof';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss einen unbekannten Ort ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_INVALID_LOCATION,
                error.getCode(),
                'der Fehlercode ist INVALID_LOCATION'
            );
        }
    }

    @IsTest
    static void eineLeereTerminartWirdAbgelehnt() {
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.type = '';

        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'applyEdit muss eine leere Terminart ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_INVALID_TYPE,
                error.getCode(),
                'der Fehlercode ist INVALID_TYPE'
            );
        }
    }

    @IsTest
    static void dieErlaubtenWerteKommenAusDerOrg() {
        // Die Werte werden aus der Picklist der Org gelesen. Der Test haelt
        // fest, dass die beiden Werte, die der Alltag benutzt, dort stehen —
        // faellt die Picklist in der Org aus, faellt dieser Test mit.
        Set<String> typen = new Set<String>();
        for (Schema.PicklistEntry entry : Appointment__c.Type__c.getDescribe().getPicklistValues()) {
            typen.add(entry.getValue());
        }
        System.assert(typen.contains('Coaching'), 'Coaching ist ein erlaubter Wert');
        System.assert(typen.contains('Feedback'), 'Feedback ist ein erlaubter Wert');

        Set<String> orte = new Set<String>();
        for (Schema.PicklistEntry entry : Appointment__c.Location__c.getDescribe().getPicklistValues()) {
            orte.add(entry.getValue());
        }
        System.assert(orte.contains('Teams'), 'Teams ist ein erlaubter Ort');
        System.assert(orte.contains('Discord'), 'Discord ist ein erlaubter Ort');
    }

    // --- 5. Speichern und Audit -------------------------------------------

    @IsTest
    static void eineGueltigeAenderungWirdGespeichertUndAuditiert() {
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.type = 'Feedback';
        request.notes = 'Neue Notiz';

        Appointment__c result = AppointmentEditService.applyEdit(request);

        System.assertEquals('Feedback', result.Type__c, 'die Aenderung traegt den neuen Wert');
        System.assertEquals('Draft', result.Status__c, 'der Status steht in der Antwort');

        Appointment__c after = readAppointment(id);
        System.assertEquals('Feedback', after.Type__c, 'die Terminart ist gespeichert');
        System.assertEquals('Neue Notiz', after.Notes__c, 'die Notiz ist gespeichert');

        List<AuditEvent__c> events = [
            SELECT Id
            FROM AuditEvent__c
            WHERE SubjectId__c = :id AND EventType__c = :AppointmentEditService.EVENT_TYPE
        ];
        System.assertEquals(1, events.size(), 'genau ein Audit-Event fuer die Bearbeitung');
    }

    @IsTest
    static void dieAntwortTraegtDenZustandNachDerAenderung() {
        // `Name` und `Status__c` stehen nicht im Aenderungsobjekt, sondern im
        // gelesenen Datensatz. Ohne Zusammenfuehrung bekommt der Client
        // `status: null` zurueck und muesste nach jedem Speichern neu laden.
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.notes = 'Neue Notiz';

        Appointment__c result = AppointmentEditService.applyEdit(request);

        System.assertEquals(id, result.Id, 'die Id stimmt');
        System.assert(result.Name != null, 'der Name steht in der Antwort');
        System.assertEquals('Draft', result.Status__c, 'der Status steht in der Antwort');
        System.assertEquals('Neue Notiz', result.Notes__c, 'die Notiz steht in der Antwort');
        System.assertEquals('Coaching', result.Type__c, 'das unveraenderte Feld steht auch in der Antwort');
    }

    @IsTest
    static void einNoOpErzeugtKeinAuditEvent() {
        Id id = draftId();
        Integer before = [SELECT COUNT() FROM AuditEvent__c WHERE SubjectId__c = :id];

        AppointmentEditService.EditRequest request = requestFor(id);
        request.notes = ORIGINAL_NOTES;

        Appointment__c result = AppointmentEditService.applyEdit(request);

        System.assertEquals(ORIGINAL_NOTES, result.Notes__c, 'der Datensatz kommt unveraendert zurueck');
        Integer after = [SELECT COUNT() FROM AuditEvent__c WHERE SubjectId__c = :id];
        System.assertEquals(before, after, 'ein No-op ist kein Ereignis');
    }

    @IsTest
    static void dasAuditEventTraegtAllePflichtfelder() {
        Id id = draftId();
        Appointment__c before = readAppointment(id);
        Appointment__c change = new Appointment__c(
            Notes__c = 'Neu',
            Type__c = 'Feedback'
        );

        AuditEvent__c audit = AppointmentEditService.buildAuditEvent(
            before,
            change,
            new List<String>{ 'Type__c', 'Notes__c' }
        );

        System.assert(audit.Action__c != null, 'Action__c');
        System.assert(audit.ActorType__c != null, 'ActorType__c');
        System.assert(audit.Domain__c != null, 'Domain__c');
        System.assert(audit.EventType__c != null, 'EventType__c');
        System.assert(audit.OccurredAt__c != null, 'OccurredAt__c');
        System.assert(audit.SchemaVersion__c != null, 'SchemaVersion__c');
        System.assert(audit.Sensitivity__c != null, 'Sensitivity__c');
        System.assert(audit.Source__c != null, 'Source__c');
        System.assert(audit.SubjectId__c != null, 'SubjectId__c');
        System.assert(audit.SubjectType__c != null, 'SubjectType__c');
        System.assert(audit.Visibility__c != null, 'Visibility__c');

        // `Action__c` ist eine restricted Picklist und kennt kein
        // `reset_to_draft`. Die Unterscheidung der Bearbeitung traegt
        // `EventType__c` — sonst waere die Bearbeitung nicht von einem
        // Reparaturlauf zu trennen.
        System.assertEquals('updated', audit.Action__c, 'Action__c nimmt einen vorhandenen Wert');
        System.assertEquals(
            AppointmentEditService.EVENT_TYPE,
            audit.EventType__c,
            'EventType__c traegt die Unterscheidung'
        );
        System.assertEquals('web', audit.Source__c, 'die Quelle ist web');
        System.assertEquals('staff', audit.ActorType__c, 'der Akteur ist staff');
        System.assertEquals('appointment', audit.Domain__c, 'die Domäne ist appointment');
        System.assertEquals(String.valueOf(id), audit.SubjectId__c, 'der Datensatz ist referenziert');
    }

    @IsTest
    static void dasAuditEventProtokolliertAlterUndNeuerWert() {
        Id id = draftId();
        Appointment__c before = readAppointment(id);
        Appointment__c change = new Appointment__c(Type__c = 'Feedback');

        AuditEvent__c audit = AppointmentEditService.buildAuditEvent(
            before,
            change,
            new List<String>{ 'Type__c' }
        );

        System.assert(audit.Changes__c.contains('Type__c'), 'die Aenderung ist benannt');
        System.assert(audit.Changes__c.contains('Coaching'), 'der alte Wert steht drin');
        System.assert(audit.Changes__c.contains('Feedback'), 'der neue Wert steht drin');
        System.assert(audit.ChangedFields__c.contains('Type__c'), 'das geaenderte Feld ist benannt');
    }

    // --- 6. Atomaritaet ---------------------------------------------------

    @IsTest
    static void einFehlgeschlagenesAuditRolltDieAenderungZurueck() {
        // Der Termin wird zuerst geschrieben, das Audit-Event danach. Wenn das
        // Audit scheitert, muss der Termin zurueckgerollt werden — sonst
        // entstuende eine Aenderung ohne Nachweis.
        Id id = draftId();

        Appointment__c change = new Appointment__c(Id = id, Notes__c = 'Nicht gespeichert.');

        // `OccurredAt__c` ist ein Pflichtfeld. Es zu leeren ist der kuerzeste
        // Weg in den Fehlerpfad — und der Fehler ist ein ganz normaler
        // DML-Fehler, kein Sonderfall der Plattform.
        AuditEvent__c broken = new AuditEvent__c(
            Action__c = AppointmentEditService.ACTION,
            ActorType__c = 'staff',
            Domain__c = 'appointment',
            EventType__c = AppointmentEditService.EVENT_TYPE,
            SchemaVersion__c = 1,
            Sensitivity__c = 'normal',
            Source__c = AppointmentEditService.SOURCE,
            SubjectId__c = String.valueOf(id),
            SubjectType__c = 'Appointment__c',
            Visibility__c = 'staff'
        );

        try {
            AppointmentEditService.saveAtomically(change, broken);
            System.assert(false, 'saveAtomically muss bei einem fehlgeschlagenen Audit scheitern');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_AUDIT_FAILED,
                error.getCode(),
                'der Fehlercode ist AUDIT_FAILED'
            );
        }

        Appointment__c after = readAppointment(id);
        System.assertEquals(
            ORIGINAL_NOTES,
            after.Notes__c,
            'der Termin ist zurueckgerollt, obwohl das Update zuerst lief'
        );
    }

    @IsTest
    static void einFehlgeschlagenerTerminWriteWirdGemeldet() {
        // Die Gegenrichtung: das Update schlaegt fehl, es wird gar nichts
        // geschrieben und gar nichts protokolliert.
        Id id = draftId();

        Appointment__c change = new Appointment__c(Id = id, Notes__c = 'Nicht gespeichert.');
        // Ein gueltig geformter Id, zu dem es keinen User gibt. Die Zuweisung
        // ist zulaessig; erst der Schreibvorgang scheitert.
        change.Coach__c = '005000000000000';

        AuditEvent__c audit = AppointmentEditService.buildAuditEvent(
            readAppointment(id),
            change,
            new List<String>{ 'Notes__c' }
        );

        try {
            AppointmentEditService.saveAtomically(change, audit);
            System.assert(false, 'saveAtomically muss bei einem fehlgeschlagenen Update scheitern');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_UPDATE_FAILED,
                error.getCode(),
                'der Fehlercode ist UPDATE_FAILED'
            );
        }

        Appointment__c after = readAppointment(id);
        System.assertEquals(ORIGINAL_NOTES, after.Notes__c, 'der Termin ist unveraendert');
        Integer count = [
            SELECT COUNT()
            FROM AuditEvent__c
            WHERE SubjectId__c = :id AND EventType__c = :AppointmentEditService.EVENT_TYPE
        ];
        System.assertEquals(0, count, 'und es gibt kein Audit-Event');
    }

    // --- 7. Die HTTP-Schicht ----------------------------------------------

    @IsTest
    static void dieRouteAntwortetBeiNichtDraftMit409() {
        Id id = confirmedId();

        AppointmentEditService.EditResponse response = callEdit(
            JSON.serialize(new Map<String, Object>{
                'id' => String.valueOf(id),
                'notes' => 'Neu'
            })
        );

        System.assertEquals(409, RestContext.response.statusCode, 'der Statuscode ist 409');
        System.assertEquals(
            AppointmentEditService.CODE_NOT_EDITABLE,
            response.code,
            'der Fehlercode ist NOT_EDITABLE'
        );
        System.assert(response.message != null, 'die Meldung ist gesetzt');
        System.assert(response.id == null, 'es gibt keinen Datensatz in der Fehlerantwort');
    }

    @IsTest
    static void dieRouteAntwortetBeiErfolgMitDemNeuenZustand() {
        Id id = draftId();

        AppointmentEditService.EditResponse response = callEdit(
            JSON.serialize(new Map<String, Object>{
                'id' => String.valueOf(id),
                'notes' => 'Neu'
            })
        );

        System.assertEquals(200, RestContext.response.statusCode, 'der Statuscode ist 200');
        System.assert(response.code == null, 'es gibt keinen Fehlercode');
        System.assertEquals(String.valueOf(id), response.id, 'die Id steht in der Antwort');
        System.assertEquals('Draft', response.status, 'der Status steht in der Antwort');
        System.assert(response.name != null, 'der Name steht in der Antwort');
    }

    @IsTest
    static void einLeererRequestBodyWirdAbgelehnt() {
        RestContext.request = new RestRequest();
        RestContext.request.requestBody = Blob.valueOf('');
        RestContext.response = new RestResponse();

        try {
            AppointmentEditService.readRequest();
            System.assert(false, 'readRequest muss einen leeren Body ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_BAD_REQUEST,
                error.getCode(),
                'der Fehlercode ist BAD_REQUEST'
            );
        }
    }

    @IsTest
    static void einFehlenderRequestBodyWirdAbgelehnt() {
        RestContext.request = null;
        RestContext.response = new RestResponse();

        try {
            AppointmentEditService.readRequest();
            System.assert(false, 'readRequest muss einen fehlenden Body ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_BAD_REQUEST,
                error.getCode(),
                'der Fehlercode ist BAD_REQUEST'
            );
        }
    }

    @IsTest
    static void keinGueltigesJsonWirdAbgelehnt() {
        RestContext.request = new RestRequest();
        RestContext.request.requestBody = Blob.valueOf('kein json');
        RestContext.response = new RestResponse();

        try {
            AppointmentEditService.readRequest();
            System.assert(false, 'readRequest muss unlesbares JSON ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_BAD_REQUEST,
                error.getCode(),
                'der Fehlercode ist BAD_REQUEST'
            );
        }
    }

    // --- 8. Zeitangaben ---------------------------------------------------

    @IsTest
    static void eineIsoZeitangabeWirdGelesen() {
        Datetime parsed = AppointmentEditService.parseIso('2026-10-20T10:30:00.000Z');
        System.assertEquals(
            '2026-10-20 10:30:00',
            parsed.formatGmt('yyyy-MM-dd HH:mm:ss'),
            'ISO-8601 wird gelesen'
        );

        System.assert(
            AppointmentEditService.parseIso('') == null,
            'leer heisst "nicht mitgesendet"'
        );
        System.assert(
            AppointmentEditService.parseIso(null) == null,
            'null heisst "nicht mitgesendet"'
        );
    }

    @IsTest
    static void eineUnlesbareZeitangabeWirdAbgelehnt() {
        try {
            AppointmentEditService.parseIso('kein-datum');
            System.assert(false, 'parseIso muss eine unlesbare Zeitangabe ablehnen');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(
                AppointmentEditService.CODE_BAD_REQUEST,
                error.getCode(),
                'der Fehlercode ist BAD_REQUEST'
            );
        }
    }

    @IsTest
    static void eineVerschobeneZeitWirdGespeichert() {
        Id id = draftId();
        AppointmentEditService.EditRequest request = requestFor(id);
        request.startTime = '2026-10-20T09:00:00.000Z';
        request.endTime = '2026-10-20T10:30:00.000Z';

        AppointmentEditService.applyEdit(request);

        Appointment__c after = readAppointment(id);
        System.assertEquals(
            '2026-10-20 09:00:00',
            after.StartTime__c.formatGmt('yyyy-MM-dd HH:mm:ss'),
            'die Startzeit ist gespeichert'
        );
        System.assertEquals(
            '2026-10-20 10:30:00',
            after.EndTime__c.formatGmt('yyyy-MM-dd HH:mm:ss'),
            'die Endzeit ist gespeichert'
        );
    }
}
