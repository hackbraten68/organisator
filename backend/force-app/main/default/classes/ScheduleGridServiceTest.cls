@IsTest
public class ScheduleGridServiceTest {

    @TestSetup
    static void makeData() {
        insert new Program__c(Name = 'Grid Program', DurationWeeks__c = 1, Status__c = 'Draft');
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        insert new Module__c(Name = 'Grid Module', Program__c = programId);
        Id moduleId = [SELECT Id FROM Module__c LIMIT 1].Id;
        insert new ProgramWeek__c(
            Name = 'Grid Week',
            Program__c = programId,
            Module__c = moduleId,
            Number__c = 1,
            Status__c = 'Draft'
        );
    }

    private static Id weekId() {
        return [SELECT Id FROM ProgramWeek__c LIMIT 1].Id;
    }

    private static WeeklySchedule__c createPlan(String status) {
        WeeklySchedule__c plan = new WeeklySchedule__c(
            Name = 'Grid Plan',
            ProgramWeek__c = weekId(),
            ScopeType__c = 'Course',
            Status__c = status,
            StartDate__c = Date.newInstance(2027, 3, 1)
        );
        insert plan;
        return plan;
    }

    private static ScheduleEntry__c createEntry(Id planId) {
        ScheduleEntry__c entry = new ScheduleEntry__c(
            Name = 'Grid Entry',
            WeeklySchedule__c = planId,
            EntryKind__c = 'Aktivität',
            Type__c = 'Workshop',
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Course',
            StartTime__c = Time.newInstance(8, 30, 0, 0),
            EndTime__c = Time.newInstance(10, 0, 0, 0),
            DurationMinutes__c = 90,
            Order__c = 1
        );
        insert entry;
        return entry;
    }

    private static String initialGrid() {
        return JSON.serialize(new Map<String, Object>{
            'version' => 1,
            'slots' => new List<Object>{
                new Map<String, Object>{
                    'id' => 'slot-a',
                    'start' => '08:30',
                    'end' => '10:00',
                    'format' => 'Synchron',
                    'units' => '1. & 2. UE'
                },
                new Map<String, Object>{
                    'id' => 'slot-b',
                    'start' => '10:15',
                    'end' => '10:30',
                    'format' => 'Pause'
                }
            }
        });
    }

    @IsTest
    static void saveForPlanZiehtZeitenUndSchreibtAudit() {
        WeeklySchedule__c plan = createPlan('Draft');
        ScheduleEntry__c entry = createEntry(plan.Id);

        Integer changed = ScheduleGridService.saveForPlan(plan.Id, initialGrid());
        System.assertEquals(1, changed, 'Legacy-Eintrag wird dem Block zugeordnet');

        entry = [
            SELECT Id, TimeSlotId__c, StartTime__c, EndTime__c
            FROM ScheduleEntry__c
            WHERE Id = :entry.Id
        ];
        System.assertEquals('slot-a', entry.TimeSlotId__c, 'Slot-ID gesetzt');

        String changedGrid = JSON.serialize(new Map<String, Object>{
            'version' => 1,
            'slots' => new List<Object>{
                new Map<String, Object>{
                    'id' => 'slot-a',
                    'start' => '09:00',
                    'end' => '10:30',
                    'format' => 'Synchron'
                },
                new Map<String, Object>{
                    'id' => 'slot-b',
                    'start' => '10:45',
                    'end' => '11:00',
                    'format' => 'Pause'
                }
            }
        });
        ScheduleGridService.saveForPlan(plan.Id, changedGrid);

        entry = [
            SELECT Id, StartTime__c, EndTime__c, DurationMinutes__c
            FROM ScheduleEntry__c
            WHERE Id = :entry.Id
        ];
        System.assertEquals(Time.newInstance(9, 0, 0, 0), entry.StartTime__c, 'Startzeit verschoben');
        System.assertEquals(Time.newInstance(10, 30, 0, 0), entry.EndTime__c, 'Endzeit verschoben');
        System.assertEquals(90, entry.DurationMinutes__c, 'Dauer neu berechnet');

        List<AuditEvent__c> audits = [
            SELECT Id, EventType__c
            FROM AuditEvent__c
            WHERE SubjectId__c = :String.valueOf(plan.Id)
              AND EventType__c = 'schedule.grid_updated'
        ];
        System.assertEquals(2, audits.size(), 'zwei Raster-Audits');
    }

