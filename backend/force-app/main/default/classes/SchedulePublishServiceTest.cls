@IsTest
public class SchedulePublishServiceTest {

    @TestSetup
    static void makeData() {
        insert new Program__c(Name = 'PUB Program', Status__c = 'Draft', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'PUB Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'PUB Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        insert new WeeklySchedule__c(Name = 'PUB Schedule', ProgramWeek__c = programWeekId, ScopeType__c = 'Course', StartDate__c = Date.newInstance(2027, 3, 1), Status__c = 'Draft');
    }

    @IsTest
    static void publishSetztPublishedAtUndBy() {
        Id scheduleId = [SELECT Id FROM WeeklySchedule__c LIMIT 1].Id;
        WeeklySchedule__c published = SchedulePublishService.publish(String.valueOf(scheduleId));
        System.assertEquals('Published', published.Status__c, 'Status Published');
        System.assertNotEquals(null, published.PublishedAt__c, 'PublishedAt gesetzt');
        System.assertNotEquals(null, published.PublishedBy__c, 'PublishedBy gesetzt');

        List<AuditEvent__c> audits = [SELECT Id, EventType__c FROM AuditEvent__c WHERE SubjectId__c = :String.valueOf(scheduleId)];
        System.assertEquals(1, audits.size(), 'ein Audit-Event');
        System.assertEquals('schedule.published', audits[0].EventType__c, 'EventType');
    }

    @IsTest
    static void unpublishSetztDraft() {
        Id scheduleId = [SELECT Id FROM WeeklySchedule__c LIMIT 1].Id;
        SchedulePublishService.publish(String.valueOf(scheduleId));
        WeeklySchedule__c draft = SchedulePublishService.unpublish(String.valueOf(scheduleId));
        System.assertEquals('Draft', draft.Status__c, 'Status Draft');
        System.assertEquals(null, draft.PublishedAt__c, 'PublishedAt null');
        System.assertEquals(null, draft.PublishedBy__c, 'PublishedBy null');
    }

    @IsTest
    static void publishUnbekannterPlanWirdAbgelehnt() {
        try {
            SchedulePublishService.publish('a00000000000000AAA');
            System.assert(false, 'unbekannter Plan muss fehlschlagen');
        } catch (SchedulePublishServiceException e) {
            System.assertEquals(404, e.getStatusCode());
        }
    }

    @IsTest
    static void publishOhneIdWirdAbgelehnt() {
        try {
            SchedulePublishService.publish(null);
            System.assert(false, 'ohne id muss fehlschlagen');
        } catch (SchedulePublishServiceException e) {
            System.assertEquals(400, e.getStatusCode());
        }
    }
}
