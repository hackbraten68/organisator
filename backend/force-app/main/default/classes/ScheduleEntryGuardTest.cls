/**
 * Guard-Tests fuer ScheduleEntryGuard.trigger.
 */
@IsTest
public class ScheduleEntryGuardTest {

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Schedule Test Account');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;
        insert new Contact(FirstName = 'Guard', LastName = 'Test', Email = 'guard.test@example.invalid', AccountId = accountId);
        insert new Participant__c(Name = 'Guard Test', Status__c = 'Active', Contact__c = [SELECT Id FROM Contact WHERE Email = 'guard.test@example.invalid' LIMIT 1].Id);
        insert new Program__c(Name = 'Guard Program', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'Guard Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'Guard Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        insert new WeeklySchedule__c(Name = 'Guard Schedule', ProgramWeek__c = programWeekId, ScopeType__c = 'Course', StartDate__c = Date.newInstance(2027, 3, 1));
        insert new ScheduleTemplate__c(Name = 'Guard Template', Status__c = 'Active');
    }

    private static Id weeklyScheduleId() {
        return [SELECT Id FROM WeeklySchedule__c LIMIT 1].Id;
    }

    private static Id templateId() {
        return [SELECT Id FROM ScheduleTemplate__c LIMIT 1].Id;
    }

    private static Id participantId() {
        return [SELECT Id FROM Participant__c LIMIT 1].Id;
    }

    private static ScheduleEntry__c baseEntry() {
        ScheduleEntry__c entry = new ScheduleEntry__c(
            Name = 'Test Entry',
            EntryKind__c = 'Aktivität',
            Type__c = 'Einzelcoaching',
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Course'
        );
        return entry;
    }

    @IsTest
    static void insertOhneElternWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        try {
            insert entry;
            System.assert(false, 'ohne Elternzuordnung muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.'));
        }
    }

    @IsTest
    static void insertMitBeidenElternWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.ScheduleTemplate__c = templateId();
        try {
            insert entry;
            System.assert(false, 'mit beiden Eltern muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.'));
        }
    }

    @IsTest
    static void insertMitWochenplanSetztDate() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.DayOfWeek__c = 'Wednesday';
        insert entry;
        ScheduleEntry__c stored = [SELECT Date__c FROM ScheduleEntry__c WHERE Id = :entry.Id];
        System.assertEquals(Date.newInstance(2027, 3, 3), stored.Date__c, 'Date__c aus StartDate + Offset');
    }

    @IsTest
    static void insertMitVorlageLeertDate() {
        ScheduleEntry__c entry = baseEntry();
        entry.ScheduleTemplate__c = templateId();
        entry.Date__c = Date.newInstance(2027, 3, 9);
        insert entry;
        ScheduleEntry__c stored = [SELECT Date__c FROM ScheduleEntry__c WHERE Id = :entry.Id];
        System.assertEquals(null, stored.Date__c, 'Vorlagenzeile hat kein Date__c');
    }

    @IsTest
    static void insertMitZeitkonfliktWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.StartTime__c = Time.newInstance(10, 0, 0, 0);
        entry.EndTime__c = Time.newInstance(10, 0, 0, 0);
        try {
            insert entry;
            System.assert(false, 'Start = Ende muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Die Zeitangaben sind ungültig.'));
        }
    }

    @IsTest
    static void insertUmgekehrteZeitWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.StartTime__c = Time.newInstance(12, 0, 0, 0);
        entry.EndTime__c = Time.newInstance(10, 0, 0, 0);
        try {
            insert entry;
            System.assert(false, 'Start > Ende muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Die Zeitangaben sind ungültig.'));
        }
    }

    @IsTest
    static void insertNurEndzeitWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.EndTime__c = Time.newInstance(11, 0, 0, 0);
        try {
            insert entry;
            System.assert(false, 'nur Endzeit muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Die Zeitangaben sind ungültig.'));
        }
    }

    @IsTest
    static void insertDurationUnterEinsWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.DurationMinutes__c = 0;
        try {
            insert entry;
            System.assert(false, 'Dauer 0 muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Die Zeitangaben sind ungültig.'));
        }
    }

    @IsTest
    static void insertTargetGroupOhneGruppeWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.TargetType__c = 'Group';
        try {
            insert entry;
            System.assert(false, 'Group ohne ParticipantGroup__c muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Der Geltungsbereich passt nicht'));
        }
    }

    @IsTest
    static void insertTargetIndividualOhneTeilnehmerWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.TargetType__c = 'Individual';
        try {
            insert entry;
            System.assert(false, 'Individual ohne Participant__c muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Der Geltungsbereich passt nicht'));
        }
    }

    @IsTest
    static void insertTargetCourseMitGruppeWirdAbgelehnt() {
        ScheduleEntry__c entry = baseEntry();
        entry.WeeklySchedule__c = weeklyScheduleId();
        entry.TargetType__c = 'Course';
        insert new ParticipantGroup__c(Name = 'Guard Group');
        Id groupId = [SELECT Id FROM ParticipantGroup__c LIMIT 1].Id;
        entry.ParticipantGroup__c = groupId;
        try {
            insert entry;
            System.assert(false, 'Course mit Gruppe muss abgelehnt werden');
        } catch (DmlException error) {
            System.assert(error.getMessage().contains('Der Geltungsbereich passt nicht'));
        }
    }
}
