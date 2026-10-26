/**
 * Veröffentlichungs-Service fuer WeeklySchedule__c.
 */
global with sharing class SchedulePublishService {
    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    public static final String DOMAIN_SCHEDULE = 'schedule';
    public static final String SOURCE_WEB = 'web';
    public static final String ACTOR_TYPE_STAFF = 'staff';
    public static final String VISIBILITY_STAFF = 'staff';
    public static final String SENSITIVITY_NORMAL = 'normal';
    public static final String ACTION_UPDATED = 'updated';
    public static final String EVENT_PUBLISHED = 'schedule.published';
    public static final String EVENT_UNPUBLISHED = 'schedule.unpublished';

    public static WeeklySchedule__c publish(String weeklyScheduleId) {
        if (String.isBlank(weeklyScheduleId)) {
            throw badRequest('weeklyScheduleId ist erforderlich.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, Name, Status__c, PublishedAt__c, PublishedBy__c, StartDate__c, EndDate__c
            FROM WeeklySchedule__c
            WHERE Id = :weeklyScheduleId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        WeeklySchedule__c schedule = rows[0];

        if (schedule.ScopeType__c == 'Course') {
            WeeklySchedule__c probe = schedule.clone(true, false, false, false);
            probe.Status__c = 'Published';
            ScheduleService.assertNoDuplicateCourseSchedule(probe);
        }

        Savepoint sp = Database.setSavepoint();
        try {
            schedule.Status__c = 'Published';
            schedule.PublishedAt__c = Datetime.now();
            schedule.PublishedBy__c = UserInfo.getUserId();
            update schedule;

            AuditEvent__c audit = buildAudit(EVENT_PUBLISHED, 'WeeklySchedule__c', schedule.Id);
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new SchedulePublishServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }
            return schedule;
        } catch (SchedulePublishServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new SchedulePublishServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    public static WeeklySchedule__c unpublish(String weeklyScheduleId) {
        if (String.isBlank(weeklyScheduleId)) {
            throw badRequest('weeklyScheduleId ist erforderlich.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, Name, Status__c, PublishedAt__c, PublishedBy__c
            FROM WeeklySchedule__c
            WHERE Id = :weeklyScheduleId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        WeeklySchedule__c schedule = rows[0];

        Savepoint sp = Database.setSavepoint();
        try {
            schedule.Status__c = 'Draft';
            schedule.PublishedAt__c = null;
            schedule.PublishedBy__c = null;
            update schedule;

            AuditEvent__c audit = buildAudit(EVENT_UNPUBLISHED, 'WeeklySchedule__c', schedule.Id);
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new SchedulePublishServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }
            return schedule;
        } catch (SchedulePublishServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new SchedulePublishServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    private static AuditEvent__c buildAudit(String eventType, String subjectType, Id subjectId) {
        String actorName = UserInfo.getFirstName();
        if (String.isBlank(actorName)) {
            actorName = UserInfo.getName();
        }
        return new AuditEvent__c(
            Action__c = ACTION_UPDATED,
            ActorDisplayName__c = actorName,
            ActorId__c = UserInfo.getUserId(),
            ActorType__c = ACTOR_TYPE_STAFF,
            Domain__c = DOMAIN_SCHEDULE,
            EventType__c = eventType,
            OccurredAt__c = Datetime.now(),
            Reason__c = eventType,
            SchemaVersion__c = 1,
            Sensitivity__c = SENSITIVITY_NORMAL,
            Source__c = SOURCE_WEB,
            SubjectId__c = String.valueOf(subjectId),
            SubjectType__c = subjectType,
            Visibility__c = VISIBILITY_STAFF
        );
    }

    private static SchedulePublishServiceException badRequest(String message) {
        return new SchedulePublishServiceException(400, CODE_BAD_REQUEST, message);
    }

    private static SchedulePublishServiceException notFound(String message) {
        return new SchedulePublishServiceException(404, CODE_SCHEDULE_NOT_FOUND, message);
    }
}
