/**
 * Audit outbox: makes lost audit writes visible and replayable (Phase 3).
 *
 * Flow: `auditService.record()` persists the event; on failure it freezes the
 * enriched input (incl. the correlationId/requestId of the failed attempt,
 * so replays carry the original correlation and duplicates collapse into one
 * timeline group) as a PENDING `AuditOutbox__c` entry instead of only
 * logging. `processOutboxOnce()` replays due PENDING entries:
 * success → PROCESSED, exhaustion (MAX_OUTBOX_RETRIES) → FAILED with
 * exponential-backoff NextRetryAt. FAILED is terminal for the worker —
 * an admin requeues via Status edit (the "Failed Audit Writes" list view),
 * which is the deliberate human gate before a suspicious payload retries.
 *
 * Everything here is best-effort per ADR-14: the outbox itself never throws
 * into callers. A failed outbox write is only console-logged (IDs, no PII) —
 * two simultaneous outages (audit + outbox) remain a logged, accepted gap.
 */

import { executeGraphQL } from "../graphqlClient";
import type {
  AuditOutboxEntry,
  AuditOutboxStatus,
  CreateAuditEventInput,
} from "@/types/audit";
import { auditService } from "./auditService";
import CREATE_OUTBOX_ENTRY from "./query/CreateOutboxEntry.graphql?raw";
import UPDATE_OUTBOX_ENTRY from "./query/UpdateOutboxEntry.graphql?raw";
import LIST_OUTBOX_ENTRIES from "./query/ListOutboxEntries.graphql?raw";

/** Replays stop after this many attempts; the entry goes FAILED. */
export const MAX_OUTBOX_RETRIES = 5;

/** How many PENDING entries one worker run replays (keeps app start fast). */
export const OUTBOX_BATCH_SIZE = 25;

/** Exponential backoff in minutes: 5, 10, 20, 40, 80. */
export function outboxRetryDelayMinutes(retryCount: number): number {
  return 5 * 2 ** Math.max(0, retryCount);
}

interface OutboxNode {
  Id: string;
  Status__c?: { value?: string | null } | null;
  EventType__c?: { value?: string | null } | null;
  Payload__c?: { value?: string | null } | null;
  SubjectId__c?: { value?: string | null } | null;
  ParticipantId__c?: { value?: string | null } | null;
  Error__c?: { value?: string | null } | null;
  RetryCount__c?: { value?: number | null } | null;
  CorrelationId__c?: { value?: string | null } | null;
  NextRetryAt__c?: { value?: string | null } | null;
  CreatedDate?: { value?: string | null } | null;
}

interface OutboxQueryResponse {
  uiapi?: {
    query?: {
      AuditOutbox__c?: { edges?: Array<{ node?: OutboxNode | null } | null> | null } | null;
    } | null;
  } | null;
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 2000);
}

function toEntry(node: OutboxNode): AuditOutboxEntry | null {
  const status = node.Status__c?.value;
  if (status !== "PENDING" && status !== "PROCESSED" && status !== "FAILED") return null;
  return {
    id: node.Id,
    status,
    eventType: node.EventType__c?.value ?? "unknown",
    payload: node.Payload__c?.value ?? "",
    subjectId: node.SubjectId__c?.value ?? undefined,
    participantId: node.ParticipantId__c?.value ?? undefined,
    error: node.Error__c?.value ?? undefined,
    retryCount: node.RetryCount__c?.value ?? 0,
    correlationId: node.CorrelationId__c?.value ?? undefined,
    nextRetryAt: node.NextRetryAt__c?.value ?? undefined,
  };
}

/**
 * Freeze a failed audit write as PENDING. Never throws: returns the entry
 * id, or null when the outbox write itself failed (logged, IDs only).
 */
export async function enqueueOutboxEntry(
  input: CreateAuditEventInput,
  error: unknown,
): Promise<string | null> {
  try {
    const data = await executeGraphQL<
      { uiapi: { AuditOutbox__cCreate: { Record: { Id: string } } } },
      Record<string, unknown>
    >(CREATE_OUTBOX_ENTRY, {
      status: "PENDING",
      eventType: `${input.domain}.${input.action}`,
      payload: JSON.stringify(input),
      subjectId: input.subjectId ?? null,
      participantId: input.participantId ?? null,
      error: errorMessage(error),
      retryCount: 0,
      correlationId: input.correlationId ?? null,
      nextRetryAt: null,
    });
    return data.uiapi.AuditOutbox__cCreate.Record.Id;
  } catch (err) {
    console.error(
      `Failed to write audit outbox entry for ${input.correlationId ?? input.subjectId ?? "unknown-subject"}`,
      err,
    );
    return null;
  }
}

