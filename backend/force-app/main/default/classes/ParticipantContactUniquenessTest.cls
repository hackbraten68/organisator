/**
 * Covers ParticipantContactUniqueness: one Participant__c per Contact.
 *
 * The update cases matter more than the insert cases. An update that leaves the
 * contact unchanged finds the record itself in the trigger's lookup map, so a
 * naive "is this contact taken?" check rejects its own no-op updates. That bug
 * is invisible in the insert path and would only surface in production, hence
 * the dedicated regression test.
 *
 * Ids are looked up per test rather than parked in static variables: on API 67
 * a static assigned inside @TestSetup is not visible inside the test method
 * (verified — the assert fires), so every test resolves what it needs itself.
 */
@IsTest
public class ParticipantContactUniquenessTest {
  private static final String AYLIN_EMAIL = 'aylin.yilmaz@example.invalid';
  private static final String JONAS_EMAIL = 'jonas.weber@example.invalid';

  @TestSetup
  static void makeData() {
    // Created rather than queried from the org: a test sees only the data
    // it inserted itself.
    insert new Account(Name = 'Codingschule Academy');
    Id accountId = [SELECT Id FROM Account LIMIT 1].Id;

    insert new List<Contact>{
      new Contact(
        FirstName = 'Aylin',
        LastName = 'Yilmaz',
        Email = AYLIN_EMAIL,
        AccountId = accountId
      ),
      new Contact(
        FirstName = 'Jonas',
        LastName = 'Weber',
        Email = JONAS_EMAIL,
        AccountId = accountId
      ),
      new Contact(
        FirstName = 'Fatima',
        LastName = 'Haddad',
        Email = 'fatima.haddad@example.invalid',
        AccountId = accountId
      )
    };
  }

  private static Id contactFor(String email) {
    return [SELECT Id FROM Contact WHERE Email = :email LIMIT 1].Id;
  }

  @IsTest
  static void insertWithFreeContactSucceeds() {
    Id contactId = contactFor(AYLIN_EMAIL);
    Participant__c participant = new Participant__c(
      Name = 'Aylin Yilmaz',
      Contact__c = contactId
    );

    Test.startTest();
    insert participant;
    Test.stopTest();

    Participant__c stored = [
      SELECT Id, Contact__c
      FROM Participant__c
      WHERE Id = :participant.Id
    ];
    System.assertEquals(
      contactId,
      stored.Contact__c,
      'Contact__c must persist'
    );
  }

  @IsTest
  static void insertWithSecondParticipantForSameContactFails() {
    Id contactId = contactFor(AYLIN_EMAIL);
    insert new Participant__c(Name = 'Aylin Yilmaz', Contact__c = contactId);

    Test.startTest();
    try {
      insert new Participant__c(Name = 'Aylin Doppelt', Contact__c = contactId);
      System.assert(
        false,
        'A second participant for the same contact must be rejected'
      );
    } catch (DmlException error) {
      // A trigger throws to the caller as DmlException; the original
      // message is carried through. This is exactly what the UI receives,
      // so the assertion is made here rather than on the custom type.
      System.assert(
        error.getMessage()
          .contains(DuplicateParticipantForContactException.CODE),
        'Message must carry the stable code for the UI layer, got: ' +
        error.getMessage()
      );
      System.assert(
        error.getMessage().contains(String.valueOf(contactId)),
        'Message must name the offending contact: ' + error.getMessage()
      );
    }
    Test.stopTest();

    System.assertEquals(
      1,
      [SELECT COUNT() FROM Participant__c WHERE Contact__c = :contactId],
      'Only the first participant may exist for a contact'
    );
  }

  @IsTest
  static void differentContactsAreIndependent() {
    Id aylinContact = contactFor(AYLIN_EMAIL);
    Id jonasContact = contactFor(JONAS_EMAIL);

    insert new List<Participant__c>{
      new Participant__c(Name = 'Aylin Yilmaz', Contact__c = aylinContact),
      new Participant__c(Name = 'Jonas Weber', Contact__c = jonasContact)
    };

    System.assertEquals(
      2,
      [
        SELECT COUNT()
        FROM Participant__c
        WHERE Contact__c IN :new List<Id>{ aylinContact, jonasContact }
      ],
      'Two contacts may each own a participant'
    );
  }

  @IsTest
  static void updateWithoutTouchingContactIsAllowed() {
    Participant__c participant = new Participant__c(
      Name = 'Aylin Yilmaz',
      Contact__c = contactFor(AYLIN_EMAIL)
    );
    insert participant;

    Test.startTest();
    participant.Status__c = 'Active';
    update participant;
    Test.stopTest();

    Participant__c stored = [
      SELECT Status__c
      FROM Participant__c
      WHERE Id = :participant.Id
    ];
    System.assertEquals(
      'Active',
      stored.Status__c,
      'A no-op update must not trip the trigger'
    );
  }

  @IsTest
  static void updateOntoAnotherParticipantsContactFails() {
    Id aylinContact = contactFor(AYLIN_EMAIL);
    Id jonasContact = contactFor(JONAS_EMAIL);

    Participant__c aylin = new Participant__c(
      Name = 'Aylin Yilmaz',
      Contact__c = aylinContact
    );
    Participant__c jonas = new Participant__c(
      Name = 'Jonas Weber',
      Contact__c = jonasContact
    );
    insert new List<Participant__c>{ aylin, jonas };

    Test.startTest();
    try {
      jonas.Contact__c = aylinContact;
      update jonas;
      System.assert(false, 'Reassigning a taken contact must be rejected');
    } catch (DmlException error) {
      System.assert(
        error.getMessage()
          .contains(DuplicateParticipantForContactException.CODE),
        'Message must carry the stable code, got: ' + error.getMessage()
      );
      System.assert(
        error.getMessage().contains(String.valueOf(aylin.Id)),
        'Message must name the current owner: ' + error.getMessage()
      );
    }
    Test.stopTest();

    Participant__c stored = [
      SELECT Contact__c
      FROM Participant__c
      WHERE Id = :jonas.Id
    ];
    System.assertEquals(
      jonasContact,
      stored.Contact__c,
      'The rejected update must not be persisted'
    );
  }

  @IsTest
  static void contactWithoutParticipantIsDeletable() {
    Id contactId = contactFor(AYLIN_EMAIL);
    Participant__c participant = new Participant__c(
      Name = 'Aylin Yilmaz',
      Contact__c = contactId
    );
    insert participant;

    Test.startTest();
    delete participant;
    Test.stopTest();

    System.assertEquals(
      0,
      [SELECT COUNT() FROM Participant__c WHERE Id = :participant.Id],
      'Participant must be gone'
    );
    System.assertEquals(
      1,
      [SELECT COUNT() FROM Contact WHERE Id = :contactId],
      'The now-unused contact must still be deletable'
    );
  }

  @IsTest
  static void contactWithParticipantIsProtected() {
    Id contactId = contactFor(AYLIN_EMAIL);
    insert new Participant__c(Name = 'Aylin Yilmaz', Contact__c = contactId);

    Test.startTest();
    try {
      delete [SELECT Id FROM Contact WHERE Id = :contactId];
      System.assert(
        false,
        'deleteConstraint=Restrict must block deleting a contact in use'
      );
    } catch (DmlException error) {
      System.assert(
        error.getMessage().contains('could not be completed'),
        'Expected the Restrict message, got: ' + error.getMessage()
      );
    }
    Test.stopTest();

    System.assertEquals(
      1,
      [SELECT COUNT() FROM Contact WHERE Id = :contactId],
      'The contact must survive the rejected delete'
    );
  }
}
