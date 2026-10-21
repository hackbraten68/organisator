/**
 * Serverseitiger Einstiegspunkt fuer die Bearbeitung eines Termins.
 *
 * WAS DAS IST
 *   Der allgemeine Bearbeitungspfad — Terminart, Uhrzeit, Ort, Link, Notiz,
 *   Coach. Er laeuft ueber `POST /services/apexrest/appointment-edit` und
 *   schreibt genau die Felder, die der Aufrufer aendern will.
 *
 * WARUM UEBERHAUPT APEX
 *   Der Pfad lief bis 2026-10-21 ueber die Standard-UI-API
 *   (`uiapi { Appointment__cUpdate }`). Damit war die einzige serverseitige
 *   Pruefung die, was die Org an Feld- und Objektrechten durchsetzt — nicht
 *   aber der fachliche Zustand des Datensatzes.
 *
 *   Entscheidung D1 (2026-10-21): Ein Termin darf ueber den allgemeinen
 *   Bearbeitungspfad nur geaendert werden, wenn sein **aktueller serverseitiger**
 *   Status `Draft` ist. Der vom Client mitgesendete Status darf nicht darueber
 *   entscheiden.
 *
 *   Warum das nicht in einem Trigger liegt: Ein Trigger sieht jeden Schreibweg,
 *   kann aber **Absicht nicht unterscheiden**. Bearbeiten und Verschieben
 *   aendern dieselben Felder (`StartTime__c`, `EndTime__c`). `rescheduleAppointment`
 *   wird in `ParticipantAppointmentsTab.tsx:140` ohne Statuspruefung aufgerufen —
 *   ein Trigger, der Zeitänderungen global auf `Draft` begrenzt, wuerde also
 *   bestehende Funktionalitaet zerstoeren. Absicht ist nur am Aufrufort sichtbar.
 *
 *   Deshalb folgt dieser Einstieg dem Muster von ADR-014: jeder fachliche Weg
 *   hat genau einen benannten serverseitigen Einstieg.
 *
 * WAS DIESER PFAD NICHT KANN
 *   Kein `Participant__c`, kein `Status__c`, kein `ConfirmedAt__c`, kein
 *   `CompletedAt__c`, kein `CancellationReason__c`, kein `CorrelationId__c`.
 *   Diese Felder sind entweder unveraenderlich (Teilnehmer) oder gehoeren einem
 *   benannten Lifecycle-Weg zu (ADR-014). Ein manipulierter Payload kann sie
 *   nicht veraendern: die Whitelist liegt serverseitig.
 *
 * KOLLISIONSSCHUTZ
 *   Nicht hier. Er liegt zentral im Trigger auf `Appointment__c` und gilt damit
 *   fuer jeden Schreibweg — Anlage, Bearbeitung, Verschieben, Coach-Wechsel.
 *   Dieser Einstieg darf deshalb **nicht** ohne den Trigger ausgeliefert werden
 *   (Release-Grenze RG).
 *
 * AUTORISIERUNG
 *   `with sharing`, wie `StaffIdentity`. Der aktuelle Status wird aus der
 *   Datenbank gelesen, nie aus der Anfrage. Klassenzugriff liegt in
 *   `backend_Access` und `backend_Coach`; ohne den Eintrag antwortet die Route
 *   403.
 *
 * ATOMARITAET
 *   Termin-Aenderung und Audit-Event werden gemeinsam geschrieben oder gar
 *   nicht. Das ist in Apex nicht selbstverstaendlich: ein abgefangener
 *   DML-Fehler laesst ein vorher erfolgreiches Update stehen. Deshalb ein
 *   Savepoint statt eines try/catch, das zurueckrollen wuerde, was es nicht kann.
 *
 * SIDE EFFECTS
 *   Aktualisiert genau den angegebenen Termin und schreibt genau ein
 *   `AuditEvent__c`. Bei einer Anfrage ohne Aenderung entsteht keines.
 */
