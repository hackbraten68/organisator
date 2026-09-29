@IsTest
public class AbsenceStatusAuditTest {
  @TestSetup
  static void makeData() {
    // Participant__c.Contact__c is required, so a participant cannot be
    // created without a contact any more.
    insert new Account(Name = 'Codingschule Academy');
    insert new Contact(
      FirstName = 'Test',
      LastName = 'Teilnehmer',
      Email = 'absence.audit@example.invalid',
      AccountId = [SELECT Id FROM Account LIMIT 1]
      .Id
    );

    Participant__c participant = new Participant__c(
      Name = 'TestParticipant',
      Status__c = 'Active',
      Contact__c = [
        SELECT Id
        FROM Contact
        WHERE Email = 'absence.audit@example.invalid'
        LIMIT 1
      ]
      .Id
    );
    insert participant;

    insert new Absence__c(
      Participant__c = participant.Id,
      Type__c = 'Urlaub',
      Status__c = 'Submitted',
      StartDate__c = Date.today(),
      EndDate__c = Date.today()
    );
  }

  @IsTest
  static void approveStampsAtAndBy() {
    Absence__c absence = [
      SELECT Id, ApprovedAt__c, ApprovedBy__c
      FROM Absence__c
      LIMIT 1
    ];

    Test.startTest();
    absence.Status__c = 'Approved';
    update absence;
    Test.stopTest();

    Absence__c updated = [
      SELECT ApprovedAt__c, ApprovedBy__c
      FROM Absence__c
      WHERE Id = :absence.Id
    ];
    System.assertNotEquals(
      null,
      updated.ApprovedAt__c,
      'ApprovedAt__c must be stamped'
    );
    System.assertEquals(
      UserInfo.getUserId(),
      updated.ApprovedBy__c,
      'ApprovedBy__c must be the running user'
    );
  }

  @IsTest
  static void rejectStampsAtByAndKeepsComment() {
    Absence__c absence = [SELECT Id FROM Absence__c LIMIT 1];

    Test.startTest();
    absence.Status__c = 'Rejected';
    absence.CoachComment__c = 'Zu kurzfristig';
    update absence;
    Test.stopTest();

    Absence__c updated = [
      SELECT RejectedAt__c, RejectedBy__c, CoachComment__c
      FROM Absence__c
      WHERE Id = :absence.Id
    ];
    System.assertNotEquals(
      null,
      updated.RejectedAt__c,
      'RejectedAt__c must be stamped'
    );
    System.assertEquals(
      UserInfo.getUserId(),
      updated.RejectedBy__c,
      'RejectedBy__c must be the running user'
    );
    System.assertEquals(
      'Zu kurzfristig',
      updated.CoachComment__c,
      'CoachComment__c must persist'
    );
  }

  @IsTest
  static void approvalClearsStaleRejection() {
    Absence__c absence = [SELECT Id FROM Absence__c LIMIT 1];

    absence.Status__c = 'Rejected';
    absence.CoachComment__c = 'abgelehnt';
    update absence;

    absence.Status__c = 'Approved';
    update absence;

    Absence__c updated = [
      SELECT ApprovedAt__c, RejectedAt__c, RejectedBy__c, CoachComment__c
      FROM Absence__c
      WHERE Id = :absence.Id
    ];
    System.assertNotEquals(null, updated.ApprovedAt__c);
    System.assertEquals(
      null,
      updated.RejectedAt__c,
      'RejectedAt__c must be cleared'
    );
    System.assertEquals(
      null,
      updated.RejectedBy__c,
      'RejectedBy__c must be cleared'
    );
    System.assertEquals(
      null,
      updated.CoachComment__c,
      'CoachComment__c must be cleared on approval'
    );
  }

  @IsTest
  static void unrelatedFieldChangeDoesNotRestamp() {
    Absence__c absence = [SELECT Id, Status__c FROM Absence__c LIMIT 1];
    absence.Status__c = 'Approved';
    update absence;
    Datetime firstStamp = [
      SELECT ApprovedAt__c
      FROM Absence__c
      WHERE Id = :absence.Id
    ]
    .ApprovedAt__c;

    absence.Reason__c = 'Familiärer Anlass';
    update absence;

    Datetime secondStamp = [
      SELECT ApprovedAt__c
      FROM Absence__c
      WHERE Id = :absence.Id
    ]
    .ApprovedAt__c;
    System.assertEquals(
      firstStamp,
      secondStamp,
      'ApprovedAt__c must not change on unrelated updates'
    );
  }
}
