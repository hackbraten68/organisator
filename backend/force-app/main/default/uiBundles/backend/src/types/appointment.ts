/**
 * Appointment domain types
 * Mirrors Appointment__c SObject fields (camelCase ↔ PascalCase__c)
 */

export type AppointmentStatus = 'Draft' | 'Finding' | 'Confirmed' | 'Completed' | 'Documented' | 'Cancelled' | 'NoShow';
export type AppointmentType = 'Coaching' | 'CheckIn' | 'Berufsschule' | 'Behörde' | 'Praktikum' | 'Sonstiges';
export type AppointmentLocation = 'OnSite' | 'Teams' | 'Phone' | 'Hybrid' | 'External';

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'Draft', 'Finding', 'Confirmed', 'Completed', 'Documented', 'Cancelled', 'NoShow'
] as const;

export const APPOINTMENT_TYPES: readonly AppointmentType[] = [
  'Coaching', 'CheckIn', 'Berufsschule', 'Behörde', 'Praktikum', 'Sonstiges'
] as const;

export const APPOINTMENT_LOCATIONS: readonly AppointmentLocation[] = [
  'OnSite', 'Teams', 'Phone', 'Hybrid', 'External'
] as const;

export interface Appointment {
  id: string;
  name: string;                    // TERM-{0000}
  participantId: string;
  participantName?: string;
  coachId?: string;
  coachName?: string;
  staffId?: string;
  staffName?: string;
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
  staffId?: string;
  type: AppointmentType;
  status?: AppointmentStatus;      // Default: Draft
  startTime: string;
  endTime: string;
  location?: AppointmentLocation;
  meetingLink?: string;
  notes?: string;
  correlationId?: string;
}

export interface AppointmentPatch {
  coachId?: string;
  staffId?: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  startTime?: string;
  endTime?: string;
  location?: AppointmentLocation;
  meetingLink?: string;
  notes?: string;
  cancellationReason?: string;
  correlationId?: string;
  confirmedAt?: string;
  completedAt?: string;
}

export interface AppointmentFilters {
  participantId?: string;
  coachId?: string;
  staffId?: string;
  status?: AppointmentStatus;
  type?: AppointmentType;
  startTimeFrom?: string;
  startTimeTo?: string;
  correlationId?: string;
}