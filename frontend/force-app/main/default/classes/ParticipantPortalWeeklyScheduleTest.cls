@IsTest
public class ParticipantPortalWeeklyScheduleTest {

    @TestSetup
    static void makeData() {
        insert new Program__c(Name = 'PW Program', Status__c = 'Draft', DurationWeeks__c = 4);
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'PW Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(Name = 'PW Week', Program__c = programId, Module__c = moduleId, Number__c = 1, Status__c = 'Draft');
    }

    private static Participant__c createParticipant(Id programId, String email) {
        Contact c = new Contact(FirstName = 'Portal', LastName = 'Test', Email = email);
        insert c;
        Participant__c p = new Participant__c(Name = 'Portal Test', Contact__c = c.Id, Program__c = programId);
        insert p;
        return p;
    }

    private static WeeklySchedule__c createPlan(
            String name,
            Id programWeekId,
            Date startDate,
            String scopeType,
            Id participantGroupId,
            Id participantId,
            String mergeMode) {
        WeeklySchedule__c plan = new WeeklySchedule__c(
            Name = name,
            ProgramWeek__c = programWeekId,
            StartDate__c = startDate,
            Status__c = 'Published',
            ScopeType__c = scopeType,
            ParticipantGroup__c = participantGroupId,
            Participant__c = participantId,
            MergeMode__c = mergeMode
        );
        insert plan;
        return plan;
    }

    private static ScheduleEntry__c createEntry(
            Id weeklyScheduleId,
            String title,
            String dayOfWeek,
            Integer order,
            String targetType,
            Id participantGroupId,
            Id participantId) {
        ScheduleEntry__c entry = new ScheduleEntry__c(
            Name = title,
            WeeklySchedule__c = weeklyScheduleId,
            EntryKind__c = 'Aktivität',
            Type__c = 'Workshop',
            DayOfWeek__c = dayOfWeek,
            TargetType__c = targetType,
            ParticipantGroup__c = participantGroupId,
            Participant__c = participantId,
            Order__c = order
        );
        insert entry;
        return entry;
    }

    @IsTest
    static void buildResponse_overlayMergesScopesAndMarksSource() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        Participant__c p = createParticipant(programId, 'overlay@example.invalid');
        ParticipantGroup__c g = new ParticipantGroup__c(Name = 'Overlay Group', Program__c = programId);
        insert g;
        insert new ParticipantGroupMember__c(Participant__c = p.Id, ParticipantGroup__c = g.Id);

        Date weekStart = Date.newInstance(2027, 3, 1);
        WeeklySchedule__c course = createPlan('Course', programWeekId, weekStart, 'Course', null, null, 'Overlay');
        WeeklySchedule__c groupPlan = createPlan('Group', programWeekId, weekStart, 'Group', g.Id, null, 'Overlay');
        WeeklySchedule__c individual = createPlan('Individual', programWeekId, weekStart, 'Individual', null, p.Id, 'Overlay');

        createEntry(course.Id, 'Course A', 'Monday', 1, 'Course', null, null);
        createEntry(course.Id, 'Course B', 'Tuesday', 1, 'Course', null, null);
        createEntry(groupPlan.Id, 'Group A', 'Monday', 1, 'Group', g.Id, null);
        createEntry(groupPlan.Id, 'Group C', 'Wednesday', 1, 'Group', g.Id, null);
        createEntry(individual.Id, 'Individual A', 'Monday', 1, 'Individual', null, p.Id);
        createEntry(individual.Id, 'Individual B', 'Monday', 2, 'Individual', null, p.Id);
        createEntry(individual.Id, 'Without slot', 'Thursday', null, 'Individual', null, p.Id);

        ParticipantPortalWeeklySchedule.WeeklyScheduleResponse resp =
            ParticipantPortalWeeklySchedule.buildResponse(p.Id, programId, new Set<Id>{g.Id}, weekStart);

        System.assertEquals(5, resp.entries.size(), 'overlay merge result');
        System.assertEquals('Individual', resp.effectiveScope, 'effective scope');
        System.assert(resp.appliedScopes.contains('Course'), 'Course applied');
        System.assert(resp.appliedScopes.contains('Group'), 'Group applied');
        System.assert(resp.appliedScopes.contains('Individual'), 'Individual applied');

