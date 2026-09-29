/**
 * Stamps decision metadata server-side on Absence__c.
 *
 * The UI API Update representation (Absence__cUpdateRepresentation) does not expose
 * ApprovedAt__c / RejectedAt__c / ApprovedBy__c / RejectedBy__c, so these cannot be
 * written from the LWC. Doing it here keeps the actor attribution trustworthy: the
 * running user's identity is captured in system mode, not trusted from the client.
 */
trigger AbsenceStatusAudit on Absence__c(before insert, before update) {
  for (Absence__c absence : Trigger.new) {
    Absence__c prior = Trigger.isUpdate ? Trigger.oldMap.get(absence.Id) : null;

    if (prior != null && prior.Status__c == absence.Status__c) {
      continue;
    }

    if (absence.Status__c == 'Approved') {
      absence.ApprovedAt__c = System.now();
      absence.ApprovedBy__c = UserInfo.getUserId();
      absence.RejectedAt__c = null;
      absence.RejectedBy__c = null;
      absence.CoachComment__c = null;
    } else if (absence.Status__c == 'Rejected') {
      absence.RejectedAt__c = System.now();
      absence.RejectedBy__c = UserInfo.getUserId();
    } else {
      absence.RejectedAt__c = null;
      absence.RejectedBy__c = null;
    }
  }
}
