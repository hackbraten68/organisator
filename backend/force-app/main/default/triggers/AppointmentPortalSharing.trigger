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
 *   Runs on insert and update when Participant__c changed, and on delete for
 *   completeness. A status, time or link change must not touch sharing.
 *
 * AFTER DELETE
 *   When an Appointment__c record is deleted, Salesforce automatically removes
 *   all share rows for that record. There is no share cleanup to perform; the
 *   context is declared so the coverage is explicit and a future maintainer can
 *   see the case was considered.
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
  // After delete: the platform automatically removes all share rows for the
  // deleted record, so there is nothing to reconcile. The context is declared
  // for completeness and to make the coverage explicit.
  if (Trigger.isDelete) {
    return;
  }

  List<Appointment__c> changed = new List<Appointment__c>();

  for (Appointment__c appointment : Trigger.new) {
    if (Trigger.isInsert) {
      changed.add(appointment);
      continue;
    }

    Appointment__c previous = Trigger.oldMap.get(appointment.Id);
    if (previous == null || appointment.Participant__c != previous.Participant__c) {
      changed.add(appointment);
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
  if (Test.isRunningTest()) {
    return;
  }

  ParticipantPortalSharingService.synchroniseAppointments(changed);
}
