@IsTest
private class WorkbookServiceTest {

    private static Date testDay() {
        Date day = Date.newInstance(2026, 11, 5);
        WorkbookService.todayOverride = day;
        return day;
    }

    private static Participant__c createParticipant(String suffix) {
        Contact contact = new Contact(
            FirstName = 'Workbook',
            LastName = 'Test',
            Email = 'workbook-' + suffix + '@example.invalid'
        );
        insert contact;
        Participant__c participant = new Participant__c(
            Name = 'Workbook Test ' + suffix,
            Contact__c = contact.Id
        );
        insert participant;
        return participant;
    }

    private static WorkbookService.TaskView createTask(
        Id participantId,
        String title,
        Date plannedDate,
        Boolean isFocus
    ) {
        WorkbookService.TaskInput input = new WorkbookService.TaskInput();
        input.title = title;
        input.plannedDate = String.valueOf(plannedDate);
        input.isFocus = isFocus;
        return WorkbookService.createTask(participantId, input);
    }

    private static Date mondayOf(Date value) {
        Integer dayOfWeek = value.toStartOfWeek().daysBetween(value);
        return value.addDays(dayOfWeek == 0 ? -6 : 1 - dayOfWeek);
    }

    @IsTest
    static void todayIsReadOnlyUntilFirstWrite() {
        Participant__c participant = createParticipant('readonly');
        Date today = testDay();

        WorkbookService.TodayView view = WorkbookService.getToday(participant.Id, today);

        System.assertEquals(String.valueOf(today), view.dateValue);
        System.assertEquals(null, view.day.id, 'GET must not create a day row');
        System.assertEquals('Open', view.day.status);
        System.assertEquals(0, view.tasks.size());
        System.assertEquals(0, [
            SELECT COUNT()
            FROM Workbook_Day__c
            WHERE Participant__c = :participant.Id
        ]);
    }

    @IsTest
    static void checkInIsIdempotent() {
        Participant__c participant = createParticipant('checkin');
        Date today = testDay();

        WorkbookService.CheckInResult first = WorkbookService.checkIn(participant.Id, today);
        WorkbookService.CheckInResult second = WorkbookService.checkIn(participant.Id, today);

        System.assertEquals(false, first.alreadyCheckedIn);
        System.assertEquals(true, second.alreadyCheckedIn);
        System.assertNotEquals(null, first.day.checkInAt);
        System.assertEquals(first.day.checkInAt, second.day.checkInAt);
        System.assertEquals('Portal', first.day.checkInSource);
        System.assertEquals(1, [
            SELECT COUNT()
            FROM Workbook_Day__c
            WHERE Participant__c = :participant.Id AND Date__c = :today
        ]);
    }

    @IsTest
    static void checkInRejectsOtherDays() {
        Participant__c participant = createParticipant('checkin-past');
        Date today = testDay();

        try {
            WorkbookService.checkIn(participant.Id, today.addDays(-1));
            System.assert(false, 'Expected CHECK_IN_DATE_MISMATCH');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('CHECK_IN_DATE_MISMATCH', error.getCode());
        }
    }

    @IsTest
    static void focusLimitIsThreePerDay() {
        Participant__c participant = createParticipant('focus');
        Date today = testDay();

        createTask(participant.Id, 'Focus 1', today, true);
        createTask(participant.Id, 'Focus 2', today, true);
        createTask(participant.Id, 'Focus 3', today, true);
        WorkbookService.TaskView fourth = createTask(
            participant.Id,
            'Not focus yet',
            today,
            false
        );

        try {
            WorkbookService.TaskInput tooMany = new WorkbookService.TaskInput();
            tooMany.title = 'Focus 4';
            tooMany.plannedDate = String.valueOf(today);
            tooMany.isFocus = true;
            WorkbookService.createTask(participant.Id, tooMany);
            System.assert(false, 'Expected FOCUS_LIMIT');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('FOCUS_LIMIT', error.getCode());
        }

        try {
            WorkbookService.TaskPatch patch = new WorkbookService.TaskPatch();
            patch.isFocus = true;
            WorkbookService.updateTask(participant.Id, fourth.id, patch);
            System.assert(false, 'Expected FOCUS_LIMIT on update');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('FOCUS_LIMIT', error.getCode());
        }
    }

