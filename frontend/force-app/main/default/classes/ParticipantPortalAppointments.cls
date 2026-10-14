/**
 * Read-only appointments for the signed-in portal user.
 *
 * ENDPOINT
 *   GET /services/apexrest/participant-portal/me/appointments
 *   No parameters, deliberately — see "Authorisation".
 *
 * WHY THIS IS A SEPARATE @RestResource
 *   Apex allows only one @HttpGet per class, and it may not return Object. A
 *   dispatcher that string-matched the request URI was tried and reverted on
 *   ParticipantPortalLearningPath: it answered 200 with /me-shaped data for any
 *   unrecognised sub-path, because the '/participant-portal/*' wildcard matches
 *   '/me/anything'. One endpoint per class removes the problem, and this
 *   urlMapping has no wildcard, so it cannot claim another path.
 *
 * AUTHORISATION — three independent gates, all required
 *   1. Identity. resolveForUser() runs before anything is queried and asserts the
 *      caller resolves to a portal identity. Reached through ParticipantPortalData
 *      so the org has exactly one identity chain.
 *   2. Record sharing. Appointment__c is externally Private. ParticipantPortalSharingService
 *      releases one Read share per appointment to the owning portal user under the
 *      Portal_Access__c reason, via AppointmentPortalSharing. This class runs
 *      'with sharing', so an appointment whose share was revoked is simply absent
 *      from the query — absence, not an error. That is fail-closed and intended.
 *   3. Object and field permission. The portal user profile grants no object
 *      access at all, so the query additionally needs Read on Appointment__c and
 *      field access to everything selected here, carried by Participant_Portal_Access.
 *      Omitting it surfaces as a QueryException that answers 500 for every
 *      signed-in member while a guest still gets a clean 401 — the endpoint looks
 *      healthy from outside the browser.
 *
 * WHY THE COACH NAME IS NOT READ FROM User
 *   Appointment__c.Coach__c is a lookup to User, but the portal gets no access to
 *   User. ParticipantPortalData has the same shape and resolves its coachName
 *   through Coach_Profile__c instead; here it runs the other way round, from the
 *   coach's User id back to Coach_Profile__c.User__c. That is only possible
 *   because Coach_Profile__c.User__c exists (added 2026-10-09).
 *
 *   A coach without a profile yields null rather than a placeholder: "Coach" in
 *   the UI would pass for a real name and hide a data-quality gap. The portal
 *   shows "Coach nicht verfügbar" for it. Two cases, both null:
 *     - Coach__c empty — nobody assigned
 *     - Coach__c set, no Coach_Profile__c points back at that User
 *
 * SIDE EFFECTS
 *   None. This is a read and must not write.
 */
