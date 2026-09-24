/**
 * Core audit event types and schemas
 * 
 * These types represent the immutable audit events that record all relevant
 * mutations across the application. Use these types for:
 * - GraphQL mutation/query responses
 * - In-memory event processing
 * - UI rendering
 * 
 * DO NOT store partial events or unvalidated events; always validate against
 * this schema before persistence.
 */

/**
 * Domains covered by the audit system
 */
export const AUDIT_DOMAINS = [
  'participant',
  'workbook',
  'absence',
  'appointment',
  'classbook',
  'daily_checkin',
  'time_tracking',
  'authentication',
  'system',
] as const;

export type AuditDomain = (typeof AUDIT_DOMAINS)[number];

/**
 * Actions recorded in audit events
 */
export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'archived',
  'restored',
  'status_changed',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
  'checked_in',
  'checked_out',
  'corrected',
  'flagged',
  'reviewed',
  'rescheduled',
  'attendance_changed',
  'document_added',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Type of actor performing the action
 */
export const AUDIT_ACTOR_TYPES = [
  'staff',
  'participant',
  'system',
  'integration',
] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/**
 * Source channel through which the action originated
 */
export const AUDIT_SOURCES = [
  'web',
  'mobile',
  'api',
  'import',
  'automation',
  'integration',
  'migration',
] as const;

export type AuditSource = (typeof AUDIT_SOURCES)[number];

/**
 * Visibility classification: who is allowed to see this event
 */
export const AUDIT_VISIBILITY_LEVELS = [
  'staff',        // Visible to staff with appropriate permissions
  'participant',  // Visible to staff AND to the affected participant
  'restricted',   // Visible only to audit admins and supervisors
] as const;

export type AuditVisibility = (typeof AUDIT_VISIBILITY_LEVELS)[number];

/**
 * Sensitivity classification: data protection level for this event
 */
export const AUDIT_SENSITIVITY_LEVELS = [
  'normal',      // Standard operational data
  'personal',    // Personal information (names, contact details read-only)
  'restricted',  // Highly sensitive (medical, financial, behavioral)
] as const;

export type AuditSensitivity = (typeof AUDIT_SENSITIVITY_LEVELS)[number];

/**
 * Audit field strategies: how a field's changes should be captured
 */
export const AUDIT_FIELD_STRATEGIES = [
  'FULL',        // Store both old and new values
  'REDACTED',    // Log that field changed, but not the values
  'REFERENCE',   // Store only the ID, not the full object
  'NONE',        // Do not include field in audit event
] as const;

export type AuditFieldStrategy = (typeof AUDIT_FIELD_STRATEGIES)[number];

/**
 * Detailed record of a single field change
 */
export interface FieldChange {
  field: string;                    // Field name in the source object
  oldValue?: unknown;               // Previous value (or null if redacted)
  newValue?: unknown;               // New value (or null if redacted)
  displayType?: string;             // 'status', 'date', 'email', 'reference', etc.
  redacted: boolean;                // True if values were intentionally redacted
  reference?: string;               // If displayType='reference': entity type (e.g., 'Program__c')
}

/**
 * Core audit event structure
 * 
 * Immutable once recorded. All values are authoritative; do not reconstruct
 * old state from multiple events (use event snapshots if historical queries needed).
 */
export interface AuditEvent {
  // Identity
  id: string;                           // Salesforce Record ID (18-char)
  recordedAt: string;                   // ISO 8601 UTC timestamp (CreatedDate)

  // Timing
  occurredAt: string;                   // ISO 8601 UTC timestamp (when event actually happened)
  schemaVersion: number;                // For backward compatibility as schema evolves

  // Classification
  eventType: string;                    // Stable identifier: "{domain}.{action}" e.g., "participant.status_changed"
  domain: AuditDomain;                  // Which area of the app was affected
  action: AuditAction;                  // What kind of change occurred

  // Actor
  actorType: AuditActorType;           // Who performed the action
  actorId?: string;                     // Salesforce User ID or system identifier (nullable for system)
  actorDisplayNameSnapshot?: string;    // Snapshot of actor's name (frozen at event time)

