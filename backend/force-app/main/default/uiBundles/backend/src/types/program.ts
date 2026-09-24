/**
 * Program domain types.
 *
 * These mirror the future Salesforce schema so the UI can switch to live
 * GraphQL data without touching components:
 *
 *   Program__c            -> Program (Name, Description__c, DurationWeeks__c, Status__c)
 *   ProgramModule__c      -> ProgramModule (Name, Order__c, Description__c, Program__c)
 *                             Modules are reusable content templates, NOT a
 *                             mandatory curriculum for every participant.
 *   LearningPathItem__c   -> LearningPathItem (Title__c, Order__c,
 *                             EstimatedWeeks__c, Status__c picklist, lookups
 *                             to Participant__c and Program__c)
 *                             The participant-specific curriculum. A Program
 *                             defines duration and organizational framework;
 *                             the actual learning path is assembled per
 *                             participant.
 *   Participant__c        -> assignments via Participant__c.Program__c lookup
 *   Coach_Profile__c      -> assignments via Program.coachIds
 *
 * Summary types stay minimal on purpose; consolidate them with the canonical
 * participant/coach types when the GraphQL integration lands.
 */

export type ProgramStatus = "Draft" | "Active" | "Archived";

export const PROGRAM_STATUSES: ProgramStatus[] = [
  "Draft",
  "Active",
  "Archived",
];

export interface Program {
  id: string;
  name: string;
  description?: string;
  durationWeeks?: number;
  status: ProgramStatus;
  coachIds: string[];
}

export interface ProgramModule {
  id: string;
  programId: string;
  name: string;
  order: number;
  description?: string;
}

export interface ProgramParticipantSummary {
  id: string;
  name: string;
  programId?: string;
}

export interface ProgramCoachSummary {
  id: string;
  name: string;
}

export interface ProgramInput {
  name: string;
  description?: string;
  durationWeeks?: number;
  status: ProgramStatus;
}

export interface ProgramModuleInput {
  name: string;
  description?: string;
}

export type LearningPathItemStatus = "Planned" | "In Progress" | "Completed";

export const LEARNING_PATH_STATUSES: LearningPathItemStatus[] = [
  "Planned",
  "In Progress",
  "Completed",
];

export interface LearningPathItem {
  id: string;
  participantId: string;
  programId: string;
  title: string;
  order: number;
  estimatedWeeks?: number;
  status: LearningPathItemStatus;
}

export interface LearningPathItemInput {
  title: string;
  estimatedWeeks?: number;
  status: LearningPathItemStatus;
}

export interface LearningPathProgress {
  total: number;
  completed: number;
  percent: number;
}
