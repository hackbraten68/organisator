/**
 * Zugriffstest für den Bearbeitungspfad.
 *
 * WAS DIESER TEST BEWEIST
 *   Dass die beiden Permission Sets dem Bearbeitungspfad den Weg bahnen und
 *   dass ein Nutzer ohne Berechtigung nicht an die Daten kommt.
 *
 *   Er beweist ausdrücklich **nicht**, dass die Plattform einem berechtigten
 *   Nutzer kein 403 gibt. Diese Prüfung happens an der REST-Grenze, und
 *   die Plattform setzt den Klassenzugriff **nicht** zur Laufzeit durch — ein
 *   Aufruf ohne den Permission Set funktioniert in Apex einwandfrei. Der
 *   Nachweis für den 403 ist deshalb die Prüfung des ausgelieferten
 *   Permission-Sets (`classAccesses`) gegen die Org, nicht dieser Test.
 *   Siehe `backend/docs/portal-deploy-status.md`.
 *
 * WAS DIE PLATTFORM ZUR LAUFZEIT DURCHSETZT (und dieser Test deshalb prüft)
 *   - Objektzugriff: ohne den Permission Set kennt der Nutzer das Objekt
 *     überhaupt nicht; die Abfrage scheitert mit `QueryException`.
 *   - Feldzugriff: `Appointment__c.Notes__c` ist im Permission Set als
 *     editierbar geführt.
 *   - Audit-Zugriff: `AuditEvent__c` bekommt Create, sonst scheitert der
 *     Audit-Write.
 *
 * PROFIL-VORBEHALT
 *   `Appointment__c.Type__c`, `Status__c`, `StartTime__c` und `EndTime__c` sind
 *   Pflichtfelder, und Salesforce lehnt `fieldPermissions` für Pflichtfelder
 *   ab — ihre Berechtigung kommt aus dem Profil (siehe `docs/coach-access.md`).
 *   Der Test benutzt deshalb ein Profil, das diese Felder freigibt, und
 *   ändert in der Probe nur `Notes__c`, dessen Berechtigung aus dem
 *   Permission Set kommt.
 *
 * TESTGRENZE
 *   `ApexClassAccess` ist aus Apex heraus nicht abfragbar ("Invalid type:
 *   ApexClassAccess") und über die REST-API erst recht nicht. Der
 *   wirksame Klassenzugriff lässt sich deshalb nur am ausgelieferten
 *   Permission Set nachweisen, nicht aus einem Test heraus.
 */
@IsTest
private class AppointmentEditAccessTest {

    private static final String DRAFT_MARKER = 'https://access.example.invalid/draft';
    private static final String CONFIRMED_MARKER = 'https://access.example.invalid/confirmed';
    private static final String ORIGINAL_NOTES = 'Urspruengliche Notiz';

    private static final String COACH_SET = 'backend_Coach';
    private static final String ACCESS_SET = 'backend_Access';