  // Subject (what was affected)
  subjectType: string;                  // Entity type affected, e.g., 'Participant__c'
  subjectId: string;                    // Entity ID
  participantId?: string;               // For participant-centric queries (may differ from subject)

  // Hierarchy (optional)
  parentType?: string;                  // If subject is nested (e.g., Workbook → Program)
  parentId?: string;

  // Context
  source: AuditSource;                  // How the action was triggered
  correlationId?: string;               // UUID grouping related events (transaction/request level)
  requestId?: string;                   // For idempotency; prevents duplicate events on retry

  // Justification (when required by policy)
  reason?: string;                      // Required for corrections, sensitive changes, rejections

  // Changes
  changedFields: string[];              // Array of field names that changed
  changes: FieldChange[];               // Detailed per-field changes

  // Context/Extensibility
  metadata: Record<string, unknown>;    // Allowlisted, domain-specific context

  // Access Control
  visibility: AuditVisibility;          // Who can access this event
  sensitivity: AuditSensitivity;        // Data protection level
}

/**
 * Input structure for creating audit events
 * 
 * Use `auditService.record()` with this shape. The service validates,
 * enriches (timestamp, actor from context), and writes.
 */
export interface CreateAuditEventInput {
  eventType: string;                    // e.g., "participant.status_changed"
  domain: AuditDomain;
  action: AuditAction;
  actorType: AuditActorType;
  actorId?: string;                     // Will be captured from server context if not provided
  subjectType: string;
  subjectId: string;
  participantId?: string;
  parentType?: string;
  parentId?: string;
  source: AuditSource;
  reason?: string;
  changedFields?: string[];
  changes?: FieldChange[];
  metadata?: Record<string, unknown>;   // Must pass allowlist validation
  visibility?: AuditVisibility;         // Defaults per domain
  sensitivity?: AuditSensitivity;       // Defaults per domain
  correlationId?: string;               // Optional; generated if not provided
  requestId?: string;                   // Optional; used for idempotency
  occurredAt?: string;                  // Defaults to current time if not provided
}

/**
 * Field audit policy configuration
 * 
 * Central registry of how each field is audited. Prevents inconsistent
 * per-service audit strategies.
 */
export interface AuditFieldPolicyConfig {
  [key: string]: FieldAuditPolicyEntry;
}

export interface FieldAuditPolicyEntry {
  strategy: AuditFieldStrategy;
  displayType?: string;                // 'status', 'date', 'email', 'reference', etc.
  reference?: string;                  // If REFERENCE strategy: entity type
  allowRedactionByPermission?: boolean; // If true, supervisors may see redacted values
}

/**
 * Predefined field policies for each domain
 * 
 * Default policies ensure consistent audit practice. Override per field
 * only with explicit business requirement.
 */
export const DEFAULT_FIELD_POLICIES: Record<string, AuditFieldPolicyConfig> = {
  participant: {
    Name: { strategy: 'FULL', displayType: 'text' },
    Status__c: { strategy: 'FULL', displayType: 'status' },
    Email__c: { strategy: 'FULL', displayType: 'email' },
    GitHub__c: { strategy: 'FULL', displayType: 'email' },
    Discord__c: { strategy: 'FULL', displayType: 'text' },
    StartDate__c: { strategy: 'FULL', displayType: 'date' },
    ExpectedEndDate__c: { strategy: 'FULL', displayType: 'date' },
    Program__c: { strategy: 'REFERENCE', reference: 'Program__c' },
    Coach_Profile__c: { strategy: 'REFERENCE', reference: 'Coach_Profile__c' },
  },
  workbook: {
    AnswerText: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
    Status: { strategy: 'FULL', displayType: 'status' },
    SubmissionTimestamp: { strategy: 'FULL', displayType: 'date' },
  },
  absence: {
    Type: { strategy: 'FULL', displayType: 'status' },
    StartDate: { strategy: 'FULL', displayType: 'date' },
    EndDate: { strategy: 'FULL', displayType: 'date' },
    Reason: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
  },
  appointment: {
    StartTime: { strategy: 'FULL', displayType: 'date' },
    EndTime: { strategy: 'FULL', displayType: 'date' },
    Status: { strategy: 'FULL', displayType: 'status' },
    Attendees: { strategy: 'REFERENCE', reference: 'User' },
  },
  classbook: {
    EntryText: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
    AttendanceStatus: { strategy: 'FULL', displayType: 'status' },
  },
  daily_checkin: {
    ResponseText: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
    Mood: { strategy: 'FULL', displayType: 'status' },
  },
  time_tracking: {
    StartTime: { strategy: 'FULL', displayType: 'date' },
    EndTime: { strategy: 'FULL', displayType: 'date' },
    Duration: { strategy: 'FULL', displayType: 'numeric' },
    CorrectionReason: { strategy: 'REDACTED', displayType: 'text', allowRedactionByPermission: true },
  },
};