    @IsTest
    static void focusLimitIsPerDay() {
        Participant__c participant = createParticipant('focus-days');
        Date today = testDay();

        createTask(participant.Id, 'Focus 1', today, true);
        createTask(participant.Id, 'Focus 2', today, true);
        createTask(participant.Id, 'Focus 3', today, true);
        createTask(participant.Id, 'Tomorrow focus', today.addDays(1), true);
    }

    @IsTest
    static void carryOverMovesTheSameTask() {
        Participant__c participant = createParticipant('carry');
        Date today = testDay();
        WorkbookService.TaskView original = createTask(participant.Id, 'Carry me', today, false);

        WorkbookService.TaskPatch patch = new WorkbookService.TaskPatch();
        patch.carryOverToDate = String.valueOf(today.addDays(1));
        WorkbookService.TaskView moved = WorkbookService.updateTask(
            participant.Id,
            original.id,
            patch
        );

        System.assertEquals(original.id, moved.id);
        System.assertEquals(String.valueOf(today.addDays(1)), moved.plannedDate);
        System.assertEquals('CarryOver', moved.source);
        System.assertEquals(1, [
            SELECT COUNT()
            FROM Workbook_Task__c
            WHERE Participant__c = :participant.Id
        ]);
    }

    @IsTest
    static void completionStampsCompletedAt() {
        Participant__c participant = createParticipant('done');
        Date today = testDay();
        WorkbookService.TaskView task = createTask(participant.Id, 'Finish me', today, false);

        WorkbookService.TaskPatch patch = new WorkbookService.TaskPatch();
        patch.status = 'Done';
        WorkbookService.TaskView done = WorkbookService.updateTask(participant.Id, task.id, patch);

        System.assertEquals('Done', done.status);
        System.assertNotEquals(null, done.completedAt);

        WorkbookService.TaskPatch reopen = new WorkbookService.TaskPatch();
        reopen.status = 'Open';
        WorkbookService.TaskView reopened = WorkbookService.updateTask(
            participant.Id,
            task.id,
            reopen
        );
        System.assertEquals(null, reopened.completedAt);
    }

    @IsTest
    static void dailyCloseStampsClosedAt() {
        Participant__c participant = createParticipant('close');
        Date today = testDay();

        WorkbookService.DayPatch close = new WorkbookService.DayPatch();
        close.action = 'close';
        WorkbookService.DayView closed = WorkbookService.updateDay(
            participant.Id,
            today,
            close
        );
        System.assertEquals('Closed', closed.status);
        System.assertNotEquals(null, closed.closedAt);

        WorkbookService.DayPatch reopen = new WorkbookService.DayPatch();
        reopen.action = 'reopen';
        WorkbookService.DayView reopened = WorkbookService.updateDay(
            participant.Id,
            today,
            reopen
        );
        System.assertEquals('Reopened', reopened.status);
        System.assertNotEquals(null, reopened.lastReopenedAt);
    }

    @IsTest
    static void supportAndFocusAreSavedOnDay() {
        Participant__c participant = createParticipant('day-fields');
        Date today = testDay();

        WorkbookService.DayPatch patch = new WorkbookService.DayPatch();
        patch.focus = 'API design';
        patch.supportStatus = 'Question';
        patch.supportNote = 'Need a second opinion.';
        patch.selfRating = 'WithHelp';
        patch.nextStep = 'Ask coach tomorrow.';
        WorkbookService.DayView view = WorkbookService.updateDay(participant.Id, today, patch);

        System.assertEquals('API design', view.focus);
        System.assertEquals('Question', view.supportStatus);
        System.assertEquals('Need a second opinion.', view.supportNote);
        System.assertEquals('WithHelp', view.selfRating);
        System.assertEquals('Ask coach tomorrow.', view.nextStep);
    }

