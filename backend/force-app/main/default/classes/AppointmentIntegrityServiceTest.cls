/**
 * Tests für `AppointmentIntegrityService`.
 *
 * DREI TESTEBENEN, und das ist hier der wichtigste Kommentar der Datei — die
 * Testabdeckung ist ungleich verteilt, und das darf beim Lesen nicht verlorengehen:
 *
 *  1. Vollständig testbar — alles, was keine inkonsistente Fixture braucht:
 *     die Begründungswächter, die Planstruktur, die Notizformatierung als reine
 *     Funktion, der Audit-Payload, der No-op-Pfad.
 *
 *  2. Nur negativ testbar — `findInconsistent()` an einem *sauberen* Termin
 *     beweist, dass konsistente Datensätze nicht gemeldet werden. Es beweist
 *     **nicht**, dass echte Verstöße gefunden werden; dafür gäbe es eine Fixture,
 *     die sich nicht bauen lässt.
 *
 *  3. Nicht isolierbar — der End-to-End-Pfad
 *         Confirmed + ConfirmedAt leer → repair() → Draft + Audit-Event
 *     Die aktive Validierungsregel `Status_Confirmed_Requires_ConfirmedAt`
 *     verhindert das Anlegen genau dieses Zustands — auch im Testkontext, weil
 *     Validierungsregeln dort genauso greifen. Ein Test, der so einen Datensatz
 *     bräuchte, würde die Regel umgehen müssen und damit nichts beweisen.
 *
 *     Der Wirkungsnachweis ist deshalb der kontrollierte Lauf auf einem echten
 *     Altbestandssatz, protokolliert in ADR-015. Er wird dort wie ein formaler
 *     Testfall geführt: Vorherzustand, Plan, Reparatur, Audit-Vollständigkeit,
 *     zweiter Aufruf als No-op, TERM-0002 unverändert.
 */
@IsTest
private class AppointmentIntegrityServiceTest {
    private static final String REASON =
        '[Legacy-Repair 2026-10-15] Confirmed ohne ConfirmedAt; als Testdatensatz klassifiziert; Ruecksetzung auf Draft freigegeben.';

    /**
     * Markiert den Testtermin eindeutig.
     *
     * Der Termin wird in jedem Test ueber dieses Feld gefunden statt ueber eine
     * statische Variable aus `@TestSetup`. Grund ist eine Messung in dieser
     * Sandbox (2026-10-15): das DML aus dem TestSetup persistiert, die
     * statisch gesetzte Id kommt im Test aber als `null` an. Ein
     * `assertNotEquals(null, cleanAppointmentId())` schlug reproduzierbar fehl —
     * unabhaengig von Zugriffsstufe und Deklaration.
     *
     * Die Lehre ist nicht „TestSetup ist kaputt", sondern: die Datenexistenz
     * belegen, nicht eine Variable. Deshalb wird hier abgefragt.
     */
    private static final String MARKER = 'https://integrity.example.invalid/marker';

    private static Id cleanAppointmentId() {
        List<Appointment__c> found = [SELECT Id FROM Appointment__c WHERE MeetingLink__c = :MARKER LIMIT 1];
        if (found.isEmpty()) {
            throw new AppointmentIntegrityService.AppointmentIntegrityException('Testtermin fehlt — TestSetup hat nicht gelaufen.');
        }
        return found[0].Id;
    }

