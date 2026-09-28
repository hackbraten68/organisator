/**
 * A `User` that can be assigned as coach on an appointment.
 *
 * `Appointment__c.Coach__c` is a lookup to `User` — not to `Coach_Profile__c` —
 * so the picker in the appointment form must offer User ids. The list is
 * filtered server-side in `userService` so system accounts never reach the UI.
 */
export interface AssignableUser {
  id: string;
  name: string;
  username?: string;
}
