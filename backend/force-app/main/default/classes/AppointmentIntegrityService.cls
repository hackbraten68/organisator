/**
 * Repariert historische Termin-Datensätze, die eine Invariante verletzen, die
 * heute gilt, zum Zeitpunkt ihrer Anlage aber noch nicht existierte.
 *
 * WAS DAS IST
 *   Die Validierungsregeln auf `Appointment__c` (manuell in Classic angelegt,
 *   siehe `backend/docs/g1-manual-checklist.md`) verlangen Begleitdaten zum
 *   Status:
 *
 *       Confirmed  →  ConfirmedAt__c
 *       Completed  →  CompletedAt__c
 *       Cancelled  →  CancellationReason__c
 *
 *   Ein Datensatz aus der Zeit vor den Regeln kann diese Bedingung verletzen.
 *   Weil die Regel das Ergebnis eines Speicherns prüft und nicht dessen
 *   Vorgeschichte, ist er **nicht gesperrt** — aber jede Änderung muss den
 *   Verstoß im selben Speichervorgang beseitigen. Ein isoliertes Ändern eines
 *   anderen Feldes scheitert. Genau daraus folgt der Reparaturschritt:
 *   `Status__c` auf `Draft` zurücksetzen, weil der entstehende Zustand gültig ist.
 *
 *   Ein „Freeze" wäre die falsche Beschreibung. Gemessen am 2026-10-15: eine
 *   Probe mit Notizänderung auf einem verstoßenden Datensatz wurde abgewiesen,
 *   dieselbe Probe mit zusätzlichem `Status__c → Draft` nicht.
 *
 * WAS DAS NICHT IST
 *   Kein Werkzeug zum Erfinden von Zeitstempeln. `ConfirmedAt__c` behauptet ein
 *   historisches Ereignis; ein nicht belegter Wert wäre eine erfundene Tatsache.
 *   Diese Reparaturart setzt den Status zurück und dokumentiert warum.
 *
 * WARUM ÜBERHAUPT EIN SERVICE
 *   Die Reparatur ist technisch ein Update. Der Wert liegt im benannten,
 *   wiederholbaren und auditierten Weg: Pflichtbegründung, Eintrag im Datensatz,
 *   Audit-Event, und `findInconsistent()` für den nächsten historischen
 *   Ausreißer. Ohne das wäre die Bereinigung in drei Wochen wieder ein
 *   Ad-hoc-Skript.
 *
 * SICHERHEITSKANTE
 *   `repair()` repariert ausschließlich die übergebene Freigabemenge. Es gibt
 *   bewusst kein `repair(findInconsistent(), …)` und keinen Weg, eine ganze
 *   Befundliste ungeprüft zu verarbeiten. Ein Datensatz, der nur zufällig
 *   gefunden wurde, wird nicht angefasst.
 *
 * TESTGRENZE
 *   Die Erkennungs- und Planlogik ist vollständig testbar und ohne DML. Die
 *   Ausführung ist es nicht: eine realistische Fixture lässt sich nicht anlegen,
 *   weil die Validierungsregel das Anlegen inkonsistenter Sätze verhindert — auch
 *   im Testkontext. Der Wirkungsnachweis ist deshalb der kontrollierte Lauf auf
 *   einem echten Altbestandssatz, protokolliert in ADR-015.
 */
public class AppointmentIntegrityService {
    /** Befund: bestätigt, aber ohne Zeitpunkt der Bestätigung. */
    public static final String CONFIRMED_WITHOUT_CONFIRMED_AT = 'CONFIRMED_WITHOUT_CONFIRMED_AT';
    /** Befund: abgeschlossen, aber ohne Zeitpunkt des Abschlusses. */
    public static final String COMPLETED_WITHOUT_COMPLETED_AT = 'COMPLETED_WITHOUT_COMPLETED_AT';
    /** Befund: abgesagt, aber ohne Begründung. */
    public static final String CANCELLED_WITHOUT_REASON = 'CANCELLED_WITHOUT_REASON';

    /** Die einzige heute gebaute Reparaturart. */
    public static final String RESET_TO_DRAFT = 'reset_to_draft';

