@IsTest
private class SchedulePortalSharingServiceTest {

    @TestSetup
    static void makeData() {
        insert new Account(Name = 'Sharing Test Account');
        Id accountId = [SELECT Id FROM Account LIMIT 1].Id;
        insert new Contact(FirstName = 'Share', LastName = 'Test', Email = 'share.test@example.invalid', AccountId = accountId);
        insert new Participant__c(
            Name = 'Share Test',
            Status__c = 'Active',
            Contact__c = [SELECT Id FROM Contact WHERE Email = 'share.test@example.invalid' LIMIT 1].Id,
            Portal_User__c = UserInfo.getUserId()
        );
        insert new Program__c(Name = 'Share Program', DurationWeeks__c = 1);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        update new Participant__c(Id = [SELECT Id FROM Participant__c LIMIT 1].Id, Program__c = programId);
        insert new Module__c(Name = 'Share Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'Share Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
        insert new ParticipantGroup__c(Name = 'Share Group', Program__c = programId);
    }

    private static Id programId() { return [SELECT Id FROM Program__c LIMIT 1].Id; }
    private static Id programWeekId() { return [SELECT Id FROM ProgramWeek__c LIMIT 1].Id; }
    private static Id participantId() { return [SELECT Id FROM Participant__c LIMIT 1].Id; }
    private static Id groupId() { return [SELECT Id FROM ParticipantGroup__c LIMIT 1].Id; }

    private static WeeklySchedule__c createPlan(String scope, Id groupId, Id participantId, String status) {
        WeeklySchedule__c plan = new WeeklySchedule__c(
            Name = 'Share Plan ' + scope,
            ProgramWeek__c = programWeekId(),
            ScopeType__c = scope,
            ParticipantGroup__c = groupId,
            Participant__c = participantId,
            StartDate__c = Date.newInstance(2027, 3, 1),
            Status__c = status
        );
        insert plan;
        return plan;
    }

    @IsTest
    static void planForPublishedCoursePlanReturnsShares() {
        Id coachId = null;
        // coach profile optional; skip coach share assertion by not setting coach
        WeeklySchedule__c plan = createPlan('Course', null, null, 'Published');
        insert new ScheduleEntry__c(
            Name = 'Course Entry',
            WeeklySchedule__c = plan.Id,
            EntryKind__c = 'Aktivität',
            Type__c = 'Workshop',
            IsRequired__c = false,
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Course',
            Order__c = 1
        );

        SchedulePortalSharingService.SharePlan result = SchedulePortalSharingService.planFor(plan.Id);
        System.assertEquals(1, result.plans.size(), 'plan share');
        System.assertEquals(1, result.weeks.size(), 'week share');
        System.assertEquals(1, result.entries.size(), 'entry share');
    }

    @IsTest
    static void planForPublishedGroupPlanReturnsShares() {
        Id gId = groupId();
        Id pId = participantId();
        insert new ParticipantGroupMember__c(ParticipantGroup__c = gId, Participant__c = pId);

        WeeklySchedule__c plan = createPlan('Group', gId, null, 'Published');
        insert new ScheduleEntry__c(
            Name = 'Group Entry',
            WeeklySchedule__c = plan.Id,
            EntryKind__c = 'Aktivität',
            Type__c = 'Gruppencoaching',
            IsRequired__c = true,
            DayOfWeek__c = 'Tuesday',
            TargetType__c = 'Group',
            ParticipantGroup__c = gId,
            Order__c = 2
        );

        SchedulePortalSharingService.SharePlan result = SchedulePortalSharingService.planFor(plan.Id);
        System.assertEquals(1, result.plans.size(), 'plan share');
        System.assertEquals(1, result.weeks.size(), 'week share');
        System.assertEquals(1, result.entries.size(), 'entry share');
    }

    @IsTest
    static void planForPublishedIndividualPlanReturnsShares() {
        Id pId = participantId();
        WeeklySchedule__c plan = createPlan('Individual', null, pId, 'Published');
        insert new ScheduleEntry__c(
            Name = 'Individual Entry',
            WeeklySchedule__c = plan.Id,
            EntryKind__c = 'Aktivität',
            Type__c = 'Einzelcoaching',
            IsRequired__c = true,
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Individual',
            Participant__c = pId,
            Order__c = 1
        );

        SchedulePortalSharingService.SharePlan result = SchedulePortalSharingService.planFor(plan.Id);
        System.assertEquals(1, result.plans.size(), 'plan share');
        System.assertEquals(1, result.weeks.size(), 'week share');
        System.assertEquals(1, result.entries.size(), 'entry share');
    }

    @IsTest
    static void planForUnpublishedPlanIsEmpty() {
        WeeklySchedule__c plan = createPlan('Course', null, null, 'Draft');
        SchedulePortalSharingService.SharePlan result = SchedulePortalSharingService.planFor(plan.Id);
        System.assert(result.isEmpty(), 'unpublished plan must produce no shares');
    }

    @IsTest
    static void planForUnknownPlanIsEmpty() {
        SchedulePortalSharingService.SharePlan result = SchedulePortalSharingService.planFor(null);
        System.assert(result.isEmpty());
    }
}