@RestResource(urlMapping='/participant-portal/me/appointments')
global with sharing class ParticipantPortalAppointments {
    /**
     * Whitelisted response shape for a single appointment.
     *
     * Copied field by field rather than serialising the sObject, so a new column
     * on Appointment__c can never leak into the portal by accident.
     *
     * Notes__c and CorrelationId__c are deliberately absent: internal working
     * notes, not participant-facing content.
     */
    global class AppointmentItemView {
        public String appointmentId;
        public Datetime startTime;
        public Datetime endTime;
        public String status;
        public String type;
        public String location;
        public String meetingLink;
        public String cancellationReason;
        public String coachName;
    }

    /**
     * The HTTP boundary shape: items on success, code/message on failure.
     *
     * Salesforce serialises the returned object to JSON; RestContext.response is
     * not writable on this org's API version, so the status code is the only part
     * set through RestContext. `appointments` is the field name the UI bundle
     * reads — renaming it here breaks that client.
     */
    global class AppointmentResponse {
        public List<AppointmentItemView> appointments;
        public String code;
        public String message;

        global AppointmentResponse(List<AppointmentItemView> items) {
            this.appointments = items;
        }

        global AppointmentResponse(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    /**
     * GET /services/apexrest/participant-portal/me/appointments
     *
     * Returns the caller's appointments, most recent first. Cancelled ones are
     * included rather than filtered out: a participant needs to see that a
     * session was cancelled and why, not have it vanish.
     */
    @HttpGet
    global static AppointmentResponse getAppointments() {
        // Personal portal data: never let a shared cache hold it.
        RestContext.response.addHeader('Cache-Control', 'no-store, private');

        try {
            ParticipantPortalData.ParticipantView participant =
                ParticipantPortalData.resolveForUser(UserInfo.getUserId());
            return new AppointmentResponse(queryAppointments(participant.participantId));
        } catch (PortalIdentityException error) {
            RestContext.response.statusCode = error.getStatusCode();
            return new AppointmentResponse(error.getCode(), error.getMessage());
        } catch (Exception error) {
            // Never surface the raw exception: it would leak field names and ids.
            // The log is where the cause belongs — see reportInternalError().
            reportInternalError(error);
            RestContext.response.statusCode = 500;
            return new AppointmentResponse('INTERNAL_ERROR', 'Appointment data unavailable.');
        }
    }

    /**
     * Logs a caught exception at ERROR level.
     *
     * A silent catch-all is how this org answered 500 for every signed-in member
     * for a while: the QueryException naming the missing CRUD was discarded,
     * ApexLog stayed empty, and a guest could not reproduce it. Any new endpoint
     * needs its own copy of this or it inherits the same blindness.
     */
    private static void reportInternalError(Exception error) {
        System.debug(
            LoggingLevel.ERROR,
            'ParticipantPortalAppointments failed: ' + error.getTypeName() + ': ' + error.getMessage()
        );
    }

    /**
     * Reads the participant's appointments and maps them to the view.
     *
     * Private on purpose: the only caller is getAppointments(), and the id comes
     * from the resolved identity rather than from a parameter. There is no seam
     * to expose here because a share row cannot be created in a test at all —
     * see ParticipantPortalSharingServiceTest, which covers the plan directly.
     */
    private static List<AppointmentItemView> queryAppointments(Id participantId) {
        List<Appointment__c> rows = [
            SELECT
                Id,
                StartTime__c,
                EndTime__c,
                Status__c,
                Type__c,
                Location__c,
                MeetingLink__c,
                CancellationReason__c,
                Coach__c
            FROM Appointment__c
            WHERE Participant__c = :participantId
            ORDER BY StartTime__c DESC
        ];

        Map<Id, String> coachNamesByUserId = resolveCoachNames(rows);

        List<AppointmentItemView> items = new List<AppointmentItemView>();
        for (Appointment__c appointment : rows) {
            AppointmentItemView item = new AppointmentItemView();
            item.appointmentId = appointment.Id;
            item.startTime = appointment.StartTime__c;
            item.endTime = appointment.EndTime__c;
            item.status = appointment.Status__c;
            item.type = appointment.Type__c;
            item.location = appointment.Location__c;
            item.meetingLink = appointment.MeetingLink__c;
            item.cancellationReason = appointment.CancellationReason__c;
            item.coachName = appointment.Coach__c == null
                ? null
                : coachNamesByUserId.get(appointment.Coach__c);
            items.add(item);
        }
        return items;
    }

    /**
     * Maps each coach User id to a profile name, for the rows that have a coach.
     *
     * Goes Coach_Profile__c.User__c -> Coach_Profile__c.Name rather than reading
     * User.Name, because the portal user has no rights on User at all. A coach
     * without a profile is simply missing from the map, which the caller turns
     * into null.
     *
     * Global rather than private, which the rest of this class is not: it is the
     * one piece of logic here that does NOT need a share row to exercise, and a
     * share row cannot be created in an Apex test at all (see
     * ParticipantPortalSharingServiceTest for why the sharing logic asserts on a
     * plan instead). Without this seam the three branches — no coach, coach with
     * a profile, coach without one — would ship untested, and the third is
     * exactly the case that produced the "Coach nicht verfügbar" decision.
     */
    global static Map<Id, String> resolveCoachNames(List<Appointment__c> appointments) {
        Set<Id> coachUserIds = new Set<Id>();
        for (Appointment__c appointment : appointments) {
            if (appointment.Coach__c != null) {
                coachUserIds.add(appointment.Coach__c);
            }
        }

        Map<Id, String> names = new Map<Id, String>();
        if (coachUserIds.isEmpty()) {
            return names;
        }

        for (Coach_Profile__c profile : [
            SELECT User__c, Name
            FROM Coach_Profile__c
            WHERE User__c IN :coachUserIds
                AND User__c != null
        ]) {
            names.put(profile.User__c, profile.Name);
        }
        return names;
    }
}
