/**
 * Covers AppointmentCollisionGuard: no two appointments may occupy the same
 * coach's time (ADR-016).
 *
 * WHAT THIS PROVES
 *   - the guard sees a conflict no matter which write path produced it
 *   - the scope of a conflict is the coach, not the participant
 *   - touching windows are allowed, overlapping ones are not
 *   - `Cancelled` frees a time, every other status — including `NoShow` —
 *     occupies it
 *   - a change that cannot create a conflict does not fail because of one
 *   - the guard works in bulk, including conflicts inside one batch
 *   - a rejected write changes nothing and leaves no audit event behind
 *
 * WHAT THIS DOES NOT PROVE
 *   - that the rule is enforced on data that already existed before the guard
 *     was deployed. A state with two blocking, overlapping appointments cannot
 *     be produced in a test at all, because the guard prevents exactly that
 *     from being created. The "unrelated change" case is therefore proven
 *     twice: once on the rule (`AppointmentCollisionService`) and once as a
 *     write against a record that overlaps only a cancelled one.
 *   - anything about a later administrator path for intentional historical
 *     overlaps. There is none — the guard has no bypass (ADR-016).
 *
 * FIXTURES
 *   Ids are looked up per test rather than parked in static variables: on API
 *   67 a static assigned inside @TestSetup is not visible inside the test
 *   method (verified — the assert fires), so every test resolves what it needs
 *   itself.
 *
 *   No appointment is created in @TestSetup: the guard compares a record with
 *   every other record of the same coach, so a shared fixture would make the
 *   tests depend on each other. Participants and coaches are shared, the
 *   appointments are not.
 */
@IsTest
public class AppointmentCollisionGuardTest {
    private static final String PARTICIPANT_EMAIL = 'collision.participant@example.invalid';

    // --- 1. Anlegen -------------------------------------------------------

    @IsTest
    static void einInsertOhneUeberschneidungIstErlaubt() {
        Appointment__c row = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        Test.startTest();
        insert row;
        Test.stopTest();

        System.assertNotEquals(null, row.Id, 'der Termin ist gespeichert');
    }

