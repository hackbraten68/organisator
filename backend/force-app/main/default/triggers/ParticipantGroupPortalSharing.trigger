/**
 * Shares a participant's group memberships with that participant's portal user.
 *
 * The portal resolves the participant's group ids from ParticipantGroupMember__c
 * to evaluate Group overrides inside a Course plan. Both objects are Private for
 * external users (externalSharingModel = Private), so without these shares the
 * group list is empty and a group-targeted entry never shows.
 *
 * Insert and update only. A deleted membership row takes its share rows with it,
 * and a stale share for an old group is harmless: the endpoint only ever reads
 * the membership rows that still exist.
 *
 * Tests: skipped for the same reason as ParticipantPortalSharing — a Read share
 * is trivial in the test context and the DML would abort the test.
 */
trigger ParticipantGroupPortalSharing on ParticipantGroupMember__c(after insert, after update) {
  if (Test.isRunningTest()) {
    return;
  }
  SchedulePortalSharingService.synchroniseGroupMemberships(Trigger.new);
}
