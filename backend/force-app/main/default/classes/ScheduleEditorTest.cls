@IsTest
private class ScheduleEditorTest {

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Editor Test Account');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;
        insert new Contact(FirstName = 'Ed', LastName = 'Test', Email = 'ed.test@example.invalid', AccountId = accountId);
        insert new Participant__c(Name = 'Ed Test', Status__c = 'Active', Contact__c = [SELECT Id FROM Contact WHERE Email = 'ed.test@example.invalid' LIMIT 1].Id);
        insert new Program__c(Name = 'Editor Program', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'Editor Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'Editor Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        insert new ParticipantGroup__c(Name = 'Editor Group', Program__c = programId);
    }

    private static Id programId() { return [SELECT Id FROM Program__c LIMIT 1].Id; }
    private static Id programWeekId() { return [SELECT Id FROM ProgramWeek__c LIMIT 1].Id; }
    private static Id groupId() { return [SELECT Id FROM ParticipantGroup__c LIMIT 1].Id; }
    private static Id participantId() { return [SELECT Id FROM Participant__c LIMIT 1].Id; }

    private static void setGet(String action, String param, String value) {
        RestContext.request = new RestRequest();
        RestContext.response = new RestResponse();
        RestContext.request.params.put('action', action);
        if (param != null && value != null) {
            RestContext.request.params.put(param, value);
        }
    }

    private static void setPost(Map<String, Object> body) {
        RestContext.request = new RestRequest();
        RestContext.response = new RestResponse();
        RestContext.request.requestBody = Blob.valueOf(JSON.serialize(body));
    }

    @IsTest
    static void listReturnsProgramsAndWeeks() {
        setGet('list', 'programId', programId());
        ScheduleEditor.EditorResponse resp = ScheduleEditor.get();
        System.assertEquals(true, resp.success);
        System.assert(!resp.programs.isEmpty(), 'programs');
        System.assertEquals(1, resp.weeks.size(), 'weeks');
    }

    @IsTest
    static void listWithoutProgramReturnsProgramsOnly() {
        setGet('list', null, null);
        ScheduleEditor.EditorResponse resp = ScheduleEditor.get();
        System.assertEquals(true, resp.success);
        System.assert(!resp.programs.isEmpty(), 'programs');
        System.assertEquals(0, resp.weeks.size(), 'weeks empty');
    }

    @IsTest
    static void getReturnsPlanAndEntries() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Test Plan';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);
        ScheduleService.ScheduleEntryRequest er = new ScheduleService.ScheduleEntryRequest();
        er.weeklyScheduleId = plan.Id;
        er.title = 'Entry 1';
        er.entryKind = 'Aktivität';
        er.type = 'Workshop';
        er.dayOfWeek = 'Monday';
        er.targetType = 'Course';
        er.order = 1;
        ScheduleService.upsertScheduleEntry(er);

