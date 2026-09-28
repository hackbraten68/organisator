/**
 * Absence domain types
 * Mirrors Absence__c SObject fields (camelCase ↔ PascalCase__c)
 */

export type AbsenceStatus = 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';
export type AbsenceType = 'Krank' | 'Urlaub' | 'Berufsschule' | 'Praktikum' | 'Behörde' | 'Sonstiges';

export const ABSENCE_STATUSES: readonly AbsenceStatus[] = [
  'Submitted',
  'Approved',
  'Rejected',
  'Cancelled',
] as const;

export const ABSENCE_TYPES: readonly AbsenceType[] = [
  'Krank',
  'Urlaub',
  'Berufsschule',
  'Praktikum',
  'Behörde',
  'Sonstiges',
] as const;

export interface Absence {
  id: string;
  name: string;                    // ABS-{0000}
  participantId: string;
  participantName?: string;
  type: AbsenceType;
  status: AbsenceStatus;
  startDate: string;               // ISO date (yyyy-MM-dd)
  endDate: string;                 // ISO date (yyyy-MM-dd)
  reason?: string;                 // Optional, sensitiv - Audit redaktioniert
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;             // ISO datetime (serverseitig gesetzt)
  rejectedById?: string;
  rejectedByName?: string;
  rejectedAt?: string;             // ISO datetime (serverseitig gesetzt)
  coachComment?: string;           // Begründung bei Ablehnung
  createdAt: string;
  updatedAt: string;
}

export interface AbsenceInput {
  participantId: string;
  type: AbsenceType;
  status?: AbsenceStatus;          // Default: Submitted
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface AbsencePatch {
  type?: AbsenceType;
  status?: AbsenceStatus;
  startDate?: string;
  endDate?: string;
  reason?: string;
  coachComment?: string;
}

export interface AbsenceWithDocuments extends Absence {
  documents: AbsenceDocument[];
}

export interface AbsenceDocument {
  id: string;
  absenceId: string;
  contentDocumentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedById: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface AbsenceFilters {
  participantId?: string;
  status?: AbsenceStatus;
  type?: AbsenceType;
  startDateFrom?: string;
  startDateTo?: string;
  coachId?: string;                // For coach-specific lists
}