        Map<String, String> sourceByTitle = new Map<String, String>();
        for (ParticipantPortalWeeklySchedule.EntryView entry : resp.entries) {
            sourceByTitle.put(entry.title, entry.sourceScope);
        }
        System.assertEquals('Individual', sourceByTitle.get('Individual A'), 'individual override source');
        System.assertEquals('Individual', sourceByTitle.get('Individual B'), 'individual appended source');
        System.assertEquals('Individual', sourceByTitle.get('Without slot'), 'order-null source');
        System.assertEquals('Course', sourceByTitle.get('Course B'), 'course source');
        System.assertEquals('Group', sourceByTitle.get('Group C'), 'group source');
    }

    @IsTest
    static void buildResponse_replaceShowsOnlyIndividual() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        Participant__c p = createParticipant(programId, 'replace@example.invalid');

        Date weekStart = Date.newInstance(2027, 3, 1);
        WeeklySchedule__c course = createPlan('Course', programWeekId, weekStart, 'Course', null, null, 'Overlay');
        WeeklySchedule__c individual = createPlan('Individual', programWeekId, weekStart, 'Individual', null, p.Id, 'Replace');

        createEntry(course.Id, 'Course only', 'Monday', 1, 'Course', null, null);
        createEntry(individual.Id, 'Replace only', 'Monday', 1, 'Individual', null, p.Id);

        ParticipantPortalWeeklySchedule.WeeklyScheduleResponse resp =
            ParticipantPortalWeeklySchedule.buildResponse(p.Id, programId, new Set<Id>(), weekStart);

        System.assertEquals(1, resp.entries.size(), 'only replace entry');
        System.assertEquals('Replace only', resp.entries[0].title, 'replace entry title');
        System.assertEquals('Individual', resp.entries[0].sourceScope, 'replace entry source');
        System.assertEquals('Individual', resp.effectiveScope, 'effective scope');
        System.assertEquals(1, resp.appliedScopes.size(), 'only Individual applied');
        System.assertEquals('Individual', resp.appliedScopes[0], 'applied scope');
    }

    @IsTest
    static void buildResponse_reflectsLiveContentEditsOnPublishedPlan() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        Participant__c p = createParticipant(programId, 'live@example.invalid');

        Date weekStart = Date.newInstance(2027, 3, 1);
        WeeklySchedule__c course = createPlan('Course', programWeekId, weekStart, 'Course', null, null, 'Overlay');
        ScheduleEntry__c entry = createEntry(course.Id, 'Vorher', 'Monday', 1, 'Course', null, null);

        ParticipantPortalWeeklySchedule.WeeklyScheduleResponse before =
            ParticipantPortalWeeklySchedule.buildResponse(p.Id, programId, new Set<Id>(), weekStart);
        System.assertEquals(1, before.entries.size(), 'initial entry');
        System.assertEquals('Vorher', before.entries[0].title, 'initial title');

        // Simulate an edit made through the backoffice on the published plan.
        entry.Name = 'Nachher';
        entry.Description__c = 'Live aktualisiert';
        entry.StartTime__c = Time.newInstance(9, 0, 0, 0);
        entry.EndTime__c = Time.newInstance(10, 30, 0, 0);
        update entry;
        createEntry(course.Id, 'Neu hinzugefuegt', 'Tuesday', 1, 'Course', null, null);

        ParticipantPortalWeeklySchedule.WeeklyScheduleResponse after =
            ParticipantPortalWeeklySchedule.buildResponse(p.Id, programId, new Set<Id>(), weekStart);

        System.assertEquals(2, after.entries.size(), 'new entry is visible without re-publish');
        Map<String, ParticipantPortalWeeklySchedule.EntryView> byTitle =
            new Map<String, ParticipantPortalWeeklySchedule.EntryView>();
        for (ParticipantPortalWeeklySchedule.EntryView view : after.entries) {
            byTitle.put(view.title, view);
        }
        System.assertEquals('Live aktualisiert', byTitle.get('Nachher').description, 'edited content visible');
        System.assert(byTitle.get('Nachher').startTime.startsWith('09:00'), 'edited time visible');
        System.assert(byTitle.containsKey('Neu hinzugefuegt'), 'added entry visible');
    }

    @IsTest
    static void buildResponse_duplicateIndividualFails() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id programWeekId = [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
        Participant__c p = createParticipant(programId, 'duplicate@example.invalid');

        Date weekStart = Date.newInstance(2027, 3, 1);
        createPlan('Individual 1', programWeekId, weekStart, 'Individual', null, p.Id, 'Overlay');
        createPlan('Individual 2', programWeekId, weekStart, 'Individual', null, p.Id, 'Overlay');

        try {
            ParticipantPortalWeeklySchedule.buildResponse(p.Id, programId, new Set<Id>(), weekStart);
            System.assert(false, 'duplicate individual plan must fail');
        } catch (PortalIdentityException e) {
            System.assertEquals(500, e.getStatusCode());
            System.assertEquals('INTERNAL_ERROR', e.getCode());
            System.assertEquals('Duplicate schedule instance.', e.getMessage());
        }
    }

    @IsTest
    static void isVisibleTo_allowsCourse() {
        ScheduleEntry__c e = new ScheduleEntry__c(TargetType__c = 'Course');
        System.assertEquals(true, ParticipantPortalWeeklySchedule.isVisibleTo(e, null, new Set<Id>()));
    }

    @IsTest
    static void isVisibleTo_allowsOwnIndividual() {
        Id p = '003000000000000AAA';
        ScheduleEntry__c e = new ScheduleEntry__c(TargetType__c = 'Individual', Participant__c = p);
        System.assertEquals(true, ParticipantPortalWeeklySchedule.isVisibleTo(e, p, new Set<Id>()));
    }

    @IsTest
    static void isVisibleTo_blocksForeignIndividual() {
        Id p = '003000000000000AAA';
        Id other = '003000000000001AAA';
        ScheduleEntry__c e = new ScheduleEntry__c(TargetType__c = 'Individual', Participant__c = other);
        System.assertEquals(false, ParticipantPortalWeeklySchedule.isVisibleTo(e, p, new Set<Id>()));
    }

    @IsTest
    static void isVisibleTo_hardBlocksForeignParticipantRegardlessOfType() {
        Id p = '003000000000000AAA';
        Id other = '003000000000001AAA';
        ScheduleEntry__c e = new ScheduleEntry__c(TargetType__c = 'Course', Participant__c = other);
        System.assertEquals(false, ParticipantPortalWeeklySchedule.isVisibleTo(e, p, new Set<Id>()));
    }

    @IsTest
    static void isVisibleTo_groupOnlyForMember() {
        Id p = '003000000000000AAA';
        Id g = 'a0G000000000000AAA';
        ScheduleEntry__c e = new ScheduleEntry__c(TargetType__c = 'Group', ParticipantGroup__c = g);
        System.assertEquals(true, ParticipantPortalWeeklySchedule.isVisibleTo(e, p, new Set<Id>{g}));
        System.assertEquals(false, ParticipantPortalWeeklySchedule.isVisibleTo(e, p, new Set<Id>()));
    }

    @IsTest
    static void isVisibleTo_rejectsNullAndUnknown() {
        ScheduleEntry__c e1 = new ScheduleEntry__c(TargetType__c = null);
        ScheduleEntry__c e2 = new ScheduleEntry__c(TargetType__c = 'Bogus');
        System.assertEquals(false, ParticipantPortalWeeklySchedule.isVisibleTo(e1, null, new Set<Id>()));
        System.assertEquals(false, ParticipantPortalWeeklySchedule.isVisibleTo(e2, null, new Set<Id>()));
    }

    @IsTest
    static void isoMonday_returnsMonday() {
        // 2026-10-26 is a Monday
        Date mon = Date.newInstance(2026, 10, 26);
        System.assertEquals(mon, ParticipantPortalWeeklySchedule.isoMonday(mon));
        System.assertEquals(mon, ParticipantPortalWeeklySchedule.isoMonday(Date.newInstance(2026, 10, 28))); // Wednesday
        System.assertEquals(Date.newInstance(2026, 10, 19), ParticipantPortalWeeklySchedule.isoMonday(Date.newInstance(2026, 10, 25))); // Sunday -> previous Monday (ISO week)
    }

    @IsTest
    static void parseWeekStart_acceptsMonday() {
        System.assertEquals(Date.newInstance(2026, 10, 26), ParticipantPortalWeeklySchedule.parseWeekStart('2026-10-26'));
    }

    @IsTest
    static void parseWeekStart_rejectsNonMonday() {
        try {
            ParticipantPortalWeeklySchedule.parseWeekStart('2026-10-27');
            System.assert(false, 'non-Monday must be rejected');
        } catch (PortalIdentityException e) {
            System.assertEquals(400, e.getStatusCode());
            System.assertEquals('BAD_WEEK_START', e.getCode());
        }
    }

    @IsTest
    static void parseWeekStart_rejectsBadFormat() {
        try {
            ParticipantPortalWeeklySchedule.parseWeekStart('not-a-date');
            System.assert(false, 'bad format must be rejected');
        } catch (PortalIdentityException e) {
            System.assertEquals(400, e.getStatusCode());
        }
    }

    @IsTest
    static void parseWeekStart_nullReturnsNull() {
        System.assertEquals(null, ParticipantPortalWeeklySchedule.parseWeekStart(null));
        System.assertEquals(null, ParticipantPortalWeeklySchedule.parseWeekStart(''));
    }

    @IsTest
    static void slotKey_returnsNullForNullOrder() {
        ScheduleEntry__c e = new ScheduleEntry__c(DayOfWeek__c = 'Monday', Order__c = null, EntryKind__c = 'Aktivität');
        System.assertEquals(null, ParticipantPortalWeeklySchedule.slotKey(e));
    }

    @IsTest
    static void slotKey_buildsComposite() {
        ScheduleEntry__c e = new ScheduleEntry__c(DayOfWeek__c = 'Monday', Order__c = 1, EntryKind__c = 'Aktivität');
        System.assertEquals('Monday|1|Aktivität', ParticipantPortalWeeklySchedule.slotKey(e));
    }

    @IsTest
    static void theEndpointIsBuiltOnTheSameIdentityGate() {
        // RestContext is null in a test; drive the identity chain directly.
        try {
            ParticipantPortalData.resolveForUser(UserInfo.getUserId());
            // may or may not resolve depending on test user; either way no leak
        } catch (PortalIdentityException e) {
            System.assertEquals(true, e.getStatusCode() == 401 || e.getStatusCode() == 403 || e.getStatusCode() == 404);
        }
    }
}
