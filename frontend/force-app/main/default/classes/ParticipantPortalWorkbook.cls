/**
 * Participant REST endpoint for "Mein Lernen" (internal domain: Workbook).
 *
 * ENDPOINTS
 *   GET    /participant-portal/me/workbook/today
 *   PUT    /participant-portal/me/workbook/days/{yyyy-MM-dd}
 *   PUT    /participant-portal/me/workbook/days/{yyyy-MM-dd}/check-in
 *   POST   /participant-portal/me/workbook/tasks
 *   PATCH  /participant-portal/me/workbook/tasks/{id}
 *   POST   /participant-portal/me/workbook/evidence
 *   PATCH  /participant-portal/me/workbook/evidence/{id}
 *   GET    /participant-portal/me/workbook/reviews?weekStart=yyyy-MM-dd
 *   PUT    /participant-portal/me/workbook/reviews/{weekStart}
 *
 * AUTHORISATION
 *   The caller is resolved with ParticipantPortalData.resolveForUser(); no
 *   request parameter selects a participant. The service then filters every
 *   query by that server-side id. Workbook rows are OWD Private and deliberately
 *   not shared with portal users, so the service runs `without sharing`.
 *
 *   This class uses one wildcard mapping for the whole workbook sub-tree. The
 *   alternatives (one @RestResource per action) would add six class-access
 *   entries to the portal permission set. The wildcard is scoped to
 *   `/workbook/*`, so it cannot swallow `/me`, `/me/learning-path` or
 *   `/me/weekly-schedule`, unlike the old `/participant-portal/*` dispatcher.
 */
