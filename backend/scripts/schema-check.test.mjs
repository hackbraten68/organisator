/**
 * Tests for schema-check's pure helpers.
 *
 * WHY THIS EXISTS
 *   The case check protects against a defect that is invisible to the existence
 *   comparison: Salesforce treats field API names case-insensitively in SOQL and
 *   in Apex describe, so `DayOfWeek__c` and `DayofWeek__c` are the same field
 *   there. uiapi GraphQL is case-SENSITIVE and rejects the wrong spelling with a
 *   ValidationError that reads as if the field did not exist. API names are
 *   immutable, so the only fix is delete and recreate.
 *
 *   I cannot create a wrong-cased field in Setup to produce this for real. A
 *   check that is only green because the situation is absent right now is not a
 *   check, so the comparison is covered here instead.
 *
 * Run: node --test scripts/schema-check.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCaseMismatches } from "./schema-check.mjs";

test("identical spellings produce no mismatch", () => {
  const repo = new Set(["Order__c", "Program__c", "DayOfWeek__c"]);
  const org = new Set(["Order__c", "Program__c", "DayOfWeek__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), []);
});

test("a case-only difference IS reported", () => {
  const repo = new Set(["DayOfWeek__c"]);
  const org = new Set(["DayofWeek__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), [
    { repo: "DayOfWeek__c", org: "DayofWeek__c" }
  ]);
});

test("a case-only difference is reported, and the ORG spelling is named", () => {
  // Direction matters: the fix is to recreate the field with the repo spelling,
  // so the report has to name what the org currently holds.
  const repo = new Set(["ActorType__c"]);
  const org = new Set(["Actortype__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), [
    { repo: "ActorType__c", org: "Actortype__c" }
  ]);
});

test("a different underscore position is NOT a case mismatch", () => {
  // `ActorId__c` vs `Actor_Id__c` differ in the underscore, not in case. That is
  // a genuinely different field: the existence check reports it as missing plus
  // extra. Calling it a case mismatch would double-report it and name the wrong
  // remedy (recreate-for-case instead of the field being absent).
  const repo = new Set(["ActorId__c"]);
  const org = new Set(["Actor_Id__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), []);
});

test("a field missing from the org is NOT a case mismatch", () => {
  // Existence is the other check's job. Reporting it twice would be noise, and
  // the caller only reaches here for fields that already matched.
  const repo = new Set(["DayOfWeek__c", "Absent__c"]);
  const org = new Set(["DayofWeek__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), [
    { repo: "DayOfWeek__c", org: "DayofWeek__c" }
  ]);
});

test("differing cases across several fields are all reported, sorted", () => {
  const repo = new Set(["Zeta__c", "Alpha__c", "Mid__c"]);
  const org = new Set(["zeta__c", "alpha__c", "MID__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), [
    { repo: "Alpha__c", org: "alpha__c" },
    { repo: "Mid__c", org: "MID__c" },
    { repo: "Zeta__c", org: "zeta__c" }
  ]);
});

test("a field the org spells the same way is not affected by a neighbour", () => {
  const repo = new Set(["Good__c", "Bad__c"]);
  const org = new Set(["Good__c", "bad__c"]);
  assert.deepEqual(findCaseMismatches(repo, org), [
    { repo: "Bad__c", org: "bad__c" }
  ]);
});

test("empty sets are handled", () => {
  assert.deepEqual(findCaseMismatches(new Set(), new Set()), []);
  assert.deepEqual(findCaseMismatches(new Set(["A__c"]), new Set()), []);
  assert.deepEqual(findCaseMismatches(new Set(), new Set(["a__c"])), []);
});