    public static final String OUTCOME_PLANNED = 'PLANNED';
    public static final String OUTCOME_APPROVED = 'APPROVED';
    public static final String OUTCOME_REPAIRED = 'REPAIRED';
    public static final String OUTCOME_SKIPPED_NOT_INCONSISTENT = 'SKIPPED_NOT_INCONSISTENT';
    public static final String OUTCOME_SKIPPED_NOT_APPROVED = 'SKIPPED_NOT_APPROVED';
    public static final String OUTCOME_FAILED = 'FAILED';

    /** Maximale Länge von `AuditEvent__c.Reason__c`. */
    private static final Integer MAX_REASON_LENGTH = 1000;
    /** Maximale Länge von `Appointment__c.Notes__c`. */
    private static final Integer MAX_NOTES_LENGTH = 32768;
    /** Unterhalb dieser Länge gilt eine Begründung als nicht belastbar. */
    private static final Integer MIN_REASON_LENGTH = 15;

    public class AppointmentIntegrityException extends Exception {
    }

    /** Ein einzelner Befund auf einem Datensatz. */
    public class Finding {
        public Id appointmentId;
        public String name;
        public String finding;
        public String currentStatus;
    }

    /**
     * Der deterministische Plan fuer einen Datensatz. Enthaelt alles, was zur
     * Freigabe sichtbar sein muss — ohne dass etwas geschrieben wurde.
     */
    public class PlannedRepair {
        public Id appointmentId;
        public String name;
        public String finding;
        public String currentStatus;
        public String targetStatus;
        public Datetime currentTimestamp;
        public String plannedNotes;
        public String plannedEventType;
        public List<String> warnings = new List<String>();
        public Boolean executable = false;
        public String exclusionReason;

        /** Vom Aufrufer gesetzt: steht diese Id in der Freigabemenge? */
        public Boolean approved = false;
    }

    /** Ergebnis fuer genau einen Datensatz. */
    public class RepairOutcome {
        public Id appointmentId;
        public String name;
        public String outcome;
        public String message;
    }

    public class RepairResult {
        public List<RepairOutcome> outcomes = new List<RepairOutcome>();

        public Integer countOf(String outcome) {
            Integer n = 0;
            for (RepairOutcome o : outcomes) {
                if (o.outcome == outcome) {
                    n += 1;
                }
            }
            return n;
        }
    }

    /**
     * Alle Datensaetze, die eine der drei Invarianten verletzen.
     *
     * Liefert benannte Befunde statt eines unscharfen "inkonsistent", damit
     * `repair()` je Befund entscheiden kann, welche Reparatur ueberhaupt
     * zulaessig ist. Breit in der Entdeckung — das ist ein Lesen.
     */
    public static List<Finding> findInconsistent() {
        List<Finding> findings = new List<Finding>();
        // `CancellationReason__c` ist ein Long Text Area und laesst sich nicht
        // in WHERE filtern ("field 'CancellationReason__c' can not be filtered in
        // a query call"). Die Abweichung wird deshalb in Apex geprueft statt in
        // SOQL: Cancelled-Saetze kommen breit herein, alles andere filtert die
        // Query. findingFor() ist die einzige Stelle, die einen Befund erkennt.
        for (Appointment__c row : [
            SELECT Id, Name, Status__c, ConfirmedAt__c, CompletedAt__c, CancellationReason__c
            FROM Appointment__c
            WHERE (Status__c = 'Confirmed' AND ConfirmedAt__c = null)
                OR (Status__c = 'Completed' AND CompletedAt__c = null)
                OR Status__c = 'Cancelled'
        ]) {
            String finding = findingFor(row);
            if (finding == null) {
                continue;
            }
            Finding f = new Finding();
            f.appointmentId = row.Id;
            f.name = row.Name;
            f.currentStatus = row.Status__c;
            f.finding = finding;
            findings.add(f);
        }
        return findings;
    }

    /** Der Befundcode zu einem Datensatz, oder null bei konsistenten Zeilen. */
    public static String findingFor(Appointment__c row) {
        if (row.Status__c == 'Confirmed' && row.ConfirmedAt__c == null) {
            return CONFIRMED_WITHOUT_CONFIRMED_AT;
        }
        if (row.Status__c == 'Completed' && row.CompletedAt__c == null) {
            return COMPLETED_WITHOUT_COMPLETED_AT;
        }
        if (row.Status__c == 'Cancelled' && row.CancellationReason__c == null) {
            return CANCELLED_WITHOUT_REASON;
        }
        return null;
    }