/**
 * Visibility and sensitivity defaults by domain
 */
export const DEFAULT_DOMAIN_VISIBILITY: Record<AuditDomain, AuditVisibility> = {
  participant: 'staff',
  workbook: 'staff',
  absence: 'restricted',
  appointment: 'staff',
  classbook: 'staff',
  daily_checkin: 'restricted',
  time_tracking: 'staff',
  authentication: 'restricted',
  system: 'staff',
};

export const DEFAULT_DOMAIN_SENSITIVITY: Record<AuditDomain, AuditSensitivity> = {
  participant: 'normal',
  workbook: 'personal',
  absence: 'personal',
  appointment: 'normal',
  classbook: 'personal',
  daily_checkin: 'personal',
  time_tracking: 'normal',
  authentication: 'restricted',
  system: 'normal',
};

/**
 * Metadata allowlist per domain
 * 
 * Only these fields are permitted in the metadata object for each domain.
 * This prevents audit injection or data leakage through metadata.
 */
export const METADATA_ALLOWLISTS: Record<AuditDomain, Set<string>> = {
  participant: new Set([
    'previousStatus',
    'newStatus',
    'programId',
    'coachId',
    'relatedEntities',
  ]),
  workbook: new Set([
    'workbookId',
    'learningPathId',
    'sequenceNumber',
    'wordCount',
    'characterCount',
  ]),
  absence: new Set([
    'absenceType',
    'durationDays',
    'approverRole',
  ]),
  appointment: new Set([
    'appointmentType',
    'location',
    'attendeeCount',
  ]),
  classbook: new Set([
    'entryType',
    'sessionId',
    'classSize',
  ]),
  daily_checkin: new Set([
    'moodValue',
    'category',
    'flagReason',
  ]),
  time_tracking: new Set([
    'activityType',
    'projectId',
    'billableHours',
  ]),
  authentication: new Set([
    'sessionDuration',
    'authMethod',
  ]),
  system: new Set([
    'jobName',
    'status',
    'recordCount',
  ]),
};

/**
 * Event type constants: "{domain}.{action}" combinations
 * 
 * Use these constants instead of string literals to avoid typos.
 */
