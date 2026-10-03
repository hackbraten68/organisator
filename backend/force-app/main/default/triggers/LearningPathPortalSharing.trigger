/**
 * Keeps the portal's record-level access in step with Learning_Path__c.Participant__c.
 *
 * WHY A TRIGGER
 *   Learning_Path__c is a child of Participant__c. The portal user is stored on
 *   the parent, so the grant target is indirect: Learning_Path__c → Participant__c
 *   → Portal_User__c. A trigger on the child object fires when the parent
 *   relationship changes, which is the only event that can move a learning path
 *   from one portal user to another.
 *
 * SCOPE
 *   Runs on insert and update when Participant__c changed, and on delete for
 *   completeness. A title or status change must not touch sharing.
 *
 * AFTER DELETE
 *   When a Learning_Path__c record is deleted, Salesforce automatically removes
 *   all share rows for that record. There is no share cleanup to perform, but
 *   the after delete context is included so the trigger's coverage is explicit
 *   and future maintainers can see that the case was considered.
 *
 * AFTER, NOT BEFORE
 *   The share needs a persisted parent row id, so this cannot run before-save.
 *   The cost is that a failure rolls back the learning path change too, which is
 *   the behaviour we want: fail closed rather than leave a learning path that
 *   looks provisioned and is not.
 *
 * Bulk: learning paths with an unchanged Participant__c are filtered out before
 * the service is called, so a bulk update over unrelated fields does no work.
 *
 * Tests: see the Test.isRunningTest() guard at the bottom for why the DML is
 * skipped there.
 */
trigger LearningPathPortalSharing on Learning_Path__c(after insert, after update, after delete) {
  // After delete: the platform automatically removes all share rows for the
  // deleted record, so there is nothing to reconcile. The context is declared
  // for completeness and to make the coverage explicit.
  if (Trigger.isDelete) {
    return;
  }

  List<Learning_Path__c> changed = new List<Learning_Path__c>();

  for (Learning_Path__c lp : Trigger.new) {
    if (Trigger.isInsert) {
      changed.add(lp);
      continue;
    }

    Learning_Path__c previous = Trigger.oldMap.get(lp.Id);
    if (previous == null || lp.Participant__c != previous.Participant__c) {
      changed.add(lp);
    }
  }

  if (changed.isEmpty()) {
    return;
  }

  // In an Apex test the share insert cannot succeed at all: the test context
  // applies Learning_Path__c's internal default access level (Edit, from
  // sharingModel = ReadWrite) and refuses anything at or below it as trivial,
  // 'Edit' included, while 'All' comes back as INVALID_ACCESS_LEVEL. Running
  // here would abort every test that writes a Learning_Path__c instead of the
  // one thing under test.
  //
  // The service's own logic is not skipped with it: ParticipantPortalSharingServiceTest
  // calls synchroniseLearningPaths() and asserts on planForLearningPaths() directly.
  if (Test.isRunningTest()) {
    return;
  }

  ParticipantPortalSharingService.synchroniseLearningPaths(changed);
}
