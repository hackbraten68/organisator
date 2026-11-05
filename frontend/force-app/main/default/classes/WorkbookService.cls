/**
 * Domain service for the participant-facing "Mein Lernen" workbook.
 *
 * The service is deliberately `without sharing`. The four Workbook objects use
 * OWD Private and are intentionally NOT shared with portal users. Every public
 * method takes the participant id from the server-side identity resolution in
 * ParticipantPortalWorkbook and filters every query by that id. Do not add a
 * method that accepts a participant id from a request body.
 *
 * The service owns the business rules that the schema cannot express:
 * - at most three focus tasks per participant per planned date
 * - carry-over moves PlannedDate__c instead of creating a new task
 * - check-in is idempotent and current-day only (Europe/Berlin)
 * - closing a day stamps ClosedAt__c; reopening stamps LastReopenedAt__c
 * - submitted week reviews carry a generated count snapshot
 * - audit events are best-effort and never make the participant action fail
 */
global without sharing class WorkbookService {

    public static final String DAY_OPEN = 'Open';
    public static final String DAY_CLOSED = 'Closed';
    public static final String DAY_REOPENED = 'Reopened';

    public static final String TASK_OPEN = 'Open';
    public static final String TASK_IN_PROGRESS = 'InProgress';
    public static final String TASK_DONE = 'Done';
    public static final String TASK_DROPPED = 'Dropped';

    public static final String SOURCE_MANUAL = 'Manual';
    public static final String SOURCE_SCHEDULE = 'Schedule';
    public static final String SOURCE_CARRY_OVER = 'CarryOver';

    public static final String EVIDENCE_LINK = 'Link';
    public static final String EVIDENCE_NOTE = 'Note';

    public static final String FEEDBACK_NONE = 'None';
    public static final String FEEDBACK_REQUESTED = 'Requested';
    public static final String FEEDBACK_GIVEN = 'Given';

    public static final Integer MAX_FOCUS_TASKS = 3;

    /** Test seam for the Europe/Berlin "today" calculation. */
    @TestVisible
    private static Date todayOverride;

    /**
     * Stable error type for the REST boundary. It carries an HTTP status and a
     * machine-readable code, mirroring PortalIdentityException.
     */
    global class WorkbookException extends Exception {
        private Integer statusCode;
        private String code;

        public void init(Integer statusCode, String code) {
            this.statusCode = statusCode;
            this.code = code;
        }

        public Integer getStatusCode() {
            return statusCode;
        }

        public String getCode() {
            return code;
        }
    }

    global class DayView {
        public String id;
        public String dateValue;
        public String status;
        public String focus;
        public String supportStatus;
        public String supportNote;
        public String selfRating;
        public String nextStep;
        public String checkInAt;
        public String checkInSource;
        public String closedAt;
        public String lastReopenedAt;
    }

    global class TaskView {
        public String id;
        public String title;
        public String status;
        public String plannedDate;
        public String originDayId;
        public Boolean isFocus;
        public Boolean needsSupport;
        public String supportNote;
        public Integer sortOrder;
        public String source;
        public String completedAt;
        public String learningPathEntryId;
        public String programWeekId;
        public String scheduleEntryId;
        public String carriedFromTaskId;
        public String createdAt;
    }

    global class EvidenceView {
        public String id;
        public String type;
        public String title;
        public String url;
        public String note;
        public String feedbackStatus;
        public String coachFeedback;
        public String coachFeedbackAt;
        public String taskId;
        public String learningPathEntryId;
        public String programWeekId;
        public String createdAt;
    }

    global class TodayView {
        public String dateValue;
        public DayView day;
        public List<TaskView> tasks;
        public List<TaskView> focusTasks;
        public List<EvidenceView> evidence;
        public String checkInAt;
        public Boolean checkedIn;
        public Integer focusCount;
        public Integer openTaskCount;
        public Integer doneTaskCount;
    }

    global class ReviewView {
        public String id;
        public String weekStartDate;
        public String weekEndDate;
        public String status;
        public String proudOf;
        public String clearerNow;
        public String nextWeekFocus;
        public String supportWish;
        public String submittedAt;
        public String generatedAt;
        public Integer taskCount;
        public Integer completedTaskCount;
        public Integer evidenceCount;
        public Integer supportRequestCount;
        public String summarySnapshot;
    }

    global class WeekView {
        public String weekStart;
        public String weekEnd;
        public List<TodayView> days;
        public ReviewView review;
        public Integer totalTasks;
        public Integer completedTasks;
        public Integer checkedInDays;
        public Integer closedDays;
        public Integer evidenceCount;
    }

    global class CheckInResult {
        public DayView day;
        public Boolean alreadyCheckedIn;
    }

    global class DayPatch {
        public String focus;
        public String supportStatus;
        public String supportNote;
        public String selfRating;
        public String nextStep;
        public String status;
        public String action;
    }

    global class TaskInput {
        public String title;
        public String plannedDate;
        public String originDayId;
        public Boolean isFocus;
        public Boolean needsSupport;
        public String supportNote;
        public Integer sortOrder;
        public String learningPathEntryId;
        public String programWeekId;
        public String scheduleEntryId;
    }

    global class TaskPatch {
        public String title;
        public String status;
        public Boolean isFocus;
        public Boolean needsSupport;
        public String supportNote;
        public Integer sortOrder;
        public String plannedDate;
        public String carryOverToDate;
        public String learningPathEntryId;
        public String programWeekId;
    }

    global class EvidenceInput {
        public String type;
        public String title;
        public String url;
        public String note;
        public String taskId;
        public String learningPathEntryId;
        public String programWeekId;
        public Boolean requestFeedback;
    }

    global class EvidencePatch {
        public String title;
        public String url;
        public String note;
        public String feedbackStatus;
    }

    global class ReviewPatch {
        public String proudOf;
        public String clearerNow;
        public String nextWeekFocus;
        public String supportWish;
        public String status;
    }

    // ---------------------------------------------------------------------
    // Today
    // ---------------------------------------------------------------------

    global static TodayView getToday(Id participantId) {
        return getToday(participantId, currentDate());
    }

    global static TodayView getToday(Id participantId, Date targetDate) {
        if (participantId == null || targetDate == null) {
            throw badRequest('BAD_REQUEST', 'Participant and date are required.');
        }

        Workbook_Day__c day = findDay(participantId, targetDate);

        TodayView view = new TodayView();
        view.dateValue = String.valueOf(targetDate);
        view.day = day == null ? virtualDay(targetDate) : toDayView(day);
        view.tasks = listTasks(participantId, targetDate);
        view.focusTasks = new List<TaskView>();
        view.openTaskCount = 0;
        view.doneTaskCount = 0;
        for (TaskView task : view.tasks) {
            if (task.isFocus) {
                view.focusTasks.add(task);
            }
            if (task.status == TASK_DONE) {
                view.doneTaskCount++;
            } else if (task.status != TASK_DROPPED) {
                view.openTaskCount++;
            }
        }
        view.evidence = listRecentEvidence(participantId, 20);
        view.focusCount = view.focusTasks.size();
        view.checkInAt = view.day.checkInAt;
        view.checkedIn = view.day.checkInAt != null;
        return view;
    }

    global static WeekView getWeek(Id participantId, Date weekStart) {
        if (participantId == null || weekStart == null) {
            throw badRequest('BAD_REQUEST', 'Participant and week start are required.');
        }
        Date monday = mondayOf(weekStart);

        WeekView view = new WeekView();
        view.weekStart = String.valueOf(monday);
        view.weekEnd = String.valueOf(monday.addDays(6));
        view.days = new List<TodayView>();
        view.totalTasks = 0;
        view.completedTasks = 0;
        view.checkedInDays = 0;
        view.closedDays = 0;
        view.evidenceCount = 0;

        for (Integer i = 0; i < 5; i++) {
            Date d = monday.addDays(i);
            TodayView dayView = getToday(participantId, d);
            view.days.add(dayView);
            view.totalTasks += dayView.tasks.size();
            view.completedTasks += dayView.doneTaskCount;
            if (dayView.checkedIn) {
                view.checkedInDays++;
            }
            if (dayView.day != null && dayView.day.status == DAY_CLOSED) {
                view.closedDays++;
            }
        }

        // Evidence count for the week
        Datetime startOfWeek = Datetime.newInstanceGmt(
            monday.year(), monday.month(), monday.day(), 0, 0, 0
        );
        Datetime endOfWeek = Datetime.newInstanceGmt(
            monday.addDays(7).year(), monday.addDays(7).month(), monday.addDays(7).day(), 0, 0, 0
        );
        view.evidenceCount = [
            SELECT COUNT()
            FROM Workbook_Evidence__c
            WHERE Participant__c = :participantId
                AND CreatedDate >= :startOfWeek
                AND CreatedDate < :endOfWeek
        ];

        view.review = getReview(participantId, monday);
        return view;
    }

    // ---------------------------------------------------------------------
    // Day, check-in and daily close
    // ---------------------------------------------------------------------

    global static CheckInResult checkIn(Id participantId, Date targetDate) {
        Date today = currentDate();
        if (targetDate == null) {
            targetDate = today;
        }
        if (targetDate != today) {
            throw badRequest(
                'CHECK_IN_DATE_MISMATCH',
                'Check-in is only available for the current day.'
            );
        }

        Workbook_Day__c day = ensureDay(participantId, targetDate);
        CheckInResult result = new CheckInResult();
        result.alreadyCheckedIn = day.CheckInAt__c != null;
        if (!result.alreadyCheckedIn) {
            day.CheckInAt__c = Datetime.now();
            day.CheckInSource__c = 'Portal';
            updateRow(day, 'DAY_UPDATE_FAILED');
            audit(
                'checked_in',
                'workbook.day.checked_in',
                'Workbook_Day__c',
                day.Id,
                participantId,
                'Daily workbook check-in'
            );
        }
        result.day = toDayView(day);
        return result;
    }

    global static DayView updateDay(Id participantId, Date targetDate, DayPatch patch) {
        if (patch == null) {
            throw badRequest('BAD_REQUEST', 'A day patch is required.');
        }
        Workbook_Day__c day = ensureDay(participantId, targetDate);

        String action = trim(patch.action);
        if (action == 'close') {
            day.Status__c = DAY_CLOSED;
            if (day.ClosedAt__c == null) {
                day.ClosedAt__c = Datetime.now();
            }
        } else if (action == 'reopen') {
            day.Status__c = DAY_REOPENED;
            day.LastReopenedAt__c = Datetime.now();
        } else if (!String.isBlank(patch.status)) {
            String status = trim(patch.status);
            if (status != DAY_OPEN && status != DAY_CLOSED && status != DAY_REOPENED) {
                throw badRequest('BAD_DAY_STATUS', 'Unknown day status.');
            }
            day.Status__c = status;
            if (status == DAY_CLOSED && day.ClosedAt__c == null) {
                day.ClosedAt__c = Datetime.now();
            }
            if (status == DAY_REOPENED && day.LastReopenedAt__c == null) {
                day.LastReopenedAt__c = Datetime.now();
            }
        }

        if (patch.focus != null) {
            day.Focus__c = truncate(patch.focus, 255, 'FOCUS_TOO_LONG');
        }
        if (patch.supportStatus != null) {
            day.SupportStatus__c = String.isBlank(patch.supportStatus)
                ? 'None'
                : trim(patch.supportStatus);
        }
        if (patch.supportNote != null) {
            day.SupportNote__c = truncate(patch.supportNote, 1000, 'SUPPORT_NOTE_TOO_LONG');
        }
        if (patch.selfRating != null) {
            day.SelfRating__c = String.isBlank(patch.selfRating)
                ? null
                : trim(patch.selfRating);
        }
        if (patch.nextStep != null) {
            day.NextStep__c = truncate(patch.nextStep, 500, 'NEXT_STEP_TOO_LONG');
        }

        updateRow(day, 'DAY_UPDATE_FAILED');

        if (day.Status__c == DAY_CLOSED && action == 'close') {
            audit(
                'status_changed',
                'workbook.day.closed',
                'Workbook_Day__c',
                day.Id,
                participantId,
                'Daily workbook close'
            );
        }
        return toDayView(day);
    }

    // ---------------------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------------------

    global static TaskView createTask(Id participantId, TaskInput input) {
        if (input == null) {
            throw badRequest('BAD_REQUEST', 'A task is required.');
        }

        Date plannedDate = input.plannedDate == null
            ? currentDate()
            : parseDate(input.plannedDate, 'BAD_TASK_DATE', 'Invalid planned date.');

        Workbook_Day__c originDay = null;
        if (!String.isBlank(input.originDayId)) {
            originDay = findOwnedDay(participantId, input.originDayId);
        }
        if (originDay == null) {
            originDay = ensureDay(participantId, plannedDate);
        }

        String title = trim(input.title);
        ScheduleEntry__c scheduleEntry = null;
        if (!String.isBlank(input.scheduleEntryId)) {
            scheduleEntry = findVisibleScheduleEntry(participantId, input.scheduleEntryId);
            if (String.isBlank(title)) {
                title = scheduleEntry.Name;
            }
        }
        if (String.isBlank(title)) {
            throw badRequest('TASK_TITLE_REQUIRED', 'A task needs a title.');
        }
        title = truncate(title, 255, 'TASK_TITLE_TOO_LONG');

        Boolean isFocus = input.isFocus == true;
        if (isFocus) {
            assertFocusLimit(participantId, plannedDate, null);
        }

        Workbook_Task__c task = new Workbook_Task__c(
            Participant__c = participantId,
            OriginDay__c = originDay.Id,
            PlannedDate__c = plannedDate,
            Title__c = title,
            Status__c = TASK_OPEN,
            Source__c = scheduleEntry == null ? SOURCE_MANUAL : SOURCE_SCHEDULE,
            IsFocus__c = isFocus,
            NeedsSupport__c = input.needsSupport == true,
            SupportNote__c = truncate(input.supportNote, 1000, 'SUPPORT_NOTE_TOO_LONG'),
            SortOrder__c = input.sortOrder,
            LearningPathEntry__c = validateLearningPath(participantId, input.learningPathEntryId),
            ProgramWeek__c = idOrNull(input.programWeekId),
            ScheduleEntry__c = scheduleEntry == null ? null : scheduleEntry.Id
        );
        insertRow(task, 'TASK_CREATE_FAILED');
        return toTaskView(task);
    }

    global static TaskView updateTask(Id participantId, Id taskId, TaskPatch patch) {
        if (patch == null) {
            throw badRequest('BAD_REQUEST', 'A task patch is required.');
        }
        Workbook_Task__c task = findOwnedTask(participantId, taskId);

        Date targetDate = task.PlannedDate__c;
        if (!String.isBlank(patch.carryOverToDate)) {
            targetDate = parseDate(
                patch.carryOverToDate,
                'BAD_CARRY_OVER_DATE',
                'Invalid carry-over date.'
            );
        } else if (!String.isBlank(patch.plannedDate)) {
            targetDate = parseDate(patch.plannedDate, 'BAD_TASK_DATE', 'Invalid planned date.');
        }

        Boolean moved = targetDate != task.PlannedDate__c;
        if (moved && task.IsFocus__c) {
            assertFocusLimit(participantId, targetDate, task.Id);
        }

        if (!String.isBlank(patch.title)) {
            task.Title__c = truncate(patch.title, 255, 'TASK_TITLE_TOO_LONG');
        }
        if (patch.isFocus != null) {
            if (patch.isFocus && !task.IsFocus__c) {
                assertFocusLimit(participantId, targetDate, task.Id);
            }
            task.IsFocus__c = patch.isFocus;
        }
        if (patch.needsSupport != null) {
            task.NeedsSupport__c = patch.needsSupport;
        }
        if (patch.supportNote != null) {
            task.SupportNote__c = truncate(patch.supportNote, 1000, 'SUPPORT_NOTE_TOO_LONG');
        }
        if (patch.sortOrder != null) {
            task.SortOrder__c = patch.sortOrder;
        }
        if (!String.isBlank(patch.learningPathEntryId)) {
            task.LearningPathEntry__c = validateLearningPath(
                participantId,
                patch.learningPathEntryId
            );
        }
        if (!String.isBlank(patch.programWeekId)) {
            task.ProgramWeek__c = idOrNull(patch.programWeekId);
        }

        Boolean completedNow = false;
        if (!String.isBlank(patch.status)) {
            String status = trim(patch.status);
            if (status != TASK_OPEN
                && status != TASK_IN_PROGRESS
                && status != TASK_DONE
                && status != TASK_DROPPED) {
                throw badRequest('BAD_TASK_STATUS', 'Unknown task status.');
            }
            if (status == TASK_DROPPED && task.IsFocus__c) {
                throw badRequest(
                    'FOCUS_TASK_CANNOT_BE_DROPPED',
                    'Remove the focus flag before dropping the task.'
                );
            }
            if (status == TASK_DONE && task.Status__c != TASK_DONE) {
                completedNow = true;
            }
            task.Status__c = status;
            task.CompletedAt__c = status == TASK_DONE
                ? (task.CompletedAt__c == null ? Datetime.now() : task.CompletedAt__c)
                : null;
        }

        if (moved) {
            task.PlannedDate__c = targetDate;
            task.Source__c = SOURCE_CARRY_OVER;
            task.OriginDay__c = task.OriginDay__c == null
                ? ensureDay(participantId, targetDate).Id
                : task.OriginDay__c;
        }

        updateRow(task, 'TASK_UPDATE_FAILED');

        if (completedNow) {
            audit(
                'status_changed',
                'workbook.task.completed',
                'Workbook_Task__c',
                task.Id,
                participantId,
                'Task completed'
            );
        }
        if (moved) {
            audit(
                'updated',
                'workbook.task.carried_over',
                'Workbook_Task__c',
                task.Id,
                participantId,
                'Task moved to ' + String.valueOf(targetDate)
            );
        }
        return toTaskView(task);
    }

    // ---------------------------------------------------------------------
    // Evidence
    // ---------------------------------------------------------------------

    global static EvidenceView createEvidence(Id participantId, EvidenceInput input) {
        if (input == null) {
            throw badRequest('BAD_REQUEST', 'Evidence is required.');
        }

        String type = trim(input.type);
        if (type != EVIDENCE_LINK && type != EVIDENCE_NOTE) {
            throw badRequest('BAD_EVIDENCE_TYPE', 'Evidence type must be Link or Note.');
        }

        String title = trim(input.title);
        String url = trim(input.url);
        String note = trim(input.note);
        validateEvidenceContent(type, title, url, note);

        Workbook_Task__c task = null;
        if (!String.isBlank(input.taskId)) {
            task = findOwnedTask(participantId, input.taskId);
        }

        Id learningPathId = validateLearningPath(participantId, input.learningPathEntryId);
        if (learningPathId == null && task != null) {
            learningPathId = task.LearningPathEntry__c;
        }

        Id programWeekId = idOrNull(input.programWeekId);
        if (programWeekId == null && task != null) {
            programWeekId = task.ProgramWeek__c;
        }

        Workbook_Evidence__c evidence = new Workbook_Evidence__c(
            Participant__c = participantId,
            Task__c = task == null ? null : task.Id,
            Type__c = type,
            Title__c = title,
            URL__c = String.isBlank(url) ? null : url,
            Note__c = String.isBlank(note) ? null : note,
            FeedbackStatus__c = input.requestFeedback == true
                ? FEEDBACK_REQUESTED
                : FEEDBACK_NONE,
            LearningPathEntry__c = learningPathId,
            ProgramWeek__c = programWeekId
        );
        insertRow(evidence, 'EVIDENCE_CREATE_FAILED');
        audit(
            'created',
            'workbook.evidence.added',
            'Workbook_Evidence__c',
            evidence.Id,
            participantId,
            'Evidence added'
        );
        return toEvidenceView(evidence);
    }

    global static EvidenceView updateEvidence(
        Id participantId,
        Id evidenceId,
        EvidencePatch patch
    ) {
        if (patch == null) {
            throw badRequest('BAD_REQUEST', 'An evidence patch is required.');
        }
        Workbook_Evidence__c evidence = findOwnedEvidence(participantId, evidenceId);

        String title = patch.title == null ? evidence.Title__c : trim(patch.title);
        String url = patch.url == null ? evidence.URL__c : trim(patch.url);
        String note = patch.note == null ? evidence.Note__c : trim(patch.note);
        validateEvidenceContent(evidence.Type__c, title, url, note);

        if (patch.title != null) {
            evidence.Title__c = title;
        }
        if (patch.url != null) {
            evidence.URL__c = String.isBlank(url) ? null : url;
        }
        if (patch.note != null) {
            evidence.Note__c = String.isBlank(note) ? null : note;
        }
        if (!String.isBlank(patch.feedbackStatus)) {
            String status = trim(patch.feedbackStatus);
            if (status != FEEDBACK_NONE && status != FEEDBACK_REQUESTED) {
                throw badRequest(
                    'BAD_FEEDBACK_STATUS',
                    'Participants can only clear or request feedback.'
                );
            }
            evidence.FeedbackStatus__c = status;
        }

        updateRow(evidence, 'EVIDENCE_UPDATE_FAILED');
        return toEvidenceView(evidence);
    }

    // ---------------------------------------------------------------------
    // Week review
    // ---------------------------------------------------------------------

    global static ReviewView getReview(Id participantId, Date weekStart) {
        Date monday = validateMonday(weekStart);
        Workbook_Week_Review__c review = findReview(participantId, monday);
        return review == null
            ? virtualReview(monday)
            : toReviewView(review);
    }

    global static ReviewView updateReview(
        Id participantId,
        Date weekStart,
        ReviewPatch patch
    ) {
        if (patch == null) {
            throw badRequest('BAD_REQUEST', 'A review patch is required.');
        }
        Date monday = validateMonday(weekStart);
        Workbook_Week_Review__c review = ensureReview(participantId, monday);

        if (patch.proudOf != null) {
            review.ProudOf__c = truncate(patch.proudOf, 1000, 'REVIEW_TEXT_TOO_LONG');
        }
        if (patch.clearerNow != null) {
            review.ClearerNow__c = truncate(patch.clearerNow, 1000, 'REVIEW_TEXT_TOO_LONG');
        }
        if (patch.nextWeekFocus != null) {
            review.NextWeekFocus__c = truncate(
                patch.nextWeekFocus,
                2000,
                'REVIEW_TEXT_TOO_LONG'
            );
        }
        if (patch.supportWish != null) {
            review.SupportWish__c = truncate(patch.supportWish, 1000, 'REVIEW_TEXT_TOO_LONG');
        }

        Boolean submittedNow = false;
        if (!String.isBlank(patch.status)) {
            String status = trim(patch.status);
            if (status != 'Draft' && status != 'Submitted') {
                throw badRequest('BAD_REVIEW_STATUS', 'Unknown review status.');
            }
            if (status == 'Submitted') {
                applyReviewSnapshot(participantId, review);
                if (review.SubmittedAt__c == null) {
                    review.SubmittedAt__c = Datetime.now();
                }
                submittedNow = true;
            }
            review.Status__c = status;
        }

        updateRow(review, 'REVIEW_UPDATE_FAILED');

        if (submittedNow) {
            audit(
                'submitted',
                'workbook.review.submitted',
                'Workbook_Week_Review__c',
                review.Id,
                participantId,
                'Week review submitted'
            );
        }
        return toReviewView(review);
    }

    // ---------------------------------------------------------------------
    // Queries and helpers
    // ---------------------------------------------------------------------

    global static Date currentDate() {
        if (todayOverride != null) {
            return todayOverride;
        }
        TimeZone berlin = TimeZone.getTimeZone('Europe/Berlin');
        Datetime now = Datetime.now();
        Integer offsetMillis = berlin.getOffset(now);
        return now.addSeconds(offsetMillis / 1000).date();
    }

    private static Workbook_Day__c findDay(Id participantId, Date targetDate) {
        String key = key(participantId, targetDate);
        List<Workbook_Day__c> rows = [
            SELECT
                Id,
                Participant__c,
                Date__c,
                ParticipantDateKey__c,
                Status__c,
                Focus__c,
                SupportStatus__c,
                SupportNote__c,
                SelfRating__c,
                NextStep__c,
                CheckInAt__c,
                CheckInSource__c,
                ClosedAt__c,
                LastReopenedAt__c
            FROM Workbook_Day__c
            WHERE ParticipantDateKey__c = :key
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            return null;
        }
        if (rows[0].Participant__c != participantId) {
            throw forbidden('DAY_NOT_OWNED', 'This workbook day belongs to another participant.');
        }
        return rows[0];
    }

    private static Workbook_Day__c findOwnedDay(Id participantId, String dayId) {
        if (String.isBlank(dayId)) {
            return null;
        }
        List<Workbook_Day__c> rows = [
            SELECT
                Id,
                Participant__c,
                Date__c,
                ParticipantDateKey__c,
                Status__c,
                Focus__c,
                SupportStatus__c,
                SupportNote__c,
                SelfRating__c,
                NextStep__c,
                CheckInAt__c,
                CheckInSource__c,
                ClosedAt__c,
                LastReopenedAt__c
            FROM Workbook_Day__c
            WHERE Id = :dayId AND Participant__c = :participantId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('DAY_NOT_FOUND', 'Workbook day not found.');
        }
        return rows[0];
    }

    private static Workbook_Day__c ensureDay(Id participantId, Date targetDate) {
        if (targetDate == null) {
            throw badRequest('BAD_DATE', 'A date is required.');
        }
        Workbook_Day__c existing = findDay(participantId, targetDate);
        if (existing != null) {
            return existing;
        }
        Workbook_Day__c row = new Workbook_Day__c(
            Participant__c = participantId,
            Date__c = targetDate,
            ParticipantDateKey__c = key(participantId, targetDate),
            Status__c = DAY_OPEN
        );
        try {
            insert row;
            return row;
        } catch (DmlException error) {
            // Two tabs may create the same day at the same time. The unique
            // external id is the concurrency guard; re-read instead of failing.
            if (isDuplicate(error)) {
                Workbook_Day__c raced = findDay(participantId, targetDate);
                if (raced != null) {
                    return raced;
                }
            }
            throw dmlError(error, 'DAY_CREATE_FAILED');
        }
    }

    private static List<TaskView> listTasks(Id participantId, Date targetDate) {
        List<Workbook_Task__c> rows = [
            SELECT
                Id,
                Participant__c,
                OriginDay__c,
                PlannedDate__c,
                Title__c,
                Status__c,
                Source__c,
                IsFocus__c,
                NeedsSupport__c,
                SupportNote__c,
                SortOrder__c,
                CompletedAt__c,
                LearningPathEntry__c,
                ProgramWeek__c,
                ScheduleEntry__c,
                CarriedFromTask__c,
                CreatedDate
            FROM Workbook_Task__c
            WHERE Participant__c = :participantId
                AND PlannedDate__c = :targetDate
            ORDER BY SortOrder__c ASC, CreatedDate ASC
        ];
        List<TaskView> views = new List<TaskView>();
        for (Workbook_Task__c row : rows) {
            views.add(toTaskView(row));
        }
        return views;
    }

    private static List<EvidenceView> listRecentEvidence(Id participantId, Integer maxRows) {
        List<Workbook_Evidence__c> rows = [
            SELECT
                Id,
                Participant__c,
                Task__c,
                Type__c,
                Title__c,
                URL__c,
                Note__c,
                FeedbackStatus__c,
                CoachFeedback__c,
                CoachFeedbackAt__c,
                LearningPathEntry__c,
                ProgramWeek__c,
                CreatedDate
            FROM Workbook_Evidence__c
            WHERE Participant__c = :participantId
            ORDER BY CreatedDate DESC
            LIMIT 20
        ];
        List<EvidenceView> views = new List<EvidenceView>();
        for (Workbook_Evidence__c row : rows) {
            views.add(toEvidenceView(row));
        }
        return views;
    }

    private static Workbook_Task__c findOwnedTask(Id participantId, Id taskId) {
        if (taskId == null) {
            throw badRequest('BAD_REQUEST', 'A task id is required.');
        }
        List<Workbook_Task__c> rows = [
            SELECT
                Id,
                Participant__c,
                OriginDay__c,
                PlannedDate__c,
                Title__c,
                Status__c,
                Source__c,
                IsFocus__c,
                NeedsSupport__c,
                SupportNote__c,
                SortOrder__c,
                CompletedAt__c,
                LearningPathEntry__c,
                ProgramWeek__c,
                ScheduleEntry__c,
                CarriedFromTask__c,
                CreatedDate
            FROM Workbook_Task__c
            WHERE Id = :taskId AND Participant__c = :participantId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('TASK_NOT_FOUND', 'Task not found.');
        }
        return rows[0];
    }

    private static Workbook_Evidence__c findOwnedEvidence(Id participantId, Id evidenceId) {
        if (evidenceId == null) {
            throw badRequest('BAD_REQUEST', 'An evidence id is required.');
        }
        List<Workbook_Evidence__c> rows = [
            SELECT
                Id,
                Participant__c,
                Task__c,
                Type__c,
                Title__c,
                URL__c,
                Note__c,
                FeedbackStatus__c,
                CoachFeedback__c,
                CoachFeedbackAt__c,
                LearningPathEntry__c,
                ProgramWeek__c,
                CreatedDate
            FROM Workbook_Evidence__c
            WHERE Id = :evidenceId AND Participant__c = :participantId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('EVIDENCE_NOT_FOUND', 'Evidence not found.');
        }
        return rows[0];
    }

    private static ScheduleEntry__c findVisibleScheduleEntry(
        Id participantId,
        String scheduleEntryId
    ) {
        Id entryId;
        try {
            entryId = Id.valueOf(scheduleEntryId);
        } catch (Exception ignored) {
            throw badRequest('BAD_SCHEDULE_ENTRY', 'Invalid schedule entry.');
        }

        List<ScheduleEntry__c> rows = [
            SELECT Id, Name, TargetType__c, Participant__c, ParticipantGroup__c
            FROM ScheduleEntry__c
            WHERE Id = :entryId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw notFound('SCHEDULE_ENTRY_NOT_FOUND', 'Schedule entry not found.');
        }
        ScheduleEntry__c entry = rows[0];
        if (entry.Participant__c != null && entry.Participant__c != participantId) {
            throw forbidden('SCHEDULE_ENTRY_NOT_VISIBLE', 'Schedule entry is not visible.');
        }
        if (entry.TargetType__c == 'Individual' && entry.Participant__c != participantId) {
            throw forbidden('SCHEDULE_ENTRY_NOT_VISIBLE', 'Schedule entry is not visible.');
        }
        if (entry.TargetType__c == 'Group' && entry.ParticipantGroup__c != null) {
            List<ParticipantGroupMember__c> members = [
                SELECT Id
                FROM ParticipantGroupMember__c
                WHERE Participant__c = :participantId
                    AND ParticipantGroup__c = :entry.ParticipantGroup__c
                LIMIT 1
            ];
            if (members.isEmpty()) {
                throw forbidden('SCHEDULE_ENTRY_NOT_VISIBLE', 'Schedule entry is not visible.');
            }
        }
        return entry;
    }

    private static Id validateLearningPath(Id participantId, String learningPathId) {
        if (String.isBlank(learningPathId)) {
            return null;
        }
        Id pathId;
        try {
            pathId = Id.valueOf(learningPathId);
        } catch (Exception ignored) {
            throw badRequest('BAD_LEARNING_PATH', 'Invalid learning path.');
        }
        List<Learning_Path__c> rows = [
            SELECT Id
            FROM Learning_Path__c
            WHERE Id = :pathId AND Participant__c = :participantId
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw badRequest('LEARNING_PATH_NOT_FOUND', 'Learning path not found.');
        }
        return pathId;
    }

    private static void assertFocusLimit(Id participantId, Date plannedDate, Id excludeTaskId) {
        Integer count;
        if (excludeTaskId == null) {
            count = [
                SELECT COUNT()
                FROM Workbook_Task__c
                WHERE Participant__c = :participantId
                    AND PlannedDate__c = :plannedDate
                    AND IsFocus__c = true
                    AND Status__c != :TASK_DROPPED
            ];
        } else {
            count = [
                SELECT COUNT()
                FROM Workbook_Task__c
                WHERE Participant__c = :participantId
                    AND PlannedDate__c = :plannedDate
                    AND IsFocus__c = true
                    AND Status__c != :TASK_DROPPED
                    AND Id != :excludeTaskId
            ];
        }
        if (count >= MAX_FOCUS_TASKS) {
            throw badRequest(
                'FOCUS_LIMIT',
                'At most three focus tasks are allowed per day.'
            );
        }
    }

    private static void validateEvidenceContent(
        String type,
        String title,
        String url,
        String note
    ) {
        if (type == EVIDENCE_LINK) {
            if (String.isBlank(title) || String.isBlank(url)) {
                throw badRequest(
                    'LINK_REQUIRES_TITLE_AND_URL',
                    'Link evidence needs a title and a URL.'
                );
            }
            if (!(url.startsWith('http://') || url.startsWith('https://'))) {
                throw badRequest('INVALID_URL', 'The URL must start with http:// or https://.');
            }
            truncate(title, 255, 'EVIDENCE_TITLE_TOO_LONG');
        } else if (type == EVIDENCE_NOTE) {
            if (String.isBlank(note)) {
                throw badRequest('NOTE_REQUIRED', 'Note evidence needs a note.');
            }
            truncate(note, 2000, 'EVIDENCE_NOTE_TOO_LONG');
        }
    }

    private static Workbook_Week_Review__c findReview(Id participantId, Date monday) {
        String weekKey = key(participantId, monday);
        List<Workbook_Week_Review__c> rows = [
            SELECT
                Id,
                Participant__c,
                ParticipantWeekKey__c,
                WeekStartDate__c,
                WeekEndDate__c,
                Status__c,
                ProudOf__c,
                ClearerNow__c,
                NextWeekFocus__c,
                SupportWish__c,
                SubmittedAt__c,
                GeneratedAt__c,
                TaskCount__c,
                CompletedTaskCount__c,
                EvidenceCount__c,
                SupportRequestCount__c,
                SummarySnapshot__c
            FROM Workbook_Week_Review__c
            WHERE ParticipantWeekKey__c = :weekKey
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            return null;
        }
        if (rows[0].Participant__c != participantId) {
            throw forbidden('REVIEW_NOT_OWNED', 'This review belongs to another participant.');
        }
        return rows[0];
    }

    private static Workbook_Week_Review__c ensureReview(Id participantId, Date monday) {
        Workbook_Week_Review__c existing = findReview(participantId, monday);
        if (existing != null) {
            return existing;
        }
        Workbook_Week_Review__c row = new Workbook_Week_Review__c(
            Participant__c = participantId,
            ParticipantWeekKey__c = key(participantId, monday),
            WeekStartDate__c = monday,
            WeekEndDate__c = monday.addDays(6),
            Status__c = 'Draft'
        );
        try {
            insert row;
            return row;
        } catch (DmlException error) {
            if (isDuplicate(error)) {
                Workbook_Week_Review__c raced = findReview(participantId, monday);
                if (raced != null) {
                    return raced;
                }
            }
            throw dmlError(error, 'REVIEW_CREATE_FAILED');
        }
    }

    private static void applyReviewSnapshot(
        Id participantId,
        Workbook_Week_Review__c review
    ) {
        Date weekStart = review.WeekStartDate__c;
        Date weekEnd = review.WeekEndDate__c;

        List<Workbook_Task__c> tasks = [
            SELECT Id, Status__c, NeedsSupport__c
            FROM Workbook_Task__c
            WHERE Participant__c = :participantId
                AND PlannedDate__c >= :weekStart
                AND PlannedDate__c <= :weekEnd
        ];
        Integer taskCount = tasks.size();
        Integer completed = 0;
        Integer supportRequests = 0;
        for (Workbook_Task__c task : tasks) {
            if (task.Status__c == TASK_DONE) {
                completed++;
            }
            if (task.NeedsSupport__c) {
                supportRequests++;
            }
        }

        List<Workbook_Day__c> supportDays = [
            SELECT Id, SupportStatus__c
            FROM Workbook_Day__c
            WHERE Participant__c = :participantId
                AND Date__c >= :weekStart
                AND Date__c <= :weekEnd
                AND SupportStatus__c != null
                AND SupportStatus__c != 'None'
        ];
        supportRequests += supportDays.size();

        Datetime startOfWeek = Datetime.newInstanceGmt(
            weekStart.year(),
            weekStart.month(),
            weekStart.day(),
            0,
            0,
            0
        );
        Datetime endOfWeek = Datetime.newInstanceGmt(
            weekEnd.addDays(1).year(),
            weekEnd.addDays(1).month(),
            weekEnd.addDays(1).day(),
            0,
            0,
            0
        );
        Integer evidenceCount = [
            SELECT COUNT()
            FROM Workbook_Evidence__c
            WHERE Participant__c = :participantId
                AND CreatedDate >= :startOfWeek
                AND CreatedDate < :endOfWeek
        ];

        review.TaskCount__c = taskCount;
        review.CompletedTaskCount__c = completed;
        review.EvidenceCount__c = evidenceCount;
        review.SupportRequestCount__c = supportRequests;
        review.GeneratedAt__c = Datetime.now();
        review.SummarySnapshot__c = JSON.serialize(
            new Map<String, Object>{
                'weekStartDate' => String.valueOf(weekStart),
                'weekEndDate' => String.valueOf(weekEnd),
                'taskCount' => taskCount,
                'completedTaskCount' => completed,
                'evidenceCount' => evidenceCount,
                'supportRequestCount' => supportRequests
            }
        );
    }

    private static DayView virtualDay(Date targetDate) {
        DayView view = new DayView();
        view.dateValue = String.valueOf(targetDate);
        view.status = DAY_OPEN;
        view.checkInAt = null;
        view.checkInSource = null;
        return view;
    }

    private static ReviewView virtualReview(Date monday) {
        ReviewView view = new ReviewView();
        view.weekStartDate = String.valueOf(monday);
        view.weekEndDate = String.valueOf(monday.addDays(6));
        view.status = 'Draft';
        view.taskCount = 0;
        view.completedTaskCount = 0;
        view.evidenceCount = 0;
        view.supportRequestCount = 0;
        return view;
    }

    private static DayView toDayView(Workbook_Day__c row) {
        DayView view = new DayView();
        view.id = row.Id;
        view.dateValue = String.valueOf(row.Date__c);
        view.status = row.Status__c;
        view.focus = row.Focus__c;
        view.supportStatus = row.SupportStatus__c;
        view.supportNote = row.SupportNote__c;
        view.selfRating = row.SelfRating__c;
        view.nextStep = row.NextStep__c;
        view.checkInAt = iso(row.CheckInAt__c);
        view.checkInSource = row.CheckInSource__c;
        view.closedAt = iso(row.ClosedAt__c);
        view.lastReopenedAt = iso(row.LastReopenedAt__c);
        return view;
    }

    private static TaskView toTaskView(Workbook_Task__c row) {
        TaskView view = new TaskView();
        view.id = row.Id;
        view.title = row.Title__c;
        view.status = row.Status__c;
        view.plannedDate = String.valueOf(row.PlannedDate__c);
        view.originDayId = row.OriginDay__c;
        view.isFocus = row.IsFocus__c == true;
        view.needsSupport = row.NeedsSupport__c == true;
        view.supportNote = row.SupportNote__c;
        view.sortOrder = row.SortOrder__c == null ? null : row.SortOrder__c.intValue();
        view.source = row.Source__c;
        view.completedAt = iso(row.CompletedAt__c);
        view.learningPathEntryId = row.LearningPathEntry__c;
        view.programWeekId = row.ProgramWeek__c;
        view.scheduleEntryId = row.ScheduleEntry__c;
        view.carriedFromTaskId = row.CarriedFromTask__c;
        view.createdAt = iso(row.CreatedDate);
        return view;
    }

    private static EvidenceView toEvidenceView(Workbook_Evidence__c row) {
        EvidenceView view = new EvidenceView();
        view.id = row.Id;
        view.type = row.Type__c;
        view.title = row.Title__c;
        view.url = row.URL__c;
        view.note = row.Note__c;
        view.feedbackStatus = row.FeedbackStatus__c;
        view.coachFeedback = row.CoachFeedback__c;
        view.coachFeedbackAt = iso(row.CoachFeedbackAt__c);
        view.taskId = row.Task__c;
        view.learningPathEntryId = row.LearningPathEntry__c;
        view.programWeekId = row.ProgramWeek__c;
        view.createdAt = iso(row.CreatedDate);
        return view;
    }

    private static ReviewView toReviewView(Workbook_Week_Review__c row) {
        ReviewView view = new ReviewView();
        view.id = row.Id;
        view.weekStartDate = String.valueOf(row.WeekStartDate__c);
        view.weekEndDate = String.valueOf(row.WeekEndDate__c);
        view.status = row.Status__c;
        view.proudOf = row.ProudOf__c;
        view.clearerNow = row.ClearerNow__c;
        view.nextWeekFocus = row.NextWeekFocus__c;
        view.supportWish = row.SupportWish__c;
        view.submittedAt = iso(row.SubmittedAt__c);
        view.generatedAt = iso(row.GeneratedAt__c);
        view.taskCount = row.TaskCount__c == null ? 0 : row.TaskCount__c.intValue();
        view.completedTaskCount = row.CompletedTaskCount__c == null
            ? 0
            : row.CompletedTaskCount__c.intValue();
        view.evidenceCount = row.EvidenceCount__c == null
            ? 0
            : row.EvidenceCount__c.intValue();
        view.supportRequestCount = row.SupportRequestCount__c == null
            ? 0
            : row.SupportRequestCount__c.intValue();
        view.summarySnapshot = row.SummarySnapshot__c;
        return view;
    }

    private static Date validateMonday(Date value) {
        if (value == null) {
            throw badRequest('BAD_WEEK_START', 'A week start date is required.');
        }
        if (mondayOf(value) != value) {
            throw badRequest('BAD_WEEK_START', 'Week start must be a Monday.');
        }
        return value;
    }

    private static Date mondayOf(Date value) {
        return value.toStartOfWeek();
    }

    private static Date parseDate(String value, String code, String message) {
        try {
            return Date.valueOf(value);
        } catch (Exception ignored) {
            throw badRequest(code, message);
        }
    }

    private static Id idOrNull(String value) {
        if (String.isBlank(value)) {
            return null;
        }
        try {
            return Id.valueOf(value);
        } catch (Exception ignored) {
            throw badRequest('BAD_ID', 'Invalid record id.');
        }
    }

    private static String key(Id participantId, Date value) {
        return String.valueOf(participantId) + '|' + String.valueOf(value);
    }

    private static String trim(String value) {
        return String.isBlank(value) ? null : value.trim();
    }

    private static String truncate(String value, Integer maxLength, String code) {
        if (value == null) {
            return null;
        }
        if (value.length() > maxLength) {
            throw badRequest(code, 'The text is too long (maximum ' + maxLength + ' characters).');
        }
        return value;
    }

    private static String iso(Datetime value) {
        if (value == null) {
            return null;
        }
        // Second precision: values read back from the database are truncated to
        // seconds, so returning milliseconds from an in-memory row would make
        // the same check-in look different on the next GET.
        return value.formatGmt('yyyy-MM-dd\'T\'HH:mm:ss\'Z\'');
    }

    private static void insertRow(SObject row, String code) {
        try {
            insert row;
        } catch (DmlException error) {
            throw dmlError(error, code);
        }
    }

    private static void updateRow(SObject row, String code) {
        try {
            update row;
        } catch (DmlException error) {
            throw dmlError(error, code);
        }
    }

    private static Boolean isDuplicate(DmlException error) {
        for (Integer index = 0; index < error.getNumDml(); index++) {
            if (error.getDmlStatusCode(index) == System.StatusCode.DUPLICATE_VALUE.name()) {
                return true;
            }
        }
        return false;
    }

    private static WorkbookException dmlError(DmlException error, String code) {
        String message = error.getNumDml() > 0
            ? error.getDmlMessage(0)
            : error.getMessage();
        WorkbookException mapped = new WorkbookException(message);
        mapped.init(400, code);
        return mapped;
    }

    private static WorkbookException badRequest(String code, String message) {
        WorkbookException error = new WorkbookException(message);
        error.init(400, code);
        return error;
    }

    private static WorkbookException forbidden(String code, String message) {
        WorkbookException error = new WorkbookException(message);
        error.init(403, code);
        return error;
    }

    private static WorkbookException notFound(String code, String message) {
        WorkbookException error = new WorkbookException(message);
        error.init(404, code);
        return error;
    }

    /**
     * Best-effort audit. The portal permission set deliberately does not grant
     * create on AuditEvent__c, so a portal write may be refused. The participant
     * action must still succeed; the failure is logged, not rethrown.
     */
    private static void audit(
        String action,
        String eventType,
        String subjectType,
        Id subjectId,
        Id participantId,
        String reason
    ) {
        try {
            String actorName = UserInfo.getName();
            insert new AuditEvent__c(
                Action__c = action,
                ActorDisplayName__c = actorName,
                ActorId__c = UserInfo.getUserId(),
                ActorType__c = 'participant',
                Domain__c = 'workbook',
                EventType__c = eventType,
                OccurredAt__c = Datetime.now(),
                ParticipantId__c = participantId,
                Reason__c = reason,
                SchemaVersion__c = 1,
                Sensitivity__c = 'normal',
                Source__c = 'web',
                SubjectId__c = String.valueOf(subjectId),
                SubjectType__c = subjectType,
                Visibility__c = 'participant'
            );
        } catch (Exception error) {
            System.debug(
                LoggingLevel.ERROR,
                'Workbook audit write failed for ' + eventType + ': ' + error.getMessage()
            );
        }
    }
}
