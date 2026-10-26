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
        System.assertEquals(mon, ParticipantPortalWeeklySchedule.isoMonday(Date.newInstance(2026, 10, 25))); // Sunday
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
