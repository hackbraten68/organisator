@IsTest
public class ScheduleTemplateServiceTest {

    @TestSetup
    static void makeData() {
        insert new Program__c(Name = 'TPL Program', Status__c = 'Draft', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'TPL Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'TPL Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;

        insert new ScheduleTemplate__c(Name = 'TPL Template', ProgramWeek__c = programWeekId, Status__c = 'Active');
        Id templateId = [SELECT Id FROM ScheduleTemplate__c LIMIT 1].Id;
        insert new ScheduleEntry__c(
            Name = 'TPL Entry',
            ScheduleTemplate__c = templateId,
            EntryKind__c = 'Aktivität',
            Type__c = 'Einzelcoaching',
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Course',
            StartTime__c = Time.newInstance(10, 0, 0, 0),
            EndTime__c = Time.newInstance(11, 0, 0, 0),
            IsCustomized__c = true
        );
    }

    @IsTest
    static void applyErstelltDeepCopy() {
        Id templateId = [SELECT Id FROM ScheduleTemplate__c LIMIT 1].Id;
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;

        ScheduleTemplateService.ApplyRequest req = new ScheduleTemplateService.ApplyRequest();
        req.templateId = String.valueOf(templateId);
        req.programWeekId = String.valueOf(programWeekId);
        req.startDate = '2027-03-01';
        req.name = 'Applied Schedule';
        WeeklySchedule__c schedule = ScheduleTemplateService.applyTemplate(req);

        System.assertNotEquals(null, schedule.Id, 'Wochenplan erstellt');
        System.assertEquals('Applied Schedule', schedule.Name);
        System.assertEquals(templateId, schedule.AppliedTemplate__c, 'Provenienz gesetzt');

        List<ScheduleEntry__c> copies = [
            SELECT Id, SourceTemplateEntry__c, IsCustomized__c, ScheduleTemplate__c, WeeklySchedule__c
            FROM ScheduleEntry__c
            WHERE WeeklySchedule__c = :schedule.Id
        ];
        System.assertEquals(1, copies.size(), 'eine Kopie');
        System.assertNotEquals(null, copies[0].SourceTemplateEntry__c, 'Herkunft gesetzt');
        System.assertEquals(false, copies[0].IsCustomized__c, 'IsCustomized false nach Kopie');
        System.assertEquals(null, copies[0].ScheduleTemplate__c, 'keine Vorlagen-Bindung');

        // Vorlage aendern -> Plan unveraendert
        ScheduleEntry__c src = [SELECT Id, Name FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :templateId LIMIT 1];
        src.Name = 'Geaendert';
        update src;
        ScheduleEntry__c copy = [SELECT Name FROM ScheduleEntry__c WHERE Id = :copies[0].Id];
        System.assertEquals('TPL Entry', copy.Name, 'Plan unveraendert nach Vorlagen-Aenderung');
    }

    @IsTest
    static void listTemplatesLiefertAktive() {
        List<ScheduleTemplate__c> templates = ScheduleTemplateService.listTemplates();
        System.assertEquals(1, templates.size(), 'eine aktive Vorlage');
    }

    @IsTest
    static void previewLiefertEintraege() {
        Id templateId = [SELECT Id FROM ScheduleTemplate__c LIMIT 1].Id;
        List<ScheduleEntry__c> preview = ScheduleTemplateService.preview(templateId);
        System.assertEquals(1, preview.size(), 'Vorschau hat einen Eintrag');
    }

    @IsTest
    static void applyOhneTemplateIdWirdAbgelehnt() {
        ScheduleTemplateService.ApplyRequest req = new ScheduleTemplateService.ApplyRequest();
        req.programWeekId = String.valueOf([SELECT Id FROM ProgramWeek__c LIMIT 1].Id);
        req.startDate = '2027-03-01';
        try {
            ScheduleTemplateService.applyTemplate(req);
            System.assert(false, 'ohne templateId muss fehlschlagen');
        } catch (ScheduleTemplateServiceException e) {
            System.assertEquals(400, e.getStatusCode());
        }
    }
}
