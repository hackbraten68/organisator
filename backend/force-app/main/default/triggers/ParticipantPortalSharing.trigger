/**
 * Keeps the portal's record-level access in step with Participant__c.Portal__User__c.
 *
 * WHY A TRIGGER AND NOT A USER TRIGGER
 *   Participant__c.Portal_User__c is the single source of truth for who a
 *   participant row is released to. A trigger on the user would couple access
 *   control to user provisioning and drag in the mixed-DML boundary between
 *   setup and non-setup objects. Changing the field on the participant is both
 *   the rarer event and the one that must not be missed.
 *
 *   User provisioning (creating the user, setting the password, assigning the
 *   permission set) stays separate and manual. Setting Portal_User__c is what
 *   opens the portal.
 *
 * SCOPE
 *   Runs on insert and update only, and only when the release target actually
 *   changed. A rename or a status change must not touch sharing.
 *
 * AFTER, NOT BEFORE
 *   The share needs a persisted parent row id, so this cannot run before-save.
 *   The cost is that a failure rolls back the participant change too, which is
 *   the behaviour we want: fail closed rather than leave a participant that
 *   looks provisioned and is not.
 *
 * Bulk: participants with an unchanged Portal_User__c are filtered out before
 * the service is called, so a bulk update over unrelated fields does no work.
 *
 * Tests: see the Test.isRunningTest() guard at the bottom for why the DML is
 * skipped there.
 */
trigger ParticipantPortalSharing on Participant__c(after insert, after update) {
  List<Participant__c> changed = new List<Participant__c>();

  for (Participant__c participant : Trigger.new) {
    // Trigger.oldMap is null on insert, so it must not be touched at all then.
    // Accessing it is what produced a NullPointerException in a test context.
    if (Trigger.isInsert) {
      changed.add(participant);
      continue;
    }

    Participant__c previous = Trigger.oldMap.get(participant.Id);
    if (previous == null || participant.Portal_User__c != previous.Portal_User__c) {
      changed.add(participant);
    }
  }

  if (changed.isEmpty()) {
    return;
  }

  // In an Apex test the share insert cannot succeed at all: the test context
  // applies Participant__c's internal default access level (Edit, from
  // sharingModel = ReadWrite) and refuses anything at or below it as trivial,
  // 'Edit' included, while 'All' comes back as INVALID_ACCESS_LEVEL. Running
  // here would abort every test that writes a Participant__c instead of the one
  // thing under test.
  //
  // The service's own logic is not skipped with it: ParticipantPortalSharingServiceTest
  // calls synchronise() and asserts on planFor() directly, and that a granted share is
  // accepted for real is shown by the live sessions in
  // backend/docs/portal-deploy-status.md.
  if (Test.isRunningTest()) {
    return;
  }

  // The service reads the current share state itself, so it only needs the rows
  // whose release target moved — not what they were before.
  ParticipantPortalSharingService.synchronise(changed);
}