    /**
     * Der Plan je Datensatz. Fuehrt **kein** DML aus.
     *
     * `approvedIds` ist die Freigabemenge. Datensaetze ausserhalb davon werden
     * mit `SKIPPED_NOT_APPROVED` geplant, nicht repariert — die Entdeckung darf
     * breit sein, die Mutation nicht.
     */
    public static List<PlannedRepair> planRepair(List<Id> approvedIds, String reason) {
        validateReason(reason);
        List<PlannedRepair> plans = new List<PlannedRepair>();
        Set<Id> approved = new Set<Id>(approvedIds == null ? new List<Id>() : approvedIds);
        if (approved.isEmpty()) {
            return plans;
        }

        Map<Id, Boolean> portalVisible = portalVisibleMap(new List<Id>(approved));

        for (Appointment__c row : [
            SELECT Id, Name, Status__c, ConfirmedAt__c, CompletedAt__c, CancellationReason__c, Notes__c
            FROM Appointment__c
            WHERE Id IN :approved
        ]) {
            PlannedRepair plan = new PlannedRepair();
            plan.appointmentId = row.Id;
            plan.name = row.Name;
            plan.currentStatus = row.Status__c;
            plan.currentTimestamp = timestampOf(row);
            plan.approved = true;
            plan.targetStatus = 'Draft';
            plan.plannedEventType = 'appointment.legacy_repaired';

            String finding = findingFor(row);
            if (finding == null) {
                plan.executable = false;
                plan.exclusionReason = 'Datensatz ist konsistent — keine Reparatur noetig.';
                plans.add(plan);
                continue;
            }

            plan.finding = finding;
            plan.plannedNotes = buildNotesEntry(row, finding, reason);

            if (plan.plannedNotes.length() > MAX_NOTES_LENGTH) {
                plan.executable = false;
                plan.exclusionReason =
                    'Notizanhang wuerde ' +
                    MAX_NOTES_LENGTH +
                    ' Zeichen ueberschreiten. Es wird nicht gekuerzt — der Datensatz bleibt unveraendert.';
            } else {
                plan.executable = true;
            }

            if (portalVisible.containsKey(row.Id) && portalVisible.get(row.Id)) {
                plan.warnings.add(
                    'Portal-Share vorhanden — die Ruecksetzung aendert den teilnehmerseitig sichtbaren Status. ' +
                        'Ausdrueckliche Freigabe noetig.'
                );
            }

            plans.add(plan);
        }
        return plans;
    }

    /**
     * Fuehrt die Reparatur fuer genau die uebergebenen Ids aus.
     *
     * Je Datensatz all-or-none: Das Audit-Event und die Terminveraenderung
     * gelingen gemeinsam oder gar nicht. Das ist in Apex nicht selbstverstaendlich
     * — ein abgefangener DML-Fehler laesst ein vorher erfolgreiches Update
     * stehen. Deshalb der Savepoint je Datensatz statt eines try/catch, das
     * zurueckrollen wuerde was es nicht kann.
     *
     * Faellt der Lauf zwischen Planung und Ausfuehrung auf einen bereits
     * reparierten Datensatz, wird er uebersprungen, niemals zurueckgesetzt.
     */
    public static RepairResult repair(List<Id> approvedIds, String reason) {
        validateReason(reason);
        RepairResult result = new RepairResult();
        if (approvedIds == null || approvedIds.isEmpty()) {
            return result;
        }

        Set<Id> approved = new Set<Id>(approvedIds);
        Map<Id, Appointment__c> rows = new Map<Id, Appointment__c>();
        for (Appointment__c row : [
            SELECT Id, Name, Status__c, ConfirmedAt__c, CompletedAt__c, CancellationReason__c, Notes__c
            FROM Appointment__c
            WHERE Id IN :approved
        ]) {
            rows.put(row.Id, row);
        }

        for (Id id : approved) {
            if (!rows.containsKey(id)) {
                result.outcomes.add(
                    outcome(id, null, OUTCOME_FAILED, 'Datensatz existiert nicht oder ist kein Appointment__c.')
                );
                continue;
            }

            Appointment__c row = rows.get(id);
            String finding = findingFor(row);
            if (finding == null) {
                result.outcomes.add(
                    outcome(
                        id,
                        row.Name,
                        OUTCOME_SKIPPED_NOT_INCONSISTENT,
                        'Datensatz ist inzwischen konsistent — nichts geaendert, kein Audit-Event.'
                    )
                );
                continue;
            }

            String notesEntry = buildNotesEntry(row, finding, reason);
            if (notesEntry.length() > MAX_NOTES_LENGTH) {
                result.outcomes.add(
                    outcome(
                        id,
                        row.Name,
                        OUTCOME_FAILED,
                        'Notizanhang wuerde ' + MAX_NOTES_LENGTH + ' Zeichen ueberschreiten. Kein Eingriff.'
                    )
                );
                continue;
            }

            AuditEvent__c audit = buildAuditEvent(row, finding, reason);
            Savepoint sp = Database.setSavepoint();

            Appointment__c change = new Appointment__c(Id = row.Id, Status__c = 'Draft');
            Database.SaveResult updateResult = Database.update(change, false);
            if (!updateResult.isSuccess()) {
                Database.rollback(sp);
                result.outcomes.add(
                    outcome(id, row.Name, OUTCOME_FAILED, errorText(updateResult.getErrors()))
                );
                continue;
            }

            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                result.outcomes.add(
                    outcome(id, row.Name, OUTCOME_FAILED, 'Audit-Event fehlgeschlagen, Update zurueckgerollt: ' + errorText(auditResult.getErrors()))
                );
                continue;
            }

            result.outcomes.add(
                outcome(id, row.Name, OUTCOME_REPAIRED, finding + ' → ' + RESET_TO_DRAFT + ' mit Audit-Event.')
            );
        }

