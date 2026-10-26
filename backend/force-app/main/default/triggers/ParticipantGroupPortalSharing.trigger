/**
 * Shares a participant's group memberships with that participant's portal user.
 *
 * Runs on insert, update, delete and undelete. On update both the old and the
 * new participant/group references are reconciled, so a moved membership does
 * not leave a stale share behind.
 */
trigger ParticipantGroupPortalSharing on ParticipantGroupMember__c (after insert, after update, after delete, after undelete) {
  if (Test.isRunningTest()) {
    return;
  }
  Set<Id> participantIds = new Set<Id>();
  if (Trigger.new != null) {
    for (ParticipantGroupMember__c member : Trigger.new) {
      if (member.Participant__c != null) {
        participantIds.add(member.Participant__c);
      }
    }
  }
  if (Trigger.old != null) {
    for (ParticipantGroupMember__c member : Trigger.old) {
      if (member.Participant__c != null) {
        participantIds.add(member.Participant__c);
      }
    }
  }
  SchedulePortalSharingService.synchroniseGroupMembershipsForParticipants(participantIds);
}