export const EVENT_TYPES = {
  // Participant
  PARTICIPANT_CREATED: 'participant.created' as const,
  PARTICIPANT_UPDATED: 'participant.updated' as const,
  PARTICIPANT_STATUS_CHANGED: 'participant.status_changed' as const,
  PARTICIPANT_ARCHIVED: 'participant.archived' as const,
  PARTICIPANT_RESTORED: 'participant.restored' as const,

  // Workbook
  WORKBOOK_ASSIGNED: 'workbook.assigned' as const,
  WORKBOOK_STARTED: 'workbook.started' as const,
  WORKBOOK_ANSWER_UPDATED: 'workbook.answer_updated' as const,
  WORKBOOK_SUBMITTED: 'workbook.submitted' as const,
  WORKBOOK_REVIEWED: 'workbook.reviewed' as const,

  // Absence
  ABSENCE_REPORTED: 'absence.reported' as const,
  ABSENCE_UPDATED: 'absence.updated' as const,
  ABSENCE_APPROVED: 'absence.approved' as const,
  ABSENCE_REJECTED: 'absence.rejected' as const,
  ABSENCE_CANCELLED: 'absence.cancelled' as const,
  ABSENCE_DOCUMENT_ADDED: 'absence.document_added' as const,

  // Appointment
  APPOINTMENT_CREATED: 'appointment.created' as const,
  APPOINTMENT_RESCHEDULED: 'appointment.rescheduled' as const,
  APPOINTMENT_CANCELLED: 'appointment.cancelled' as const,
  APPOINTMENT_ATTENDANCE_CHANGED: 'appointment.attendance_changed' as const,

  // Klassenbuch
  CLASSBOOK_ENTRY_CREATED: 'classbook.entry_created' as const,
  CLASSBOOK_ENTRY_UPDATED: 'classbook.entry_updated' as const,
  CLASSBOOK_ENTRY_DELETED: 'classbook.entry_deleted' as const,
  CLASSBOOK_ATTENDANCE_CHANGED: 'classbook.attendance_changed' as const,

  // Daily Check-In
  DAILY_CHECKIN_SUBMITTED: 'daily_checkin.submitted' as const,
  DAILY_CHECKIN_UPDATED: 'daily_checkin.updated' as const,
  DAILY_CHECKIN_FLAGGED: 'daily_checkin.flagged' as const,
  DAILY_CHECKIN_REVIEWED: 'daily_checkin.reviewed' as const,

  // Time Tracking
  TIME_ENTRY_STARTED: 'time_entry.started' as const,
  TIME_ENTRY_STOPPED: 'time_entry.stopped' as const,
  TIME_ENTRY_CREATED: 'time_entry.created' as const,
  TIME_ENTRY_CORRECTED: 'time_entry.corrected' as const,
  TIME_ENTRY_DELETED: 'time_entry.deleted' as const,
  TIME_ENTRY_APPROVED: 'time_entry.approved' as const,
  TIME_ENTRY_REJECTED: 'time_entry.rejected' as const,

  // System/Auth
  SYSTEM_JOB_EXECUTED: 'system.created' as const,
  AUTHENTICATION_LOGIN: 'authentication.created' as const,
} as const;

/**
 * Query filter options for audit event searches
 */
export interface AuditEventFilter {
  dateFrom?: string;           // ISO 8601 date
  dateTo?: string;             // ISO 8601 date
  actorId?: string;
  actorType?: AuditActorType;
  participantId?: string;
  domain?: AuditDomain;
  action?: AuditAction;
  eventType?: string;
  subjectType?: string;
  subjectId?: string;
  sensitivity?: AuditSensitivity;
  visibility?: AuditVisibility;
  correlationId?: string;
  source?: AuditSource;
}

/**
 * Pagination cursor for stable, efficient traversal
 */
export interface AuditEventCursor {
  limit: number;                // Records per page
  after?: string;               // Opaque cursor token (encode id + timestamp)
  sortBy?: 'occurredAt' | 'recordedAt'; // Default: occurredAt
  sortDirection?: 'asc' | 'desc'; // Default: desc
}

/**
 * Paginated response from audit queries
 */
export interface AuditEventPage {
  events: AuditEvent[];
  totalCount?: number;          // May not be available if counting is expensive
  hasNextPage: boolean;
  nextCursor?: string;          // Used for the next request
}

/**
 * Summary of changes for UI display (1 transaction → 1 activity in timeline)
 */
export interface ActivityGrouping {
  correlationId: string;
  occurredAt: string;
  actor: ActorInfo;
  summary: string;              // Human-readable "Status changed from X to Y"
  events: AuditEvent[];         // Underlying events
  changedEntityIds: string[];   // Which entities were affected
}

/**
 * Actor display information (safe for UI)
 */
export interface ActorInfo {
  id?: string;
  displayName: string;
  type: AuditActorType;
  avatarUrl?: string;           // Optional; used if available
}