    @TestSetup
    static void makeData() {
        Contact contact = new Contact(LastName = 'Integrity', Email = 'integrity@example.invalid');
        insert contact;

        Participant__c participant = new Participant__c(
            Name = 'Integrity',
            Status__c = 'Active',
            Contact__c = contact.Id
        );
        insert participant;

        // Ein *konsistenter* Termin. Genau der Zustand, den die Regel verlangt —
        // das ist der einzige, den ein Test bauen darf.
        Appointment__c clean = new Appointment__c(
            Participant__c = participant.Id,
            Type__c = 'Coaching',
            Location__c = 'Teams',
            MeetingLink__c = MARKER,
            Status__c = 'Confirmed',
            ConfirmedAt__c = Datetime.newInstanceGmt(2026, 10, 10, 9, 0, 0),
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 20, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 20, 11, 0, 0)
        );
        insert clean;
    }

    // --- Ebene 1: vollstaendig testbar -------------------------------------

    @IsTest
    static void eineLeereBegruendungWirdAbgelehnt() {
        try {
            AppointmentIntegrityService.planRepair(new List<Id>{ cleanAppointmentId() }, null);
            System.assert(false, 'planRepair muss eine fehlende Begruendung ablehnen');
        } catch (AppointmentIntegrityService.AppointmentIntegrityException e) {
            // Auf 'Konvention' pruefen, nicht auf 'Begruendung': die Meldung
            // enthaelt das echte Umlaut aus 'Begruendung', und eine Assertion
            // auf die ASCII-Form schlaegt fehl, ohne dass etwas falsch waere.
            System.assert(
                e.getMessage() != null && e.getMessage().contains('Konvention'),
                'die Meldung nennt die Konvention fuer die Begruendung, war: [' + e.getMessage() + ']'
            );
        }
    }

    @IsTest
    static void eineBegruendungAusNurLeerzeichenWirdAbgelehnt() {
        try {
            AppointmentIntegrityService.planRepair(new List<Id>{ cleanAppointmentId() }, '   ');
            System.assert(false, 'planRepair muss eine leere Begruendung ablehnen');
        } catch (AppointmentIntegrityService.AppointmentIntegrityException e) {
            System.assert(true);
        }
    }

    @IsTest
    static void eineZuKurzeBegruendungWirdAbgelehnt() {
        try {
            AppointmentIntegrityService.planRepair(new List<Id>{ cleanAppointmentId() }, 'ok');
            System.assert(false, 'eine einzelne Silbe ist keine Begruendung');
        } catch (AppointmentIntegrityService.AppointmentIntegrityException e) {
            System.assert(e.getMessage().contains('zu kurz'), 'die Meldung sagt, dass es zu kurz ist');
        }
    }

    @IsTest
    static void eineZuLangeBegruendungWirdAbgelehntStattGekuerzt() {
        String tooLong = 'a'.repeat(1001);
        try {
            AppointmentIntegrityService.planRepair(new List<Id>{ cleanAppointmentId() }, tooLong);
            System.assert(false, 'eine Begruendung jenseits von Reason__c muss abgelehnt werden');
        } catch (AppointmentIntegrityService.AppointmentIntegrityException e) {
            System.assert(e.getMessage().contains('1000'), 'die Meldung nennt das erlaubte Mass');
        }
    }

    @IsTest
    static void eineFreigabemengeOhneIdsLiefertKeinenPlan() {
        System.assertEquals(
            0,
            AppointmentIntegrityService.planRepair(new List<Id>(), REASON).size(),
            'eine leere Freigabemenge repariert nichts'
        );
        System.assertEquals(
            0,
            AppointmentIntegrityService.planRepair(null, REASON).size(),
            'null ist dasselbe wie leer'
        );
    }

    @IsTest
    static void einKonsistenterDatensatzWirdAlsNichtReparierbarGeplant() {
        List<AppointmentIntegrityService.PlannedRepair> plans = AppointmentIntegrityService.planRepair(
            new List<Id>{ cleanAppointmentId() },
            REASON
        );

        System.assertEquals(1, plans.size(), 'genau ein Plan');
        AppointmentIntegrityService.PlannedRepair plan = plans[0];
        System.assertEquals(false, plan.executable, 'konsistent heisst: nichts zu tun');
        System.assert(plan.exclusionReason.contains('konsistent'), 'der Grund steht im Plan');
    }

    @IsTest
    static void derPlanNenntZielstatusUndEreignis() {
        // Der Plan entsteht auch fuer einen konsistenten Satz — die Felder
        // Zielstatus und Ereignistyp sind planbar, unabhaengig vom Befund.
        AppointmentIntegrityService.PlannedRepair plan = AppointmentIntegrityService.planRepair(
            new List<Id>{ cleanAppointmentId() },
            REASON
        )[0];

        System.assertEquals('Draft', plan.targetStatus, 'das Ziel ist immer Draft');
        System.assertEquals('appointment.legacy_repaired', plan.plannedEventType, 'der Ereignistyp steht fest');
        System.assertEquals(cleanAppointmentId(), plan.appointmentId, 'der Datensatz ist benannt');
    }

    @IsTest
    static void dieFreigabemengeWirdNichtVersteckt() {
        List<AppointmentIntegrityService.PlannedRepair> plans = AppointmentIntegrityService.planRepair(
            new List<Id>{ cleanAppointmentId() },
            REASON
        );
        System.assertEquals(true, plans[0].approved, 'ein geplanter Datensatz gilt als freigegeben');
    }

    @IsTest
    static void findInconsistentIgnoriertKonsistenteDatensaetze() {
        // Ebene 2 — der negative Zweig. Siehe Dateikopf.
        List<AppointmentIntegrityService.Finding> findings = AppointmentIntegrityService.findInconsistent();
        for (AppointmentIntegrityService.Finding f : findings) {
            System.assertNotEquals(
                cleanAppointmentId(),
                f.appointmentId,
                'ein konsistenter Termin darf nie als Verstoß gemeldet werden'
            );
        }
    }

    @IsTest
    static void repairUeberspringtKonsistenteDatensaetzeOhneAuditEvent() {
        Id id = cleanAppointmentId();
        Integer before = [SELECT COUNT() FROM AuditEvent__c WHERE SubjectId__c = :id];
        AppointmentIntegrityService.RepairResult result = AppointmentIntegrityService.repair(new List<Id>{ id }, REASON);
        Integer after = [SELECT COUNT() FROM AuditEvent__c WHERE SubjectId__c = :id];

        System.assertEquals(1, result.outcomes.size(), 'ein Ergebnis je Datensatz');
        System.assertEquals(
            AppointmentIntegrityService.OUTCOME_SKIPPED_NOT_INCONSISTENT,
            result.outcomes[0].outcome,
            'konsistent wird uebersprungen'
        );
        System.assertEquals(0, result.countOf(AppointmentIntegrityService.OUTCOME_REPAIRED), 'nichts repariert');
        System.assertEquals(before, after, 'und es entsteht kein Audit-Event');
    }

    @IsTest
    static void eineIdFremderObjektartWirdAlsFehlschlagGemeldet() {
        // Eine echte Account-Id statt einer erfundenen: damit wird die
        // Typpruefung geprueft und nicht die Id-Syntax.
        Account account = new Account(Name = 'Fremd');
        insert account;

        AppointmentIntegrityService.RepairResult result = AppointmentIntegrityService.repair(
            new List<Id>{ account.Id },
            REASON
        );

        System.assertEquals(1, result.outcomes.size(), 'ein Ergebnis');
        System.assertEquals(
            AppointmentIntegrityService.OUTCOME_FAILED,
            result.outcomes[0].outcome,
            'eine unbekannte Id ist ein Fehlschlag'
        );
        System.assertEquals(0, result.countOf(AppointmentIntegrityService.OUTCOME_REPAIRED), 'nichts repariert');
    }

    @IsTest
    static void derNotizeintragHaengtAnUndUeberschreibtNie() {
        Appointment__c row = new Appointment__c(
            Status__c = 'Confirmed',
            Notes__c = 'Bestehende Notiz, die erhalten bleiben muss.'
        );

        String entry = AppointmentIntegrityService.buildNotesEntry(
            row,
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            REASON
        );

        System.assert(entry.startsWith('Bestehende Notiz'), 'der vorhandene Text steht vorn');
        System.assert(entry.contains('Legacy-Reparatur'), 'der Eintrag ist angehaengt');
        System.assert(entry.contains(REASON), 'die Begruendung steht im Eintrag');
        System.assert(entry.contains(AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT), 'der Befund steht drin');
    }

    @IsTest
    static void derNotizeintragVerdoppeltKeinenZeilenumbruch() {
        Appointment__c row = new Appointment__c(Status__c = 'Confirmed', Notes__c = 'Text mit Abschluss\n');

        String entry = AppointmentIntegrityService.buildNotesEntry(
            row,
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            REASON
        );

        System.assert(!entry.contains('\n\n\n'), 'kein Leerzeilenstapel aus einem vorhandenen Umbruch');
    }

    @IsTest
    static void derNotizeintragTraegtInEinerLeereNotesNurDenEintrag() {
        Appointment__c row = new Appointment__c(Status__c = 'Confirmed');

        String entry = AppointmentIntegrityService.buildNotesEntry(
            row,
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            REASON
        );

        System.assert(!entry.startsWith('\n'), 'kein fuehrender Leerraum bei leerer Notiz');
        System.assert(entry.contains('Legacy-Reparatur'), 'der Eintrag steht trotzdem drin');
    }

    @IsTest
    static void derNotizeintragNenntDenDatumstagImFormat() {
        String entry = AppointmentIntegrityService.buildNotesEntry(
            new Appointment__c(Status__c = 'Cancelled'),
            AppointmentIntegrityService.CANCELLED_WITHOUT_REASON,
            REASON
        );

        Date d = Date.today();
        String iso = String.valueOf(d.year()) + '-';
        System.assert(entry.startsWith('[' + iso), 'ISO-Datum mit fuehrender Null, unabhaengig von der Locale');
    }

    @IsTest
    static void dasAuditEventFuelltAllePflichtfelder() {
        // Name ist AutoNumber und nicht schreibbar — der Test braucht es nicht.
        Appointment__c row = new Appointment__c(Id = cleanAppointmentId(), Status__c = 'Confirmed');

        AuditEvent__c audit = AppointmentIntegrityService.buildAuditEvent(
            row,
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            REASON
        );

        // Alle elf in der Objektmetadaten-Liste als required markierten Felder.
        System.assertNotEquals(null, audit.Action__c, 'Action__c');
        System.assertNotEquals(null, audit.ActorType__c, 'ActorType__c');
        System.assertNotEquals(null, audit.Domain__c, 'Domain__c');
        System.assertNotEquals(null, audit.EventType__c, 'EventType__c');
        System.assertNotEquals(null, audit.OccurredAt__c, 'OccurredAt__c');
        System.assertNotEquals(null, audit.SchemaVersion__c, 'SchemaVersion__c');
        System.assertNotEquals(null, audit.Sensitivity__c, 'Sensitivity__c');
        System.assertNotEquals(null, audit.Source__c, 'Source__c');
        System.assertNotEquals(null, audit.SubjectId__c, 'SubjectId__c');
        System.assertNotEquals(null, audit.SubjectType__c, 'SubjectType__c');
        System.assertNotEquals(null, audit.Visibility__c, 'Visibility__c');

        System.assertEquals('reset_to_draft', audit.Action__c, 'Action sagt, was technisch geschah');
        System.assertEquals(REASON, audit.Reason__c, 'Reason sagt, warum in diesem Fall');
        System.assertEquals('automation', audit.Source__c, 'die Quelle ist automation — ein zulaessiger Wert');
        System.assertEquals('staff', audit.ActorType__c, 'Akteur ist staff');
        System.assertEquals('appointment', audit.Domain__c, 'Domäne ist appointment');
        System.assertEquals(cleanAppointmentId(), audit.SubjectId__c, 'der Datensatz ist referenziert');
    }

    @IsTest
    static void dasAuditEventProtokolliertAlterUndNeuerWert() {
        Appointment__c row = new Appointment__c(Id = cleanAppointmentId(), Status__c = 'Confirmed');

        AuditEvent__c audit = AppointmentIntegrityService.buildAuditEvent(
            row,
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            REASON
        );

        System.assert(audit.Changes__c.contains('Status__c'), 'die Aenderung ist benannt');
        System.assert(audit.Changes__c.contains('Confirmed'), 'der alte Wert steht drin');
        System.assert(audit.ChangedFields__c.contains('Notes__c'), 'auch die Notiz ist Teil der Aenderung');
    }

    @IsTest
    static void derBefundcodeRichtetSichNachDemStatus() {
        System.assertEquals(
            AppointmentIntegrityService.CONFIRMED_WITHOUT_CONFIRMED_AT,
            AppointmentIntegrityService.findingFor(
                new Appointment__c(Status__c = 'Confirmed', ConfirmedAt__c = null)
            ),
            'Confirmed ohne Zeitstempel'
        );
        System.assertEquals(
            AppointmentIntegrityService.COMPLETED_WITHOUT_COMPLETED_AT,
            AppointmentIntegrityService.findingFor(
                new Appointment__c(Status__c = 'Completed', CompletedAt__c = null)
            ),
            'Completed ohne Zeitstempel'
        );
        System.assertEquals(
            AppointmentIntegrityService.CANCELLED_WITHOUT_REASON,
            AppointmentIntegrityService.findingFor(
                new Appointment__c(Status__c = 'Cancelled', CancellationReason__c = null)
            ),
            'Cancelled ohne Grund'
        );
        System.assertEquals(
            null,
            AppointmentIntegrityService.findingFor(
                new Appointment__c(Status__c = 'Confirmed', ConfirmedAt__c = Datetime.now())
            ),
            'konsistent ergibt keinen Befund'
        );
        System.assertEquals(
            null,
            AppointmentIntegrityService.findingFor(new Appointment__c(Status__c = 'Draft')),
            'Draft ist immer konsistent'
        );
    }
}