@RestResource(urlMapping='/appointment-edit/*')
global with sharing class AppointmentEditService {

    /** Der einzige Status, in dem der allgemeine Bearbeitungspfad greift. */
    public static final String EDITABLE_STATUS = 'Draft';

    /** Ereignistyp des Audit-Events. */
    public static final String EVENT_TYPE = 'appointment.edited';
    /** `Action__c` ist restricted; `updated` ist ein vorhandener Wert. */
    public static final String ACTION = 'updated';
    /** Quelle: die Aktion kommt aus der Web-App, wird aber serverseitig geloggt. */
    public static final String SOURCE = 'web';

    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_NOT_FOUND = 'APPOINTMENT_NOT_FOUND';
    public static final String CODE_NOT_EDITABLE = 'APPOINTMENT_NOT_EDITABLE';
    public static final String CODE_INVALID_INTERVAL = 'INVALID_INTERVAL';
    public static final String CODE_INVALID_TYPE = 'INVALID_TYPE';
    public static final String CODE_INVALID_LOCATION = 'INVALID_LOCATION';
    public static final String CODE_UPDATE_FAILED = 'UPDATE_FAILED';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    /**
     * Die Anfrage. Enthaelt nur Felder, die dieser Pfad aendern darf.
     *
     * Ein Feld, das hier fehlt, kann ueber diesen Weg nie gesetzt werden —
     * `JSON.deserialize` ignoriert unbekannte Schluessel, und die Whitelist in
     * `applyPatch()` nimmt nur die unten genannten Feldnamen.
     *
     * `null` heisst "nicht mitgesendet", `""` heisst "leeren". Fuer Pflichtfelder
     * ist Leeren ein Fehler, fuer optionale ein Loeschvorgang.
     */
    global class EditRequest {
        global String id;
        global String coachId;
        global String type;
        global String startTime;
        global String endTime;
        global String location;
        global String meetingLink;
        global String notes;
    }

    /**
     * Die Antwort. Erfolg traegt den Datensatz, Fehler traegt Code und Meldung.
     *
     * Ein flacher Typ statt zweier Klassen, weil `@HttpGet` Object als Rueckgabe
     * ablehnt und ein eigener Response-Typ dieselbe Begruendung haette — siehe
     * `StaffIdentity.MeResponse`.
     */
    global class EditResponse {
        global String id;
        global String name;
        global String status;
        global String code;
        global String message;

        global EditResponse(Appointment__c row) {
            this.id = row.Id;
            this.name = row.Name;
            this.status = row.Status__c;
        }

        global EditResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    public class AppointmentEditException extends Exception {
        private Integer statusCode;
        private String code;

        public AppointmentEditException(Integer statusCode, String code, String message) {
            this.statusCode = statusCode;
            this.code = code;
            this.setMessage(message);
        }

        public Integer getStatusCode() {
            return this.statusCode;
        }

        public String getCode() {
            return this.code;
        }
    }

    /**
     * POST /services/apexrest/appointment-edit
     *
     * Der einzige HTTP-Einstieg. Der urlMapping braucht das '/*', weil ein
     * mapping ohne Wildcard '/appointment-edit' selbst nicht matcht — dieselbe
     * Falle, die `StaffIdentity` dokumentiert.
     */
    @HttpPost
    global static EditResponse edit() {
        // Eine Aenderung ist nicht cachebar, von niemandem.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        try {
            return new EditResponse(applyEdit(readRequest()));
        } catch (AppointmentEditException error) {
            RestContext.response.statusCode = error.getStatusCode();
            return new EditResponse(error.getCode(), error.getMessage());
        } catch (Exception error) {
            // Nie die rohe Exception zurueckgeben: sie verraet Feldnamen und Ids.
            System.debug(
                LoggingLevel.ERROR,
                'AppointmentEditService failed: ' + error.getTypeName() + ': ' + error.getMessage()
            );
            RestContext.response.statusCode = 500;
            return new EditResponse(CODE_INTERNAL, 'Der Termin konnte nicht bearbeitet werden.');
        }
    }

    /**
     * Liest und deserialisiert den Request-Body.
     *
     * Explizit statt Parameter-Binding: so ist der Fehler bei ungueltigem JSON
     * kontrollierbar und die Absicht in einem Test ohne echte HTTP-Schicht
     * pruefbar.
     */
    @TestVisible
    private static EditRequest readRequest() {
        RestRequest request = RestContext.request;
        if (request == null || request.requestBody == null) {
            throw badRequest('Der Request-Body fehlt.');
        }
        String body = request.requestBody.toString();
        if (String.isBlank(body)) {
            throw badRequest('Der Request-Body ist leer.');
        }
        try {
            return (EditRequest) JSON.deserialize(body, EditRequest.class);
        } catch (Exception malformed) {
            throw badRequest('Der Request-Body ist kein gueltiges JSON-Objekt.');
        }
    }

    /**
     * Die fachliche Arbeit: lesen, pruefen, anwenden, atomar schreiben.
     *
     * @TestVisible, weil die HTTP-Schicht im Test sonst ein Problem waere —
     * derselbe Schnitt wie `StaffIdentity.resolveForUser`.
     */
    @TestVisible
    private static Appointment__c applyEdit(EditRequest request) {
        if (request == null || String.isBlank(request.id)) {
            throw badRequest('Es wurde keine Termin-Id uebergeben.');
        }

        List<Appointment__c> rows = [
            SELECT Id, Name, Status__c, Participant__c, Coach__c, Type__c, StartTime__c,
                   EndTime__c, Location__c, MeetingLink__c, Notes__c, CorrelationId__c
            FROM Appointment__c
            WHERE Id = :request.id
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Termin existiert nicht.');
        }

        Appointment__c before = rows[0];

        // Der entscheidende Schritt: der Status kommt aus der Datenbank, nicht
        // aus der Anfrage. Ein Client kann nicht behaupten, der Termin sei Draft.
        if (!isEditable(before)) {
            throw new AppointmentEditException(
                409,
                CODE_NOT_EDITABLE,
                'Ein Termin kann nur im Status Draft bearbeitet werden. Aktueller Status: ' +
                    (before.Status__c == null ? '(leer)' : before.Status__c) +
                    '.'
            );
        }

        validateType(request.type);
        validateLocation(request.location);

        Datetime start = parseIso(request.startTime);
        Datetime finish = parseIso(request.endTime);

        // `change` traegt nur die Id; applyPatch fuellt ausschliesslich die
        // Felder, die sich wirklich unterscheiden. Ein voll gelesener Datensatz
        // wuerde Nebeneffekte auf Felder haben, die zwischen Lesen und Schreiben
        // geaendert wurden.
        Appointment__c change = new Appointment__c(Id = before.Id);
        List<String> changed = applyPatch(before, change, request, start, finish);

        if (changed.isEmpty()) {
            // Nichts zu tun: kein Update, kein Audit-Event. Ein No-op ist kein
            // Ereignis, und ein Ereignis zu erfinden waere das, was D1 verbietet.
            return before;
        }

        validateEffectiveInterval(before, change);

        AuditEvent__c audit = buildAuditEvent(before, change, changed);
        saveAtomically(change, audit);

        return applyToRow(before, change, changed);
    }

    /**
     * Der Zustand **nach** der Aenderung: der gelesene Datensatz, uebernommen
     * mit den geaenderten Feldern.
     *
     * `change` traegt nur die Id und die geaenderten Felder. Als Antwort
     * braucht der Aufrufer aber den vollstaendigen Zustand — `EditResponse`
     * gibt `Name` und `Status__c` aus, und die stehen in `change` nicht.
     * Ohne diese Zusammenfuehrung bekaeme der Client `status: null` zurueck
     * und muesste nach jedem Speichern neu laden.
     *
     * WARUM NICHT `clone()`
     *   `Appointment__c.Name` ist ein AutoNumber-Feld (`TERM-{0000}`), und
     *   `clone()` kopiert AutoNumber-Felder nicht — die Antwort haette keinen
     *   Namen. Auch `clone(false, true)` liefert keinen brauchbaren Satz:
     *   ohne Feldwerte und ohne Id ist er leer.
     *
     * WARUM ERST NACH `buildAuditEvent()`
     *   Das Audit-Event braucht die **alten** Werte. Wer den gelesenen
     *   Datensatz vorher veraendert, protokolliert den neuen Zustand als den
     *   alten. Deshalb wird hier nichts angefasst, was die Protokollierung
     *   noch braucht.
     */
    private static Appointment__c applyToRow(
        Appointment__c before,
        Appointment__c change,
        List<String> changed
    ) {
        for (String field : changed) {
            before.put(field, change.get(field));
        }
        return before;
    }

    /**
     * Der Draft-Gate als reine Funktion.
     *
     * Ausgelagert, weil die Regel genau einmal existieren soll und weil sie
     * ohne Datenbank und ohne DML pruefbar ist.
     */
    public static Boolean isEditable(Appointment__c row) {
        return row != null && row.Status__c == EDITABLE_STATUS;
    }

    /**
     * Wendet die Whitelist an und liefert die geaenderten Feldnamen.
     *
     * Reine Funktion ohne DML: `before` wird gelesen, `change` beschrieben.
     * Die Rueckgabe ist gleichzeitig die Grundlage des Audit-Events und die
     * Pruefung, ob ueberhaupt etwas zu schreiben ist.
     */
    @TestVisible
    private static List<String> applyPatch(
        Appointment__c before,
        Appointment__c change,
        EditRequest request,
        Datetime start,
        Datetime finish
    ) {
        List<String> changed = new List<String>();

        if (request.coachId != null) {
            String value = String.isBlank(request.coachId) ? null : request.coachId;
            if (value != before.Coach__c) {
                change.Coach__c = value;
                changed.add('Coach__c');
            }
        }
        if (request.type != null && request.type != before.Type__c) {
            change.Type__c = request.type;
            changed.add('Type__c');
        }
        if (start != null && start != before.StartTime__c) {
            change.StartTime__c = start;
            changed.add('StartTime__c');
        }
        if (finish != null && finish != before.EndTime__c) {
            change.EndTime__c = finish;
            changed.add('EndTime__c');
        }
        if (request.location != null) {
            String value = String.isBlank(request.location) ? null : request.location;
            if (value != before.Location__c) {
                change.Location__c = value;
                changed.add('Location__c');
            }
        }
        if (request.meetingLink != null) {
            String value = String.isBlank(request.meetingLink) ? null : request.meetingLink;
            if (value != before.MeetingLink__c) {
                change.MeetingLink__c = value;
                changed.add('MeetingLink__c');
            }
        }
        if (request.notes != null) {
            String value = String.isBlank(request.notes) ? null : request.notes;
            if (value != before.Notes__c) {
                change.Notes__c = value;
                changed.add('Notes__c');
            }
        }

        return changed;
    }

    /**
     * Liesst eine ISO-8601-Zeitangabe.
     *
     * Der Client sendet `toISOString()` — also "2026-10-21T10:00:00.000Z". Das
     * JSON-Deserialisieren uebernimmt die Zeitzone; ein eigenes Format wuerde
     * die Locale mitbringen.
     */
    @TestVisible
    private static Datetime parseIso(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        Datetime parsed;
        try {
            parsed = (Datetime) JSON.deserialize('"' + value + '"', Datetime.class);
        } catch (Exception unreadable) {
            throw badRequest('Die Zeitangabe "' + value + '" ist nicht lesbar.');
        }
        // Manche Platform-Versionen liefern bei unlesbaren Strings `null`
        // statt einer Exception. Beides muss derselbe Fehler sein — ein
        // stillschweigend verworfener Zeitwert waere ein Datenverlust.
        if (parsed == null) {
            throw badRequest('Die Zeitangabe "' + value + '" ist nicht lesbar.');
        }
        return parsed;
    }

    /**
     * Prueft das Intervall **nach** der Anwendung der Aenderung.
     *
     * Nicht die mitgesendeten Werte, sondern der entstehende Zustand: Aendert
     * der Client nur die Startzeit, wuerde die Endzeit unveraendert bleiben und
     * das Intervall trotzdem ungueltig werden.
     */
    private static void validateEffectiveInterval(Appointment__c before, Appointment__c change) {
        Datetime effectiveStart = change.StartTime__c != null ? change.StartTime__c : before.StartTime__c;
        Datetime effectiveFinish = change.EndTime__c != null ? change.EndTime__c : before.EndTime__c;
        if (effectiveStart != null && effectiveFinish != null && effectiveStart >= effectiveFinish) {
            throw new AppointmentEditException(
                400,
                CODE_INVALID_INTERVAL,
                'Die Startzeit muss vor der Endzeit liegen.'
            );
        }
    }

    /**
     * Prueft die Terminart gegen die Picklist der Org.
     *
     * Gegen `Schema` und nicht gegen eine Kopie der Werte im Code: eine Kopie
     * driftet still, genau wie die drei `Location__c`-Werte es einmal taten
     * (siehe `appointment-request-plan.md` Abschnitt 6.1). Die Picklist der Org
     * ist die Quelle; dieser Code fragt sie ab.
     */
    private static void validateType(String value) {
        if (value == null) {
            return;
        }
        if (String.isBlank(value)) {
            throw new AppointmentEditException(400, CODE_INVALID_TYPE, 'Die Terminart darf nicht geleert werden.');
        }
        if (!picklistValues(Appointment__c.Type__c).contains(value)) {
            throw new AppointmentEditException(
                400,
                CODE_INVALID_TYPE,
                'Unbekannte Terminart: ' + value + '. Die Werte kommen aus der Org.'
            );
        }
    }

    /** Wie `validateType`, fuer den Ort. Leer ist erlaubt: der Ort ist optional. */
    private static void validateLocation(String value) {
        if (value == null || String.isBlank(value)) {
            return;
        }
        if (!picklistValues(Appointment__c.Location__c).contains(value)) {
            throw new AppointmentEditException(
                400,
                CODE_INVALID_LOCATION,
                'Unbekannter Ort: ' + value + '. Die Werte kommen aus der Org.'
            );
        }
    }

    /** Die aktiven Werte einer Picklist, aus der Org gelesen. */
    private static Set<String> picklistValues(Schema.SObjectField field) {
        Set<String> values = new Set<String>();
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                values.add(entry.getValue());
            }
        }
        return values;
    }

    /**
     * Baut das Audit-Event. Reine Funktion, damit die Pflichtfelder ohne DML
     * pruefbar sind.
     *
     * `Action__c` bleibt `updated`, weil die Picklist das als normalen
     * Schreibvorgang fuert. Die Unterscheidung der Bearbeitung traegt
     * `EventType__c` — dasselbe Muster, das `AppointmentIntegrityService` fuer
     * die Reparatur einfuehrte, und der Grund, warum der erste Reparaturlauf
     * mit `Action__c = 'reset_to_draft'` gescheitert ist.
     */
    public static AuditEvent__c buildAuditEvent(
        Appointment__c before,
        Appointment__c change,
        List<String> changed
    ) {
        List<Map<String, Object>> changes = new List<Map<String, Object>>();
        for (String field : changed) {
            changes.add(
                new Map<String, Object>{
                    'field' => field,
                    'oldValue' => asText(before.get(field)),
                    'newValue' => asText(change.get(field)),
                    'redacted' => false
                }
            );
        }

        String actorName = UserInfo.getFirstName();
        if (String.isBlank(actorName)) {
            actorName = UserInfo.getName();
        }

        return new AuditEvent__c(
            Action__c = ACTION,
            ActorDisplayName__c = actorName,
            ActorId__c = UserInfo.getUserId(),
            ActorType__c = 'staff',
            ChangedFields__c = JSON.serialize(changed),
            Changes__c = JSON.serialize(changes),
            CorrelationId__c = before.CorrelationId__c,
            Domain__c = 'appointment',
            EventType__c = EVENT_TYPE,
            OccurredAt__c = Datetime.now(),
            ParticipantId__c = before.Participant__c,
            Reason__c = 'Termin bearbeitet',
            SchemaVersion__c = 1,
            Sensitivity__c = 'normal',
            Source__c = SOURCE,
            SubjectId__c = before.Id,
            SubjectType__c = 'Appointment__c',
            Visibility__c = 'staff'
        );
    }

    /**
     * Schreibt Termin und Audit-Event gemeinsam.
     *
     * @TestVisible, weil genau dieser Ort die Atomaritaet beweist: ein Test
     * kann hier ein absichtlich ungueltiges Audit-Event uebergeben und sehen,
     * dass der bereits gegangene Termin zurueckgerollt wird.
     */
    @TestVisible
    private static void saveAtomically(Appointment__c change, AuditEvent__c audit) {
        Savepoint sp = Database.setSavepoint();

        Database.SaveResult updateResult = Database.update(change, false);
        if (!updateResult.isSuccess()) {
            Database.rollback(sp);
            throw new AppointmentEditException(
                500,
                CODE_UPDATE_FAILED,
                'Der Termin konnte nicht gespeichert werden: ' + errorText(updateResult.getErrors())
            );
        }

        Database.SaveResult auditResult = Database.insert(audit, false);
        if (!auditResult.isSuccess()) {
            Database.rollback(sp);
            throw new AppointmentEditException(
                500,
                CODE_AUDIT_FAILED,
                'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.'
            );
        }
    }

    private static AppointmentEditException badRequest(String message) {
        return new AppointmentEditException(400, CODE_BAD_REQUEST, message);
    }

    private static AppointmentEditException notFound(String message) {
        return new AppointmentEditException(404, CODE_NOT_FOUND, message);
    }

    private static String asText(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String errorText(List<Database.Error> errors) {
        List<String> parts = new List<String>();
        for (Database.Error error : errors) {
            parts.add(error.getStatusCode() + ': ' + error.getMessage());
        }
        return String.join(parts, '; ');
    }
}