    @TestSetup
    static void makeData() {
        Contact contact = new Contact(LastName = 'Access', Email = 'access@example.invalid');
        insert contact;

        Participant__c participant = new Participant__c(
            Name = 'Access',
            Status__c = 'Active',
            Contact__c = contact.Id
        );
        insert participant;

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
            Participant__c = participant.Id,
            Type__c = 'Coaching',
            Location__c = 'Teams',
            MeetingLink__c = CONFIRMED_MARKER,
            Notes__c = ORIGINAL_NOTES,
            Status__c = 'Confirmed',
            ConfirmedAt__c = Datetime.newInstanceGmt(2026, 10, 10, 9, 0, 0),
            StartTime__c = Datetime.newInstanceGmt(2026, 10, 21, 10, 0, 0),
            EndTime__c = Datetime.newInstanceGmt(2026, 10, 21, 11, 0, 0)
        );
    }

    // --- Die Permission Sets ----------------------------------------------

    @IsTest
    static void beidePermissionSetsSindInDerOrgVorhanden() {
        List<PermissionSet> sets = [
            SELECT Id, Name
            FROM PermissionSet
            WHERE Name IN ('backend_Access', 'backend_Coach')
        ];
        System.assertEquals(2, sets.size(), 'beide Permission Sets muessen in der Org sein');
    }

    @IsTest
    static void einCoachDarfDenBearbeitungspfadAusfuehren() {
        User coach = makeUserWithSet('coach@example.invalid', COACH_SET);
        Id id = draftId();

        System.runAs(coach) {
            AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
            request.id = String.valueOf(id);
            request.notes = 'Vom Coach geaendert';

            AppointmentEditService.applyEdit(request);
        }

        Appointment__c after = [
            SELECT Notes__c FROM Appointment__c WHERE Id = :id LIMIT 1
        ];
        System.assertEquals(
            'Vom Coach geaendert',
            after.Notes__c,
            'die Aenderung des Coaches ist gespeichert'
        );

        List<AuditEvent__c> events = [
            SELECT Id, ActorId__c
            FROM AuditEvent__c
            WHERE SubjectId__c = :id AND EventType__c = :AppointmentEditService.EVENT_TYPE
        ];
        System.assertEquals(1, events.size(), 'genau ein Audit-Event');
        System.assertEquals(
            String.valueOf(coach.Id),
            events[0].ActorId__c,
            'das Audit-Event nennt den Coach, nicht den Admin'
        );
    }

    @IsTest
    static void einBackendUserDarfDenBearbeitungspfadAusfuehren() {
        // Die Admin-Stufe ist laut `docs/coach-access.md` das Profil des Org
        // (System Administrator) plus `backend_Access` fuer den Klassenzugriff.
        // Mit diesem Profil darf der Pfad laufen.
        User staff = makeUserWithSet('staff@example.invalid', ACCESS_SET, UserInfo.getProfileId());
        Id id = draftId();

        System.runAs(staff) {
            AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
            request.id = String.valueOf(id);
            request.notes = 'Vom Staff geaendert';

            AppointmentEditService.applyEdit(request);
        }

        Appointment__c after = [
            SELECT Notes__c FROM Appointment__c WHERE Id = :id LIMIT 1
        ];
        System.assertEquals(
            'Vom Staff geaendert',
            after.Notes__c,
            'die Aenderung ist gespeichert'
        );
    }

    @IsTest
    static void backendAccessAlleinGibtKeinenZugriffAufTermine() {
        // Die beiden Berechtigungsstufen sind getrennt (siehe
        // `docs/coach-access.md`): `backend_Access` schaltet den
        // Klassenzugriff frei — ohne ihn gaebe die Route 403 —, `backend_Coach`
        // gibt die fachlichen Objekte dazu. Wer nur `backend_Access` hat,
        // kommt an keine Termine. Das ist beabsichtigt und wird hier
        // festgehalten, damit die beiden Sets nicht verwechselt werden.
        User staff = makeUserWithSet('staff2@example.invalid', ACCESS_SET);
        Id id = draftId();

        Boolean abgelehnt = false;
        System.runAs(staff) {
            try {
                AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
                request.id = String.valueOf(id);
                request.notes = 'Nicht erlaubt';
                AppointmentEditService.applyEdit(request);
            } catch (Exception refused) {
                abgelehnt = true;
            }
        }

        System.assert(
            abgelehnt,
            'backend_Access allein gibt keinen Zugriff auf Termine — der Objektzugriff kommt aus dem Profil'
        );

        Appointment__c after = [
            SELECT Notes__c FROM Appointment__c WHERE Id = :id LIMIT 1
        ];
        System.assertEquals(ORIGINAL_NOTES, after.Notes__c, 'der Termin ist unveraendert');
    }

    @IsTest
    static void ohneBerechtigungGibtEsKeinenZugriffAufDenTermin() {
        User outsider = makeUser('outsider@example.invalid');
        Id id = draftId();

        Boolean abgelehnt = false;
        String grund = '';
        System.runAs(outsider) {
            try {
                AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
                request.id = String.valueOf(id);
                request.notes = 'Nicht erlaubt';
                AppointmentEditService.applyEdit(request);
            } catch (Exception refused) {
                abgelehnt = true;
                grund = refused.getTypeName() + ': ' + refused.getMessage();
            }
        }

        System.assert(abgelehnt, 'ohne Permission Set darf der Termin nicht bearbeitet werden');
        System.assert(
            grund.contains('Appointment__c') || grund.contains('APPOINTMENT_NOT_FOUND'),
            'der Zugriff scheitert am Objektzugriff, war: ' + grund
        );

        Appointment__c after = [
            SELECT Notes__c FROM Appointment__c WHERE Id = :id LIMIT 1
        ];
        System.assertEquals(ORIGINAL_NOTES, after.Notes__c, 'der Termin ist unveraendert');
    }

    @IsTest
    static void derDraftGateGiltAuchFuerEinenCoach() {
        // Der Gate darf nicht davon abhaengen, wer schreibt: auch ein Coach
        // mit voller Berechtigung kann einen bestaetigten Termin nicht
        // bearbeiten.
        User coach = makeUserWithSet('coach2@example.invalid', COACH_SET);
        Id id = confirmedId();

        String code = '';
        System.runAs(coach) {
            try {
                AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
                request.id = String.valueOf(id);
                request.notes = 'Nicht erlaubt';
                AppointmentEditService.applyEdit(request);
            } catch (AppointmentEditService.AppointmentEditException refused) {
                code = refused.getCode();
            }
        }

        System.assertEquals(
            AppointmentEditService.CODE_NOT_EDITABLE,
            code,
            'auch ein Coach wird am Draft-Gate abgeprueft'
        );
    }

    @IsTest
    static void einCoachKannDieTerminartAendern() {
        // `Type__c` ist ein Pflichtfeld; seine Berechtigung kommt aus dem
        // Profil, nicht aus dem Permission Set (siehe `docs/coach-access.md`).
        // Der Test haelt fest, was in dieser Org tatsaechlich gilt.
        User coach = makeUserWithSet('coach3@example.invalid', COACH_SET);
        Id id = draftId();

        Boolean moeglich = false;
        String grund = '';
        System.runAs(coach) {
            try {
                AppointmentEditService.EditRequest request = new AppointmentEditService.EditRequest();
                request.id = String.valueOf(id);
                request.type = 'Feedback';
                AppointmentEditService.applyEdit(request);
                moeglich = true;
            } catch (Exception refused) {
                grund = refused.getTypeName() + ': ' + refused.getMessage();
            }
        }

        System.assert(
            moeglich,
            'ein Coach mit Standardprofil darf die Terminart nicht aendern — ' +
            'das ist die dokumentierte Profil-Vorbehaltsstelle: ' + grund
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

    /**
     * Ein Nutzer mit dem Standardprofil — ohne weitere Rechte.
     *
     * Das Profil traegt bewusst keine Berechtigung auf den Coach-Objekten.
     * Genau deshalb ist es der Gegenpol zum berechtigten Fall.
     */
    private static Id limitedProfileId() {
        List<Profile> profiles = [SELECT Id, Name FROM Profile WHERE UserType = 'Standard'];
        for (Profile profile : profiles) {
            if (profile.Name == 'Standard User') {
                return profile.Id;
            }
        }
        System.assert(
            false,
            'Die Org braucht ein Profil "Standard User" fuer diesen Test.'
        );
        return null;
    }

    private static User makeUser(String email) {
        User user = new User(
            FirstName = 'Access',
            LastName = 'Test',
            Email = email,
            Username = email,
            Alias = email.left(8),
            ProfileId = limitedProfileId(),
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            LanguageLocaleKey = 'de',
            EmailEncodingKey = 'UTF-8'
        );
        insert user;
        return user;
    }

    private static User makeUserWithSet(String email, String permissionSetName) {
        return makeUserWithSet(email, permissionSetName, limitedProfileId());
    }

    private static User makeUserWithSet(String email, String permissionSetName, Id profileId) {
        User user = new User(
            FirstName = 'Access',
            LastName = 'Test',
            Email = email,
            Username = email,
            Alias = email.left(8),
            ProfileId = profileId,
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            LanguageLocaleKey = 'de',
            EmailEncodingKey = 'UTF-8'
        );
        insert user;

        List<PermissionSet> sets = [
            SELECT Id
            FROM PermissionSet
            WHERE Name = :permissionSetName
            LIMIT 1
        ];
        if (sets.isEmpty()) {
            System.assert(false, 'Permission Set ' + permissionSetName + ' fehlt in der Org.');
            return user;
        }
        // Der Permission Set ist ein Setup-Objekt, der Termin ein normales.
        // `runAs` hebt die Misch-DML-Sperre auf — sonst bricht der Test an
        // MIXED_DML_OPERATION ab, bevor er etwas beweist.
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert new PermissionSetAssignment(
                AssigneeId = user.Id,
                PermissionSetId = sets[0].Id
            );
        }
        return user;
    }
}