    @IsTest
    static void saveForPlanBlockiertVeroeffentlichtePlaene() {
        WeeklySchedule__c plan = createPlan('Published');
        createEntry(plan.Id);

        try {
            ScheduleGridService.saveForPlan(plan.Id, initialGrid());
            System.assert(false, 'veroeffentlichter Plan muss schreibgeschuetzt sein');
        } catch (ScheduleServiceException e) {
            System.assertEquals(409, e.getStatusCode());
            System.assertEquals(ScheduleService.CODE_PLAN_NOT_EDITABLE, e.getCode());
        }
    }

    @IsTest
    static void saveForPlanBlockiertEntferntenBelegtenSlot() {
        WeeklySchedule__c plan = createPlan('Draft');
        ScheduleEntry__c entry = createEntry(plan.Id);
        ScheduleGridService.saveForPlan(plan.Id, initialGrid());

        String onlySecondSlot = JSON.serialize(new Map<String, Object>{
            'version' => 1,
            'slots' => new List<Object>{
                new Map<String, Object>{
                    'id' => 'slot-b',
                    'start' => '10:15',
                    'end' => '10:30',
                    'format' => 'Pause'
                }
            }
        });

        try {
            ScheduleGridService.saveForPlan(plan.Id, onlySecondSlot);
            System.assert(false, 'belegter Slot darf nicht entfernt werden');
        } catch (ScheduleServiceException e) {
            System.assertEquals(409, e.getStatusCode());
            System.assertEquals(ScheduleGridService.CODE_GRID_SLOT_IN_USE, e.getCode());
        }
        System.assertEquals('slot-a', [
            SELECT TimeSlotId__c FROM ScheduleEntry__c WHERE Id = :entry.Id
        ].TimeSlotId__c, 'Eintrag bleibt unveraendert');
    }

    @IsTest
    static void saveForTemplatePersistiertKonfiguration() {
        ScheduleTemplate__c template = new ScheduleTemplate__c(
            Name = 'Grid Template',
            ProgramWeek__c = weekId(),
            Status__c = 'Active'
        );
        insert template;
        insert new ScheduleEntry__c(
            Name = 'Grid Template Entry',
            ScheduleTemplate__c = template.Id,
            EntryKind__c = 'Aktivität',
            Type__c = 'Workshop',
            DayOfWeek__c = 'Monday',
            TargetType__c = 'Course',
            StartTime__c = Time.newInstance(8, 30, 0, 0),
            EndTime__c = Time.newInstance(10, 0, 0, 0)
        );

        ScheduleGridService.saveForTemplate(template.Id, initialGrid());

        ScheduleTemplate__c updated = [
            SELECT GridConfig__c FROM ScheduleTemplate__c WHERE Id = :template.Id
        ];
        System.assertNotEquals(null, updated.GridConfig__c, 'GridConfig gespeichert');
        ScheduleEntry__c entry = [
            SELECT TimeSlotId__c FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :template.Id
        ];
        System.assertEquals('slot-a', entry.TimeSlotId__c, 'Vorlageneintrag zugeordnet');
    }

    @IsTest
    static void parseLehntUngueltigeKonfigurationAb() {
        try {
            ScheduleGridService.parse('{"version":1,"slots":[{"id":"slot-a","start":"10:00","end":"09:00"}]}');
            System.assert(false, 'Ende vor Start muss abgelehnt werden');
        } catch (ScheduleServiceException e) {
            System.assertEquals(400, e.getStatusCode());
            System.assertEquals(ScheduleGridService.CODE_GRID_INVALID, e.getCode());
        }

        try {
            ScheduleGridService.parse('{broken');
            System.assert(false, 'ungueltiges JSON muss abgelehnt werden');
        } catch (ScheduleServiceException e) {
            System.assertEquals(ScheduleGridService.CODE_GRID_INVALID, e.getCode());
        }
    }
}
