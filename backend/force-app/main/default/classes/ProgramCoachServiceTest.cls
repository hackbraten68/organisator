@IsTest
public class ProgramCoachServiceTest {

    @TestSetup
    static void makeData() {
        insert new Program__c(Name = 'PC Program', Status__c = 'Draft', DurationWeeks__c = 1);
        User u = new User(
            FirstName = 'PC', LastName = 'Coach',
            Username = 'pccoach@pc.invalid',
            Email = 'pccoach@pc.invalid',
            Alias = 'pccoach',
            ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1].Id,
            TimeZoneSidKey = 'Europe/Berlin',
            LocaleSidKey = 'de_DE',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'de'
        );
        insert u;
        insert new Coach_Profile__c(Name = 'PC Coach', User__c = u.Id, Status__c = true);
    }

    @IsTest
    static void assignUndIsAssigned() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id profileId = [SELECT Id FROM Coach_Profile__c LIMIT 1].Id;

        System.assertEquals(false, ProgramCoachService.isAssignedToProgram(programId), 'vorher nicht zugeordnet');

        ProgramCoach__c row = ProgramCoachService.assignCoach(programId, profileId);
        System.assertNotEquals(null, row.Id, 'Zuordnung erstellt');

        // Idempotent
        ProgramCoach__c row2 = ProgramCoachService.assignCoach(programId, profileId);
        System.assertEquals(row.Id, row2.Id, 'idempotent');

        Id userId = [SELECT User__c FROM Coach_Profile__c WHERE Id = :profileId].User__c;
        System.assertEquals(true, ProgramCoachService.isAssignedToProgram(programId, userId), 'zugeordnet');

        Id profile = ProgramCoachService.resolveCoachProfileId(userId);
        System.assertEquals(profileId, profile, 'Profile aufgeloest');

        System.assertEquals(1, ProgramCoachService.assignedCoachProfileIds(programId).size(), 'genau eine Zuordnung');
    }

    @IsTest
    static void unassignEntferntZuordnung() {
        Id programId = [SELECT Id FROM Program__c LIMIT 1].Id;
        Id profileId = [SELECT Id FROM Coach_Profile__c LIMIT 1].Id;
        ProgramCoachService.assignCoach(programId, profileId);
        ProgramCoachService.unassignCoach(programId, profileId);
        System.assertEquals(0, ProgramCoachService.assignedCoachProfileIds(programId).size(), 'entfernt');
    }

    @IsTest
    static void fehlendeParameterWerdenAbgelehnt() {
        try {
            ProgramCoachService.assignCoach(null, null);
            System.assert(false, 'assign ohne Parameter muss fehlschlagen');
        } catch (ProgramCoachServiceException e) {
            System.assertEquals(400, e.getStatusCode());
        }
        try {
            ProgramCoachService.unassignCoach('a00000000000000AAA', 'a01000000000000AAA');
            // may succeed (no rows) or throw; either way no assertion
        } catch (ProgramCoachServiceException e) {
            // ok
        }
    }
}