@RestResource(urlMapping='/participant-portal/me/workbook/*')
global without sharing class ParticipantPortalWorkbook {

    global class GetResponse {
        public WorkbookService.TodayView today;
        public WorkbookService.WeekView week;
        public WorkbookService.ReviewView review;
        public String code;
        public String message;
    }

    global class PutResponse {
        public WorkbookService.DayView day;
        public String checkInAt;
        public Boolean alreadyCheckedIn;
        public WorkbookService.ReviewView review;
        public String code;
        public String message;
    }

    global class PostResponse {
        public WorkbookService.TaskView task;
        public WorkbookService.EvidenceView evidence;
        public String code;
        public String message;
    }

    global class PatchResponse {
        public WorkbookService.TaskView task;
        public WorkbookService.EvidenceView evidence;
        public String code;
        public String message;
    }

    @HttpGet
    global static GetResponse getWorkbook() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        try {
            Id participantId = currentParticipantId();
            List<String> parts = pathSegments();

            if (parts.size() == 1 && parts[0] == 'today') {
                Date targetDate = WorkbookService.currentDate();
                String dateParam = RestContext.request.params.get('date');
                if (!String.isBlank(dateParam)) {
                    targetDate = parseDate(dateParam);
                }
                GetResponse response = new GetResponse();
                response.today = WorkbookService.getToday(participantId, targetDate);
                return response;
            }

            if (parts.size() == 1 && parts[0] == 'week') {
                String weekStart = RestContext.request.params.get('weekStart');
                if (String.isBlank(weekStart)) {
                    throw badRequest('BAD_WEEK_START', 'weekStart is required.');
                }
                GetResponse response = new GetResponse();
                response.week = WorkbookService.getWeek(
                    participantId,
                    parseDate(weekStart)
                );
                return response;
            }

            if (parts.size() == 1 && parts[0] == 'reviews') {
                String weekStart = RestContext.request.params.get('weekStart');
                if (String.isBlank(weekStart)) {
                    throw badRequest('BAD_WEEK_START', 'weekStart is required.');
                }
                GetResponse response = new GetResponse();
                response.review = WorkbookService.getReview(
                    participantId,
                    parseDate(weekStart)
                );
                return response;
            }

            return getError(404, 'NOT_FOUND', 'Workbook endpoint not found.');
        } catch (PortalIdentityException error) {
            return getError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (WorkbookService.WorkbookException error) {
            return getError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (Exception error) {
            reportInternalError(error);
            return getError(500, 'INTERNAL_ERROR', 'Workbook data unavailable.');
        }
    }

    @HttpPut
    global static PutResponse putWorkbook() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        try {
            Id participantId = currentParticipantId();
            List<String> parts = pathSegments();

            if (parts.size() == 3
                && parts[0] == 'days'
                && parts[2] == 'check-in') {
                WorkbookService.CheckInResult result = WorkbookService.checkIn(
                    participantId,
                    parseDate(parts[1])
                );
                PutResponse response = new PutResponse();
                response.day = result.day;
                response.checkInAt = result.day.checkInAt;
                response.alreadyCheckedIn = result.alreadyCheckedIn;
                return response;
            }

            if (parts.size() == 2 && parts[0] == 'days') {
                WorkbookService.DayPatch patch = (WorkbookService.DayPatch) parseBody(
                    WorkbookService.DayPatch.class
                );
                PutResponse response = new PutResponse();
                response.day = WorkbookService.updateDay(
                    participantId,
                    parseDate(parts[1]),
                    patch
                );
                return response;
            }

            if (parts.size() == 2 && parts[0] == 'reviews') {
                WorkbookService.ReviewPatch patch = (WorkbookService.ReviewPatch) parseBody(
                    WorkbookService.ReviewPatch.class
                );
                PutResponse response = new PutResponse();
                response.review = WorkbookService.updateReview(
                    participantId,
                    parseDate(parts[1]),
                    patch
                );
                return response;
            }

            return putError(404, 'NOT_FOUND', 'Workbook endpoint not found.');
        } catch (PortalIdentityException error) {
            return putError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (WorkbookService.WorkbookException error) {
            return putError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (Exception error) {
            reportInternalError(error);
            return putError(500, 'INTERNAL_ERROR', 'Workbook data unavailable.');
        }
    }

    @HttpPost
    global static PostResponse postWorkbook() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        try {
            Id participantId = currentParticipantId();
            List<String> parts = pathSegments();

            if (parts.size() == 1 && parts[0] == 'tasks') {
                WorkbookService.TaskInput input = (WorkbookService.TaskInput) parseBody(
                    WorkbookService.TaskInput.class
                );
                PostResponse response = new PostResponse();
                response.task = WorkbookService.createTask(participantId, input);
                return response;
            }

            if (parts.size() == 1 && parts[0] == 'evidence') {
                WorkbookService.EvidenceInput input = (WorkbookService.EvidenceInput) parseBody(
                    WorkbookService.EvidenceInput.class
                );
                PostResponse response = new PostResponse();
                response.evidence = WorkbookService.createEvidence(participantId, input);
                return response;
            }

            return postError(404, 'NOT_FOUND', 'Workbook endpoint not found.');
        } catch (PortalIdentityException error) {
            return postError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (WorkbookService.WorkbookException error) {
            return postError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (Exception error) {
            reportInternalError(error);
            return postError(500, 'INTERNAL_ERROR', 'Workbook data unavailable.');
        }
    }

    @HttpPatch
    global static PatchResponse patchWorkbook() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');
        try {
            Id participantId = currentParticipantId();
            List<String> parts = pathSegments();

            if (parts.size() == 2 && parts[0] == 'tasks') {
                WorkbookService.TaskPatch patch = (WorkbookService.TaskPatch) parseBody(
                    WorkbookService.TaskPatch.class
                );
                PatchResponse response = new PatchResponse();
                response.task = WorkbookService.updateTask(
                    participantId,
                    parseId(parts[1]),
                    patch
                );
                return response;
            }

            if (parts.size() == 2 && parts[0] == 'evidence') {
                WorkbookService.EvidencePatch patch = (WorkbookService.EvidencePatch) parseBody(
                    WorkbookService.EvidencePatch.class
                );
                PatchResponse response = new PatchResponse();
                response.evidence = WorkbookService.updateEvidence(
                    participantId,
                    parseId(parts[1]),
                    patch
                );
                return response;
            }

            return patchError(404, 'NOT_FOUND', 'Workbook endpoint not found.');
        } catch (PortalIdentityException error) {
            return patchError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (WorkbookService.WorkbookException error) {
            return patchError(error.getStatusCode(), error.getCode(), error.getMessage());
        } catch (Exception error) {
            reportInternalError(error);
            return patchError(500, 'INTERNAL_ERROR', 'Workbook data unavailable.');
        }
    }

    private static Id currentParticipantId() {
        ParticipantPortalData.ParticipantView identity = ParticipantPortalData.resolveForUser(
            UserInfo.getUserId()
        );
        return Id.valueOf(identity.participantId);
    }

    private static List<String> pathSegments() {
        String uri = RestContext.request.requestURI;
        String marker = '/participant-portal/me/workbook/';
        String path = uri.contains(marker) ? uri.substringAfter(marker) : '';
        List<String> segments = new List<String>();
        for (String part : path.split('/')) {
            if (!String.isBlank(part)) {
                segments.add(part);
            }
        }
        return segments;
    }

    private static Object parseBody(System.Type targetType) {
        String body = RestContext.request.requestBody == null
            ? null
            : RestContext.request.requestBody.toString();
        if (String.isBlank(body)) {
            return null;
        }
        try {
            return JSON.deserialize(body, targetType);
        } catch (Exception error) {
            throw badRequest('BAD_JSON', 'Request body is not valid JSON.');
        }
    }

    private static Date parseDate(String value) {
        try {
            return Date.valueOf(value);
        } catch (Exception error) {
            throw badRequest('BAD_DATE', 'Date must use yyyy-MM-dd.');
        }
    }

    private static Id parseId(String value) {
        try {
            return Id.valueOf(value);
        } catch (Exception error) {
            throw badRequest('BAD_ID', 'Invalid record id.');
        }
    }

    private static WorkbookService.WorkbookException badRequest(String code, String message) {
        WorkbookService.WorkbookException error = new WorkbookService.WorkbookException(message);
        error.init(400, code);
        return error;
    }

    private static GetResponse getError(Integer status, String code, String message) {
        RestContext.response.statusCode = status;
        GetResponse response = new GetResponse();
        response.code = code;
        response.message = message;
        return response;
    }

    private static PutResponse putError(Integer status, String code, String message) {
        RestContext.response.statusCode = status;
        PutResponse response = new PutResponse();
        response.code = code;
        response.message = message;
        return response;
    }

    private static PostResponse postError(Integer status, String code, String message) {
        RestContext.response.statusCode = status;
        PostResponse response = new PostResponse();
        response.code = code;
        response.message = message;
        return response;
    }

    private static PatchResponse patchError(Integer status, String code, String message) {
        RestContext.response.statusCode = status;
        PatchResponse response = new PatchResponse();
        response.code = code;
        response.message = message;
        return response;
    }

    private static void reportInternalError(Exception error) {
        System.debug(
            LoggingLevel.ERROR,
            'ParticipantPortalWorkbook failed: ' + error.getTypeName() + ': ' + error.getMessage()
        );
    }
}
