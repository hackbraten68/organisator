/**
 * Tests fuer ScheduleService.
 */
@IsTest
public class ScheduleServiceTest {

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Schedule Service Account');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;
        insert new Contact(FirstName = 'Svc', LastName = 'Test', Email = 'svc.test@example.invalid', AccountId = accountId);
        insert new Participant__c(Name = 'Svc Test', Status__c = 'Active', Contact__c = [SELECT Id FROM Contact WHERE Email = 'svc.test@example.invalid' LIMIT 1].Id);
        insert new Program__c(Name = 'Svc Program', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'Svc Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'Svc Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
    }

    private static Id programWeekId() {
        return [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
    }

    private static Id participantId() {
        return [SELECT Id FROM Participant__c LIMIT 1].Id;
    }

    @IsTest
    static void upsertWeeklyScheduleErstelltUndPrueft() {
        ScheduleService.WeeklyScheduleRequest request = new ScheduleService.WeeklyScheduleRequest();
        request.name = 'Test Schedule';
        request.programWeekId = programWeekId();
        request.scopeType = 'Course';
        request.startDate = '2027-03-01';

        WeeklySchedule__c created = ScheduleService.upsertWeeklySchedule(request);
        System.assertNotEquals(null, created.Id, 'Wochenplan gespeichert');
        System.assertEquals('Course', created.ScopeType__c, 'ScopeType');
        System.assertEquals('Draft', created.Status__c, 'Status Default Draft');

        List<AuditEvent__c> audits = [SELECT Id, Domain__c, EventType__c FROM AuditEvent__c WHERE SubjectId__c = :String.valueOf(created.Id)];
        System.assertEquals(1, audits.size(), 'genau ein Audit-Event');
        System.assertEquals('schedule', audits[0].Domain__c, 'Domain schedule');
        System.assertEquals('schedule.created', audits[0].EventType__c, 'EventType schedule.created');
    }

    @IsTest
    static void upsertWeeklyScheduleEndeVorStartWirdAbgelehnt() {
        ScheduleService.WeeklyScheduleRequest request = new ScheduleService.WeeklyScheduleRequest();
        request.name = 'Test Schedule';
        request.programWeekId = programWeekId();
        request.scopeType = 'Course';
        request.startDate = '2027-03-01';
        request.endDate = '2027-02-20';
        try {
            ScheduleService.upsertWeeklySchedule(request);
            System.assert(false, 'EndDate < StartDate muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals(400, error.getStatusCode());
        }
    }

    @IsTest
    static void upsertWeeklyScheduleScopeGroupOhneGruppeWirdAbgelehnt() {
        ScheduleService.WeeklyScheduleRequest request = new ScheduleService.WeeklyScheduleRequest();
        request.programWeekId = programWeekId();
        request.scopeType = 'Group';
        request.startDate = '2027-03-01';
        try {
            ScheduleService.upsertWeeklySchedule(request);
            System.assert(false, 'Group ohne Gruppe muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals('ENTRY_TARGET_INVALID', error.getCode());
        }
    }

    @IsTest
    static void upsertScheduleEntryErstelltUndBerechnetDate() {
        ScheduleService.WeeklyScheduleRequest wsReq = new ScheduleService.WeeklyScheduleRequest();
        wsReq.name = 'Test Schedule';
        wsReq.programWeekId = programWeekId();
        wsReq.scopeType = 'Course';
        wsReq.startDate = '2027-03-01';
        WeeklySchedule__c ws = ScheduleService.upsertWeeklySchedule(wsReq);

        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.weeklyScheduleId = ws.Id;
        request.title = 'Test Entry';
        request.dayOfWeek = 'Friday';
        request.targetType = 'Course';

        ScheduleEntry__c entry = ScheduleService.upsertScheduleEntry(request);
        System.assertNotEquals(null, entry.Id, 'Eintrag gespeichert');
        System.assertEquals(Date.newInstance(2027, 3, 5), entry.Date__c, 'Date__c aus StartDate + DayOfWeek');
        System.assertEquals('Aktivität', entry.EntryKind__c, 'Default EntryKind');
        System.assertEquals('Einzelcoaching', entry.Type__c, 'Default Type');
        System.assertEquals('Course', entry.TargetType__c, 'Default TargetType');
        System.assertEquals('Monday', entry.DayOfWeek__c, 'Default DayOfWeek');

        List<AuditEvent__c> audits = [SELECT Id, EventType__c FROM AuditEvent__c WHERE SubjectId__c = :String.valueOf(entry.Id)];
        System.assertEquals(1, audits.size(), 'genau ein Audit-Event');
        System.assertEquals('schedule.entry_created', audits[0].EventType__c, 'EventType');
    }

    @IsTest
    static void upsertScheduleEntryOhneElternWirdAbgelehnt() {
        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.title = 'Orphan';
        try {
            ScheduleService.upsertScheduleEntry(request);
            System.assert(false, 'ohne Eltern muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals(400, error.getStatusCode());
        }
    }

    @IsTest
    static void upsertScheduleEntryMitBeidenElternWirdAbgelehnt() {
        ScheduleService.WeeklyScheduleRequest wsReq = new ScheduleService.WeeklyScheduleRequest();
        wsReq.name = 'Test Schedule';
        wsReq.programWeekId = programWeekId();
        wsReq.scopeType = 'Course';
        wsReq.startDate = '2027-03-01';
        WeeklySchedule__c ws = ScheduleService.upsertWeeklySchedule(wsReq);
        insert new ScheduleTemplate__c(Name = 'Svc Template', Status__c = 'Active');
        Id templateId = [SELECT Id FROM ScheduleTemplate__c LIMIT 1].Id;

        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.weeklyScheduleId = ws.Id;
        request.scheduleTemplateId = templateId;
        request.title = 'Both';
        try {
            ScheduleService.upsertScheduleEntry(request);
            System.assert(false, 'mit beiden Eltern muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals(400, error.getStatusCode());
        }
    }

    @IsTest
    static void upsertScheduleEntryZeitUngueltigWirdAbgelehnt() {
        ScheduleService.WeeklyScheduleRequest wsReq = new ScheduleService.WeeklyScheduleRequest();
        wsReq.name = 'Test Schedule';
        wsReq.programWeekId = programWeekId();
        wsReq.scopeType = 'Course';
        wsReq.startDate = '2027-03-01';
        WeeklySchedule__c ws = ScheduleService.upsertWeeklySchedule(wsReq);

        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.weeklyScheduleId = ws.Id;
        request.title = 'Bad Time';
        request.startTime = '10:00:00';
        request.endTime = '10:00:00';
        try {
            ScheduleService.upsertScheduleEntry(request);
            System.assert(false, 'Start = Ende muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals('INVALID_INTERVAL', error.getCode());
        }
    }

    @IsTest
    static void upsertScheduleEntryTargetIndividualOhneTeilnehmerWirdAbgelehnt() {
        ScheduleService.WeeklyScheduleRequest wsReq = new ScheduleService.WeeklyScheduleRequest();
        wsReq.name = 'Test Schedule';
        wsReq.programWeekId = programWeekId();
        wsReq.scopeType = 'Course';
        wsReq.startDate = '2027-03-01';
        WeeklySchedule__c ws = ScheduleService.upsertWeeklySchedule(wsReq);

        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.weeklyScheduleId = ws.Id;
        request.title = 'Individual';
        request.targetType = 'Individual';
        try {
            ScheduleService.upsertScheduleEntry(request);
            System.assert(false, 'Individual ohne Participant muss abgelehnt werden');
        } catch (ScheduleServiceException error) {
            System.assertEquals('ENTRY_TARGET_INVALID', error.getCode());
        }
    }

    @IsTest
    static void deleteScheduleEntryEntferntUndAudit() {
        ScheduleService.WeeklyScheduleRequest wsReq = new ScheduleService.WeeklyScheduleRequest();
        wsReq.name = 'Test Schedule';
        wsReq.programWeekId = programWeekId();
        wsReq.scopeType = 'Course';
        wsReq.startDate = '2027-03-01';
        WeeklySchedule__c ws = ScheduleService.upsertWeeklySchedule(wsReq);

        ScheduleService.ScheduleEntryRequest request = new ScheduleService.ScheduleEntryRequest();
        request.weeklyScheduleId = ws.Id;
        request.title = 'ToDelete';
        ScheduleEntry__c entry = ScheduleService.upsertScheduleEntry(request);

        ScheduleService.deleteScheduleEntry(String.valueOf(entry.Id));
        System.assertEquals(0, [SELECT COUNT() FROM ScheduleEntry__c WHERE Id = :entry.Id], 'Eintrag geloescht');

        List<AuditEvent__c> audits = [SELECT Id, EventType__c FROM AuditEvent__c WHERE SubjectId__c = :String.valueOf(entry.Id) AND EventType__c = 'schedule.entry_deleted'];
        System.assertEquals(1, audits.size(), 'entry_deleted Audit-Event');
    }

    @IsTest
    static void dayOffsetBerechnetRichtig() {
        System.assertEquals(0, ScheduleService.dayOffset('Monday'));
        System.assertEquals(6, ScheduleService.dayOffset('Sunday'));
        System.assertEquals(4, ScheduleService.dayOffset('Friday'));
    }
}