        setGet('get', 'planId', plan.Id);
        ScheduleEditor.EditorResponse resp = ScheduleEditor.get();
        System.assertEquals(true, resp.success);
        System.assertEquals(plan.Id, resp.plan.id);
        System.assertEquals(1, resp.entries.size(), 'entries');
    }

    @IsTest
    static void optionsReturnsPicklistsAndTemplates() {
        setGet('options', 'programId', programId());
        ScheduleEditor.EditorResponse resp = ScheduleEditor.get();
        System.assertEquals(true, resp.success);
        System.assert(!resp.options.entryKinds.isEmpty(), 'entryKinds');
        System.assert(!resp.options.types.isEmpty(), 'types');
        System.assert(!resp.options.days.isEmpty(), 'days');
    }

    @IsTest
    static void savePlanCreatesDraft() {
        Map<String, Object> body = new Map<String, Object>{
            'action' => 'savePlan',
            'name' => 'Neuer Plan',
            'programWeekId' => programWeekId(),
            'scopeType' => 'Course',
            'startDate' => '2027-03-01'
        };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(true, resp.success);
        System.assertNotEquals(null, resp.id);
        System.assertEquals('Draft', resp.status);
    }

    @IsTest
    static void saveEntryCreatesAndUpdates() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Plan For Entry';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);

        Map<String, Object> body = new Map<String, Object>{
            'action' => 'saveEntry',
            'weeklyScheduleId' => plan.Id,
            'title' => 'Neuer Eintrag',
            'entryKind' => 'Aktivität',
            'type' => 'Workshop',
            'dayOfWeek' => 'Monday',
            'targetType' => 'Course',
            'order' => 1
        };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(true, resp.success);
        System.assertNotEquals(null, resp.id);

        // update
        Map<String, Object> body2 = new Map<String, Object>{
            'action' => 'saveEntry',
            'id' => resp.id,
            'title' => 'Aktualisiert'
        };
        setPost(body2);
        ScheduleEditor.MutationResponse resp2 = ScheduleEditor.post();
        System.assertEquals(true, resp2.success);
        System.assertEquals(resp.id, resp2.id);
    }

    @IsTest
    static void publishAndUnpublish() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Publish Plan';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);

        Map<String, Object> pub = new Map<String, Object>{ 'action' => 'publish', 'id' => plan.Id };
        setPost(pub);
        ScheduleEditor.MutationResponse r1 = ScheduleEditor.post();
        System.assertEquals(true, r1.success);
        System.assertEquals('Published', r1.status);

        Map<String, Object> unpub = new Map<String, Object>{ 'action' => 'unpublish', 'id' => plan.Id };
        setPost(unpub);
        ScheduleEditor.MutationResponse r2 = ScheduleEditor.post();
        System.assertEquals(true, r2.success);
        System.assertEquals('Draft', r2.status);
    }

    @IsTest
    static void deletePlanDraft() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Delete Plan';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);

        Map<String, Object> body = new Map<String, Object>{ 'action' => 'deletePlan', 'id' => plan.Id };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(true, resp.success);
    }

    @IsTest
    static void deleteEntry() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Plan For Delete Entry';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);

        ScheduleService.ScheduleEntryRequest er = new ScheduleService.ScheduleEntryRequest();
        er.weeklyScheduleId = plan.Id;
        er.title = 'Delete Me';
        er.entryKind = 'Aktivität';
        er.type = 'Workshop';
        er.dayOfWeek = 'Monday';
        er.targetType = 'Course';
        er.order = 1;
        ScheduleEntry__c entry = ScheduleService.upsertScheduleEntry(er);

        Map<String, Object> body = new Map<String, Object>{ 'action' => 'deleteEntry', 'id' => entry.Id };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(true, resp.success);
    }

    @IsTest
    static void deletePublishedPlanFails() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Published Plan';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);
        SchedulePublishService.publish(plan.Id);

        Map<String, Object> body = new Map<String, Object>{ 'action' => 'deletePlan', 'id' => plan.Id };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(false, resp.success);
        System.assertEquals(409, RestContext.response.statusCode);
    }

    @IsTest
    static void duplicateSlotReturns409() {
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.name = 'Slot Plan';
        req.programWeekId = programWeekId();
        req.scopeType = 'Course';
        req.startDate = '2027-03-01';
        WeeklySchedule__c plan = ScheduleService.upsertWeeklySchedule(req);

        ScheduleService.ScheduleEntryRequest er = new ScheduleService.ScheduleEntryRequest();
        er.weeklyScheduleId = plan.Id;
        er.title = 'Entry A';
        er.entryKind = 'Aktivität';
        er.type = 'Workshop';
        er.dayOfWeek = 'Monday';
        er.targetType = 'Course';
        er.order = 1;
        ScheduleService.upsertScheduleEntry(er);

        Map<String, Object> body = new Map<String, Object>{
            'action' => 'saveEntry',
            'weeklyScheduleId' => plan.Id,
            'title' => 'Entry B',
            'entryKind' => 'Aktivität',
            'type' => 'Workshop',
            'dayOfWeek' => 'Monday',
            'targetType' => 'Course',
            'order' => 1
        };
        setPost(body);
        ScheduleEditor.MutationResponse resp = ScheduleEditor.post();
        System.assertEquals(false, resp.success);
        System.assertEquals(409, RestContext.response.statusCode);
    }
}