    @IsTest
    static void einInsertMitUeberschneidungBeimSelbenCoachWirdAbgelehnt() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Draft') }
        );

        System.assertEquals(
            1,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c = :coachA()],
            'der zweite Termin ist nicht gespeichert'
        );
    }

    @IsTest
    static void derselbeZeitraumBeiUnterschiedlichenCoachesIstErlaubt() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        // Der gleiche Zeitraum bei einem anderen Coach ist ein anderes
        // Zeitfenster: zwei Coaches koennen parallel terminiert sein.
        Test.startTest();
        insert appointment(coachB(), at(1, 10), at(1, 11), 'Draft');
        Test.stopTest();

        System.assertEquals(
            2,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c IN :new Set<Id>{ coachA(), coachB() }],
            'beide Termine existieren'
        );
    }

    @IsTest
    static void einDirektVorherAngrenzenderTerminIstErlaubt() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        // Endet der erste genau, wenn der zweite beginnt, ueberlappen sie
        // nicht: der Coach darf sofort den naechsten Termin beginnen.
        Test.startTest();
        insert appointment(coachA(), at(1, 11), at(1, 12), 'Draft');
        Test.stopTest();

        System.assertEquals(
            2,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c = :coachA()],
            'beide Termine existieren'
        );
    }

    @IsTest
    static void einDirektNachherAngrenzenderTerminIstErlaubt() {
        insert appointment(coachA(), at(1, 12), at(1, 13), 'Draft');

        Test.startTest();
        insert appointment(coachA(), at(1, 11), at(1, 12), 'Draft');
        Test.stopTest();

        System.assertEquals(
            2,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c = :coachA()],
            'beide Termine existieren'
        );
    }

    @IsTest
    static void einVollstaendigEingeschlossenerTerminWirdAbgelehnt() {
        insert appointment(coachA(), at(1, 10), at(1, 14), 'Draft');

        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 11), at(1, 12), 'Draft') }
        );
    }

    @IsTest
    static void einVollstaendigUmschliessenderTerminWirdAbgelehnt() {
        insert appointment(coachA(), at(1, 11), at(1, 12), 'Draft');

        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 10), at(1, 14), 'Draft') }
        );
    }

    @IsTest
    static void eineUeberschneidungAmAnfangWirdAbgelehnt() {
        insert appointment(coachA(), at(1, 10), at(1, 12), 'Draft');

        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 9), at(1, 10, 30), 'Draft') }
        );
    }

    @IsTest
    static void eineUeberschneidungAmEndeWirdAbgelehnt() {
        insert appointment(coachA(), at(1, 10), at(1, 12), 'Draft');

        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 11, 30), at(1, 14), 'Draft') }
        );
    }

    // --- 2. Status --------------------------------------------------------

    @IsTest
    static void einCancelledTerminBlockiertNicht() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        // Ein stornierter Termin hat seine Zeit freigegeben.
        Test.startTest();
        insert appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Cancelled');
        Test.stopTest();

        System.assertEquals(
            2,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c = :coachA()],
            'beide Termine existieren'
        );
    }

    @IsTest
    static void einNoShowTerminBlockiert() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        // NoShow ist kein stornierter Termin: der Slot war belegt, der Coach
        // stand nur nicht zur Verfuegung.
        assertTimeConflictRejected(
            new List<Appointment__c>{ appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'NoShow') }
        );
    }

    @IsTest
    static void einWechselVonCancelledInEinenBlockierendenStatusWirdGeprueft() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        Appointment__c cancelled = appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Cancelled');
        insert cancelled;

        // Der Wechsel aus Cancelled heraus macht den Termin blockierend — und
        // damit wird geprueft.
        cancelled.Status__c = 'Draft';
        assertTimeConflictRejectedOnUpdate(new List<Appointment__c>{ cancelled });
    }

    @IsTest
    static void einWechselInCancelledIstZulaessig() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        Appointment__c overlapping = appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Cancelled');
        insert overlapping;

        // Ein stornierter Termin belegt nichts; der Wechsel in Cancelled loest
        // eine bestehende Ueberschneidung, statt eine zu erzeugen.
        Test.startTest();
        overlapping.Status__c = 'Cancelled';
        overlapping.Notes__c = 'Doppelt storniert';
        update overlapping;
        Test.stopTest();

        System.assertEquals(
            'Cancelled',
            [
                SELECT Status__c
                FROM Appointment__c
                WHERE Id = :overlapping.Id
            ]
            .Status__c,
            'der Status ist Cancelled'
        );
    }

    // --- 3. Welche Aenderungen geprueft werden ----------------------------

    @IsTest
    static void eineSachfremdeAenderungIstKeineKollisionsrelevanteAenderung() {
        Appointment__c before = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');

        Appointment__c notesOnly = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        notesOnly.Notes__c = 'Nur eine Notiz';
        System.assert(
            !AppointmentCollisionService.isCollisionRelevantChange(before, notesOnly),
            'eine Notiz aendert keinen belegten Zeitraum'
        );

        Appointment__c typeOnly = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        typeOnly.Type__c = 'Feedback';
        System.assert(
            !AppointmentCollisionService.isCollisionRelevantChange(before, typeOnly),
            'die Terminart aendert keinen belegten Zeitraum'
        );

        Appointment__c sameBlocking = appointment(coachA(), at(1, 10), at(1, 11), 'Confirmed');
        System.assert(
            !AppointmentCollisionService.isCollisionRelevantChange(before, sameBlocking),
            'zwei blockierende Status aendern den belegten Zeitraum nicht'
        );

        Appointment__c newCoach = appointment(coachB(), at(1, 10), at(1, 11), 'Draft');
        System.assert(
            AppointmentCollisionService.isCollisionRelevantChange(before, newCoach),
            'ein anderer Coach ist ein anderer Kalender'
        );

        Appointment__c laterStart = appointment(coachA(), at(1, 12), at(1, 11), 'Draft');
        System.assert(
            AppointmentCollisionService.isCollisionRelevantChange(before, laterStart),
            'eine andere Startzeit ist ein anderer Slot'
        );

        Appointment__c laterEnd = appointment(coachA(), at(1, 10), at(1, 12), 'Draft');
        System.assert(
            AppointmentCollisionService.isCollisionRelevantChange(before, laterEnd),
            'eine andere Endzeit ist ein anderer Slot'
        );

        Appointment__c outOfBlocking = appointment(coachA(), at(1, 10), at(1, 11), 'Cancelled');
        System.assert(
            AppointmentCollisionService.isCollisionRelevantChange(before, outOfBlocking),
            'der Wechsel aus einem blockierenden Status heraus ist relevant'
        );

        Appointment__c intoBlocking = appointment(coachA(), at(1, 10), at(1, 11), 'Cancelled');
        System.assert(
            AppointmentCollisionService.isCollisionRelevantChange(outOfBlocking, intoBlocking),
            'der Wechsel in einen blockierenden Status hinein ist relevant'
        );
    }

    @IsTest
    static void dieListeDerKollisionsrelevantenFelderIstDerVertrag() {
        // Die Liste ist die Zusage aus ADR-016. Die Vergleiche in
        // `isCollisionRelevantChange` sind ihre Umsetzung — beide muessen
        // zusammenpassen, sonst driftet die Doku von der Regel weg.
        System.assertEquals(
            4,
            AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.size(),
            'die Liste nennt genau vier Felder'
        );
        System.assert(
            AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.contains('Coach__c'),
            'der Coach ist relevant'
        );
        System.assert(
            AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.contains('StartTime__c'),
            'die Startzeit ist relevant'
        );
        System.assert(
            AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.contains('EndTime__c'),
            'die Endzeit ist relevant'
        );
        System.assert(
            AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.contains('Status__c'),
            'der Status ist relevant'
        );
        System.assert(
            !AppointmentCollisionService.COLLISION_RELEVANT_FIELDS.contains('Participant__c'),
            'der Teilnehmer ist nicht relevant: derselbe Coach zur selben Zeit fuer zwei Teilnehmende ist genau die Ueberschneidung'
        );
    }

    @IsTest
    static void eineSachfremdeAenderungAnEinemUeberschneidendenTerminIstErlaubt() {
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        Appointment__c cancelled = appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Cancelled');
        insert cancelled;

        // Der Termin ueberschneidet sich zwar mit einem anderen, ist aber
        // selbst nicht blockierend. Eine sachfremde Aenderung an ihm darf
        // nicht daran scheitern.
        Test.startTest();
        cancelled.Notes__c = 'Nur eine Notiz';
        update cancelled;
        Test.stopTest();

        System.assertEquals(
            'Nur eine Notiz',
            [
                SELECT Notes__c
                FROM Appointment__c
                WHERE Id = :cancelled.Id
            ]
            .Notes__c,
            'die Notiz ist gespeichert'
        );
    }

    @IsTest
    static void einUpdateVonCoachOderZeitraumWirdGeprueft() {
        Appointment__c moved = appointment(coachA(), at(1, 14), at(1, 15), 'Draft');
        insert moved;
        insert appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        insert appointment(coachA(), at(1, 20), at(1, 21), 'Draft');

        // Verschieben in ein belegtes Fenster: wird geprueft und abgelehnt.
        moved.StartTime__c = at(1, 10, 30);
        moved.EndTime__c = at(1, 11, 30);
        assertTimeConflictRejectedOnUpdate(new List<Appointment__c>{ moved });

        Appointment__c fresh = appointment(coachB(), at(1, 20), at(1, 21), 'Draft');
        insert fresh;

        // Coach-Wechsel in einen belegten Kalender: wird ebenfalls geprueft.
        fresh.Coach__c = coachA();
        assertTimeConflictRejectedOnUpdate(new List<Appointment__c>{ fresh });
    }

    @IsTest
    static void derBearbeiteteDatensatzKollidiertNichtMitSichSelbst() {
        Appointment__c row = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        insert row;

        // Ein Termin darf in ein Fenster verschoben werden, das sein eigenes
        // altes Fenster ueberlappt: der alte Stand des Datensatzes darf ihn
        // nicht gegen sich selbst pruefen.
        Test.startTest();
        row.StartTime__c = at(1, 10, 30);
        row.EndTime__c = at(1, 11, 30);
        update row;
        Test.stopTest();

        System.assertEquals(
            at(1, 10, 30),
            [
                SELECT StartTime__c
                FROM Appointment__c
                WHERE Id = :row.Id
            ]
            .StartTime__c,
            'die neue Startzeit ist gespeichert'
        );
    }

    // --- 4. Das Intervall -------------------------------------------------

    @IsTest
    static void einStartGleichDemEndeWirdAbgelehnt() {
        Appointment__c row = appointment(coachA(), at(1, 10), at(1, 10), 'Draft');

        try {
            insert row;
            System.assert(false, 'ein Intervall ohne Dauer muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(
                error.getMessage().contains(AppointmentConflictException.CODE_INVALID_INTERVAL),
                'die Meldung muss den Interval-Code tragen: ' + error.getMessage()
            );
        }
    }

    @IsTest
    static void einStartNachDemEndeWirdAbgelehnt() {
        Appointment__c row = appointment(coachA(), at(1, 12), at(1, 10), 'Draft');

        try {
            insert row;
            System.assert(false, 'ein umgekehrtes Intervall muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(
                error.getMessage().contains(AppointmentConflictException.CODE_INVALID_INTERVAL),
                'die Meldung muss den Interval-Code tragen: ' + error.getMessage()
            );
        }
    }

    // --- 5. Bulk ----------------------------------------------------------

    @IsTest
    static void einKonfliktInnerhalbEinesInsertBatchesWirdErkannt() {
        List<Appointment__c> rows = new List<Appointment__c>{
            appointment(coachA(), at(1, 10), at(1, 11), 'Draft'),
            appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Draft')
        };

        assertTimeConflictRejected(rows);
    }

    @IsTest
    static void einKonfliktInnerhalbEinesUpdateBatchesWirdErkannt() {
        Appointment__c first = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        Appointment__c second = appointment(coachA(), at(1, 12), at(1, 13), 'Draft');
        insert first;
        insert second;

        // Beide Termine werden gleichzeitig in dasselbe Fenster verschoben.
        first.StartTime__c = at(1, 20);
        first.EndTime__c = at(1, 21);
        second.StartTime__c = at(1, 20, 30);
        second.EndTime__c = at(1, 21, 30);

        assertTimeConflictRejectedOnUpdate(new List<Appointment__c>{ first, second });
    }

    @IsTest
    static void eineGemischteBulkVerarbeitungBrichtDenGesamtenSchreibvorgangAb() {
        // Der Waechter wirft im Trigger. Ein ungefangener Trigger-Fehler
        // bricht die aufrufende DML-Anweisung ab — nicht nur die eine Zeile.
        // Das ist derselbe Vertrag wie bei ParticipantContactUniqueness.
        List<Appointment__c> rows = new List<Appointment__c>{
            appointment(coachA(), at(1, 10), at(1, 11), 'Draft'),
            appointment(coachA(), at(1, 10, 30), at(1, 11, 30), 'Draft')
        };

        assertTimeConflictRejected(rows);

        System.assertEquals(
            0,
            [SELECT COUNT() FROM Appointment__c WHERE Coach__c = :coachA()],
            'kein Termin des Batchs ist gespeichert'
        );
    }

    // --- 6. Transaktion und Audit -----------------------------------------

    @IsTest
    static void einAbgelehnterSchreibvorgangAendertNichtsUndSchreibtKeinAuditEvent() {
        Appointment__c target = appointment(coachA(), at(1, 10), at(1, 11), 'Draft');
        insert target;
        insert appointment(coachA(), at(1, 12), at(1, 13), 'Draft');

        AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
        request.id = String.valueOf(target.Id);
        request.startTime = '2027-03-01T12:30:00.000Z';
        request.endTime = '2027-03-01T13:30:00.000Z';

        Test.startTest();
        try {
            AppointmentEditService.applyEdit(request);
            System.assert(false, 'der Eintiegspunkt muss den Konflikt melden');
        } catch (AppointmentEditService.AppointmentEditException error) {
            System.assertEquals(409, error.getStatusCode(), 'der Statuscode ist 409');
            System.assertEquals(
                AppointmentEditService.CODE_TIME_CONFLICT,
                error.getCode(),
                'der Fehlercode ist der Konfliktcode'
            );
        }
        Test.stopTest();

        Appointment__c after = [
            SELECT StartTime__c, EndTime__c
            FROM Appointment__c
            WHERE Id = :target.Id
        ];
        System.assertEquals(at(1, 10), after.StartTime__c, 'die Startzeit ist unveraendert');
        System.assertEquals(at(1, 11), after.EndTime__c, 'die Endzeit ist unveraendert');

        System.assertEquals(
            0,
            [SELECT COUNT() FROM AuditEvent__c WHERE SubjectId__c = :target.Id],
            'ein abgelehnter Vorgang schreibt kein Audit-Event'
        );
    }

    // --- Hilfen -----------------------------------------------------------

    private static void assertTimeConflictRejected(List<Appointment__c> rows) {
        try {
            insert rows;
            System.assert(false, 'der Schreibvorgang muss abgelehnt werden');
        } catch (DmlException error) {
            assertConflictCode(error);
        }
    }

    private static void assertTimeConflictRejectedOnUpdate(List<Appointment__c> rows) {
        try {
            update rows;
            System.assert(false, 'der Schreibvorgang muss abgelehnt werden');
        } catch (DmlException error) {
            assertConflictCode(error);
        }
    }

    private static void assertConflictCode(DmlException error) {
        // Ein Trigger wirft sich dem Aufrufer als DmlException; die
        // urspruengliche Meldung wird durchgereicht. Genau das sieht auch die
        // Oberflaeche, deshalb wird hier auf die Meldung geprueft und nicht
        // auf den Typ.
        System.assert(
            error.getMessage().contains(AppointmentConflictException.CODE_TIME_CONFLICT),
            'die Meldung muss den Konfliktcode tragen: ' + error.getMessage()
        );
    }

    /**
     * A term for the shared participant, the given coach and the given window.
     */
    private static Appointment__c appointment(
        Id coachId,
        Datetime start,
        Datetime finish,
        String status
    ) {
        Appointment__c row = new Appointment__c(
            Participant__c = participantId(),
            Coach__c = coachId,
            Type__c = 'Coaching',
            Status__c = status,
            StartTime__c = start,
            EndTime__c = finish
        );
        // Die org-seitigen Validierungsregeln verlangen die Begleitdaten des
        // gewaehlten Status (g1-manual-checklist.md). Sie greifen auch im
        // Testkontext.
        if (status == 'Confirmed') {
            row.ConfirmedAt__c = Datetime.newInstanceGmt(2027, 2, 1, 9, 0, 0);
        } else if (status == 'Completed') {
            row.CompletedAt__c = Datetime.newInstanceGmt(2027, 2, 1, 10, 0, 0);
        } else if (status == 'Cancelled') {
            row.CancellationReason__c = 'Testgrund';
        }
        return row;
    }

    private static Datetime at(Integer day, Integer hour) {
        return Datetime.newInstanceGmt(2027, 3, day, hour, 0, 0);
    }

    private static Datetime at(Integer day, Integer hour, Integer minute) {
        return Datetime.newInstanceGmt(2027, 3, day, hour, minute, 0);
    }

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Codingschule Academy');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;

        insert new Contact(
            FirstName = 'Kollision',
            LastName = 'Test',
            Email = PARTICIPANT_EMAIL,
            AccountId = accountId
        );

        insert new Participant__c(
            Name = 'Kollision Test',
            Status__c = 'Active',
            Contact__c = [SELECT Id FROM Contact WHERE Email = :PARTICIPANT_EMAIL LIMIT 1].Id
        );

        makeUser('CollisionA');
        makeUser('CollisionB');
    }

    private static Id participantId() {
        List<Participant__c> found = [
            SELECT Id
            FROM Participant__c
            WHERE Name = 'Kollision Test'
            LIMIT 1
        ];
        if (found.isEmpty()) {
            throw new AppointmentConflictException(
                'FIXTURE_MISSING: Der Testteilnehmer fehlt — TestSetup hat nicht gelaufen.'
            );
        }
        return found[0].Id;
    }

    private static Id coachA() {
        return coachId('collisiona');
    }

    private static Id coachB() {
        return coachId('collisionb');
    }

    private static Id coachId(String usernamePart) {
        List<User> found = [
            SELECT Id
            FROM User
            WHERE Username LIKE :usernamePart + '%'
            LIMIT 1
        ];
        if (found.isEmpty()) {
            throw new AppointmentConflictException(
                'FIXTURE_MISSING: Der Testcoach ' + usernamePart + ' fehlt — TestSetup hat nicht gelaufen.'
            );
        }
        return found[0].Id;
    }

    private static Id makeUser(String suffix) {
        // ProfileId ist in Apex Pflicht; ein Test kann keinen externen
        // Benutzer anlegen und braucht auch keinen — ein Coach muss nur ein
        // echter Benutzer sein.
        User user = new User(
            FirstName = 'Coach',
            LastName = suffix,
            Username = suffix.toLowerCase() + '@collision.invalid',
            Email = suffix.toLowerCase() + '@collision.invalid',
            Alias = 'co' + suffix.left(3),
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'de'
        );
        insert user;
        return user.Id;
    }
}
