/**
 * Persistente Coach↔Programm-Zuordnung (F7).
 *
 * Ersetzt den fluechtigen programCoachSeed (programService.ts). Die Zuordnung
 * ist serverseitig pruefbar: isAssignedToProgram() nutzt UserInfo.getUserId()
 * und prueft gegen ProgramCoach__c — kein Vertrauen in clientseitige Flags.
 */
global with sharing class ProgramCoachService {
    public static final String CODE_BAD_REQUEST = 'BAD_REQUEST';
    public static final String CODE_NOT_FOUND = 'NOT_FOUND';
    public static final String CODE_AUDIT_FAILED = 'AUDIT_FAILED';
    public static final String CODE_INTERNAL = 'INTERNAL_ERROR';

    public static Id resolveCoachProfileId(String userId) {
        if (String.isBlank(userId)) {
            return null;
        }
        List<Coach_Profile__c> profiles = [
            SELECT Id
            FROM Coach_Profile__c
            WHERE User__c = :userId
            LIMIT 1
        ];
        return profiles.isEmpty() ? null : profiles[0].Id;
    }

    public static Boolean isAssignedToProgram(String programId) {
        return isAssignedToProgram(programId, UserInfo.getUserId());
    }

    public static Boolean isAssignedToProgram(String programId, String userId) {
        if (String.isBlank(programId) || String.isBlank(userId)) {
            return false;
        }
        Id profileId = resolveCoachProfileId(userId);
        if (profileId == null) {
            return false;
        }
        Integer count = [
            SELECT COUNT()
            FROM ProgramCoach__c
            WHERE Program__c = :programId
              AND Coach_Profile__c = :profileId
        ];
        return count > 0;
    }

    public static List<Id> assignedCoachProfileIds(String programId) {
        if (String.isBlank(programId)) {
            return new List<Id>();
        }
        List<Id> ids = new List<Id>();
        for (ProgramCoach__c row : [
            SELECT Coach_Profile__c
            FROM ProgramCoach__c
            WHERE Program__c = :programId
        ]) {
            ids.add(row.Coach_Profile__c);
        }
        return ids;
    }

    public static ProgramCoach__c assignCoach(String programId, String coachProfileId) {
        if (String.isBlank(programId) || String.isBlank(coachProfileId)) {
            throw badRequest('programId und coachProfileId sind erforderlich.');
        }
        // Idempotent: bestehende Zuordnung nicht doppelt anlegen.
        List<ProgramCoach__c> existing = [
            SELECT Id, Program__c, Coach_Profile__c
            FROM ProgramCoach__c
            WHERE Program__c = :programId
              AND Coach_Profile__c = :coachProfileId
            LIMIT 1
        ];
        if (!existing.isEmpty()) {
            return existing[0];
        }
        ProgramCoach__c row = new ProgramCoach__c(
            Program__c = programId,
            Coach_Profile__c = coachProfileId
        );
        insert row;
        return row;
    }

    public static void unassignCoach(String programId, String coachProfileId) {
        if (String.isBlank(programId) || String.isBlank(coachProfileId)) {
            throw badRequest('programId und coachProfileId sind erforderlich.');
        }
        delete [
            SELECT Id
            FROM ProgramCoach__c
            WHERE Program__c = :programId
              AND Coach_Profile__c = :coachProfileId
        ];
    }

    private static ProgramCoachServiceException badRequest(String message) {
        return new ProgramCoachServiceException(400, CODE_BAD_REQUEST, message);
    }
}
