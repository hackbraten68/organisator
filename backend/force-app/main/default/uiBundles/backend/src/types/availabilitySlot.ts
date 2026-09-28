/**
 * AvailabilitySlot domain types
 * Mirrors AvailabilitySlot__c SObject fields
 */

export type AvailabilitySlotType = 'Coaching' | 'CheckIn' | 'General';

export const AVAILABILITY_SLOT_TYPES: readonly AvailabilitySlotType[] = [
  'Coaching', 'CheckIn', 'General'
] as const;

export interface AvailabilitySlot {
  id: string;
  name: string;                    // SLOT-{0000}
  userId: string;
  userName?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string;               // HH:mm:ss
  endTime: string;                 // HH:mm:ss
  type: AvailabilitySlotType;
  isActive: boolean;
  validFrom?: string;              // ISO date
  validTo?: string;                // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlotInput {
  userId: string;
  dayOfWeek: AvailabilitySlot['dayOfWeek'];
  startTime: string;
  endTime: string;
  type?: AvailabilitySlotType;     // Default: General
  isActive?: boolean;              // Default: true
  validFrom?: string;
  validTo?: string;
}

export interface AvailabilitySlotPatch {
  dayOfWeek?: AvailabilitySlot['dayOfWeek'];
  startTime?: string;
  endTime?: string;
  type?: AvailabilitySlotType;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}

export interface AvailabilitySlotFilters {
  userId?: string;
  dayOfWeek?: AvailabilitySlot['dayOfWeek'];
  type?: AvailabilitySlotType;
  isActive?: boolean;
}