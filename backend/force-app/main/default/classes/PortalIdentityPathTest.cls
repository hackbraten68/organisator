/**
 * Proves the portal identity path holds in the data:
 *
 *   User.ContactId -> Participant__c WHERE Contact__c = :contactId
 *
 * The lookup is only unambiguous if the two invariants below hold. Neither needs
 * an Experience Cloud user, so they can be checked on every deploy instead of
 * waiting for the license-dependent spike (spike-sharing-1.5.md, Schritt 7/8).
 *
 * What this does NOT cover: whether an external user is *permitted* to read the
 * record it resolves to. That is sharing, and it is the open half of the spike.
 */
@IsTest
public class PortalIdentityPathTest {
  @TestSetup
  static void makeData() {
    insert new Account(Name = 'Portal Identity Path Test');
    Id accountId = [SELECT Id FROM Account LIMIT 1].Id;

    insert new List<Contact>{
      new Contact(
        FirstName = 'Path',
        LastName = 'Alpha',
        Email = 'path.alpha@example.invalid',
        AccountId = accountId
      ),
      new Contact(
        FirstName = 'Path',
        LastName = 'Beta',
        Email = 'path.beta@example.invalid',
        AccountId = accountId
      ),
      // Deliberately participant-less: a contact may exist without a role.
      new Contact(
        FirstName = 'Path',
        LastName = 'Gamma',
        Email = 'path.gamma@example.invalid',
        AccountId = accountId
      )
    };

    Id alpha = [
      SELECT Id
      FROM Contact
      WHERE Email = 'path.alpha@example.invalid'
      LIMIT 1
    ]
    .Id;
    Id beta = [
      SELECT Id
      FROM Contact
      WHERE Email = 'path.beta@example.invalid'
      LIMIT 1
    ]
    .Id;

    insert new List<Participant__c>{
      new Participant__c(Name = 'Path Alpha', Contact__c = alpha),
      new Participant__c(Name = 'Path Beta', Contact__c = beta)
    };
  }

  @IsTest
  static void everyParticipantHasAContact() {
    System.assertEquals(
      0,
      [SELECT COUNT() FROM Participant__c WHERE Contact__c = NULL],
      'Contact__c is required, so no participant may exist without one'
    );
  }

  @IsTest
  static void noContactOwnsTwoParticipants() {
    List<AggregateResult> duplicates = [
      SELECT Contact__c
      FROM Participant__c
      WHERE Contact__c != NULL
      GROUP BY Contact__c
      HAVING COUNT(Id) > 1
    ];

    System.assertEquals(
      0,
      duplicates.size(),
      'A contact maps to at most one participant role (ADR-001)'
    );
  }

  @IsTest
  static void resolvingByContactIdYieldsAtMostOneParticipant() {
    for (Contact contact : [SELECT Id FROM Contact]) {
      List<Participant__c> resolved = [
        SELECT Id
        FROM Participant__c
        WHERE Contact__c = :contact.Id
      ];

      System.assert(
        resolved.size() <= 1,
        'Resolving User.ContactId must never be ambiguous, got ' +
        resolved.size()
      );
    }
  }

  @IsTest
  static void aContactWithoutAParticipantResolvesToNothing() {
    Id gamma = [
      SELECT Id
      FROM Contact
      WHERE Email = 'path.gamma@example.invalid'
      LIMIT 1
    ]
    .Id;

    System.assertEquals(
      0,
      [SELECT COUNT() FROM Participant__c WHERE Contact__c = :gamma],
      'A contact without a role resolves to nothing, which the portal must handle'
    );
  }

  @IsTest
  static void theTriggerRejectsASecondRoleForTheSameContact() {
    Id alpha = [
      SELECT Id
      FROM Contact
      WHERE Email = 'path.alpha@example.invalid'
      LIMIT 1
    ]
    .Id;

    Test.startTest();
    try {
      insert new Participant__c(
        Name = 'Path Alpha Doppelt',
        Contact__c = alpha
      );
      System.assert(
        false,
        'A second participant for one contact must be rejected'
      );
    } catch (DmlException error) {
      System.assert(
        error.getMessage()
          .contains(DuplicateParticipantForContactException.CODE),
        'Expected the duplicate code, got: ' + error.getMessage()
      );
    }
    Test.stopTest();
  }
}