    @IsTest
    static void evidenceRequiresTheRightContent() {
        Participant__c participant = createParticipant('evidence');
        Date today = testDay();
        WorkbookService.TaskView task = createTask(participant.Id, 'Evidence task', today, false);

        WorkbookService.EvidenceInput note = new WorkbookService.EvidenceInput();
        note.type = 'Note';
        note.note = 'I learned how the REST endpoint resolves identity.';
        note.taskId = task.id;
        note.requestFeedback = true;
        WorkbookService.EvidenceView created = WorkbookService.createEvidence(
            participant.Id,
            note
        );
        System.assertEquals('Requested', created.feedbackStatus);
        System.assertEquals(task.id, created.taskId);

        WorkbookService.EvidenceInput brokenLink = new WorkbookService.EvidenceInput();
        brokenLink.type = 'Link';
        brokenLink.title = 'Without URL';
        try {
            WorkbookService.createEvidence(participant.Id, brokenLink);
            System.assert(false, 'Expected LINK_REQUIRES_TITLE_AND_URL');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('LINK_REQUIRES_TITLE_AND_URL', error.getCode());
        }

        WorkbookService.EvidenceInput link = new WorkbookService.EvidenceInput();
        link.type = 'Link';
        link.title = 'Design doc';
        link.url = 'https://example.invalid/design';
        WorkbookService.EvidenceView linked = WorkbookService.createEvidence(
            participant.Id,
            link
        );
        System.assertEquals('https://example.invalid/design', linked.url);
    }

    @IsTest
    static void weekReviewStoresSnapshotAndCounts() {
        Participant__c participant = createParticipant('review');
        Date today = testDay();
        Date monday = mondayOf(today);

        WorkbookService.TaskView done = createTask(participant.Id, 'Done task', today, true);
        createTask(participant.Id, 'Open task', today, false);
        WorkbookService.TaskPatch complete = new WorkbookService.TaskPatch();
        complete.status = 'Done';
        WorkbookService.updateTask(participant.Id, done.id, complete);

        WorkbookService.EvidenceInput note = new WorkbookService.EvidenceInput();
        note.type = 'Note';
        note.note = 'Review evidence.';
        WorkbookService.createEvidence(participant.Id, note);

        WorkbookService.DayPatch support = new WorkbookService.DayPatch();
        support.supportStatus = 'Blocked';
        WorkbookService.updateDay(participant.Id, today, support);

        WorkbookService.ReviewPatch patch = new WorkbookService.ReviewPatch();
        patch.proudOf = 'I shipped the endpoint.';
        patch.clearerNow = 'Identity resolution is server-side only.';
        patch.nextWeekFocus = 'Build the Today page.';
        patch.supportWish = 'A code review.';
        patch.status = 'Submitted';
        WorkbookService.ReviewView review = WorkbookService.updateReview(
            participant.Id,
            monday,
            patch
        );

        System.assertEquals('Submitted', review.status);
        System.assertNotEquals(null, review.submittedAt);
        System.assertNotEquals(null, review.summarySnapshot);
        System.assertEquals(2, review.taskCount);
        System.assertEquals(1, review.completedTaskCount);
        System.assertEquals(1, review.evidenceCount);
        System.assertEquals(1, review.supportRequestCount);
    }

    @IsTest
    static void weekReviewRejectsNonMonday() {
        Participant__c participant = createParticipant('review-monday');
        Date today = testDay();
        Date tuesday = mondayOf(today).addDays(1);

        try {
            WorkbookService.getReview(participant.Id, tuesday);
            System.assert(false, 'Expected BAD_WEEK_START');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('BAD_WEEK_START', error.getCode());
        }
    }

    @IsTest
    static void otherParticipantsTasksAreNotReachable() {
        Participant__c owner = createParticipant('owner');
        Participant__c other = createParticipant('other');
        Date today = testDay();
        WorkbookService.TaskView task = createTask(owner.Id, 'Private task', today, false);

        try {
            WorkbookService.TaskPatch patch = new WorkbookService.TaskPatch();
            patch.title = 'Hijacked';
            WorkbookService.updateTask(other.Id, task.id, patch);
            System.assert(false, 'Expected TASK_NOT_FOUND');
        } catch (WorkbookService.WorkbookException error) {
            System.assertEquals('TASK_NOT_FOUND', error.getCode());
        }
    }
}
