/**
 * Read-only weekly schedule for the signed-in portal user.
 *
 * ENDPOINT
 *   GET /services/apexrest/participant-portal/me/weekly-schedule
 *   Optional query param: weekStart=YYYY-MM-DD (must be a Monday).
 *
 * AUTHORISATION
 *   1. Identity via ParticipantPortalData.resolveForUser().
 *   2. No sharing rows for plan objects: this class runs `without sharing` and
 *      filters server-side (see isVisibleTo / merge). `Participant_Portal_Access`
 *      grants read + field access without viewAllRecords.
 *   3. Object + field permissions are enforced explicitly (WITH SECURITY_ENFORCED).
 *
 * ISOLATION CONTRACT
 *   A participant never receives a row whose Participant__c is set and differs
 *   from their own. The check runs before any TargetType evaluation.
 */
@RestResource(urlMapping='/participant-portal/me/weekly-schedule')
global without sharing class ParticipantPortalWeeklySchedule {

    global class ProgramWeekView {
        public String name;
        public Integer weekNumber;
    }

    global class WeekOption {
        public String weekStart;
        public String programWeekName;
        public Integer programWeekNumber;
    }

    global class EntryView {
        public String key;
        public String title;
        public String description;
        public String entryKind;
        public String type;
        public Boolean isRequired;
        public String dayOfWeek;
        public String dateValue;
        public String startTime;
        public String endTime;
        public Integer durationMinutes;
        public String targetType;
        public String coachName;
        public String location;
        public String meetingLink;
        public Integer order;
        public Boolean isCustomized;
    }

    global class WeeklyScheduleResponse {
        public String weekStart;
        public String weekEnd;
        public String effectiveScope;
        public List<String> appliedScopes;
        public ProgramWeekView programWeek;
        public List<WeekOption> weeks;
        public List<EntryView> entries;
        public String code;
        public String message;
    }

    @HttpGet
    global static WeeklyScheduleResponse getWeeklySchedule() {
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            ParticipantPortalData.ParticipantView pv =
                ParticipantPortalData.resolveForUser(UserInfo.getUserId());
            Id participantId = Id.valueOf(pv.participantId);

            List<Participant__c> pts = [
                SELECT Id, Program__c
                FROM Participant__c
                WHERE Id = :participantId
                LIMIT 1
            ];
            if (pts.isEmpty()) {
                throw identityError(404, 'NO_PARTICIPANT', 'This contact is not a participant yet.');
            }
            Id programId = pts[0].Program__c;

            Set<Id> groupIds = new Set<Id>();
            for (ParticipantGroupMember__c m : [
                SELECT ParticipantGroup__c
                FROM ParticipantGroupMember__c
                WHERE Participant__c = :participantId
            ]) {
                if (m.ParticipantGroup__c != null) {
                    groupIds.add(m.ParticipantGroup__c);
                }
            }

            Date requested = parseWeekStart(RestContext.request == null ? null : RestContext.request.params.get('weekStart'));
            Date weekStart = requested == null ? isoMonday(Date.today()) : requested;

            return buildResponse(participantId, programId, groupIds, weekStart);
        } catch (PortalIdentityException error) {
            System.debug(LoggingLevel.ERROR, 'ParticipantPortalWeeklySchedule identity: ' + error.getTypeName() + ': ' + error.getMessage());
            RestContext.response.statusCode = error.getStatusCode();
            WeeklyScheduleResponse r = new WeeklyScheduleResponse();
            r.code = (error.getStatusCode() >= 500) ? 'INTERNAL_ERROR' : error.getCode();
            r.message = (error.getStatusCode() >= 500) ? 'Schedule data unavailable.' : error.getMessage();
            return r;
        } catch (Exception error) {
            reportInternalError(error);
            RestContext.response.statusCode = 500;
            WeeklyScheduleResponse r = new WeeklyScheduleResponse();
            r.code = 'INTERNAL_ERROR';
            r.message = 'Schedule data unavailable.';
            return r;
        }
    }

    private static WeeklyScheduleResponse buildResponse(Id participantId, Id programId, Set<Id> groupIds, Date weekStart) {
        // Object/field permission gate (fail-closed).
        assertReadable();

        // All published instances of the participant's program (all weeks).
        List<WeeklySchedule__c> allInstances = [
            SELECT Id, Name, ScopeType__c, Participant__c, ParticipantGroup__c,
                   StartDate__c, EndDate__c, Status__c, ProgramWeek__c,
                   ProgramWeek__r.Name, ProgramWeek__r.Number__c
            FROM WeeklySchedule__c
            WHERE Status__c = 'Published'
              AND ProgramWeek__c IN (SELECT Id FROM ProgramWeek__c WHERE Program__c = :programId)
        ];

        // Group by week.
        Map<Date, List<WeeklySchedule__c>> byWeek = new Map<Date, List<WeeklySchedule__c>>();
        for (WeeklySchedule__c inst : allInstances) {
            if (inst.StartDate__c == null) continue;
            if (!byWeek.containsKey(inst.StartDate__c)) {
                byWeek.put(inst.StartDate__c, new List<WeeklySchedule__c>());
            }
            byWeek.get(inst.StartDate__c).add(inst);
        }

        // Applicable instances per week.
        Map<Date, List<WeeklySchedule__c>> applicableByWeek = new Map<Date, List<WeeklySchedule__c>>();
        for (Date w : byWeek.keySet()) {
            List<WeeklySchedule__c> app = new List<WeeklySchedule__c>();
            for (WeeklySchedule__c inst : byWeek.get(w)) {
                if (inst.ScopeType__c == 'Course') {
                    app.add(inst);
                } else if (inst.ScopeType__c == 'Group' && inst.ParticipantGroup__c != null && groupIds.contains(inst.ParticipantGroup__c)) {
                    app.add(inst);
                } else if (inst.ScopeType__c == 'Individual' && inst.Participant__c == participantId) {
                    app.add(inst);
                }
            }
            if (!app.isEmpty()) {
                applicableByWeek.put(w, app);
            }
        }

        // Duplicate-instance guards.
        for (Date w : applicableByWeek.keySet()) {
            Integer courseCount = 0;
            Integer individualCount = 0;
            Set<String> groupSlots = new Set<String>();
            for (WeeklySchedule__c inst : applicableByWeek.get(w)) {
                if (inst.ScopeType__c == 'Course') courseCount++;
                else if (inst.ScopeType__c == 'Individual') individualCount++;
            }
            if (courseCount > 1 || individualCount > 1) {
                throw identityError(500, 'INTERNAL_ERROR', 'Duplicate schedule instance.');
            }
        }

        // Load entries for all applicable instances.
        Set<Id> applicableIds = new Set<Id>();
        for (List<WeeklySchedule__c> insts : applicableByWeek.values()) {
            for (WeeklySchedule__c inst : insts) applicableIds.add(inst.Id);
        }
        Map<Id, List<ScheduleEntry__c>> entriesByInstance = new Map<Id, List<ScheduleEntry__c>>();
        if (!applicableIds.isEmpty()) {
            for (ScheduleEntry__c e : [
                SELECT Id, WeeklySchedule__c, Description__c, EntryKind__c, Type__c, IsRequired__c,
                       DayOfWeek__c, Date__c, StartTime__c, EndTime__c, DurationMinutes__c,
                       TargetType__c, ParticipantGroup__c, Participant__c, Coach_Profile__c,
                       Location__c, MeetingLink__c, Order__c, IsCustomized__c
                FROM ScheduleEntry__c
                WHERE WeeklySchedule__c IN :applicableIds
                ]) {
                if (!entriesByInstance.containsKey(e.WeeklySchedule__c)) {
                    entriesByInstance.put(e.WeeklySchedule__c, new List<ScheduleEntry__c>());
                }
                entriesByInstance.get(e.WeeklySchedule__c).add(e);
            }
        }

        // Coach name resolution.
        Set<Id> profileIds = new Set<Id>();
        for (List<ScheduleEntry__c> es : entriesByInstance.values()) {
            for (ScheduleEntry__c e : es) {
                if (e.Coach_Profile__c != null) profileIds.add(e.Coach_Profile__c);
            }
        }
        Map<Id, String> coachNames = new Map<Id, String>();
        if (!profileIds.isEmpty()) {
            for (Coach_Profile__c p : [
                SELECT Id, Name FROM Coach_Profile__c WHERE Id IN :profileIds
                ]) {
                coachNames.put(p.Id, p.Name);
            }
        }

        // Build weeks list (only weeks with >=1 visible entry).
        List<WeekOption> weeks = new List<WeekOption>();
        List<Date> sortedWeeks = new List<Date>(applicableByWeek.keySet());
        sortedWeeks.sort();
        for (Date w : sortedWeeks) {
            List<WeeklySchedule__c> insts = applicableByWeek.get(w);
            // visibility check
            Boolean anyVisible = false;
            for (WeeklySchedule__c inst : insts) {
                for (ScheduleEntry__c e : entriesByInstance.get(inst.Id) == null ? new List<ScheduleEntry__c>() : entriesByInstance.get(inst.Id)) {
                    if (isVisibleTo(e, participantId, groupIds)) { anyVisible = true; break; }
                }
                if (anyVisible) break;
            }
            if (!anyVisible) continue;
            // representative instance for programWeek (prefer Course)
            WeeklySchedule__c rep = null;
            for (WeeklySchedule__c inst : insts) {
                if (inst.ScopeType__c == 'Course') { rep = inst; break; }
            }
            if (rep == null) rep = insts[0];
            WeekOption wo = new WeekOption();
            wo.weekStart = String.valueOf(w);
            wo.programWeekName = rep.ProgramWeek__r == null ? null : rep.ProgramWeek__r.Name;
            wo.programWeekNumber = rep.ProgramWeek__r == null ? null : (Integer) rep.ProgramWeek__r.Number__c;
            weeks.add(wo);
        }

        // Build response for the requested week.
        WeeklyScheduleResponse resp = new WeeklyScheduleResponse();
        resp.weekStart = String.valueOf(weekStart);
        resp.weekEnd = String.valueOf(weekStart.addDays(6));
        resp.weeks = weeks;
        resp.entries = new List<EntryView>();

        List<WeeklySchedule__c> selInsts = applicableByWeek.get(weekStart);
        if (selInsts == null || selInsts.isEmpty()) {
            resp.effectiveScope = null;
            resp.appliedScopes = new List<String>();
            resp.programWeek = null;
            resp.code = null;
            resp.message = null;
            return resp;
        }

        // Representative programWeek
        WeeklySchedule__c rep = null;
        for (WeeklySchedule__c inst : selInsts) {
            if (inst.ScopeType__c == 'Course') { rep = inst; break; }
        }
        if (rep == null) rep = selInsts[0];
        ProgramWeekView pw = new ProgramWeekView();
        pw.name = rep.ProgramWeek__r == null ? null : rep.ProgramWeek__r.Name;
        pw.weekNumber = rep.ProgramWeek__r == null ? null : (Integer) rep.ProgramWeek__r.Number__c;
        resp.programWeek = pw;

        // Collect entries per scope.
        List<ScheduleEntry__c> courseEntries = new List<ScheduleEntry__c>();
        List<ScheduleEntry__c> groupEntries = new List<ScheduleEntry__c>();
        List<ScheduleEntry__c> individualEntries = new List<ScheduleEntry__c>();
        for (WeeklySchedule__c inst : selInsts) {
            List<ScheduleEntry__c> es = entriesByInstance.get(inst.Id);
            if (es == null) continue;
            if (inst.ScopeType__c == 'Course') courseEntries.addAll(es);
            else if (inst.ScopeType__c == 'Group') groupEntries.addAll(es);
            else if (inst.ScopeType__c == 'Individual') individualEntries.addAll(es);
        }

        // Filter visible.
        courseEntries = filterVisible(courseEntries, participantId, groupIds);
        groupEntries = filterVisible(groupEntries, participantId, groupIds);
        individualEntries = filterVisible(individualEntries, participantId, groupIds);

        // Slot uniqueness within each scope.
        assertUniqueSlots(groupEntries, 'Group');
        assertUniqueSlots(individualEntries, 'Individual');
        // Course: allow duplicates? No — treat as data error too.
        assertUniqueSlots(courseEntries, 'Course');

        // Merge Course -> Group -> Individual.
        List<ScheduleEntry__c> merged = new List<ScheduleEntry__c>();
        Map<String, Integer> slotIndex = new Map<String, Integer>();
        for (ScheduleEntry__c e : courseEntries) {
            String k = slotKey(e);
            if (k != null && slotIndex.containsKey(k)) {
                throw identityError(500, 'INTERNAL_ERROR', 'Slot conflict.');
            }
            if (k != null) slotIndex.put(k, merged.size());
            merged.add(e);
        }
        for (ScheduleEntry__c e : groupEntries) {
            String k = slotKey(e);
            if (k != null && slotIndex.containsKey(k)) {
                merged.set(slotIndex.get(k), e);
            } else {
                if (k != null) slotIndex.put(k, merged.size());
                merged.add(e);
            }
        }
        for (ScheduleEntry__c e : individualEntries) {
            String k = slotKey(e);
            if (k != null && slotIndex.containsKey(k)) {
                merged.set(slotIndex.get(k), e);
            } else {
                if (k != null) slotIndex.put(k, merged.size());
                merged.add(e);
            }
        }

        // appliedScopes
        List<String> applied = new List<String>();
        // simpler: track which scopes had an applicable instance
        applied = new List<String>();
        Boolean hasCourse = false, hasGroup = false, hasIndividual = false;
        for (WeeklySchedule__c inst : selInsts) {
            if (inst.ScopeType__c == 'Course') hasCourse = true;
            else if (inst.ScopeType__c == 'Group') hasGroup = true;
            else if (inst.ScopeType__c == 'Individual') hasIndividual = true;
        }
        if (hasCourse) applied.add('Course');
        if (hasGroup) applied.add('Group');
        if (hasIndividual) applied.add('Individual');

        resp.effectiveScope = hasIndividual ? 'Individual' : (hasGroup ? 'Group' : 'Course');
        resp.appliedScopes = applied;

        // Map to DTO.
        for (ScheduleEntry__c e : merged) {
            resp.entries.add(toView(e, coachNames));
        }

        resp.code = null;
        resp.message = null;
        return resp;
    }

    private static List<ScheduleEntry__c> filterVisible(List<ScheduleEntry__c> entries, Id participantId, Set<Id> groupIds) {
        List<ScheduleEntry__c> out = new List<ScheduleEntry__c>();
        for (ScheduleEntry__c e : entries) {
            if (isVisibleTo(e, participantId, groupIds)) out.add(e);
        }
        return out;
    }

    @TestVisible
    private static Boolean isVisibleTo(ScheduleEntry__c e, Id participantId, Set<Id> groupIds) {
        if (e == null) return false;
        if (e.Participant__c != null && e.Participant__c != participantId) return false;
        String t = e.TargetType__c;
        if (String.isBlank(t)) return false;
        if (t == 'Course') return true;
        if (t == 'Group') return e.ParticipantGroup__c != null && groupIds.contains(e.ParticipantGroup__c);
        if (t == 'Individual') return e.Participant__c == participantId;
        return false;
    }

    @TestVisible
    private static String slotKey(ScheduleEntry__c e) {
        if (e == null || e.Order__c == null) return null;
        return e.DayOfWeek__c + '|' + String.valueOf(e.Order__c) + '|' + e.EntryKind__c;
    }

    private static void assertUniqueSlots(List<ScheduleEntry__c> entries, String label) {
        Set<String> seen = new Set<String>();
        for (ScheduleEntry__c e : entries) {
            String k = slotKey(e);
            if (k == null) continue;
            if (!seen.add(k)) {
                throw identityError(500, 'INTERNAL_ERROR', 'Slot conflict in ' + label + '.');
            }
        }
    }

    private static EntryView toView(ScheduleEntry__c e, Map<Id, String> coachNames) {
        EntryView v = new EntryView();
        v.key = slotKey(e);
        if (v.key == null) v.key = e.DayOfWeek__c + '|' + String.valueOf(e.Id);
        v.title = e.Name;
        v.description = e.Description__c;
        v.entryKind = e.EntryKind__c;
        v.type = e.Type__c;
        v.isRequired = e.IsRequired__c;
        v.dayOfWeek = e.DayOfWeek__c;
        v.dateValue = e.Date__c == null ? null : String.valueOf(e.Date__c);
        v.startTime = e.StartTime__c == null ? null : String.valueOf(e.StartTime__c);
        v.endTime = e.EndTime__c == null ? null : String.valueOf(e.EndTime__c);
        v.durationMinutes = e.DurationMinutes__c == null ? null : Integer.valueOf(e.DurationMinutes__c);
        v.targetType = e.TargetType__c;
        v.coachName = e.Coach_Profile__c == null ? null : coachNames.get(e.Coach_Profile__c);
        v.location = e.Location__c;
        v.meetingLink = e.MeetingLink__c;
        v.order = e.Order__c == null ? null : Integer.valueOf(e.Order__c);
        v.isCustomized = e.IsCustomized__c;
        return v;
    }

    @TestVisible
    private static Date isoMonday(Date d) {
        if (d == null) return null;
        Date anchor = Date.newInstance(1900, 1, 1); // a Monday
        Integer diffMod = Math.mod(d.daysBetween(anchor), 7);
        Integer daysBack = Math.mod(7 - diffMod, 7);
        return d.addDays(-daysBack);
    }

    @TestVisible
    private static Date parseWeekStart(String raw) {
        if (String.isBlank(raw)) return null;
        Date parsed;
        try {
            parsed = Date.valueOf(raw);
        } catch (Exception e) {
            PortalIdentityException ex = new PortalIdentityException('weekStart must be yyyy-MM-dd.');
            ex.init(400, 'BAD_WEEK_START');
            throw ex;
        }
        if (parsed == null || isoMonday(parsed) != parsed) {
            PortalIdentityException ex = new PortalIdentityException('weekStart must be a Monday.');
            ex.init(400, 'BAD_WEEK_START');
            throw ex;
        }
        return parsed;
    }

    private static PortalIdentityException identityError(Integer status, String code, String message) {
        PortalIdentityException e = new PortalIdentityException(message);
        e.init(status, code);
        return e;
    }

    private static void assertReadable() {
        if (!Schema.sObjectType.WeeklySchedule__c.isAccessible()
            || !Schema.sObjectType.ScheduleEntry__c.isAccessible()
            || !Schema.sObjectType.ProgramWeek__c.isAccessible()
            || !Schema.sObjectType.Coach_Profile__c.isAccessible()
            || !Schema.sObjectType.ParticipantGroup__c.isAccessible()
            || !Schema.sObjectType.ParticipantGroupMember__c.isAccessible()) {
            throw identityError(500, 'INTERNAL_ERROR', 'Schedule data unavailable.');
        }
        // Field-level (only the fields the queries select).
        Map<String, Schema.SObjectField> ws = Schema.sObjectType.WeeklySchedule__c.fields.getMap();
        for (String f : new String[]{'ScopeType__c','Participant__c','ParticipantGroup__c','StartDate__c','Status__c','ProgramWeek__c'}) {
            if (ws.get(f) == null || !ws.get(f).getDescribe().isAccessible()) throw identityError(500, 'INTERNAL_ERROR', 'Schedule data unavailable.');
        }
        Map<String, Schema.SObjectField> se = Schema.sObjectType.ScheduleEntry__c.fields.getMap();
        for (String f : new String[]{'WeeklySchedule__c','Description__c','EntryKind__c','Type__c','IsRequired__c','DayOfWeek__c','Date__c','StartTime__c','EndTime__c','DurationMinutes__c','TargetType__c','ParticipantGroup__c','Participant__c','Coach_Profile__c','Location__c','MeetingLink__c','Order__c','IsCustomized__c'}) {
            if (se.get(f) == null || !se.get(f).getDescribe().isAccessible()) throw identityError(500, 'INTERNAL_ERROR', 'Schedule data unavailable.');
        }
        Map<String, Schema.SObjectField> pw = Schema.sObjectType.ProgramWeek__c.fields.getMap();
        for (String f : new String[]{'Name','Number__c','Program__c'}) {
            if (pw.get(f) == null || !pw.get(f).getDescribe().isAccessible()) throw identityError(500, 'INTERNAL_ERROR', 'Schedule data unavailable.');
        }
        Map<String, Schema.SObjectField> cp = Schema.sObjectType.Coach_Profile__c.fields.getMap();
        if (cp.get('Name') == null || !cp.get('Name').getDescribe().isAccessible()) throw identityError(500, 'INTERNAL_ERROR', 'Schedule data unavailable.');
    }

    private static void reportInternalError(Exception error) {
        System.debug(LoggingLevel.ERROR, 'ParticipantPortalWeeklySchedule failed: ' + error.getTypeName() + ': ' + error.getMessage());
    }
}
