/**
 * Keeps the portal's record-level access in step with Appointment__c.Participant__c.
 *
 * WHY A TRIGGER
 *   Appointment__c has externalSharingModel = Private, so a portal user sees
 *   nothing without an explicit share. The grant target is indirect, stored on
 *   the parent: Appointment__c → Participant__c → Portal_User__c. A trigger on
 *   the child fires when that parent relationship changes, which is the only
 *   event that can move an appointment from one portal user to another.
 *
 * SCOPE
 *   Runs on insert and update when Participant__c OR Coach__c changed, and on
 *   delete for completeness. A status, time or link change must not touch
 *   sharing.
 *
 *   Coach__c is watched for a second purpose: it decides which Coach_Profile__c
 *   the participant's portal user may read, so a coach swap has to be reconciled
 *   even when the appointment itself stays visible to the same person.
 *
 * AFTER DELETE
 *   Salesforce automatically removes the share rows belonging to the deleted
 *   appointment, so there is nothing to clean up for the appointment itself.
 *   The participant is still reconciled: a deleted appointment was one of the
 *   relationships justifying a coach profile, and if nothing else justifies it
 *   the release has to go with it. Returning early here would leave the
 *   participant reading a coach profile nothing points at any more.
 *
 * AFTER, NOT BEFORE
 *   The share needs a persisted parent row id, so this cannot run before-save.
 *   The cost is that a failure rolls back the appointment change too, which is
 *   the behaviour we want: fail closed rather than leave an appointment that
 *   looks provisioned and is not visible to its own participant.
 *
 * Bulk: appointments with an unchanged Participant__c are filtered out before the
 * service is called, so a bulk update over unrelated fields does no work.
 *
 * Tests: see the Test.isRunningTest() guard at the bottom for why the DML is
 * skipped there.
 */
trigger AppointmentPortalSharing on Appointment__c(after insert, after update, after delete) {
  List<Appointment__c> changed = new List<Appointment__c>();
  // Collected across old and new, because a coach swap moves the release of a
  // coach profile away from one participant AND to another — reconciling only the
  // new side would leave the old participant reading a coach profile nothing
  // justifies any more. On delete the participants come from Trigger.old only.
  Set<Id> participantsToReconcile = new Set<Id>();

  if (Trigger.isDelete) {
    for (Appointment__c appointment : Trigger.old) {
      if (appointment.Participant__c != null) {
        participantsToReconcile.add(appointment.Participant__c);
      }
    }
    if (participantsToReconcile.isEmpty() || Test.isRunningTest()) {
      return;
    }
    ParticipantPortalSharingService.synchroniseReferences([
      SELECT Id, Portal_User__c
      FROM Participant__c
      WHERE Id IN :participantsToReconcile
    ]);
    return;
  }

  for (Appointment__c appointment : Trigger.new) {
    if (appointment.Participant__c != null) {
      participantsToReconcile.add(appointment.Participant__c);
    }

    if (Trigger.isInsert) {
      changed.add(appointment);
      continue;
    }

    Appointment__c previous = Trigger.oldMap.get(appointment.Id);
    if (
      previous == null ||
      appointment.Participant__c != previous.Participant__c ||
      appointment.Coach__c != previous.Coach__c
    ) {
      changed.add(appointment);
    }

    if (previous != null && previous.Participant__c != null) {
      participantsToReconcile.add(previous.Participant__c);
    }
  }

  if (changed.isEmpty()) {
    return;
  }

  // In an Apex test the share insert cannot succeed at all: the test context
  // applies Appointment__c's internal default access level (Edit, from
  // sharingModel = ReadWrite) and refuses anything at or below it as trivial,
  // 'Edit' included, while 'All' comes back as INVALID_ACCESS_LEVEL. Running
  // here would abort every test that writes an Appointment__c instead of the one
  // thing under test.
  //
  // The service's own logic is not skipped with it:
  // ParticipantPortalSharingServiceTest calls synchroniseAppointments() and
  // asserts on planForAppointments() directly.
  //
  // The Coach_Profile__c reconciliation below sits behind this guard too, for the
  // same reason: it ends in share DML. Its logic is asserted directly through
  // planForCoachProfiles() / planForPrograms(), which perform no DML at all.
  if (Test.isRunningTest()) {
    return;
  }

  ParticipantPortalSharingService.synchroniseAppointments(changed);

  // The reference layer rides on the same relationships. Inline rather than in a
  // helper because an Apex trigger cannot declare methods; skipped entirely when
  // there is nobody to reconcile, so a bulk update over unrelated fields does no
  // query and no work.
  if (participantsToReconcile.isEmpty()) {
    return;
  }
  ParticipantPortalSharingService.synchroniseReferences([
    SELECT Id, Portal_User__c
    FROM Participant__c
    WHERE Id IN :participantsToReconcile
  ]);
}
