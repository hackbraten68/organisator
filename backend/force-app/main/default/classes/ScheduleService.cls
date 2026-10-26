/**
 * CRUD fuer WeeklySchedule__c und ScheduleEntry__c.
 *
 * Service-Layer wie AppointmentEditService: with sharing, Feld-Whitelist,
 * Audit in derselben Transaktion, Savepoint + Rollback, eigene Exception-Klasse
 * mit statusCode + code.
 *
 * Fehlercodes: SCHEDULE_NOT_FOUND, ENTRY_TARGET_INVALID, NOT_ASSIGNED
 */
global with sharing class ScheduleService {
    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND';
    public static final String CODE_ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND';
    public static final String CODE_ENTRY_TARGET_INVALID = 'ENTRY_TARGET_INVALID';
    public static final String CODE_NOT_ASSIGNED = 'NOT_ASSIGNED';
    public static final String CODE_PROGRAM_WEEK_NOT_FOUND = 'PROGRAM_WEEK_NOT_FOUND';
    public static final String CODE_TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND';
    public static final String CODE_INVALID_INTERVAL = 'INVALID_INTERVAL';
    public static final String CODE_INVALID_WEEK_START = 'INVALID_WEEK_START';
    public static final String CODE_DUPLICATE_COURSE_SCHEDULE = 'DUPLICATE_COURSE_SCHEDULE';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    public static final String DOMAIN_SCHEDULE = 'schedule';
    public static final String SOURCE_WEB = 'web';
    public static final String ACTOR_TYPE_STAFF = 'staff';
    public static final String VISIBILITY_STAFF = 'staff';
    public static final String SENSITIVITY_NORMAL = 'normal';
    public static final String ACTION_CREATED = 'created';
    public static final String ACTION_UPDATED = 'updated';
    public static final String ACTION_DELETED = 'deleted';

    public static final String EVENT_SCHEDULE_CREATED = 'schedule.created';
    public static final String EVENT_SCHEDULE_UPDATED = 'schedule.updated';
    public static final String EVENT_ENTRY_CREATED = 'schedule.entry_created';
    public static final String EVENT_ENTRY_UPDATED = 'schedule.entry_updated';
    public static final String EVENT_ENTRY_DELETED = 'schedule.entry_deleted';

    public static final Set<String> SCOPE_COURSE = new Set<String>{ 'Course' };
    public static final Set<String> SCOPE_GROUP = new Set<String>{ 'Group' };
    public static final Set<String> SCOPE_INDIVIDUAL = new Set<String>{ 'Individual' };

    global class WeeklyScheduleRequest {
        global String id;
        global String name;
        global String programWeekId;
        global String scopeType;
        global String participantGroupId;
        global String participantId;
        global String startDate;
        global String endDate;
        global String status;
        global String deviationReason;
        global String notes;
    }

    global class ScheduleEntryRequest {
        global String id;
        global String weeklyScheduleId;
        global String scheduleTemplateId;
        global String title;
        global String description;
        global String entryKind;
        global String type;
        global Boolean isRequired;
        global String dayOfWeek;
        global String startTime;
        global String endTime;
        global Integer durationMinutes;
        global String targetType;
        global String participantGroupId;
        global String participantId;
        global String coachProfileId;
        global String location;
        global String meetingLink;
        global Integer order;
        global String deviationReason;
        global String notes;
        global Boolean isCustomized;
    }

    global class ScheduleResponse {
        global Boolean success;
        global String id;
        global String code;
        global String message;
        global List<AuditEvent__c> auditEvents;

        global ScheduleResponse(String id) {
            this.success = true;
            this.id = id;
        }

        global ScheduleResponse(String code, String message) {
            this.success = false;
            this.code = code;
            this.message = message;
        }
    }

    public static WeeklySchedule__c upsertWeeklySchedule(WeeklyScheduleRequest request) {
        if (request == null) {
            throw badRequest('Der Request fehlt.');
        }

        WeeklySchedule__c record;
        if (String.isNotBlank(request.id)) {
            List<WeeklySchedule__c> existing = [
                SELECT Id, Name, ProgramWeek__c, ScopeType__c, ParticipantGroup__c, Participant__c,
                       StartDate__c, EndDate__c, Status__c, PublishedAt__c, PublishedBy__c,
                       AppliedTemplate__c, TemplateAppliedAt__c, DeviationReason__c, Notes__c
                FROM WeeklySchedule__c
                WHERE Id = :request.id
                LIMIT 1
            ];
            if (existing.isEmpty()) {
                throw notFound('Der Wochenplan existiert nicht.');
            }
            record = existing[0];
        } else {
            if (String.isBlank(request.programWeekId)) {
                throw badRequest('programWeekId ist erforderlich.');
            }
            if (String.isBlank(request.startDate)) {
                throw badRequest('startDate ist erforderlich.');
            }
            if (String.isBlank(request.name)) {
                throw badRequest('name ist erforderlich.');
            }
            record = new WeeklySchedule__c(
                Name = request.name,
                ProgramWeek__c = request.programWeekId,
                StartDate__c = Date.valueOf(request.startDate)
            );
        }

        if (String.isNotBlank(request.scopeType)) {
            record.ScopeType__c = request.scopeType;
        } else if (String.isBlank(request.id)) {
            record.ScopeType__c = 'Course';
        }

        if (String.isNotBlank(request.name)) {
            record.Name = request.name;
        }
        if (request.participantGroupId != null) {
            record.ParticipantGroup__c = String.isBlank(request.participantGroupId) ? null : request.participantGroupId;
        }
        if (request.participantId != null) {
            record.Participant__c = String.isBlank(request.participantId) ? null : request.participantId;
        }
        if (String.isNotBlank(request.status)) {
            record.Status__c = request.status;
        } else if (String.isBlank(request.id)) {
            record.Status__c = 'Draft';
        }
        if (request.endDate != null) {
            record.EndDate__c = String.isBlank(request.endDate) ? null : Date.valueOf(request.endDate);
        }
        if (request.deviationReason != null) {
            record.DeviationReason__c = String.isBlank(request.deviationReason) ? null : request.deviationReason;
        }
        if (request.notes != null) {
            record.Notes__c = String.isBlank(request.notes) ? null : request.notes;
        }

        validateWeeklySchedule(record);
        Id pwId = String.isNotBlank(request.id) ? record.ProgramWeek__c : (String.isNotBlank(request.programWeekId) ? request.programWeekId : null);
        assertCoachAccess(pwId);
        assertNoDuplicateCourseSchedule(record);

        Savepoint sp = Database.setSavepoint();
        try {
            upsert record;

            AuditEvent__c audit = buildAudit(
                String.isBlank(request.id) ? ACTION_CREATED : ACTION_UPDATED,
                String.isBlank(request.id) ? EVENT_SCHEDULE_CREATED : EVENT_SCHEDULE_UPDATED,
                'WeeklySchedule__c',
                record.Id,
                null
            );
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new ScheduleServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }
            return record;
        } catch (ScheduleServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    public static ScheduleEntry__c upsertScheduleEntry(ScheduleEntryRequest request) {
        if (request == null) {
            throw badRequest('Der Request fehlt.');
        }

        ScheduleEntry__c record;
        if (String.isNotBlank(request.id)) {
            List<ScheduleEntry__c> existing = [
                SELECT Id, Name, WeeklySchedule__c, ScheduleTemplate__c, Description__c,
                       EntryKind__c, Type__c, IsRequired__c, DayOfWeek__c, Date__c,
                       StartTime__c, EndTime__c, DurationMinutes__c, TargetType__c,
                       ParticipantGroup__c, Participant__c, Coach_Profile__c, Location__c,
                       MeetingLink__c, Order__c, DeviationReason__c, Notes__c, IsCustomized__c,
                       SourceTemplateEntry__c
                FROM ScheduleEntry__c
                WHERE Id = :request.id
                LIMIT 1
            ];
            if (existing.isEmpty()) {
                throw notFound('Die Planzeile existiert nicht.');
            }
            record = existing[0];
        } else {
            if (String.isBlank(request.title)) {
                throw badRequest('Titel ist erforderlich.');
            }
            record = new ScheduleEntry__c(Name = request.title);
            if (String.isNotBlank(request.weeklyScheduleId)) {
                record.WeeklySchedule__c = request.weeklyScheduleId;
            }
            if (String.isNotBlank(request.scheduleTemplateId)) {
                record.ScheduleTemplate__c = request.scheduleTemplateId;
            }
            if (String.isNotBlank(request.entryKind)) {
                record.EntryKind__c = request.entryKind;
            } else {
                record.EntryKind__c = 'Aktivität';
            }
            if (String.isNotBlank(request.type)) {
                record.Type__c = request.type;
            } else {
                record.Type__c = 'Einzelcoaching';
            }
            if (request.isRequired == null) {
                record.IsRequired__c = false;
            } else {
                record.IsRequired__c = request.isRequired;
            }
            if (String.isNotBlank(request.dayOfWeek)) {
                record.DayOfWeek__c = request.dayOfWeek;
            } else {
                record.DayOfWeek__c = 'Monday';
            }
            if (String.isNotBlank(request.targetType)) {
                record.TargetType__c = request.targetType;
            } else {
                record.TargetType__c = 'Course';
            }
            if (request.isCustomized == null) {
                record.IsCustomized__c = false;
            } else {
                record.IsCustomized__c = request.isCustomized;
            }
        }

        if (request.title != null) {
            record.Name = String.isBlank(request.title) ? record.Name : request.title;
        }
        if (request.description != null) {
            record.Description__c = String.isBlank(request.description) ? null : request.description;
        }
        if (String.isNotBlank(request.entryKind)) {
            record.EntryKind__c = request.entryKind;
        }
        if (String.isNotBlank(request.type)) {
            record.Type__c = request.type;
        }
        if (request.isRequired != null) {
            record.IsRequired__c = request.isRequired;
        }
        if (String.isNotBlank(request.dayOfWeek)) {
            record.DayOfWeek__c = request.dayOfWeek;
        }
        if (request.startTime != null) {
            record.StartTime__c = String.isBlank(request.startTime) ? null : parseTime(request.startTime);
        }
        if (request.endTime != null) {
            record.EndTime__c = String.isBlank(request.endTime) ? null : parseTime(request.endTime);
        }
        if (request.durationMinutes != null) {
            record.DurationMinutes__c = request.durationMinutes;
        }
        if (String.isNotBlank(request.targetType)) {
            record.TargetType__c = request.targetType;
        }
        if (request.participantGroupId != null) {
            record.ParticipantGroup__c = String.isBlank(request.participantGroupId) ? null : request.participantGroupId;
        }
        if (request.participantId != null) {
            record.Participant__c = String.isBlank(request.participantId) ? null : request.participantId;
        }
        if (request.coachProfileId != null) {
            record.Coach_Profile__c = String.isBlank(request.coachProfileId) ? null : request.coachProfileId;
        }
        if (String.isNotBlank(request.location)) {
            record.Location__c = request.location;
        }
        if (request.meetingLink != null) {
            record.MeetingLink__c = String.isBlank(request.meetingLink) ? null : request.meetingLink;
        }
        if (request.order != null) {
            record.Order__c = request.order;
        }
        if (request.deviationReason != null) {
            record.DeviationReason__c = String.isBlank(request.deviationReason) ? null : request.deviationReason;
        }
        if (request.notes != null) {
            record.Notes__c = String.isBlank(request.notes) ? null : request.notes;
        }
        if (request.isCustomized != null) {
            record.IsCustomized__c = request.isCustomized;
        }

        computeDateForEntry(record);
        validateScheduleEntry(record);
        if (String.isNotBlank(record.WeeklySchedule__c)) {
            List<WeeklySchedule__c> ws = [SELECT ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :record.WeeklySchedule__c LIMIT 1];
            if (!ws.isEmpty()) {
                assertCoachAccess(ws[0].ProgramWeek__c);
            }
        }

        Savepoint sp = Database.setSavepoint();
        try {
            upsert record;

            AuditEvent__c audit = buildAudit(
                String.isBlank(request.id) ? ACTION_CREATED : ACTION_UPDATED,
                String.isBlank(request.id) ? EVENT_ENTRY_CREATED : EVENT_ENTRY_UPDATED,
                'ScheduleEntry__c',
                record.Id,
                null
            );
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new ScheduleServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }
            return record;
        } catch (ScheduleServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    public static void deleteScheduleEntry(String entryId) {
        if (String.isBlank(entryId)) {
            throw badRequest('Eintrag-ID fehlt.');
        }
        List<ScheduleEntry__c> entries = [SELECT Id FROM ScheduleEntry__c WHERE Id = :entryId LIMIT 1];
        if (entries.isEmpty()) {
            throw notFound('Die Planzeile existiert nicht.');
        }
        Savepoint sp = Database.setSavepoint();
        try {
            delete entries[0];
            AuditEvent__c audit = buildAudit(ACTION_DELETED, EVENT_ENTRY_DELETED, 'ScheduleEntry__c', entryId, null);
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new ScheduleServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }
        } catch (ScheduleServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    public static void assertNoDuplicateCourseSchedule(WeeklySchedule__c schedule) {
        if (schedule == null || schedule.ScopeType__c != 'Course' || schedule.Status__c != 'Published') {
            return;
        }
        if (schedule.ProgramWeek__c == null) {
            return;
        }
        List<ProgramWeek__c> weeks = [
            SELECT Program__c
            FROM ProgramWeek__c
            WHERE Id = :schedule.ProgramWeek__c
            LIMIT 1
        ];
        if (weeks.isEmpty() || weeks[0].Program__c == null) {
            return;
        }
        Id programId = weeks[0].Program__c;
        List<WeeklySchedule__c> duplicates = [
            SELECT Id
            FROM WeeklySchedule__c
            WHERE Id != :schedule.Id
              AND Status__c = 'Published'
              AND ScopeType__c = 'Course'
              AND StartDate__c = :schedule.StartDate__c
              AND ProgramWeek__c IN (SELECT Id FROM ProgramWeek__c WHERE Program__c = :programId)
            LIMIT 1
        ];
        if (!duplicates.isEmpty()) {
            throw new ScheduleServiceException(409, CODE_DUPLICATE_COURSE_SCHEDULE, 'Fuer dieses Programm und diese Woche existiert bereits ein veroffentlichter Kurs-Wochenplan.');
        }
    }

    public static void assertCoachAccess(Id programWeekId) {
        Id profileId = ProgramCoachService.resolveCoachProfileId(UserInfo.getUserId());
        if (profileId == null) {
            return;
        }
        // Staff members also have a coach profile (Role__c = 'Staff') but are
        // not restricted to assigned programs; only real coaches are.
        if (ProgramCoachService.isStaffProfile(profileId)) {
            return;
        }
        if (programWeekId == null) {
            return;
        }
        List<ProgramWeek__c> weeks = [
            SELECT Program__c
            FROM ProgramWeek__c
            WHERE Id = :programWeekId
            LIMIT 1
        ];
        if (weeks.isEmpty() || weeks[0].Program__c == null) {
            return;
        }
        if (!ProgramCoachService.isAssignedToProgram(weeks[0].Program__c, UserInfo.getUserId())) {
            throw new ScheduleServiceException(403, CODE_NOT_ASSIGNED, 'Sie sind diesem Programm nicht zugeordnet.');
        }
    }

    public static void validateWeeklySchedule(WeeklySchedule__c schedule) {
        if (schedule == null) {
            throw badRequest('Wochenplan fehlt.');
        }
        if (schedule.StartDate__c == null) {
            throw badRequest('StartDate__c ist erforderlich.');
        }
        if (Math.mod(schedule.StartDate__c.daysBetween(Date.newInstance(1900, 1, 1)), 7) != 0) {
            throw new ScheduleServiceException(400, CODE_INVALID_WEEK_START, 'StartDate__c muss ein Montag sein.');
        }
        if (schedule.EndDate__c != null && schedule.EndDate__c < schedule.StartDate__c) {
            throw badRequest('Das Ende der Woche darf nicht vor dem Startdatum liegen.');
        }

        String scope = schedule.ScopeType__c;
        if (String.isBlank(scope)) {
            throw badRequest('ScopeType__c ist erforderlich.');
        }

        if (scope == 'Course') {
            if (schedule.ParticipantGroup__c != null || schedule.Participant__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else if (scope == 'Group') {
            if (schedule.ParticipantGroup__c == null || schedule.Participant__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else if (scope == 'Individual') {
            if (schedule.Participant__c == null || schedule.ParticipantGroup__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else {
            throw badRequest('Unbekannter ScopeType__c.');
        }

        if (schedule.ProgramWeek__c != null) {
            validateProgramWeekUnique(schedule);
        }
    }

    private static void validateProgramWeekUnique(WeeklySchedule__c schedule) {
        // K4: one ProgramWeek can carry several plan instances - the Course
        // default, one per ParticipantGroup and one per Participant. The
        // uniqueness key is therefore (ProgramWeek, scope, target), not just
        // ProgramWeek. The portal enforces the same shape at read time:
        // duplicate Course and Individual instances are a data error, while
        // several Group instances are expected.
        String scope = schedule.ScopeType__c;
        List<WeeklySchedule__c> duplicates;
        if (scope == 'Course') {
            duplicates = [
                SELECT Id
                FROM WeeklySchedule__c
                WHERE ProgramWeek__c = :schedule.ProgramWeek__c
                  AND ScopeType__c = 'Course'
                  AND Id != :schedule.Id
                LIMIT 1
            ];
        } else if (scope == 'Group') {
            duplicates = [
                SELECT Id
                FROM WeeklySchedule__c
                WHERE ProgramWeek__c = :schedule.ProgramWeek__c
                  AND ScopeType__c = 'Group'
                  AND ParticipantGroup__c = :schedule.ParticipantGroup__c
                  AND Id != :schedule.Id
                LIMIT 1
            ];
        } else if (scope == 'Individual') {
            duplicates = [
                SELECT Id
                FROM WeeklySchedule__c
                WHERE ProgramWeek__c = :schedule.ProgramWeek__c
                  AND ScopeType__c = 'Individual'
                  AND Participant__c = :schedule.Participant__c
                  AND Id != :schedule.Id
                LIMIT 1
            ];
        } else {
            return;
        }
        if (!duplicates.isEmpty()) {
            throw badRequest('Fuer diese Kurswoche und diesen Geltungsbereich existiert bereits ein Wochenplan.');
        }
    }

    public static void validateScheduleEntry(ScheduleEntry__c entry) {
        if (entry == null) {
            throw badRequest('Planzeile fehlt.');
        }

        if (String.isBlank(entry.EntryKind__c)) {
            throw badRequest('EntryKind__c ist erforderlich.');
        }
        if (String.isBlank(entry.Type__c)) {
            throw badRequest('Type__c ist erforderlich.');
        }
        if (String.isBlank(entry.DayOfWeek__c)) {
            throw badRequest('DayOfWeek__c ist erforderlich.');
        }
        if (String.isBlank(entry.TargetType__c)) {
            throw badRequest('TargetType__c ist erforderlich.');
        }

        Boolean hasWeekly = entry.WeeklySchedule__c != null;
        Boolean hasTemplate = entry.ScheduleTemplate__c != null;
        if (!hasWeekly && !hasTemplate) {
            throw new ScheduleServiceException(400, CODE_BAD_REQUEST, 'Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.');
        }
        if (hasWeekly && hasTemplate) {
            throw new ScheduleServiceException(400, CODE_BAD_REQUEST, 'Eine Planzeile muss entweder einem Wochenplan oder einer Vorlage zugeordnet sein.');
        }

        String target = entry.TargetType__c;
        if (target == 'Course') {
            if (entry.ParticipantGroup__c != null || entry.Participant__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else if (target == 'Group') {
            if (entry.ParticipantGroup__c == null || entry.Participant__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else if (target == 'Individual') {
            if (entry.Participant__c == null || entry.ParticipantGroup__c != null) {
                throw new ScheduleServiceException(400, CODE_ENTRY_TARGET_INVALID, 'Der Geltungsbereich passt nicht zur ausgewählten Teilnehmergruppe beziehungsweise zum ausgewählten Teilnehmer.');
            }
        } else {
            throw badRequest('Unbekannter TargetType__c.');
        }

        if (entry.StartTime__c != null && entry.EndTime__c == null) {
            throw new ScheduleServiceException(400, CODE_INVALID_INTERVAL, 'Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
        }
        if (entry.StartTime__c == null && entry.EndTime__c != null) {
            throw new ScheduleServiceException(400, CODE_INVALID_INTERVAL, 'Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
        }
        if (entry.StartTime__c != null && entry.EndTime__c != null) {
            if (entry.EndTime__c <= entry.StartTime__c) {
                throw new ScheduleServiceException(400, CODE_INVALID_INTERVAL, 'Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
            }
        }
        if (entry.DurationMinutes__c != null && entry.DurationMinutes__c < 1) {
            throw new ScheduleServiceException(400, CODE_INVALID_INTERVAL, 'Die Zeitangaben sind ungültig. Die Endzeit muss nach der Startzeit liegen und die Dauer muss positiv sein.');
        }
    }

    public static void computeDateForEntry(ScheduleEntry__c entry) {
        if (entry == null) {
            return;
        }
        if (entry.WeeklySchedule__c == null) {
            entry.Date__c = null;
            return;
        }
        if (String.isBlank(entry.DayOfWeek__c)) {
            return;
        }

        List<WeeklySchedule__c> schedules = [
            SELECT Id, StartDate__c
            FROM WeeklySchedule__c
            WHERE Id = :entry.WeeklySchedule__c
            LIMIT 1
        ];
        if (schedules.isEmpty() || schedules[0].StartDate__c == null) {
            return;
        }

        Integer offset = dayOffset(entry.DayOfWeek__c);
        entry.Date__c = schedules[0].StartDate__c.addDays(offset);
    }

    @TestVisible
    public static Time parseTime(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        List<String> parts = value.split(':');
        if (parts.size() < 2) {
            throw badRequest('Die Zeitangabe "' + value + '" ist nicht lesbar.');
        }
        Integer hour = Integer.valueOf(parts[0]);
        Integer minute = Integer.valueOf(parts[1]);
        Integer second = 0;
        Integer millisecond = 0;
        if (parts.size() >= 3) {
            String sec = parts[2];
            if (sec.contains('.')) {
                Integer dot = sec.indexOf('.');
                second = Integer.valueOf(sec.substring(0, dot));
                millisecond = Integer.valueOf(sec.substring(dot + 1));
            } else {
                second = Integer.valueOf(sec);
            }
        }
        return Time.newInstance(hour, minute, second, millisecond);
    }

    public static Integer dayOffset(String dayOfWeek) {
        if (String.isBlank(dayOfWeek)) {
            return 0;
        }
        if (dayOfWeek == 'Monday') {
            return 0;
        }
        if (dayOfWeek == 'Tuesday') {
            return 1;
        }
        if (dayOfWeek == 'Wednesday') {
            return 2;
        }
        if (dayOfWeek == 'Thursday') {
            return 3;
        }
        if (dayOfWeek == 'Friday') {
            return 4;
        }
        if (dayOfWeek == 'Saturday') {
            return 5;
        }
        if (dayOfWeek == 'Sunday') {
            return 6;
        }
        return 0;
    }

    public static AuditEvent__c buildAudit(String action, String eventType, String subjectType, Id subjectId, Id participantId) {
        String actorName = UserInfo.getFirstName();
        if (String.isBlank(actorName)) {
            actorName = UserInfo.getName();
        }

        return new AuditEvent__c(
            Action__c = action,
            ActorDisplayName__c = actorName,
            ActorId__c = UserInfo.getUserId(),
            ActorType__c = ACTOR_TYPE_STAFF,
            Domain__c = DOMAIN_SCHEDULE,
            EventType__c = eventType,
            OccurredAt__c = Datetime.now(),
            ParticipantId__c = participantId,
            Reason__c = eventType,
            SchemaVersion__c = 1,
            Sensitivity__c = SENSITIVITY_NORMAL,
            Source__c = SOURCE_WEB,
            SubjectId__c = String.valueOf(subjectId),
            SubjectType__c = subjectType,
            Visibility__c = VISIBILITY_STAFF
        );
    }

    private static ScheduleServiceException badRequest(String message) {
        return new ScheduleServiceException(400, CODE_BAD_REQUEST, message);
    }

    private static ScheduleServiceException notFound(String message) {
        return new ScheduleServiceException(404, CODE_SCHEDULE_NOT_FOUND, message);
    }
}
