@IsTest
public class ScheduleEntryMaterialisationServiceTest {

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Mat Account');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;
        insert new Contact(FirstName = 'Mat', LastName = 'Test', Email = 'mat.test@example.invalid', AccountId = accountId);
        insert new Participant__c(Name = 'Mat Test', Status__c = 'Active', Contact__c = [SELECT Id FROM Contact WHERE Email = 'mat.test@example.invalid' LIMIT 1].Id);

        User u = new User(
            FirstName = 'Coach', LastName = 'Mat',
            Username = 'coachmat@mat.invalid',
            Email = 'coachmat@mat.invalid',
            Alias = 'cmat',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'de'
        );
        insert u;
        insert new Coach_Profile__c(Name = 'Coach Mat', User__c = u.Id, Status__c = true);

        insert new Program__c(Name = 'Mat Program', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'Mat Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'Mat Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        insert new WeeklySchedule__c(Name = 'Mat Schedule', ProgramWeek__c = programWeekId, ScopeType__c = 'Individual', StartDate__c = Date.newInstance(2027, 3, 1), Participant__c = [SELECT Id FROM Participant__c LIMIT 1].Id);
    }

    private static Id entryId(Boolean individual) {
        Id wsId = [SELECT Id FROM WeeklySchedule__c LIMIT 1].Id;
        Id participantId = [SELECT Id FROM Participant__c LIMIT 1].Id;
        Id coachProfileId = [SELECT Id FROM Coach_Profile__c LIMIT 1].Id;
        ScheduleEntry__c entry = new ScheduleEntry__c(
            Name = 'Mat Entry',
            WeeklySchedule__c = wsId,
            EntryKind__c = 'Aktivität',
            Type__c = 'Einzelcoaching',
            DayOfWeek__c = 'Monday',
            TargetType__c = individual ? 'Individual' : 'Course',
            Participant__c = individual ? participantId : null,
            Coach_Profile__c = coachProfileId,
            StartTime__c = Time.newInstance(10, 0, 0, 0),
            EndTime__c = Time.newInstance(11, 0, 0, 0)
        );
        insert entry;
        return entry.Id;
    }

    @IsTest
    static void materialiseErstelltTermin() {
        Id eid = entryId(true);
        Id apptId = ScheduleEntryMaterialisationService.materialise(String.valueOf(eid));
        System.assertNotEquals(null, apptId, 'Termin erstellt');

        Appointment__c appt = [SELECT Id, Status__c, Type__c, ScheduleEntry__c, Coach__c FROM Appointment__c WHERE Id = :apptId];
        System.assertEquals('Draft', appt.Status__c, 'Status Draft');
        System.assertEquals('Einzelcoaching', appt.Type__c, 'Typ 1:1');
        System.assertEquals(eid, appt.ScheduleEntry__c, 'Verweis auf Planzeile');
    }

    @IsTest
    static void materialiseNichtIndividualWirdAbgelehnt() {
        Id eid = entryId(false);
        try {
            ScheduleEntryMaterialisationService.materialise(String.valueOf(eid));
            System.assert(false, 'Course-Eintrag darf nicht materialisiert werden');
        } catch (ScheduleMaterialisationException error) {
            System.assertEquals(422, error.getStatusCode());
            System.assertEquals('TYPE_NOT_MATERIALISABLE', error.getCode());
        }
    }

    @IsTest
    static void materialiseIdempotent() {
        Id eid = entryId(true);
        Id first = ScheduleEntryMaterialisationService.materialise(String.valueOf(eid));
        Id second = ScheduleEntryMaterialisationService.materialise(String.valueOf(eid));
        System.assertEquals(first, second, 'idempotent: gleicher Termin');
        System.assertEquals(1, [SELECT COUNT() FROM Appointment__c WHERE ScheduleEntry__c = :eid], 'genau ein Termin');
    }
}
