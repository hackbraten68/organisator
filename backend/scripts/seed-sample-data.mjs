#!/usr/bin/env node
/**
 * Dev seed: realistic sample data for 10-13 participants (backendtest demo org).
 *
 * WHAT IT DOES
 * Creates participants, drives status/coach/program changes and learning-path
 * mutations, and writes the matching audit events — the same sequences and
 * shapes the production services use (participantService/programService).
 * Result: a lived-in org with inbox variety, timeline history and learning
 * path dramaturgy instead of sterile end states.
 *
 * WHY NOT THE TS SERVICES DIRECTLY
 * The services run on createDataSDK(), which needs the UIBundle browser
 * session and cannot execute from plain Node. This script therefore posts the
 * repo's own .graphql documents (read as text, no drift on operation shape)
 * and mirrors the service audit logic 1:1 (same event types, same
 * changes/metadata split). Service code paths themselves are unit-tested;
 * this script exercises the org end-to-end (picklists, lookups, timeline).
 * If service audit logic changes, mirror it here.
 *
 * KNOWN GAPS (documented, not hidden)
 * - Participant creation currently has no production audit writer. The seed
 *   emits participant.created events directly to create a realistic timeline.
 * - Absence/appointment domains have no writers and are not seeded.
 *
 * USAGE
 *   node scripts/seed-sample-data.mjs [--target-org backendtest] [--dry-run] [--rebuild]
 *   Default run aborts when scripts/.seed-manifest.json exists (no double seed).
 *   --rebuild deletes the previous seed (incl. its audit events) and reseeds.
 *   --dry-run prints the plan without writing anything.
 *
 * CLEANUP SEMANTICS
 * Seed audit events carry CorrelationId DEV_SEED_<date> and are deleted with
 * the seed: a fresh seed must yield a deterministic state, never orphaned
 * history pointing at deleted subjects.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "force-app/main/default/uiBundles/backend/src");
const MANIFEST_PATH = path.join(ROOT, "scripts/.seed-manifest.json");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const TARGET_ORG = opt("--target-org", "backendtest");
const DRY_RUN = args.includes("--dry-run");
const REBUILD = args.includes("--rebuild");

const RUN_ID = `DEV_SEED_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
const ACTOR = { id: "SYSTEM", type: "system", displayName: "System" };

// ---------------------------------------------------------------------------
// Salesforce GraphQL transport
// ---------------------------------------------------------------------------
let ENDPOINT = null;
function sfJson(cmd, extra = []) {
  return JSON.parse(execFileSync("sf", [...cmd, "--json"], { encoding: "utf8" }));
}
function auth() {
  const org = sfJson(["org", "display", "--target-org", TARGET_ORG]).result;
  const token = sfJson(["org", "auth", "show-access-token", "--target-org", TARGET_ORG]).result
    .accessToken;
  ENDPOINT = {
    url: `${org.instanceUrl}/services/data/v67.0/graphql`,
    token,
  };
}
async function gql(operation, variables = {}) {
  const res = await fetch(ENDPOINT.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENDPOINT.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: operation, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(`GraphQL Error: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (body.data == null) throw new Error("GraphQL response data is null");
  return body.data;
}
const doc = (p) => readFileSync(path.join(SRC, p), "utf8");

const CREATE_PARTICIPANT = `mutation SeedCreateParticipant(
  $name: String!, $status: Picklist, $email: Email, $github: String, $discord: String,
  $programId: IdOrRef, $coachId: IdOrRef
) {
  uiapi {
    Participant__cCreate(input: { Participant__c: {
      Name: $name, Status__c: $status, Email__c: $email, GitHub__c: $github,
      Discord__c: $discord, Program__c: $programId, Coach_Profile__c: $coachId
    } }) { Record { Id } }
  }
}`;
const DELETE_ONE = (type) => `mutation SeedDelete($id: ID!) {
  uiapi { ${type}Delete(input: { Id: $id }) { Record { Id } } }
}`;
const QUERY_PROGRAMS = `query SeedPrograms { uiapi { query {
  Program__c(first: 20) { edges { node { Id Name { value } } } } } } }`;
const QUERY_COACHES = `query SeedCoaches { uiapi { query {
  Coach_Profile__c(first: 20) { edges { node { Id Name { value } } } } } } }`;

// ---------------------------------------------------------------------------
// Audit writer (mirrors auditService.record variable shapes)
// ---------------------------------------------------------------------------
async function writeAuditEvent({
  eventType, domain, action, subjectType, subjectId, participantId,
  changes, metadata, reason, occurredAt,
}) {
  const changedFields = changes.map((c) => c.field);
  const data = await gql(doc("api/audit/query/CreateAuditEvent.graphql"), {
    occurredAt,
    eventType,
    schemaVersion: 1,
    domain,
    action,
    actorType: ACTOR.type,
    actorId: ACTOR.id,
    actorDisplayName: ACTOR.displayName,
    subjectType,
    subjectId,
    participantId,
    source: "web",
    correlationId: RUN_ID,
    requestId: randomUUID(),
    reason: reason ?? null,
    changedFields: JSON.stringify(changedFields),
    changes: JSON.stringify(
      changes.map((c) => ({ ...c, displayType: c.displayType ?? "text", redacted: false })),
    ),
    metadata: JSON.stringify(metadata),
    visibility: "staff",
    sensitivity: "normal",
  });
  return data.uiapi.AuditEvent__cCreate.Record.Id;
}

// Staggered occurredAt cursor for a realistic 3-week history.
let clock = new Date("2026-09-07T09:00:00.000Z").getTime();
function tick(hours = 11) {
  clock += hours * 3600 * 1000;
  return new Date(clock).toISOString();
}

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------
const PEOPLE = [
  // Onboarding with targeted inbox gaps (program/coach/discord/github rules)
  { name: "Aylin Yilmaz", email: "aylin.yilmaz@example.com", github: null, discord: "aylin_y", program: "IT Pro", coach: "Sandra Krüger", finalStatus: "Onboarding", flips: [], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Grundlagen", 3, "In Progress"]] },
  { name: "Jonas Weber", email: "jonas.weber@example.com", github: "jonasweber", discord: null, program: "IT Pro Advanced", coach: "Ghaith Saidani", finalStatus: "Onboarding", flips: [], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Grundlagen", 3, "In Progress"]] },
  { name: "Fatima Haddad", email: "fatima.haddad@example.com", github: "fatimahaddad", discord: "fatima_h", program: "IT Pro", coach: null, finalStatus: "Onboarding", flips: [], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Grundlagen", 3, "In Progress"]] },
  { name: "Leon Fischer", email: "leon.fischer@example.com", github: "leonfischer", discord: "leon_f", program: null, coach: "Frank Blum", finalStatus: "Onboarding", flips: [], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Grundlagen", 3, "In Progress", "advance"]] },
  // Active journeys
  { name: "Sara Novak", email: "sara.novak@example.com", github: "saranovak", discord: "sara_n", program: "IT Pro", coach: "Sandra Krüger", firstCoach: "Frank Blum", firstProgram: "Test Course", finalStatus: "Active", flips: ["Active"], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Completed"], ["React-Projekt", 4, "In Progress"]] },
  { name: "Mehmet Kaya", email: "mehmet.kaya@example.com", github: "mehmetkaya", discord: "mehmet_k", program: "IT Pro Advanced", coach: "Ghaith Saidani", finalStatus: "Active", flips: ["Active"], reorder: 2, items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Completed"], ["React-Projekt", 4, "In Progress", "advance"]] },
  { name: "Julia Brandt", email: "julia.brandt@example.com", github: "juliabrandt", discord: "julia_b", program: "IT Pro", coach: "Sam Dillenburg", finalStatus: "Active", flips: ["Active"], updateWeeks: ["JavaScript Vertiefung", 4], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 2, "Completed"], ["React-Projekt", 4, "In Progress"]] },
  { name: "David Okafor", email: "david.okafor@example.com", github: "davidokafor", discord: "david_o", program: "Test Course", coach: "Frank Blum", finalStatus: "Active", flips: ["Active"], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Completed"], ["React-Projekt", 4, "In Progress"]] },
  { name: "Lena Hoffmann", email: "lena.hoffmann@example.com", github: "lenahoffmann", discord: "lena_h", program: "IT Pro", coach: "Sandra Krüger", finalStatus: "Active", flips: ["Active"], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Completed"], ["React-Projekt", 4, "In Progress"]] },
  // Edge journeys
  { name: "Karim Mansour", email: "karim.mansour@example.com", github: "karimmansour", discord: "karim_m", program: "IT Pro Advanced", coach: "Ghaith Saidani", finalStatus: "Paused", flips: ["Active", "Paused"], deleteItem: "Git Grundlagen", items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Planned"]] },
  { name: "Sophie Lehmann", email: "sophie.lehmann@example.com", github: "sophielehmann", discord: "sophie_l", program: "IT Pro", coach: "Sam Dillenburg", finalStatus: "Graduated", flips: ["Active", "Graduated"], items: [["HTML & CSS Grundlagen", 2, "Completed"], ["JavaScript Vertiefung", 3, "Completed"], ["React-Abschlussprojekt", 4, "Completed"], ["Bewerbungstraining", 2, "Completed"]] },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const manifest = { runId: RUN_ID, targetOrg: TARGET_ORG, participants: [], items: [], auditEvents: [] };
const auditIds = [];
async function audit(vars) {
  const id = await writeAuditEvent(vars);
  auditIds.push(id);
  return id;
}

async function main() {
  if (existsSync(MANIFEST_PATH) && !REBUILD && !DRY_RUN) {
    console.error(`Seed manifest exists (${MANIFEST_PATH}). Refusing double seed. Use --rebuild.`);
    process.exit(2);
  }
  auth();

  const programs = Object.fromEntries(
    (await gql(QUERY_PROGRAMS)).uiapi.query.Program__c.edges.map((e) => [e.node.Name.value, e.node.Id]),
  );
  const coaches = Object.fromEntries(
    (await gql(QUERY_COACHES)).uiapi.query.Coach_Profile__c.edges.map((e) => [e.node.Name.value, e.node.Id]),
  );
  for (const name of ["IT Pro", "IT Pro Advanced", "Test Course"]) {
    if (!programs[name]) throw new Error(`Program missing: ${name}`);
  }

  if (DRY_RUN) {
    const items = PEOPLE.reduce((n, p) => n + p.items.length + (p.deleteItem ? 1 : 0), 0);
    console.log(`DRY RUN against ${TARGET_ORG}: ${PEOPLE.length} participants, ~${items} learning-path items.`);
    console.log("Programs:", Object.keys(programs).join(", "));
    console.log("Coaches:", Object.keys(coaches).join(", "));
    return;
  }

  if (REBUILD) await cleanup();

  const UPDATE_PARTICIPANT = doc("api/participant/query/UpdateParticipant.graphql");
  const CREATE_ITEM = doc("api/program/query/CreateLearningPathItem.graphql");
  const UPDATE_ITEM = doc("api/program/query/UpdateLearningPathItem.graphql");
  const DELETE_ITEM = doc("api/program/query/DeleteLearningPathItem.graphql");

  for (const p of PEOPLE) {
    const programId = p.program ? programs[p.program] : null;
    const coachId = (p.firstCoach ?? p.coach) ? coaches[p.firstCoach ?? p.coach] : null;

    // 1. Create as Onboarding (mirrors future create flow; no prod writer yet).
    const created = await gql(CREATE_PARTICIPANT, {
      name: p.name, status: "Onboarding",
      email: p.email ?? null, github: p.github ?? null, discord: p.discord ?? null,
      programId, coachId,
    });
    const pid = created.uiapi.Participant__cCreate.Record.Id;
    manifest.participants.push({ id: pid, name: p.name });

    const changes = [
      { field: "Name", oldValue: undefined, newValue: p.name },
      { field: "Status__c", oldValue: undefined, newValue: "Onboarding" },
    ];
    if (p.email) changes.push({ field: "Email__c", oldValue: undefined, newValue: p.email });
    if (programId) changes.push({ field: "Program__c", oldValue: undefined, newValue: programId });
    if (coachId) changes.push({ field: "Coach_Profile__c", oldValue: undefined, newValue: coachId });
    await audit({
      eventType: "participant.created", domain: "participant", action: "created",
      subjectType: "Participant__c", subjectId: pid, participantId: pid,
      changes, metadata: { programId, coachId }, occurredAt: tick(),
    });

    // 2. Coach/program change before status flips (Sara: visible updated event).
    if (p.firstCoach || p.firstProgram) {
      const newProgramId = programs[p.program];
      const newCoachId = coaches[p.coach];
      await gql(UPDATE_PARTICIPANT, { id: pid, programId: newProgramId, coachId: newCoachId });
      await audit({
        eventType: "participant.updated", domain: "participant", action: "updated",
        subjectType: "Participant__c", subjectId: pid, participantId: pid,
        changes: [
          { field: "Program__c", oldValue: programId, newValue: newProgramId },
          { field: "Coach_Profile__c", oldValue: coachId, newValue: newCoachId },
        ],
        metadata: { programId: newProgramId, coachId: newCoachId }, occurredAt: tick(),
      });
    }

    // 3. Status journey Onboarding -> ... (mirrors updateParticipant audit split).
    let status = "Onboarding";
    for (const next of p.flips) {
      await gql(UPDATE_PARTICIPANT, { id: pid, status: next });
      await audit({
        eventType: "participant.status_changed", domain: "participant", action: "status_changed",
        subjectType: "Participant__c", subjectId: pid, participantId: pid,
        changes: [{ field: "Status__c", oldValue: status, newValue: next, displayType: "status" }],
        metadata: { previousStatus: status, newStatus: next }, occurredAt: tick(17),
      });
      status = next;
    }

    // 4. Learning-path dramaturgy.
    const itemProgramId = programId ?? programs["IT Pro"];
    let order = 0;
    const itemIds = {};
    for (const [title, weeks, itemStatus, advance] of p.items) {
      order += 1;
      const startStatus = advance ? "Planned" : itemStatus;
      const res = await gql(CREATE_ITEM, {
        participantId: pid, programId: itemProgramId, title,
        order, status: startStatus, estimatedWeeks: weeks,
      });
      const itemId = res.uiapi.Learning_Path__cCreate.Record.Id;
      itemIds[title] = { id: itemId, order, weeks, status: startStatus };
      manifest.items.push({ id: itemId, title, participant: p.name });
      await audit({
        eventType: "learning_path.item_created", domain: "learning_path", action: "created",
        subjectType: "LearningPathItem__c", subjectId: itemId, participantId: pid,
        changes: [
          { field: "Title", oldValue: undefined, newValue: title },
          { field: "EstimatedWeeks__c", oldValue: undefined, newValue: weeks },
          { field: "Status", oldValue: undefined, newValue: startStatus },
        ],
        metadata: { title, programId: itemProgramId, estimatedWeeks: weeks, status: startStatus, source: "program_editor" },
        occurredAt: tick(7),
      });
      if (advance) {
        await gql(UPDATE_ITEM, { id: itemId, status: itemStatus });
        await audit({
          eventType: "learning_path.item_updated", domain: "learning_path", action: "updated",
          subjectType: "LearningPathItem__c", subjectId: itemId, participantId: pid,
          changes: [{ field: "Status", oldValue: "Planned", newValue: itemStatus }],
          metadata: { title, programId: itemProgramId, estimatedWeeks: weeks, status: itemStatus, source: "program_editor" },
          occurredAt: tick(9),
        });
        itemIds[title].status = itemStatus;
      }
    }

    // 5. Duration update (visible item_updated).
    if (p.updateWeeks) {
      const [title, newWeeks] = p.updateWeeks;
      const item = itemIds[title];
      await gql(UPDATE_ITEM, { id: item.id, estimatedWeeks: newWeeks });
      await audit({
        eventType: "learning_path.item_updated", domain: "learning_path", action: "updated",
        subjectType: "LearningPathItem__c", subjectId: item.id, participantId: pid,
        changes: [{ field: "EstimatedWeeks__c", oldValue: item.weeks, newValue: newWeeks }],
        metadata: { title, programId: itemProgramId, estimatedWeeks: newWeeks, status: item.status, source: "program_editor" },
        occurredAt: tick(9),
      });
    }

    // 6. Reorder (backend-only: hidden from timelines, tracked in store).
    if (p.reorder !== undefined) {
      const ordered = Object.values(itemIds).sort((a, b) => a.order - b.order);
      const [moved] = ordered.splice(p.reorder, 1);
      ordered.splice(p.reorder - 1, 0, moved);
      for (const [index, it] of ordered.entries()) {
        await gql(UPDATE_ITEM, { id: it.id, order: index + 1 });
      }
      const titles = ordered.map((it) => Object.keys(itemIds).find((t) => itemIds[t] === it));
      const movedTitle = titles[ordered.indexOf(moved)];
      await audit({
        eventType: "learning_path.item_reordered", domain: "learning_path", action: "reordered",
        subjectType: "LearningPathItem__c", subjectId: moved.id, participantId: pid,
        changes: [{ field: "Order__c", oldValue: moved.order, newValue: p.reorder }],
        metadata: { title: movedTitle, programId: itemProgramId, previousPosition: moved.order, newPosition: p.reorder, source: "program_editor" },
        occurredAt: tick(5),
      });
    }

    // 7. Delete with snapshot (visible item_deleted).
    if (p.deleteItem) {
      order += 1;
      const res = await gql(CREATE_ITEM, {
        participantId: pid, programId: itemProgramId, title: p.deleteItem,
        order, status: "Planned", estimatedWeeks: 1,
      });
      const itemId = res.uiapi.Learning_Path__cCreate.Record.Id;
      await audit({
        eventType: "learning_path.item_created", domain: "learning_path", action: "created",
        subjectType: "LearningPathItem__c", subjectId: itemId, participantId: pid,
        changes: [
          { field: "Title", oldValue: undefined, newValue: p.deleteItem },
          { field: "EstimatedWeeks__c", oldValue: undefined, newValue: 1 },
          { field: "Status", oldValue: undefined, newValue: "Planned" },
        ],
        metadata: { title: p.deleteItem, programId: itemProgramId, estimatedWeeks: 1, status: "Planned", source: "program_editor" },
        occurredAt: tick(7),
      });
      await gql(DELETE_ITEM, { id: itemId });
      await audit({
        eventType: "learning_path.item_deleted", domain: "learning_path", action: "deleted",
        subjectType: "LearningPathItem__c", subjectId: itemId, participantId: pid,
        changes: [],
        metadata: { title: p.deleteItem, programId: itemProgramId, previousPosition: order, estimatedWeeks: 1, status: "Planned", source: "program_editor" },
        occurredAt: tick(9),
      });
    }

    console.log(`seeded ${p.name} (${status})`);
  }

  manifest.auditEvents = auditIds;
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone: ${manifest.participants.length} participants, ${manifest.items.length} items, ${auditIds.length} audit events. Manifest: ${MANIFEST_PATH}`);
}

async function cleanup() {
  if (!existsSync(MANIFEST_PATH)) {
    console.log("No manifest, nothing to clean.");
    return;
  }
  const old = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  // Seed audit events first (incl. LIKE fallback for robustness), then items, then participants.
  const like = await gql(
    `query SeedEvents($prefix: String!) { uiapi { query {
      AuditEvent__c(where: { CorrelationId__c: { like: $prefix } }, first: 200) {
        edges { node { Id } } } } } }`,
    { prefix: "DEV_SEED_%" },
  );
  const eventIds = new Set([
    ...(old.auditEvents ?? []),
    ...like.uiapi.query.AuditEvent__c.edges.map((e) => e.node.Id),
  ]);
  for (const id of eventIds) await gql(DELETE_ONE("AuditEvent__c"), { id });
  for (const item of old.items ?? []) {
    try { await gql(DELETE_ONE("Learning_Path__c"), { id: item.id }); } catch { /* already gone */ }
  }
  for (const p of old.participants ?? []) {
    try { await gql(DELETE_ONE("Participant__c"), { id: p.id }); } catch { /* already gone */ }
  }
  unlinkSync(MANIFEST_PATH);
  console.log(`Cleaned ${eventIds.size} events, ${(old.items ?? []).length} items, ${(old.participants ?? []).length} participants.`);
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`);
  console.error("Partial state may exist. Manifest (if written) lists created records.");
  process.exit(1);
});
