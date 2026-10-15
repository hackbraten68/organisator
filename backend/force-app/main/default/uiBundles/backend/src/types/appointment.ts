/**
 * Appointment domain types
 * Mirrors Appointment__c SObject fields (camelCase ↔ PascalCase__c)
 */

/**
 * 'Documented' ist bewusst nicht dabei: der Wert hatte keinen Erzeuger, kein
 * Datenfeld und keinen erklärbaren Uebergang. Er taucht gleichwohl in Filtern
 * und in der Zaehlung vergangener Termine auf, ohne dass je ein Datensatz
 * entstuende. Bei Bedarf gehoert er zurueck — mit Feld und benannter Aktion.
 */
export type AppointmentStatus = 'Draft' | 'Finding' | 'Confirmed' | 'Completed' | 'Cancelled' | 'NoShow';
export type AppointmentType = 'Coaching' | 'CheckIn' | 'Feedback' | 'Behörde' | 'Praktikum' | 'Sonstiges';
export type AppointmentLocation = 'Discord' | 'Zoom' | 'Teams' | 'External';

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'Draft', 'Finding', 'Confirmed', 'Completed', 'Cancelled', 'NoShow'
] as const;

export const APPOINTMENT_TYPES: readonly AppointmentType[] = [
  'Coaching', 'CheckIn', 'Feedback', 'Behörde', 'Praktikum', 'Sonstiges'
] as const;

export const APPOINTMENT_LOCATIONS: readonly AppointmentLocation[] = [
  'Discord', 'Zoom', 'Teams', 'External'
] as const;

/**
 * Anzeigename fuer die Orte. Abweichung vom API-Namen ist hier nur `External`,
 * das im Dialog "Extern" heisst — die anderen drei bleiben unveraendert, damit
 * ein Lookup im Fehlerfall auf den Wert zeigt, den Salesforce zurueckweist.
 */
export const APPOINTMENT_LOCATION_LABELS: Readonly<Record<AppointmentLocation, string>> = {
  Discord: 'Discord',
  Zoom: 'Zoom',
  Teams: 'MS Teams',
  External: 'Extern',
};

export interface Appointment {
  id: string;
  name: string;                    // TERM-{0000}
  participantId: string;
  participantName?: string;
  coachId?: string;
  coachName?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startTime: string;               // ISO datetime
  endTime: string;                 // ISO datetime
  location?: AppointmentLocation;
  meetingLink?: string;
  notes?: string;
  cancellationReason?: string;
  correlationId?: string;          // First-Class Booking Journey Tracker
  confirmedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentInput {
  participantId: string;
  coachId?: string;
  type: AppointmentType;
  startTime: string;
  endTime: string;
  location?: AppointmentLocation;
  meetingLink?: string;
  notes?: string;
  correlationId?: string;
}

export interface AppointmentPatch {
  coachId?: string;
  type?: AppointmentType;
  startTime?: string;
  endTime?: string;
  location?: AppointmentLocation;
  meetingLink?: string;
  notes?: string;
  cancellationReason?: string;
  correlationId?: string;
}

export interface AppointmentFilters {
  participantId?: string;
  coachId?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  startTimeFrom?: string;
  startTimeTo?: string;
  correlationId?: string;
}