/**
 * REST-Endpunkt fuer den Backoffice-Wochenplan-Editor.
 *
 * GET  /services/apexrest/schedule-editor?action=list|get|options
 * POST /services/apexrest/schedule-editor  { "action": "...", ... }
 *
 * Autorisierung: Staff sieht alles, zugeordnete Coaches nur ihre Programme.
 * Schreiboperationen laufen ueber die bestehenden Services und pruefen den
 * Coach-Zugriff serverseitig.
 */
@RestResource(urlMapping='/schedule-editor/*')
global with sharing class ScheduleEditor {

    global class EditorResponse {
        global Boolean success;
        global String code;
        global String message;
        global List<ProgramView> programs;
        global List<WeekView> weeks;
        global PlanView plan;
        global List<EntryView> entries;
        global OptionsView options;
        global LearningPathOptionsView learningPathOptions;
    }

    global class LearningPathOptionsView {
        global String learningPathId;
        global String learningPathTitle;
        global String participantId;
        global String participantName;
        global String programId;
        global String programName;
        global String moduleId;
        global String moduleName;
        global List<ProgramWeekView> programWeeks;
        global List<TemplateView> templates;
        global String resolutionStatus;
    }

    global class ProgramWeekView {
        global String id;
        global String name;
        global Integer weekNumber;
    }

    global class MutationResponse {
        global Boolean success;
        global String code;
        global String message;
        global String id;
        global String status;
    }

    global class ProgramView {
        global String id;
        global String name;
    }

    global class WeekView {
        global String programWeekId;
        global Integer weekNumber;
        global String name;
        global String moduleName;
        global List<PlanView> plans;
    }

    global class PlanView {
        global String id;
        global String name;
        global String programWeekId;
        global String scopeType;
        global String status;
        global String startDate;
        global String endDate;
        global String participantGroupId;
        global String participantGroupName;
        global String participantId;
        global String participantName;
        global String appliedTemplateId;
        global String templateName;
        global Integer entryCount;
        global String notes;
        global String deviationReason;
        global String publishedAt;
        global String publishedBy;
        global String coachName;
    }

    global class EntryView {
        global String id;
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
        global String coachName;
        global String location;
        global String meetingLink;
        global Integer order;
        global String deviationReason;
        global String notes;
        global Boolean isCustomized;
    }

    global class CoachView {
        global String id;
        global String name;
        global String role;
    }

    global class GroupView {
        global String id;
        global String name;
    }

    global class ParticipantView {
        global String id;
        global String name;
    }

    global class TemplateView {
        global String id;
        global String name;
        global String programId;
        global String programWeekId;
        global Integer entryCount;
        global String status;
    }

    global class OptionsView {
        global List<CoachView> coaches;
        global List<GroupView> groups;
        global List<ParticipantView> participants;
        global List<TemplateView> templates;
        global List<String> entryKinds;
        global List<String> types;
        global List<String> days;
        global List<String> locations;
        global List<String> targetTypes;
    }

    global class SavePlanInput {
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

    global class DuplicateTemplateInput {
        global String templateId;
        global String name;
    }

    global class SaveAsTemplateInput {
        global String weeklyScheduleId;
        global String name;
        global String description;
    }

    global class CreateIndividualPlanInput {
        global String learningPathId;
        global String templateId;
        global String programWeekId;
        global String startDate;
        global String name;
    }

    global class SaveEntryInput {
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

    @HttpGet
    global static EditorResponse get() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        EditorResponse resp = new EditorResponse();
        resp.success = true;
        try {
            String action = (RestContext.request == null || RestContext.request.params == null)
                ? 'list' : RestContext.request.params.get('action');
            if (String.isBlank(action)) {
                action = 'list';
            }
            if (action == 'list') {
                String programId = RestContext.request == null ? null : RestContext.request.params.get('programId');
                listBoard(resp, programId);
            } else if (action == 'get') {
                String planId = RestContext.request == null ? null : RestContext.request.params.get('planId');
                getPlan(resp, planId);
            } else if (action == 'options') {
                String programId = RestContext.request == null ? null : RestContext.request.params.get('programId');
                String planId = RestContext.request == null ? null : RestContext.request.params.get('planId');
                getOptions(resp, programId, planId);
            } else if (action == 'templates') {
                String programId = RestContext.request == null ? null : RestContext.request.params.get('programId');
                getTemplates(resp, programId);
            } else if (action == 'getTemplate') {
                String templateId = RestContext.request == null ? null : RestContext.request.params.get('templateId');
                getTemplate(resp, templateId);
            } else if (action == 'learningPathOptions') {
                String learningPathId = RestContext.request == null ? null : RestContext.request.params.get('learningPathId');
                getLearningPathOptions(resp, learningPathId);
            } else {
                throw badRequest('Unbekannte Aktion.');
            }
        } catch (ScheduleServiceException e) {
            fail(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (SchedulePublishServiceException e) {
            fail(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (ScheduleTemplateServiceException e) {
            fail(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'ScheduleEditor failed: ' + e.getTypeName() + ': ' + e.getMessage());
            fail(resp, 500, 'INTERNAL_ERROR', 'Der Wochenplan-Editor konnte nicht geladen werden.');
        }
        return resp;
    }

    @HttpPost
    global static MutationResponse post() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        MutationResponse resp = new MutationResponse();
        resp.success = true;
        try {
            String body = (RestContext.request == null || RestContext.request.requestBody == null)
                ? null : RestContext.request.requestBody.toString();
            if (String.isBlank(body)) {
                throw badRequest('Der Request-Body fehlt.');
            }
            Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(body);
            String action = (String) payload.get('action');
            if (String.isBlank(action)) {
                throw badRequest('action ist erforderlich.');
            }
            if (action == 'savePlan') {
                savePlan(resp, payload);
            } else if (action == 'saveEntry') {
                saveEntry(resp, payload);
            } else if (action == 'deleteEntry') {
                deleteEntry(resp, payload);
            } else if (action == 'deletePlan') {
                deletePlan(resp, payload);
            } else if (action == 'publish') {
                publishPlan(resp, payload);
            } else if (action == 'unpublish') {
                unpublishPlan(resp, payload);
            } else if (action == 'applyTemplate') {
                applyTemplate(resp, payload);
            } else if (action == 'createIndividualPlanFromLearningPath') {
                createIndividualPlanFromLearningPath(resp, payload);
            } else if (action == 'saveAsTemplate') {
                saveAsTemplate(resp, payload);
            } else if (action == 'deleteTemplate') {
                deleteTemplate(resp, payload);
            } else if (action == 'duplicateTemplate') {
                duplicateTemplate(resp, payload);
            } else {
                throw badRequest('Unbekannte Aktion.');
            }
        } catch (ScheduleServiceException e) {
            failMutation(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (SchedulePublishServiceException e) {
            failMutation(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (ScheduleTemplateServiceException e) {
            failMutation(resp, e.getStatusCode(), e.getCode(), e.getMessage());
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'ScheduleEditor POST failed: ' + e.getTypeName() + ': ' + e.getMessage());
            failMutation(resp, 500, 'INTERNAL_ERROR', 'Die Aenderung konnte nicht gespeichert werden.');
        }
        return resp;
    }

    private static void fail(EditorResponse resp, Integer status, String code, String message) {
        resp.success = false;
        resp.code = code;
        resp.message = message;
        RestContext.response.statusCode = status;
    }

    private static void failMutation(MutationResponse resp, Integer status, String code, String message) {
        resp.success = false;
        resp.code = code;
        resp.message = message;
        RestContext.response.statusCode = status;
    }

    private static ScheduleServiceException badRequest(String message) {
        return new ScheduleServiceException(400, ScheduleService.CODE_BAD_REQUEST, message);
    }

    private static ScheduleServiceException notFound(String message) {
        return new ScheduleServiceException(404, ScheduleService.CODE_SCHEDULE_NOT_FOUND, message);
    }

    private static void assertProgramAccess(String programId) {
        if (String.isBlank(programId)) {
            return;
        }
        if (ProgramCoachService.isStaffUser(UserInfo.getUserId())) {
            return;
        }
        if (!ProgramCoachService.isAssignedToProgram(programId, UserInfo.getUserId())) {
            throw new ScheduleServiceException(403, ScheduleService.CODE_NOT_ASSIGNED,
                'Sie sind diesem Programm nicht zugeordnet.');
        }
    }

    private static void listBoard(EditorResponse resp, String programId) {
        List<ProgramView> programs = new List<ProgramView>();
        if (ProgramCoachService.isStaffUser(UserInfo.getUserId())) {
            for (Program__c program : [SELECT Id, Name FROM Program__c ORDER BY Name]) {
                ProgramView pv = new ProgramView();
                pv.id = program.Id;
                pv.name = program.Name;
                programs.add(pv);
            }
        } else {
            Id profileId = ProgramCoachService.resolveCoachProfileId(UserInfo.getUserId());
            if (profileId != null) {
                for (ProgramCoach__c pc : [
                    SELECT Program__c, Program__r.Name
                    FROM ProgramCoach__c
                    WHERE Coach_Profile__c = :profileId
                ]) {
                    if (pc.Program__c != null) {
                        ProgramView pv = new ProgramView();
                        pv.id = pc.Program__c;
                        pv.name = pc.Program__r.Name;
                        programs.add(pv);
                    }
                }
            }
        }
        resp.programs = programs;

        if (String.isBlank(programId)) {
            resp.weeks = new List<WeekView>();
            return;
        }
        assertProgramAccess(programId);

        List<ProgramWeek__c> weeks = [
            SELECT Id, Name, Number__c, Module__c, Module__r.Name
            FROM ProgramWeek__c
            WHERE Program__c = :programId
            ORDER BY Number__c
        ];
        List<Id> weekIds = new List<Id>();
        for (ProgramWeek__c week : weeks) {
            weekIds.add(week.Id);
        }

        Map<Id, List<WeeklySchedule__c>> plansByWeek = new Map<Id, List<WeeklySchedule__c>>();
        if (!weekIds.isEmpty()) {
            for (WeeklySchedule__c plan : [
                SELECT Id, Name, ProgramWeek__c, ScopeType__c, Status__c, StartDate__c, EndDate__c,
                       ParticipantGroup__c, ParticipantGroup__r.Name, Participant__c, Participant__r.Name,
                       AppliedTemplate__c, AppliedTemplate__r.Name, Notes__c, DeviationReason__c,
                       PublishedAt__c, PublishedBy__c, PublishedBy__r.Name
                FROM WeeklySchedule__c
                WHERE ProgramWeek__c IN :weekIds
            ]) {
                if (!plansByWeek.containsKey(plan.ProgramWeek__c)) {
                    plansByWeek.put(plan.ProgramWeek__c, new List<WeeklySchedule__c>());
                }
                plansByWeek.get(plan.ProgramWeek__c).add(plan);
            }
        }

        Map<Id, Integer> entryCountByPlan = new Map<Id, Integer>();
        if (!weekIds.isEmpty()) {
            for (AggregateResult ar : [
                SELECT WeeklySchedule__c ws, COUNT(Id) c
                FROM ScheduleEntry__c
                WHERE WeeklySchedule__c IN (SELECT Id FROM WeeklySchedule__c WHERE ProgramWeek__c IN :weekIds)
                GROUP BY WeeklySchedule__c
            ]) {
                entryCountByPlan.put((Id) ar.get('ws'), (Integer) ar.get('c'));
            }
        }

        List<WeekView> weekViews = new List<WeekView>();
        for (ProgramWeek__c week : weeks) {
            WeekView wv = new WeekView();
            wv.programWeekId = week.Id;
            wv.weekNumber = (Integer) week.Number__c;
            wv.name = week.Name;
            wv.moduleName = week.Module__r == null ? null : week.Module__r.Name;
            wv.plans = new List<PlanView>();
            List<WeeklySchedule__c> plans = plansByWeek.get(week.Id);
            if (plans != null) {
                for (WeeklySchedule__c plan : plans) {
                    wv.plans.add(mapPlan(plan, entryCountByPlan.get(plan.Id)));
                }
            }
            weekViews.add(wv);
        }
        resp.weeks = weekViews;
    }

    private static void getPlan(EditorResponse resp, String planId) {
        if (String.isBlank(planId)) {
            throw badRequest('planId ist erforderlich.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, Name, ProgramWeek__c, ProgramWeek__r.Program__c, ScopeType__c, Status__c,
                   StartDate__c, EndDate__c, ParticipantGroup__c, ParticipantGroup__r.Name,
                   Participant__c, Participant__r.Name, AppliedTemplate__c, AppliedTemplate__r.Name,
                   Notes__c, DeviationReason__c, PublishedAt__c, PublishedBy__c, PublishedBy__r.Name
            FROM WeeklySchedule__c
            WHERE Id = :planId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        WeeklySchedule__c plan = rows[0];
        assertProgramAccess(plan.ProgramWeek__r == null ? null : plan.ProgramWeek__r.Program__c);

        resp.plan = mapPlan(plan, null);

        List<EntryView> entries = new List<EntryView>();
        for (ScheduleEntry__c entry : [
            SELECT Id, Name, Description__c, EntryKind__c, Type__c, IsRequired__c, DayOfWeek__c,
                   StartTime__c, EndTime__c, DurationMinutes__c, TargetType__c, ParticipantGroup__c,
                   Participant__c, Coach_Profile__c, Coach_Profile__r.Name, Location__c, MeetingLink__c,
                   Order__c, DeviationReason__c, Notes__c, IsCustomized__c
            FROM ScheduleEntry__c
            WHERE WeeklySchedule__c = :planId
            ORDER BY DayOfWeek__c, Order__c, StartTime__c
        ]) {
            entries.add(mapEntry(entry));
        }
        resp.entries = entries;
    }

    private static void getOptions(EditorResponse resp, String programId, String planId) {
        if (String.isBlank(programId) && String.isNotBlank(planId)) {
            List<WeeklySchedule__c> plans = [
                SELECT ProgramWeek__r.Program__c FROM WeeklySchedule__c WHERE Id = :planId LIMIT 1
            ];
            if (!plans.isEmpty() && plans[0].ProgramWeek__r != null) {
                programId = plans[0].ProgramWeek__r.Program__c;
            }
        }

        if (String.isNotBlank(programId)) {
            assertProgramAccess(programId);
        }

        OptionsView ov = new OptionsView();
        List<CoachView> coaches = new List<CoachView>();
        for (Coach_Profile__c coach : [SELECT Id, Name, Role__c FROM Coach_Profile__c ORDER BY Name]) {
            CoachView cv = new CoachView();
            cv.id = coach.Id;
            cv.name = coach.Name;
            cv.role = coach.Role__c;
            coaches.add(cv);
        }
        ov.coaches = coaches;

        List<GroupView> groups = new List<GroupView>();
        List<ParticipantView> participants = new List<ParticipantView>();
        Set<Id> weekIds = new Set<Id>();
        if (String.isNotBlank(programId)) {
            for (ParticipantGroup__c grp : [
                SELECT Id, Name FROM ParticipantGroup__c WHERE Program__c = :programId ORDER BY Name
            ]) {
                GroupView gv = new GroupView();
                gv.id = grp.Id;
                gv.name = grp.Name;
                groups.add(gv);
            }
            for (Participant__c participant : [
                SELECT Id, Name FROM Participant__c WHERE Program__c = :programId ORDER BY Name
            ]) {
                ParticipantView pv = new ParticipantView();
                pv.id = participant.Id;
                pv.name = participant.Name;
                participants.add(pv);
            }
            for (ProgramWeek__c week : [SELECT Id FROM ProgramWeek__c WHERE Program__c = :programId]) {
                weekIds.add(week.Id);
            }
        }
        ov.groups = groups;
        ov.participants = participants;

        List<TemplateView> templates = new List<TemplateView>();
        for (ScheduleTemplate__c template : [
            SELECT Id, Name, Program__c, ProgramWeek__c, Status__c
            FROM ScheduleTemplate__c
            WHERE Status__c = 'Active'
              AND (Program__c = :programId OR ProgramWeek__c IN :weekIds)
            ORDER BY Name
        ]) {
            TemplateView tv = new TemplateView();
            tv.id = template.Id;
            tv.name = template.Name;
            tv.programId = template.Program__c;
            tv.programWeekId = template.ProgramWeek__c;
            tv.status = template.Status__c;
            tv.entryCount = [SELECT COUNT() FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :template.Id];
            templates.add(tv);
        }
        ov.templates = templates;

        ov.entryKinds = picklistValues('ScheduleEntry__c', 'EntryKind__c');
        ov.types = picklistValues('ScheduleEntry__c', 'Type__c');
        ov.days = picklistValues('ScheduleEntry__c', 'DayOfWeek__c');
        ov.locations = picklistValues('ScheduleEntry__c', 'Location__c');
        ov.targetTypes = picklistValues('ScheduleEntry__c', 'TargetType__c');

        resp.options = ov;
    }

    private static void getLearningPathOptions(EditorResponse resp, String learningPathId) {
        if (String.isBlank(learningPathId)) {
            throw badRequest('learningPathId ist erforderlich.');
        }
        List<Learning_Path__c> paths = [
            SELECT Id, Title__c, Participant__c, Participant__r.Name, Participant__r.Program__c,
                   Participant__r.Program__r.Name, Module__c, Module__r.Name
            FROM Learning_Path__c
            WHERE Id = :learningPathId
            LIMIT 1
        ];
        if (paths.isEmpty()) {
            throw notFound('Der Lernpfadeintrag existiert nicht.');
        }
        Learning_Path__c lp = paths[0];

        LearningPathOptionsView lpo = new LearningPathOptionsView();
        lpo.learningPathId = lp.Id;
        lpo.learningPathTitle = lp.Title__c;
        lpo.participantId = lp.Participant__c;
        lpo.participantName = lp.Participant__r == null ? null : lp.Participant__r.Name;
        lpo.programId = lp.Participant__r == null ? null : lp.Participant__r.Program__c;
        lpo.programName = lp.Participant__r == null || lp.Participant__r.Program__r == null ? null : lp.Participant__r.Program__r.Name;
        lpo.moduleId = lp.Module__c;
        lpo.moduleName = lp.Module__r == null ? null : lp.Module__r.Name;

        // Resolution status
        if (lp.Participant__c == null) {
            lpo.resolutionStatus = 'NO_PARTICIPANT';
        } else if (lp.Participant__r.Program__c == null) {
            lpo.resolutionStatus = 'NO_PROGRAM';
        } else if (lp.Module__c == null) {
            lpo.resolutionStatus = 'NO_MODULE';
        } else {
            lpo.resolutionStatus = 'OK';
        }

        // Program weeks for the module
        lpo.programWeeks = new List<ProgramWeekView>();
        if (lpo.programId != null && lp.Module__c != null) {
            for (ProgramWeek__c pw : [
                SELECT Id, Name, Number__c
                FROM ProgramWeek__c
                WHERE Program__c = :lpo.programId
                  AND Module__c = :lp.Module__c
                ORDER BY Number__c
            ]) {
                ProgramWeekView pwv = new ProgramWeekView();
                pwv.id = pw.Id;
                pwv.name = pw.Name;
                pwv.weekNumber = (Integer) pw.Number__c;
                lpo.programWeeks.add(pwv);
            }
        }

        // Templates: active, matching program or programWeek
        Set<Id> weekIds = new Set<Id>();
        for (ProgramWeekView pwv : lpo.programWeeks) {
            weekIds.add(pwv.id);
        }
        lpo.templates = new List<TemplateView>();
        if (lpo.programId != null) {
            for (ScheduleTemplate__c t : [
                SELECT Id, Name, Program__c, ProgramWeek__c, Status__c
                FROM ScheduleTemplate__c
                WHERE Status__c = 'Active'
                  AND (Program__c = :lpo.programId OR ProgramWeek__c IN :weekIds)
                ORDER BY Name
            ]) {
                // If template has a Module__c, it must match the learning path module
                if (t.ProgramWeek__c != null && !weekIds.contains(t.ProgramWeek__c)) {
                    continue;
                }
                TemplateView tv = new TemplateView();
                tv.id = t.Id;
                tv.name = t.Name;
                tv.programId = t.Program__c;
                tv.programWeekId = t.ProgramWeek__c;
                tv.status = t.Status__c;
                tv.entryCount = [SELECT COUNT() FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :t.Id];
                lpo.templates.add(tv);
            }
        }

        resp.learningPathOptions = lpo;
    }

    private static void createIndividualPlanFromLearningPath(MutationResponse resp, Map<String, Object> payload) {
        CreateIndividualPlanInput input = (CreateIndividualPlanInput) JSON.deserialize(JSON.serialize(payload), CreateIndividualPlanInput.class);

        if (String.isBlank(input.learningPathId)) {
            throw badRequest('learningPathId ist erforderlich.');
        }
        if (String.isBlank(input.templateId)) {
            throw badRequest('templateId ist erforderlich.');
        }
        if (String.isBlank(input.startDate)) {
            throw badRequest('startDate ist erforderlich.');
        }

        // Load learning path
        List<Learning_Path__c> paths = [
            SELECT Id, Title__c, Participant__c, Participant__r.Program__c, Module__c
            FROM Learning_Path__c
            WHERE Id = :input.learningPathId
            LIMIT 1
        ];
        if (paths.isEmpty()) {
            throw notFound('Der Lernpfadeintrag existiert nicht.');
        }
        Learning_Path__c lp = paths[0];

        if (lp.Participant__c == null) {
            throw badRequest('Der Lernpfadeintrag hat keinen Teilnehmer.');
        }
        if (lp.Participant__r.Program__c == null) {
            throw badRequest('Der Teilnehmer hat kein Programm.');
        }
        if (lp.Module__c == null) {
            throw badRequest('Der Lernpfadeintrag hat kein Modul.');
        }

        // Determine programWeekId
        String programWeekId = input.programWeekId;
        if (String.isBlank(programWeekId)) {
            List<ProgramWeek__c> weeks = [
                SELECT Id FROM ProgramWeek__c
                WHERE Program__c = :lp.Participant__r.Program__c
                  AND Module__c = :lp.Module__c
                LIMIT 2
            ];
            if (weeks.isEmpty()) {
                throw notFound('Keine Kurswoche fuer das Modul gefunden.');
            }
            if (weeks.size() > 1) {
                throw badRequest('Mehrere Kurswochen fuer das Modul gefunden. Bitte programWeekId angeben.');
            }
            programWeekId = weeks[0].Id;
        }

        // Validate programWeek belongs to participant's program and module
        List<ProgramWeek__c> pwCheck = [
            SELECT Id, Program__c, Module__c FROM ProgramWeek__c WHERE Id = :programWeekId LIMIT 1
        ];
        if (pwCheck.isEmpty()) {
            throw notFound('Die Kurswoche existiert nicht.');
        }
        if (pwCheck[0].Program__c != lp.Participant__r.Program__c) {
            throw badRequest('Die Kurswoche gehoert nicht zum Teilnehmerprogramm.');
        }
        if (pwCheck[0].Module__c != lp.Module__c) {
            throw badRequest('Die Kurswoche gehoert nicht zum Modul des Lernpfadeintrags.');
        }

        // Coach gate
        ScheduleService.assertCoachAccess(programWeekId);

        // Validate template
        List<ScheduleTemplate__c> templates = [
            SELECT Id, Status__c, Program__c, ProgramWeek__c, Module__c
            FROM ScheduleTemplate__c
            WHERE Id = :input.templateId
            LIMIT 1
        ];
        if (templates.isEmpty()) {
            throw notFound('Die Vorlage existiert nicht.');
        }
        ScheduleTemplate__c template = templates[0];
        if (template.Status__c != 'Active') {
            throw badRequest('Die Vorlage ist nicht aktiv.');
        }
        if (template.ProgramWeek__c != null && template.ProgramWeek__c != programWeekId) {
            throw badRequest('Die Vorlage passt nicht zur ausgewaehlten Kurswoche.');
        }
        if (template.ProgramWeek__c == null && template.Program__c != null
                && template.Program__c != lp.Participant__r.Program__c) {
            throw badRequest('Die Vorlage passt nicht zum ausgewaehlten Programm.');
        }
        if (template.Module__c != null && template.Module__c != lp.Module__c) {
            throw badRequest('Die Vorlage passt nicht zum Modul des Lernpfadeintrags.');
        }

        // Validate start date is Monday
        Date startDate;
        try {
            startDate = Date.valueOf(input.startDate);
        } catch (Exception e) {
            throw badRequest('Ungueltiges Startdatum.');
        }
        if (Math.mod(startDate.daysBetween(Date.newInstance(1900, 1, 1)), 7) != 0) {
            throw badRequest('Das Startdatum muss ein Montag sein.');
        }

        // Duplicate check
        List<WeeklySchedule__c> existing = [
            SELECT Id, Status__c FROM WeeklySchedule__c
            WHERE ProgramWeek__c = :programWeekId
              AND ScopeType__c = 'Individual'
              AND Participant__c = :lp.Participant__c
              AND StartDate__c = :startDate
            LIMIT 2
        ];
        if (!existing.isEmpty()) {
            if (existing.size() > 1) {
                throw new ScheduleServiceException(409, ScheduleService.CODE_DUPLICATE_INDIVIDUAL_SCHEDULE,
                    'Mehrere individuelle Wochenplaene fuer diesen Teilnehmer, diese Kurswoche und dieses Startdatum gefunden.');
            }
            WeeklySchedule__c found = existing[0];
            resp.id = found.Id;
            resp.status = found.Status__c;
            resp.code = 'EXISTING_SCHEDULE_OPENED';
            resp.message = 'Ein vorhandener Plan wurde geoeffnet.';
            resp.success = true;
            return;
        }

        // Apply template with Individual scope
        ScheduleTemplateService.ApplyRequest applyReq = new ScheduleTemplateService.ApplyRequest();
        applyReq.templateId = input.templateId;
        applyReq.programWeekId = programWeekId;
        applyReq.startDate = input.startDate;
        applyReq.name = String.isBlank(input.name) ? null : input.name;
        applyReq.scopeType = 'Individual';
        applyReq.participantId = lp.Participant__c;
        applyReq.mergeMode = 'Replace';

        WeeklySchedule__c created = ScheduleTemplateService.applyTemplate(applyReq);
        resp.id = created.Id;
        resp.status = created.Status__c;
        resp.success = true;
    }

    private static void getTemplate(EditorResponse resp, String templateId) {
        if (String.isBlank(templateId)) {
            throw badRequest('templateId ist erforderlich.');
        }
        List<ScheduleTemplate__c> templates = [
            SELECT Id, Name, Program__c, ProgramWeek__c, Status__c, Description__c
            FROM ScheduleTemplate__c
            WHERE Id = :templateId
            LIMIT 1
        ];
        if (templates.isEmpty()) {
            throw notFound('Die Vorlage existiert nicht.');
        }
        ScheduleTemplate__c tmpl = templates[0];

        PlanView pv = new PlanView();
        pv.id = tmpl.Id;
        pv.name = tmpl.Name;
        pv.status = tmpl.Status__c;
        pv.notes = tmpl.Description__c;
        resp.plan = pv;

        List<EntryView> entries = new List<EntryView>();
        for (ScheduleEntry__c e : [
            SELECT Id, Name, Description__c, EntryKind__c, Type__c, IsRequired__c, DayOfWeek__c,
                   StartTime__c, EndTime__c, DurationMinutes__c, TargetType__c, ParticipantGroup__c,
                   Participant__c, Coach_Profile__c, Coach_Profile__r.Name, Location__c, MeetingLink__c,
                   Order__c, DeviationReason__c, Notes__c, IsCustomized__c
            FROM ScheduleEntry__c
            WHERE ScheduleTemplate__c = :templateId
            ORDER BY DayOfWeek__c, Order__c, StartTime__c
        ]) {
            entries.add(mapEntry(e));
        }
        resp.entries = entries;
    }

    private static void getTemplates(EditorResponse resp, String programId) {
        List<TemplateView> templates = new List<TemplateView>();

        if (String.isBlank(programId)) {
            // List all templates the user can access
            for (ScheduleTemplate__c t : [
                SELECT Id, Name, Program__c, ProgramWeek__c, Status__c
                FROM ScheduleTemplate__c
                WHERE Status__c = 'Active'
                ORDER BY Name
            ]) {
                TemplateView tv = new TemplateView();
                tv.id = t.Id;
                tv.name = t.Name;
                tv.programId = t.Program__c;
                tv.programWeekId = t.ProgramWeek__c;
                tv.status = t.Status__c;
                tv.entryCount = [SELECT COUNT() FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :t.Id];
                templates.add(tv);
            }
        } else {
            assertProgramAccess(programId);

            Set<Id> weekIds = new Set<Id>();
            for (ProgramWeek__c pw : [SELECT Id FROM ProgramWeek__c WHERE Program__c = :programId]) {
                weekIds.add(pw.Id);
            }

            for (ScheduleTemplate__c t : [
                SELECT Id, Name, Program__c, ProgramWeek__c, Status__c
                FROM ScheduleTemplate__c
                WHERE Status__c = 'Active'
                  AND (Program__c = :programId OR ProgramWeek__c IN :weekIds)
                ORDER BY Name
            ]) {
                TemplateView tv = new TemplateView();
                tv.id = t.Id;
                tv.name = t.Name;
                tv.programId = t.Program__c;
                tv.programWeekId = t.ProgramWeek__c;
                tv.status = t.Status__c;
                tv.entryCount = [SELECT COUNT() FROM ScheduleEntry__c WHERE ScheduleTemplate__c = :t.Id];
                templates.add(tv);
            }
        }

        if (resp.options == null) resp.options = new OptionsView();
        resp.options.templates = templates;
    }

    private static PlanView mapPlan(WeeklySchedule__c plan, Integer entryCount) {
        PlanView pv = new PlanView();
        pv.id = plan.Id;
        pv.name = plan.Name;
        pv.programWeekId = plan.ProgramWeek__c;
        pv.scopeType = plan.ScopeType__c;
        pv.status = plan.Status__c;
        pv.startDate = plan.StartDate__c == null ? null : String.valueOf(plan.StartDate__c);
        pv.endDate = plan.EndDate__c == null ? null : String.valueOf(plan.EndDate__c);
        pv.participantGroupId = plan.ParticipantGroup__c;
        pv.participantGroupName = plan.ParticipantGroup__r == null ? null : plan.ParticipantGroup__r.Name;
        pv.participantId = plan.Participant__c;
        pv.participantName = plan.Participant__r == null ? null : plan.Participant__r.Name;
        pv.appliedTemplateId = plan.AppliedTemplate__c;
        pv.templateName = plan.AppliedTemplate__r == null ? null : plan.AppliedTemplate__r.Name;
        pv.entryCount = entryCount == null ? 0 : entryCount;
        pv.notes = plan.Notes__c;
        pv.deviationReason = plan.DeviationReason__c;
        pv.publishedAt = plan.PublishedAt__c == null ? null : String.valueOf(plan.PublishedAt__c);
        pv.publishedBy = plan.PublishedBy__c;
        pv.coachName = plan.PublishedBy__r == null ? null : plan.PublishedBy__r.Name;
        return pv;
    }

    private static EntryView mapEntry(ScheduleEntry__c entry) {
        EntryView ev = new EntryView();
        ev.id = entry.Id;
        ev.title = entry.Name;
        ev.description = entry.Description__c;
        ev.entryKind = entry.EntryKind__c;
        ev.type = entry.Type__c;
        ev.isRequired = entry.IsRequired__c;
        ev.dayOfWeek = entry.DayOfWeek__c;
        ev.startTime = entry.StartTime__c == null ? null : String.valueOf(entry.StartTime__c);
        ev.endTime = entry.EndTime__c == null ? null : String.valueOf(entry.EndTime__c);
        ev.durationMinutes = entry.DurationMinutes__c == null ? null : entry.DurationMinutes__c.intValue();
        ev.targetType = entry.TargetType__c;
        ev.participantGroupId = entry.ParticipantGroup__c;
        ev.participantId = entry.Participant__c;
        ev.coachProfileId = entry.Coach_Profile__c;
        ev.coachName = entry.Coach_Profile__r == null ? null : entry.Coach_Profile__r.Name;
        ev.location = entry.Location__c;
        ev.meetingLink = entry.MeetingLink__c;
        ev.order = entry.Order__c == null ? null : entry.Order__c.intValue();
        ev.deviationReason = entry.DeviationReason__c;
        ev.notes = entry.Notes__c;
        ev.isCustomized = entry.IsCustomized__c;
        return ev;
    }

    private static List<String> picklistValues(String objectName, String fieldName) {
        List<String> values = new List<String>();
        Schema.SObjectType sot = Schema.getGlobalDescribe().get(objectName);
        if (sot == null) {
            return values;
        }
        Map<String, Schema.SObjectField> fields = sot.getDescribe().fields.getMap();
        if (!fields.containsKey(fieldName)) {
            return values;
        }
        for (Schema.PicklistEntry pe : fields.get(fieldName).getDescribe().getPicklistValues()) {
            if (pe.isActive()) {
                values.add(pe.getValue());
            }
        }
        return values;
    }

    private static void savePlan(MutationResponse resp, Map<String, Object> payload) {
        SavePlanInput input = (SavePlanInput) JSON.deserialize(JSON.serialize(payload), SavePlanInput.class);
        ScheduleService.WeeklyScheduleRequest req = new ScheduleService.WeeklyScheduleRequest();
        req.id = input.id;
        req.name = input.name;
        req.programWeekId = input.programWeekId;
        req.scopeType = input.scopeType;
        req.participantGroupId = input.participantGroupId;
        req.participantId = input.participantId;
        req.startDate = input.startDate;
        req.endDate = input.endDate;
        req.status = input.status;
        req.deviationReason = input.deviationReason;
        req.notes = input.notes;

        if (String.isNotBlank(req.id)) {
            List<WeeklySchedule__c> existing = [
                SELECT ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :req.id LIMIT 1
            ];
            if (!existing.isEmpty()) {
                ScheduleService.assertCoachAccess(existing[0].ProgramWeek__c);
            }
        } else if (String.isNotBlank(req.programWeekId)) {
            ScheduleService.assertCoachAccess(req.programWeekId);
        }

        WeeklySchedule__c saved = ScheduleService.upsertWeeklySchedule(req);
        resp.id = saved.Id;
        resp.status = saved.Status__c;
        if (saved.Status__c == 'Published') {
            SchedulePortalSharingService.synchronisePlan(saved.Id);
        }
    }

    private static void saveEntry(MutationResponse resp, Map<String, Object> payload) {
        SaveEntryInput input = (SaveEntryInput) JSON.deserialize(JSON.serialize(payload), SaveEntryInput.class);
        ScheduleService.ScheduleEntryRequest req = new ScheduleService.ScheduleEntryRequest();
        req.id = input.id;
        req.weeklyScheduleId = input.weeklyScheduleId;
        req.scheduleTemplateId = input.scheduleTemplateId;
        req.title = input.title;
        req.description = input.description;
        req.entryKind = input.entryKind;
        req.type = input.type;
        req.isRequired = input.isRequired;
        req.dayOfWeek = input.dayOfWeek;
        req.startTime = input.startTime;
        req.endTime = input.endTime;
        req.durationMinutes = input.durationMinutes;
        req.targetType = input.targetType;
        req.participantGroupId = input.participantGroupId;
        req.participantId = input.participantId;
        req.coachProfileId = input.coachProfileId;
        req.location = input.location;
        req.meetingLink = input.meetingLink;
        req.order = input.order;
        req.deviationReason = input.deviationReason;
        req.notes = input.notes;
        req.isCustomized = input.isCustomized;

        if (String.isNotBlank(req.id)) {
            List<ScheduleEntry__c> existing = [
                SELECT WeeklySchedule__c FROM ScheduleEntry__c WHERE Id = :req.id LIMIT 1
            ];
            if (!existing.isEmpty() && existing[0].WeeklySchedule__c != null) {
                List<WeeklySchedule__c> plans = [
                    SELECT ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :existing[0].WeeklySchedule__c LIMIT 1
                ];
                if (!plans.isEmpty()) {
                    ScheduleService.assertCoachAccess(plans[0].ProgramWeek__c);
                }
            }
        }
        if (String.isNotBlank(req.weeklyScheduleId)) {
            List<WeeklySchedule__c> plans = [
                SELECT ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :req.weeklyScheduleId LIMIT 1
            ];
            if (!plans.isEmpty()) {
                ScheduleService.assertCoachAccess(plans[0].ProgramWeek__c);
            }
        }
        if (String.isNotBlank(req.scheduleTemplateId)) {
            List<ScheduleTemplate__c> templates = [
                SELECT ProgramWeek__c FROM ScheduleTemplate__c WHERE Id = :req.scheduleTemplateId LIMIT 1
            ];
            if (!templates.isEmpty() && templates[0].ProgramWeek__c != null) {
                ScheduleService.assertCoachAccess(templates[0].ProgramWeek__c);
            }
        }

        ScheduleEntry__c saved = ScheduleService.upsertScheduleEntry(req);
        resp.id = saved.Id;
        if (String.isNotBlank(saved.WeeklySchedule__c)) {
            List<WeeklySchedule__c> plans = [
                SELECT Status__c FROM WeeklySchedule__c WHERE Id = :saved.WeeklySchedule__c LIMIT 1
            ];
            if (!plans.isEmpty() && plans[0].Status__c == 'Published') {
                SchedulePortalSharingService.synchronisePlan(saved.WeeklySchedule__c);
            }
        }
    }

    private static void deleteEntry(MutationResponse resp, Map<String, Object> payload) {
        String id = (String) payload.get('id');
        if (String.isBlank(id)) {
            throw badRequest('Eintrag-ID fehlt.');
        }
        List<ScheduleEntry__c> entries = [
            SELECT Id, WeeklySchedule__c FROM ScheduleEntry__c WHERE Id = :id LIMIT 1
        ];
        if (entries.isEmpty()) {
            throw notFound('Die Planzeile existiert nicht.');
        }
        Id weeklyScheduleId = entries[0].WeeklySchedule__c;
        if (weeklyScheduleId != null) {
            List<WeeklySchedule__c> plans = [
                SELECT ProgramWeek__c, Status__c FROM WeeklySchedule__c WHERE Id = :weeklyScheduleId LIMIT 1
            ];
            if (!plans.isEmpty()) {
                ScheduleService.assertCoachAccess(plans[0].ProgramWeek__c);
            }
        } else {
            // Template entry - check template's program week
            List<ScheduleEntry__c> entryCheck = [
                SELECT ScheduleTemplate__c FROM ScheduleEntry__c WHERE Id = :id LIMIT 1
            ];
            if (!entryCheck.isEmpty() && entryCheck[0].ScheduleTemplate__c != null) {
                List<ScheduleTemplate__c> templates = [
                    SELECT ProgramWeek__c FROM ScheduleTemplate__c WHERE Id = :entryCheck[0].ScheduleTemplate__c LIMIT 1
                ];
                if (!templates.isEmpty() && templates[0].ProgramWeek__c != null) {
                    ScheduleService.assertCoachAccess(templates[0].ProgramWeek__c);
                }
            }
        }
        ScheduleService.deleteScheduleEntry(id);
        if (weeklyScheduleId != null) {
            List<WeeklySchedule__c> plans = [
                SELECT Status__c FROM WeeklySchedule__c WHERE Id = :weeklyScheduleId LIMIT 1
            ];
            if (!plans.isEmpty() && plans[0].Status__c == 'Published') {
                SchedulePortalSharingService.synchronisePlan(weeklyScheduleId);
            }
        }
        resp.id = id;
    }

    private static void deletePlan(MutationResponse resp, Map<String, Object> payload) {
        String id = (String) payload.get('id');
        if (String.isBlank(id)) {
            throw badRequest('Wochenplan-ID fehlt.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, ProgramWeek__c, Status__c FROM WeeklySchedule__c WHERE Id = :id LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        ScheduleService.assertCoachAccess(rows[0].ProgramWeek__c);
        ScheduleService.deleteWeeklySchedule(id);
        resp.id = id;
    }

    private static void publishPlan(MutationResponse resp, Map<String, Object> payload) {
        String id = (String) payload.get('id');
        if (String.isBlank(id)) {
            throw badRequest('Wochenplan-ID fehlt.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :id LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        ScheduleService.assertCoachAccess(rows[0].ProgramWeek__c);
        WeeklySchedule__c published = SchedulePublishService.publish(id);
        SchedulePortalSharingService.synchronisePlan(id);
        resp.id = published.Id;
        resp.status = published.Status__c;
    }

    private static void unpublishPlan(MutationResponse resp, Map<String, Object> payload) {
        String id = (String) payload.get('id');
        if (String.isBlank(id)) {
            throw badRequest('Wochenplan-ID fehlt.');
        }
        List<WeeklySchedule__c> rows = [
            SELECT Id, ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :id LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        ScheduleService.assertCoachAccess(rows[0].ProgramWeek__c);
        WeeklySchedule__c unpublished = SchedulePublishService.unpublish(id);
        SchedulePortalSharingService.revokePlan(id);
        resp.id = unpublished.Id;
        resp.status = unpublished.Status__c;
    }

    private static void saveAsTemplate(MutationResponse resp, Map<String, Object> payload) {
        SaveAsTemplateInput input = (SaveAsTemplateInput) JSON.deserialize(JSON.serialize(payload), SaveAsTemplateInput.class);
        if (String.isBlank(input.weeklyScheduleId)) {
            throw badRequest('weeklyScheduleId ist erforderlich.');
        }
        if (String.isBlank(input.name)) {
            throw badRequest('name ist erforderlich.');
        }

        List<WeeklySchedule__c> plans = [
            SELECT Id, ProgramWeek__c FROM WeeklySchedule__c WHERE Id = :input.weeklyScheduleId LIMIT 1
        ];
        if (plans.isEmpty()) {
            throw notFound('Der Wochenplan existiert nicht.');
        }
        ScheduleService.assertCoachAccess(plans[0].ProgramWeek__c);

        ScheduleTemplateService.SaveAsTemplateRequest req = new ScheduleTemplateService.SaveAsTemplateRequest();
        req.weeklyScheduleId = input.weeklyScheduleId;
        req.name = input.name;
        req.description = input.description;

        ScheduleTemplate__c template = ScheduleTemplateService.saveAsTemplate(req);
        resp.id = template.Id;
        resp.status = template.Status__c;
        resp.success = true;
    }

    private static void duplicateTemplate(MutationResponse resp, Map<String, Object> payload) {
        DuplicateTemplateInput input = (DuplicateTemplateInput) JSON.deserialize(JSON.serialize(payload), DuplicateTemplateInput.class);
        if (String.isBlank(input.templateId)) {
            throw badRequest('templateId ist erforderlich.');
        }

        ScheduleTemplateService.DuplicateTemplateRequest req = new ScheduleTemplateService.DuplicateTemplateRequest();
        req.templateId = input.templateId;
        req.name = input.name;

        ScheduleTemplate__c copy = ScheduleTemplateService.duplicateTemplate(req);
        resp.id = copy.Id;
        resp.status = copy.Status__c;
        resp.success = true;
    }

    private static void deleteTemplate(MutationResponse resp, Map<String, Object> payload) {
        String id = (String) payload.get('id');
        if (String.isBlank(id)) {
            throw badRequest('Vorlagen-ID fehlt.');
        }
        ScheduleTemplateService.deleteTemplate(id);
        resp.id = id;
        resp.success = true;
    }

    private static void applyTemplate(MutationResponse resp, Map<String, Object> payload) {
        String templateId = (String) payload.get('templateId');
        String programWeekId = (String) payload.get('programWeekId');
        String startDate = (String) payload.get('startDate');
        String name = (String) payload.get('name');

        if (String.isBlank(programWeekId)) {
            throw badRequest('programWeekId ist erforderlich.');
        }
        ScheduleService.assertCoachAccess(programWeekId);

        ScheduleTemplateService.ApplyRequest request = new ScheduleTemplateService.ApplyRequest();
        request.templateId = templateId;
        request.programWeekId = programWeekId;
        request.startDate = startDate;
        request.name = name;

        WeeklySchedule__c created = ScheduleTemplateService.applyTemplate(request);
        resp.id = created.Id;
        resp.status = created.Status__c;
    }
}