/** List entries by status, oldest first (worker order). Never throws. */
export async function listOutboxEntries(
  status: AuditOutboxStatus,
  limit = OUTBOX_BATCH_SIZE,
): Promise<AuditOutboxEntry[]> {
  try {
    const data = await executeGraphQL<OutboxQueryResponse, { status: string; limit: number }>(
      LIST_OUTBOX_ENTRIES,
      { status, limit },
    );
    const edges = data?.uiapi?.query?.AuditOutbox__c?.edges ?? [];
    const entries: AuditOutboxEntry[] = [];
    for (const edge of edges) {
      if (!edge?.node) continue;
      const entry = toEntry(edge.node);
      if (entry) entries.push(entry);
    }
    return entries;
  } catch (err) {
    console.error(`Failed to list audit outbox entries (${status})`, err);
    return [];
  }
}

async function updateOutboxEntry(
  id: string,
  patch: {
    status?: AuditOutboxStatus;
    error?: string | null;
    retryCount?: number;
    nextRetryAt?: string | null;
  },
): Promise<void> {
  await executeGraphQL(UPDATE_OUTBOX_ENTRY, {
    id,
    status: patch.status ?? null,
    error: patch.error ?? null,
    retryCount: patch.retryCount ?? null,
    nextRetryAt: patch.nextRetryAt ?? null,
  });
}

function parsePayload(raw: string): CreateAuditEventInput | null {
  try {
    const parsed = JSON.parse(raw) as CreateAuditEventInput;
    if (!parsed || typeof parsed !== "object" || !parsed.domain || !parsed.action) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface OutboxProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

/**
 * One worker run: replay due PENDING entries (NextRetryAt null or past).
 * - Replay ok → PROCESSED.
 * - Replay fails + retries left → PENDING with incremented RetryCount__c
 *   and backoff NextRetryAt (counted as skipped: still in flight).
 * - Replay fails + retries exhausted → FAILED (terminal for the worker).
 * - Unparseable payload → FAILED immediately (retrying can't help).
 * - NextRetryAt in the future → skipped until due.
 *
 * Delivery is at-least-once by design (no atomic claim exists via UIAPI):
 * overlapping runs may replay the same payload twice. Replays reuse the
 * frozen correlationId, so duplicates collapse into ONE timeline group
 * (groupEventsByCorrelation) — visible duplication is impossible, a spare
 * store row is the accepted worst case.
 */
export async function processOutboxOnce(): Promise<OutboxProcessResult> {
  const result: OutboxProcessResult = { processed: 0, failed: 0, skipped: 0 };
  const now = new Date();
  const entries = await listOutboxEntries("PENDING");

  for (const entry of entries) {
    if (entry.nextRetryAt && new Date(entry.nextRetryAt) > now) {
      result.skipped += 1;
      continue;
    }
    const payload = parsePayload(entry.payload);
    if (!payload) {
      try {
        await updateOutboxEntry(entry.id, {
          status: "FAILED",
          error: "Unparseable payload; manual review required.",
          retryCount: entry.retryCount,
        });
      } catch (err) {
        console.error(`Failed to fail outbox entry ${entry.id}`, err);
      }
      result.failed += 1;
      continue;
    }
    try {
      await auditService.record(payload);
      await updateOutboxEntry(entry.id, { status: "PROCESSED" });
      result.processed += 1;
    } catch (err) {
      const retryCount = entry.retryCount + 1;
      const exhausted = retryCount >= MAX_OUTBOX_RETRIES;
      try {
        await updateOutboxEntry(entry.id, {
          status: exhausted ? "FAILED" : "PENDING",
          error: errorMessage(err),
          retryCount,
          nextRetryAt: exhausted
            ? null
            : new Date(now.getTime() + outboxRetryDelayMinutes(retryCount) * 60_000).toISOString(),
        });
      } catch (updateErr) {
        console.error(`Failed to update outbox entry ${entry.id}`, updateErr);
      }
      if (exhausted) result.failed += 1;
      else result.skipped += 1;
    }
  }
  return result;
}

/**
 * Manual admin replay: FAILED → PENDING (clears the backoff so the next
 * worker run picks it up immediately). The human edit is the deliberate
 * gate before a suspicious payload retries.
 */
export async function requeueOutboxEntry(id: string): Promise<void> {
  await updateOutboxEntry(id, { status: "PENDING", nextRetryAt: null });
}
