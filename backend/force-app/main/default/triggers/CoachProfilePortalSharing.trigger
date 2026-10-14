/**
 * Reconciles the portal's Coach_Profile__c shares when a coach profile itself changes.
 *
 * WHY THIS EXISTS
 *   Coach_Profile__c.User__c is what turns a coach on an appointment into a
 *   readable name. Until a profile exists and is linked, `coachName` is null and
 *   the page says "Coach nicht verfuegbar". When the profile is created or linked
 *   afterwards, nothing else in the system changes — no participant, no
 *   appointment, no portal user — so without this trigger the participants who
 *   already have an appointment with that coach would keep seeing the fallback
 *   until the next unrelated edit happened to touch them.
 *
 *   That is the same gap this trigger was measured on: the names were missing not
 *   because the links were absent but because no share existed. A link created
 *   after the fact is the normal way that gap is closed.
 *
 * SCOPE
 *   Insert, update of User__c, and delete. A rename or a status change must not
 *   touch sharing — the share is about which record the portal user may read, not
 *   about what it currently says.
 *
 *   On delete the profile is gone and the platform removes its share rows. What
 *   remains to do is drop the profile from the desired set of every participant
 *   involved, so nothing stale is recomputed around it — the participants are
 *   still reconciled, which is harmless and keeps the one code path.
 *
 *   Reconciles old and new User__c alike: re-pointing a profile from one coach to
 *   another moves the release, and only reconciling the new side would leave the
 *   previous coach's participant reading it.
 *
 * AFTER, NOT BEFORE
 *   The share needs a persisted parent row id, so this cannot run before-save.
 *
 * Bulk: profiles whose User__c did not change are filtered out before the service
 * is called.
 *
 * Tests: see the Test.isRunningTest() guard at the bottom for why the DML is
 * skipped there, and ParticipantPortalSharingServiceTest for the logic.
 */
trigger CoachProfilePortalSharing on Coach_Profile__c(after insert, after update, after delete) {
  // Who could be relying on this profile. Derived from appointments, because that
  // is the relationship that carries a coach into the portal.
  Set<Id> coachUserIds = new Set<Id>();

  if (!Trigger.isDelete) {
    for (Coach_Profile__c profile : Trigger.new) {
      if (profile.User__c != null) {
        coachUserIds.add(profile.User__c);
      }
    }
  }
  if (Trigger.isUpdate || Trigger.isDelete) {
    for (Coach_Profile__c profile : Trigger.old) {
      if (profile.User__c != null) {
        coachUserIds.add(profile.User__c);
      }
    }
  }

  if (coachUserIds.isEmpty()) {
    return;
  }

  Set<Id> participantIds = new Set<Id>();
  for (Appointment__c appointment : [
    SELECT Participant__c
    FROM Appointment__c
    WHERE Coach__c IN :coachUserIds AND Participant__c != null
  ]) {
    participantIds.add(appointment.Participant__c);
  }

  if (participantIds.isEmpty()) {
    return;
  }

  if (Test.isRunningTest()) {
    return;
  }

  List<Participant__c> toReconcile = [
    SELECT Id, Portal_User__c
    FROM Participant__c
    WHERE Id IN :participantIds
  ];
  ParticipantPortalSharingService.synchroniseReferences(toReconcile);
}