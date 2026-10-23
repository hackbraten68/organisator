/**
 * Materialisiert einen Termin (Appointment__c) aus einer Planzeile.
 *
 * Nur fuer Eintraege mit TargetType = Individual. Typ-Mapping 1:1:
 * ist der Zielwert auf Appointment__c.Type__c nicht vorhanden, wird mit
 * 422 TYPE_NOT_MATERIALISABLE abgelehnt — kein stiller Fallback.
 */
global with sharing class ScheduleEntryMaterialisationService {
    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND';
    public static final String CODE_NOT_MATERIALISABLE = 'TYPE_NOT_MATERIALISABLE';
    public static final String CODE_NOT_EDITABLE = 'NOT_EDITABLE';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    public static Id materialise(String entryId) {
        if (String.isBlank(entryId)) {
            throw badRequest('entryId ist erforderlich.');
        }

        List<ScheduleEntry__c> entries = [
            SELECT Id, Name, WeeklySchedule__c, Date__c, StartTime__c, EndTime__c,
                   Type__c, TargetType__c, Participant__c, Coach_Profile__c,
                   Location__c, MeetingLink__c, Notes__c, Description__c
            FROM ScheduleEntry__c
            WHERE Id = :entryId
            LIMIT 1
        ];
        if (entries.isEmpty()) {
            throw notFound('Die Planzeile existiert nicht.');
        }
        ScheduleEntry__c entry = entries[0];

        if (entry.TargetType__c != 'Individual' || entry.Participant__c == null) {
            throw notMaterialisable('Nur individuelle Planzeilen mit Teilnehmer koennen materialisiert werden.');
        }
        if (entry.Date__c == null || entry.StartTime__c == null || entry.EndTime__c == null) {
            throw notMaterialisable('Die Planzeile hat kein gueltiges Datum/Zeitfenster.');
        }
        if (!picklistValues(Appointment__c.Type__c).contains(entry.Type__c)) {
            throw notMaterialisable('Der Aktivitaetstyp "' + entry.Type__c + '" ist auf Appointment__c.Type__c nicht vorhanden.');
        }

        Id coachUserId = null;
        if (entry.Coach_Profile__c != null) {
            List<Coach_Profile__c> profiles = [
                SELECT Id, User__c
                FROM Coach_Profile__c
                WHERE Id = :entry.Coach_Profile__c
                LIMIT 1
            ];
            if (!profiles.isEmpty()) {
                coachUserId = profiles[0].User__c;
            }
        }

        Datetime startDt = Datetime.newInstance(entry.Date__c, entry.StartTime__c);
        Datetime endDt = Datetime.newInstance(entry.Date__c, entry.EndTime__c);

        List<Appointment__c> existing = [
            SELECT Id, Status__c
            FROM Appointment__c
            WHERE ScheduleEntry__c = :entry.Id
            LIMIT 1
        ];

        Savepoint sp = Database.setSavepoint();
        try {
            if (existing.isEmpty()) {
                Appointment__c appt = new Appointment__c(
                    Participant__c = entry.Participant__c,
                    Coach__c = coachUserId,
                    Type__c = entry.Type__c,
                    Status__c = 'Draft',
                    StartTime__c = startDt,
                    EndTime__c = endDt,
                    Location__c = entry.Location__c,
                    MeetingLink__c = entry.MeetingLink__c,
                    Notes__c = entry.Notes__c,
                    ScheduleEntry__c = entry.Id
                );
                insert appt;
                return appt.Id;
            } else {
                Appointment__c appt = existing[0];
                if (appt.Status__c != 'Draft') {
                    throw new ScheduleMaterialisationException(409, CODE_NOT_EDITABLE, 'Der Termin kann nur im Status Draft aktualisiert werden.');
                }
                appt.Participant__c = entry.Participant__c;
                appt.Coach__c = coachUserId;
                appt.Type__c = entry.Type__c;
                appt.StartTime__c = startDt;
                appt.EndTime__c = endDt;
                appt.Location__c = entry.Location__c;
                appt.MeetingLink__c = entry.MeetingLink__c;
                appt.Notes__c = entry.Notes__c;
                update appt;
                return appt.Id;
            }
        } catch (ScheduleMaterialisationException e) {
            throw e;
        } catch (Exception e) {
            Database.rollback(sp);
            throw new ScheduleMaterialisationException(500, CODE_INTERNAL, e.getMessage());
        }
    }

    private static Set<String> picklistValues(Schema.SObjectField field) {
        Set<String> values = new Set<String>();
        for (Schema.PicklistEntry entry : field.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                values.add(entry.getValue());
            }
        }
        return values;
    }

    private static ScheduleMaterialisationException badRequest(String message) {
        return new ScheduleMaterialisationException(400, CODE_BAD_REQUEST, message);
    }

    private static ScheduleMaterialisationException notFound(String message) {
        return new ScheduleMaterialisationException(404, CODE_ENTRY_NOT_FOUND, message);
    }

    private static ScheduleMaterialisationException notMaterialisable(String message) {
        return new ScheduleMaterialisationException(422, CODE_NOT_MATERIALISABLE, message);
    }
}
