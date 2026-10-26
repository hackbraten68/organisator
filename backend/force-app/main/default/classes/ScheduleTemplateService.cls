/**
 * Vorlagen-Service fuer ScheduleTemplate__c.
 *
 * apply() = Deep Copy: die Vorlagenzeilen werden als neue Planzeilen kopiert,
 * SourceTemplateEntry__c verweist auf die Herkunft, IsCustomized__c = false.
 * AppliedTemplate__c ist nur Provenienz, keine Verbindung.
 */
global with sharing class ScheduleTemplateService {
    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND';
    public static final String CODE_SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    public static final String DOMAIN_SCHEDULE = 'schedule';
    public static final String SOURCE_WEB = 'web';
    public static final String ACTOR_TYPE_STAFF = 'staff';
    public static final String VISIBILITY_STAFF = 'staff';
    public static final String SENSITIVITY_NORMAL = 'normal';
    public static final String ACTION_CREATED = 'created';
    public static final String EVENT_TEMPLATE_APPLIED = 'schedule.template_applied';

    global class ApplyRequest {
        global String templateId;
        global String programWeekId;
        global String startDate;
        global String name;
        global String scopeType;
        global String participantGroupId;
        global String participantId;
        global String mergeMode;
    }

    public static WeeklySchedule__c applyTemplate(ApplyRequest request) {
        if (request == null || String.isBlank(request.templateId)) {
            throw badRequest('templateId ist erforderlich.');
        }
        if (String.isBlank(request.programWeekId)) {
            throw badRequest('programWeekId ist erforderlich.');
        }
        if (String.isBlank(request.startDate)) {
            throw badRequest('startDate ist erforderlich.');
        }

        List<ScheduleTemplate__c> templates = [
            SELECT Id, Name, Status__c, Program__c, Module__c, ProgramWeek__c, Description__c
            FROM ScheduleTemplate__c
            WHERE Id = :request.templateId
            LIMIT 1
        ];
        if (templates.isEmpty()) {
            throw notFound('Die Vorlage existiert nicht.');
        }
        ScheduleTemplate__c template = templates[0];

        List<ProgramWeek__c> weeks = [
            SELECT Id, Program__c, Module__c
            FROM ProgramWeek__c
            WHERE Id = :request.programWeekId
            LIMIT 1
        ];
        if (weeks.isEmpty()) {
            throw notFound('Die Kurswoche existiert nicht.');
        }

        if (template.Status__c != 'Active') {
            throw badRequest('Die Vorlage ist nicht aktiv.');
        }
        if (template.ProgramWeek__c != null && template.ProgramWeek__c != request.programWeekId) {
            throw badRequest('Die Vorlage passt nicht zur ausgewaehlten Kurswoche.');
        }
        if (template.ProgramWeek__c == null && template.Program__c != null
                && template.Program__c != weeks[0].Program__c) {
            throw badRequest('Die Vorlage passt nicht zum ausgewaehlten Programm.');
        }

        String scope = String.isBlank(request.scopeType) ? 'Course' : request.scopeType;
        if (scope != 'Course' && scope != 'Group' && scope != 'Individual') {
            throw badRequest('Unbekannter Geltungsbereich.');
        }
        if (scope == 'Group' && String.isBlank(request.participantGroupId)) {
            throw badRequest('Fuer einen Gruppenplan ist eine Teilnehmergruppe erforderlich.');
        }
        if (scope == 'Individual' && String.isBlank(request.participantId)) {
            throw badRequest('Fuer einen Individualplan ist ein Teilnehmer erforderlich.');
        }
        if (scope == 'Course' && (String.isNotBlank(request.participantGroupId) || String.isNotBlank(request.participantId))) {
            throw badRequest('Ein Kursplan darf keine Teilnehmer- oder Gruppenzuordnung haben.');
        }

        Date startDate = Date.valueOf(request.startDate);

        // Duplicate check for Individual/Group scopes
        if (scope == 'Individual') {
            List<WeeklySchedule__c> existing = [
                SELECT Id FROM WeeklySchedule__c
                WHERE ProgramWeek__c = :request.programWeekId
                  AND ScopeType__c = 'Individual'
                  AND Participant__c = :request.participantId
                  AND StartDate__c = :startDate
                LIMIT 2
            ];
            if (!existing.isEmpty()) {
                throw new ScheduleTemplateServiceException(409, ScheduleService.CODE_DUPLICATE_INDIVIDUAL_SCHEDULE,
                    'Fuer diesen Teilnehmer, diese Kurswoche und dieses Startdatum existiert bereits ein individueller Wochenplan.');
            }
        } else if (scope == 'Group') {
            List<WeeklySchedule__c> existing = [
                SELECT Id FROM WeeklySchedule__c
                WHERE ProgramWeek__c = :request.programWeekId
                  AND ScopeType__c = 'Group'
                  AND ParticipantGroup__c = :request.participantGroupId
                  AND StartDate__c = :startDate
                LIMIT 2
            ];
            if (!existing.isEmpty()) {
                throw new ScheduleTemplateServiceException(409, ScheduleService.CODE_DUPLICATE_INDIVIDUAL_SCHEDULE,
                    'Fuer diese Gruppe, diese Kurswoche und dieses Startdatum existiert bereits ein Gruppenwochenplan.');
            }
        }

        String scheduleName = String.isBlank(request.name) ? template.Name : request.name;

        WeeklySchedule__c schedule = new WeeklySchedule__c(
            Name = scheduleName,
            ProgramWeek__c = request.programWeekId,
            ScopeType__c = scope,
            ParticipantGroup__c = scope == 'Group' ? request.participantGroupId : null,
            Participant__c = scope == 'Individual' ? request.participantId : null,
            StartDate__c = startDate,
            Status__c = 'Draft',
            AppliedTemplate__c = template.Id,
            TemplateAppliedAt__c = Datetime.now(),
            MergeMode__c = String.isBlank(request.mergeMode) ? 'Overlay' : request.mergeMode
        );

        Savepoint sp = Database.setSavepoint();
        try {
            insert schedule;

            List<ScheduleEntry__c> templateEntries = [
                SELECT Id, Name, Description__c, EntryKind__c, Type__c, IsRequired__c,
                       DayOfWeek__c, StartTime__c, EndTime__c, DurationMinutes__c,
                       TargetType__c, ParticipantGroup__c, Participant__c, Coach_Profile__c,
                       Location__c, MeetingLink__c, Order__c, DeviationReason__c, Notes__c
                FROM ScheduleEntry__c
                WHERE ScheduleTemplate__c = :template.Id
            ];

            // For Group/Individual scopes, template entries must be Course-targeted
            // (generic content). Context-specific entries are not portable.
            if (scope != 'Course') {
                for (ScheduleEntry__c src : templateEntries) {
                    if (src.TargetType__c != 'Course') {
                        throw badRequest('Die Vorlage enthaelt zielgruppenspezifische Eintraege und kann nicht auf diesen Geltungsbereich angewendet werden.');
                    }
                }
            }

            List<ScheduleEntry__c> copies = new List<ScheduleEntry__c>();
            for (ScheduleEntry__c src : templateEntries) {
                ScheduleEntry__c copy = new ScheduleEntry__c(
                    Name = src.Name,
                    WeeklySchedule__c = schedule.Id,
                    Description__c = src.Description__c,
                    EntryKind__c = src.EntryKind__c,
                    Type__c = src.Type__c,
                    IsRequired__c = src.IsRequired__c,
                    DayOfWeek__c = src.DayOfWeek__c,
                    StartTime__c = src.StartTime__c,
                    EndTime__c = src.EndTime__c,
                    DurationMinutes__c = src.DurationMinutes__c,
                    TargetType__c = src.TargetType__c,
                    ParticipantGroup__c = src.ParticipantGroup__c,
                    Participant__c = src.Participant__c,
                    Coach_Profile__c = src.Coach_Profile__c,
                    Location__c = src.Location__c,
                    MeetingLink__c = src.MeetingLink__c,
                    Order__c = src.Order__c,
                    DeviationReason__c = src.DeviationReason__c,
                    Notes__c = src.Notes__c,
                    SourceTemplateEntry__c = src.Id,
                    IsCustomized__c = false
                );
                copies.add(copy);
            }
            if (!copies.isEmpty()) {
                for (ScheduleEntry__c copy : copies) {
                    ScheduleService.validateScheduleEntry(copy);
                }
                insert copies;
            }

            AuditEvent__c audit = buildAudit(EVENT_TEMPLATE_APPLIED, 'ScheduleEntry__c', schedule.Id, null);
            Database.SaveResult auditResult = Database.insert(audit, false);
            if (!auditResult.isSuccess()) {
                Database.rollback(sp);
                throw new ScheduleTemplateServiceException(500, CODE_AUDIT_FAILED, 'Das Audit-Event konnte nicht geschrieben werden; die Aenderung wurde zurueckgerollt.');
            }

            return schedule;
        } catch (ScheduleTemplateServiceException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleTemplateServiceException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    public static List<ScheduleTemplate__c> listTemplates() {
        return [
            SELECT Id, Name, Status__c, Program__c, Module__c, ProgramWeek__c, Description__c
            FROM ScheduleTemplate__c
            WHERE Status__c = 'Active'
            ORDER BY Name
        ];
    }

    public static List<ScheduleEntry__c> preview(Id templateId) {
        if (templateId == null) {
            throw badRequest('templateId ist erforderlich.');
        }
        return [
            SELECT Id, Name, Description__c, EntryKind__c, Type__c, IsRequired__c,
                   DayOfWeek__c, StartTime__c, EndTime__c, DurationMinutes__c,
                   TargetType__c, ParticipantGroup__c, Participant__c, Coach_Profile__c,
                   Location__c, MeetingLink__c, Order__c, DeviationReason__c, Notes__c
            FROM ScheduleEntry__c
            WHERE ScheduleTemplate__c = :templateId
            ORDER BY DayOfWeek__c, Order__c
        ];
    }

    private static AuditEvent__c buildAudit(String eventType, String subjectType, Id subjectId, Id participantId) {
        String actorName = UserInfo.getFirstName();
        if (String.isBlank(actorName)) {
            actorName = UserInfo.getName();
        }
        return new AuditEvent__c(
            Action__c = ACTION_CREATED,
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

    private static ScheduleTemplateServiceException badRequest(String message) {
        return new ScheduleTemplateServiceException(400, CODE_BAD_REQUEST, message);
    }

    private static ScheduleTemplateServiceException notFound(String message) {
        return new ScheduleTemplateServiceException(404, CODE_TEMPLATE_NOT_FOUND, message);
    }
}