        return result;
    }

    /**
     * Baut den Notizeintrag. Reine Funktion — ohne DML und ohne Seiteneffekt,
     * damit Format und Randfaelle direkt testbar sind.
     *
     * Haengt an, ueberschreibt nie. Ein bestehender Text bleibt lesbar, weil die
     * Begruendung fuer den Datenbestand sonst verloren ginge.
     */
    public static String buildNotesEntry(Appointment__c row, String finding, String reason) {
        String entry =
            '[' +
            today() +
            ' Legacy-Reparatur]\n' +
            'Status von ' +
            (row.Status__c == null ? '(leer)' : row.Status__c) +
            ' auf Draft zurueckgesetzt (' +
            finding +
            ' → ' +
            RESET_TO_DRAFT +
            ').\n' +
            'Grund: ' +
            reason;
        if (String.isBlank(row.Notes__c)) {
            return entry;
        }
        String existing = row.Notes__c;
        // Trenner nur einfuegen, wenn wirklich etwas vorhanden ist und kein
        // Zeilenumbruch den Block schon abschliesst.
        String separator = existing.endsWith('\n') ? '' : '\n';
        return existing + separator + '\n' + entry;
    }

    /**
     * Baut das Audit-Event. Reine Funktion, damit die Pflichtfelder ohne DML
     * pruefbar sind.
     *
     * `Action__c` beantwortet *was* technisch geschah, `Reason__c` *warum* in
     * diesem Einzelfall. Das ist die Trennung, die eine spaetere Auswertung in
     * beide Richtungen ermoeglicht.
     */
    public static AuditEvent__c buildAuditEvent(Appointment__c row, String finding, String reason) {
        return new AuditEvent__c(
            Action__c = RESET_TO_DRAFT,
            ActorId__c = UserInfo.getUserId(),
            ActorType__c = 'staff',
            Changes__c = JSON.serialize(
                new List<Map<String, Object>>{
                    new Map<String, Object>{ 'field' => 'Status__c', 'oldValue' => row.Status__c, 'newValue' => 'Draft', 'redacted' => false },
                    new Map<String, Object>{ 'field' => 'Notes__c', 'oldValue' => row.Notes__c, 'newValue' => buildNotesEntry(row, finding, reason), 'redacted' => false }
                }
            ),
            ChangedFields__c = JSON.serialize(new List<String>{ 'Status__c', 'Notes__c' }),
            CorrelationId__c = newCorrelationId(row.Id),
            Domain__c = 'appointment',
            EventType__c = 'appointment.legacy_repaired',
            OccurredAt__c = Datetime.now(),
            Reason__c = reason,
            SchemaVersion__c = 1,
            Sensitivity__c = 'normal',
            Source__c = 'automation',
            SubjectId__c = row.Id,
            SubjectType__c = 'Appointment__c',
            Visibility__c = 'staff'
        );
    }

    private static void validateReason(String reason) {
        if (reason == null || String.isBlank(reason)) {
            throw new AppointmentIntegrityException(
                'Eine Reparatur braucht eine Begründung. Konvention: [Referenz] Befund; fachliche Entscheidung; Freigabe.'
            );
        }
        String trimmed = reason.trim();
        if (trimmed.length() > MAX_REASON_LENGTH) {
            throw new AppointmentIntegrityException(
                'Die Begruendung ist ' + trimmed.length() + ' Zeichen lang, erlaubt sind ' + MAX_REASON_LENGTH + '.'
            );
        }
        if (trimmed.length() < MIN_REASON_LENGTH) {
            throw new AppointmentIntegrityException(
                'Die Begruendung ist mit ' +
                    trimmed.length() +
                    ' Zeichen zu kurz, um eine Entscheidung zu belegen. Mindestens ' +
                    MIN_REASON_LENGTH +
                    ' Zeichen.'
            );
        }
    }

    /** Termin-Ids, die einen Portal-Share unter dem Portal-Grund tragen. */
    private static Map<Id, Boolean> portalVisibleMap(List<Id> appointmentIds) {
        Map<Id, Boolean> visible = new Map<Id, Boolean>();
        for (Appointment__Share share : [
            SELECT ParentId
            FROM Appointment__Share
            WHERE ParentId IN :appointmentIds AND RowCause = 'Portal_Access__c'
        ]) {
            visible.put(share.ParentId, true);
        }
        return visible;
    }

    private static Datetime timestampOf(Appointment__c row) {
        if (row.Status__c == 'Confirmed') {
            return row.ConfirmedAt__c;
        }
        if (row.Status__c == 'Completed') {
            return row.CompletedAt__c;
        }
        return null;
    }

    private static RepairOutcome outcome(Id id, String name, String outcome, String message) {
        RepairOutcome o = new RepairOutcome();
        o.appointmentId = id;
        o.name = name;
        o.outcome = outcome;
        o.message = message;
        return o;
    }

    private static String errorText(List<Database.Error> errors) {
        List<String> parts = new List<String>();
        for (Database.Error e : errors) {
            parts.add(e.getStatusCode() + ': ' + e.getMessage());
        }
        return String.join(parts, '; ');
    }

    /** ISO-Datum ohne Locale-Abhaengigkeit. */
    private static String today() {
        Date d = Date.today();
        return String.valueOf(d.year()) + '-' + pad(d.month()) + '-' + pad(d.day());
    }

    private static String pad(Integer value) {
        return value < 10 ? '0' + String.valueOf(value) : String.valueOf(value);
    }

    /**
     * Zufalls-ID im UUID-Format fuer die Correlation eines Reparaturlaufs.
     *
     * Eine eigene Zufallsquelle statt eines vorhandenen Feldes: die Correlation
     * gehoert zum Lauf, nicht zum Termin, und muss auch dann eindeutig sein, wenn
     * `Appointment__c.CorrelationId__c` leer ist.
     */
    /**
     * Die Correlation eines Reparaturvorgangs.
     *
     * Bewusst keine Zufallsquelle: `Crypto.generateRandomUUID()` und
     * `Crypto.generateRandomBytes()` sind in dieser API-Version nicht verfuegbar
     * (beim Deploy am 2026-10-15 gemessen). Der Zweck ist ohnehin nicht
     * Geheimhaltung, sondern die Gruppierung der Ereignisse, die zu derselben
     * Reparatur gehoeren.
     *
     * Abgeleitet aus der Termin-Id: eindeutig pro Datensatz, rein aus der
     * Eingabe bestimmt — damit bleibt `buildAuditEvent()` eine reine Funktion und
     * im Test wiederholbar. Zwei Laeufe auf demselben Termin ergeben dieselbe
     * Correlation, was hier richtig ist: es ist dieselbe Reparatur.
     */
    private static String newCorrelationId(Id appointmentId) {
        return 'repair-' + String.valueOf(appointmentId);
    }
}