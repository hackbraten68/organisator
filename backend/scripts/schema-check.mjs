#!/usr/bin/env node
/**
 * Runtime schema health check: compares the org's runtime schema against the
 * repository's source metadata.
 *
 * WHY THIS EXISTS
 * A successful deploy is not proof that custom fields reached the runtime
 * schema. See docs/AGENTS-salesforce-runtime-schema-troubleshooting.md: the
 * Metadata API, the Tooling API and the deploy report all report a field as
 * present, while SOQL, REST describe and Apex report "No such column" and
 * `sf project retrieve` returns nothing. The runtime schema is the only source
 * this project trusts.
 *
 * WHAT IT DOES
 * 1. Runs scripts/schema-check.apex in the target org (execute-anonymous) and
 *    reads back the runtime custom fields of every relevant object.
 * 2. Reads force-app/main/default/objects/<Object>/fields/*.field-meta.xml.
 * 3. Prints a per-object table and exits non-zero when a field the repo declares
 *    is missing from the runtime schema, or vice versa.
 *
 * The org-side probe deliberately selects only the fields describe reports, so
 * its own SOQL check cannot fail on a field it never saw. The interesting
 * comparison is org versus repo, and that is what this script owns.
 *
 * USAGE
 *   node scripts/schema-check.mjs                      # default org
 *   node scripts/schema-check.mjs --target-org myorg
 *
 * EXIT CODES
 *   0  runtime schema matches the repository
 *   1  drift between runtime schema and repository
 *   2  the org probe itself failed (auth, compile error, network)
 */

import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveTargetOrgOrThrow } from "./target-org.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OBJECTS_DIR = path.join(ROOT, "force-app/main/default/objects");
const APEX_PROBE = path.join(ROOT, "scripts/schema-check.apex");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")
    ? args[i + 1]
    : fallback;
};
// No hardcoded fallback: the org is either given explicitly or comes from
// `sf config get target-org`. A wrong guess here would report on one org while the
// developer believes they are looking at another. See scripts/target-org.mjs.
const { org: TARGET_ORG } = resolveTargetOrgOrThrow({
  argv: args,
  label: "schema-check"
});

// ---------------------------------------------------------------------------
// Org side: run the Apex probe and parse its report
// ---------------------------------------------------------------------------
/**
 * `sf apex run` prints the script, then a log block. The debug payload is the
 * last log block and arrives as real, separate lines with the pipes HTML
 * escaped as `&#124;`.
 *
 * Names are kept TWICE on purpose:
 *   - lowercased, for the existence check. SOQL and Apex describe are both
 *     case-insensitive, so `DayOfWeek__c` and `DayofWeek__c` are the same field
 *     there and must not show as drift.
 *   - verbatim, for the case check. uiapi GraphQL is case-SENSITIVE and rejects
 *     a field whose spelling differs, with a ValidationError that looks like the
 *     field does not exist. A case-only rename is therefore a real defect that
 *     must not pass, and it cannot be fixed later — API names are immutable.
 */
function probeRuntimeSchema() {
  let raw;
  try {
    raw = execFileSync(
      "sf",
      ["apex", "run", "--target-org", TARGET_ORG, "--file", APEX_PROBE],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (err) {
    const text = String(err.stdout ?? "") + String(err.stderr ?? "");
    if (/executeCompileFailure|CompileError|INVALID_OR_NULL/i.test(text)) {
      throw new Error(
        `Apex probe failed against ${TARGET_ORG}.\n${strip(text).slice(-1500)}`
      );
    }
    throw new Error(`Apex probe could not run against ${TARGET_ORG}.`);
  }

  const clean = strip(raw);
  if (/executeCompileFailure/i.test(clean)) {
    throw new Error(
      `Apex probe failed against ${TARGET_ORG}.\n${clean.slice(-1500)}`
    );
  }

  const TAGS = ["OBJ", "FIELD", "SOQL", "NEWOBJ", "INSERT", "SUMMARY"];
  const fieldsByObject = new Map();
  const exactByObject = new Map();
  const checks = [];
  let seenPayload = false;

  for (const line of clean.split("\n")) {
    // The first payload line carries the log prefix; later ones do not.
    const payload = line.includes("|DEBUG|")
      ? line.slice(line.lastIndexOf("|DEBUG|") + 7)
      : line;
    const parts = payload.split("|").map((p) => p.trim());
    if (!TAGS.includes(parts[0])) continue;
    seenPayload = true;

    if (parts[0] === "OBJ") {
      // Seed the entry so objects with no custom fields still get a row.
      if (!fieldsByObject.has(parts[1])) {
        fieldsByObject.set(parts[1], new Set());
        exactByObject.set(parts[1], new Set());
      }
    } else if (parts[0] === "FIELD" && parts[3] === "PRESENT") {
      if (!fieldsByObject.has(parts[1])) {
        fieldsByObject.set(parts[1], new Set());
        exactByObject.set(parts[1], new Set());
      }
      fieldsByObject.get(parts[1]).add(parts[2].toLowerCase());
      exactByObject.get(parts[1]).add(parts[2]);
    } else {
      checks.push(parts.join("|"));
    }
  }

  if (!seenPayload) {
    throw new Error(
      `Apex probe produced no tagged output. The script may have hit a governor limit.\n` +
        clean.slice(-1000)
    );
  }
  return { fieldsByObject, exactByObject, checks };
}

const strip = (text) =>
  text.replace(/\x1b\[[0-9;]*m/g, "").replace(/&#124;/g, "|");

// ---------------------------------------------------------------------------
// Repo side: the custom fields the source declares
// ---------------------------------------------------------------------------
/**
 * Reads the custom field API names an object declares. The file name is the API
 * name; the <fullName> element is cross-checked so a misnamed file is caught.
 *
 * Only `__c` fields are collected. objects/Account/ carries 31 *standard*
 * Salesforce fields that were retrieved into source for reference; those are
 * correctly absent from the custom-field schema and must not count as drift.
 *
 * `fields` is lower-cased for the existence check, `exact` keeps the spelling
 * for the case check. See probeRuntimeSchema() for why both are needed.
 *
 * `owned` is false when the fields directory exists but declares no custom
 * fields. That marks a standard object we carry only for reference — the repo
 * has no stake in it, and a shared sandbox accumulates fields from other
 * projects on it. A MISSING directory is different and stays a problem: that
 * means the object vanished from source by accident.
 */
function repoFieldsFor(objectName) {
  const dir = path.join(OBJECTS_DIR, objectName, "fields");
  if (!existsSync(dir))
    return {
      fields: new Set(),
      exact: new Set(),
      owned: false,
      problems: [`object ${objectName} not in source`]
    };

  const fields = new Set();
  const exact = new Set();
  const problems = [];
  for (const file of readdirSync(dir).filter((f) =>
    f.endsWith(".field-meta.xml")
  )) {
    const fromName = file.replace(".field-meta.xml", "");
    if (!fromName.endsWith("__c")) continue;
    const xml = readFileSafe(path.join(dir, file));
    const fromFullName = xml?.match(/<fullName>([^<]+)<\/fullName>/)?.[1];
    if (fromFullName && fromFullName !== fromName) {
      problems.push(`${fromName}: <fullName> says ${fromFullName}`);
    }
    fields.add(fromName.toLowerCase());
    exact.add(fromName);
  }
  return { fields, exact, owned: exact.size > 0, problems };
}

function readFileSafe(file) {
  try {
    return execFileSync("cat", [file], { encoding: "utf8" });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadata layer: is the field at least created?
// ---------------------------------------------------------------------------
/**
 * A repo field can be missing from the runtime for two very different reasons:
 * it was never created, or it exists in the metadata layer but never got
 * compiled into the runtime schema. The Tooling API tells them apart, so the
 * report can say which one it is instead of only "missing".
 *
 * The Tooling API is ALSO the only source of the org's true field spelling.
 * Apex's `Schema.Describe.fields.getMap()` keys are always lower-case — that is
 * why `containsKey('DayOfWeek__c')` and `containsKey('DayofWeek__c')` both hit —
 * so the Apex probe cannot be used for a case comparison at all. FieldDefinition
 * returns QualifiedApiName as spelled.
 *
 * Returns `{ lower, exact }`, or null when the Tooling API is unavailable.
 * Callers must degrade rather than guess: a case check run against a lower-cased
 * source would report every field as wrong.
 */
const toolingCache = new Map();

function toolingFieldsFor(objectName) {
  if (toolingCache.has(objectName)) return toolingCache.get(objectName);

  const query =
    "SELECT QualifiedApiName FROM FieldDefinition " +
    `WHERE EntityDefinition.QualifiedApiName='${objectName}' AND QualifiedApiName LIKE '%__c'`;

  let raw;
  try {
    raw = execFileSync(
      "sf",
      [
        "data",
        "query",
        "--target-org",
        TARGET_ORG,
        "--use-tooling-api",
        "--query",
        query,
        "--json"
      ],
      {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024
      }
    );
  } catch {
    toolingCache.set(objectName, null);
    return null; // Tooling API unavailable; degrade to runtime-only comparison.
  }

  let result = null;
  try {
    const records = JSON.parse(raw).result?.records ?? [];
    const exact = new Set(records.map((r) => r.QualifiedApiName));
    result = { lower: new Set([...exact].map((n) => n.toLowerCase())), exact };
  } catch {
    result = null;
  }
  toolingCache.set(objectName, result);
  return result;
}

// ---------------------------------------------------------------------------
// Case comparison
// ---------------------------------------------------------------------------
/**
 * Finds repo fields whose spelling differs from the org's, ignoring case.
 *
 * Pure and side-effect free so it can be unit tested: I cannot create a
 * wrong-cased field in Setup to produce this case for real, and a check that is
 * only ever green because the situation does not currently exist is not a check.
 *
 * Existence has already been established by the caller (a field only lands here
 * when it matched case-insensitively), so this returns the spelling difference
 * rather than "missing".
 *
 * @param {Set<string>} repoExact  API names as spelled in the repo
 * @param {Set<string>} orgExact   API names as spelled in the org
 * @returns {Array<{repo: string, org: string}>}
 */
export function findCaseMismatches(repoExact, orgExact) {
  const orgByLower = new Map();
  for (const name of orgExact) orgByLower.set(name.toLowerCase(), name);
  const mismatches = [];
  for (const name of repoExact) {
    const orgName = orgByLower.get(name.toLowerCase());
    if (orgName !== undefined && orgName !== name) {
      mismatches.push({ repo: name, org: orgName });
    }
  }
  return mismatches.sort((a, b) => a.repo.localeCompare(b.repo));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
/**
 * Only probe when run as a script. The test imports this module for its pure
 * helpers, and importing it must not fire the whole healthcheck — that is
 * several org round-trips and it would make a unit test depend on the org.
 */
function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  try {
    report();
  } catch (err) {
    console.error(`\nHealthcheck abgebrochen: ${err.message}\n`);
    process.exit(2);
  }
}

function report() {
  const { fieldsByObject, exactByObject, checks } = probeRuntimeSchema();

  const objectNames = [...fieldsByObject.keys()].sort();
  const rows = [];
  const skipped = [];
  let drift = 0;

  for (const objectName of objectNames) {
    const runtime = fieldsByObject.get(objectName);
    const {
      fields: repo,
      exact: repoExact,
      owned,
      problems
    } = repoFieldsFor(objectName);
    const tooling = toolingFieldsFor(objectName);
    const toolingLower = tooling?.lower ?? null;

    // An object the repo declares with no custom fields is not ours to verify.
    // A shared sandbox collects fields from other projects on standard objects
    // like Account, and those are not drift. Recorded rather than hidden: a check
    // that silently drops what it ignores is a check you stop trusting.
    if (!owned && problems.length === 0) {
      skipped.push({ objectName, runtime: runtime.size });
      continue;
    }

    const missing = [...repo].filter((f) => !runtime.has(f)).sort();
    const extra = [...runtime].filter((f) => !repo.has(f)).sort();
    // Only compare against the org's true spelling. Without the Tooling API
    // there is none to compare against, and guessing would flag all 90 fields.
    const caseMismatches = tooling?.exact
      ? findCaseMismatches(repoExact, tooling.exact)
      : [];
    if (
      missing.length ||
      extra.length ||
      problems.length ||
      caseMismatches.length
    )
      drift++;

    rows.push({
      objectName,
      repo: repo.size,
      runtime: runtime.size,
      missing,
      extra,
      caseMismatches,
      problems,
      toolingLower
    });
  }

  const nameWidth = Math.max(...rows.map((r) => r.objectName.length), 8);
  const rule = "-".repeat(nameWidth + 62);

  console.log(`\nRuntime-Schema-Healthcheck  (org: ${TARGET_ORG})\n`);
  console.log(
    `Orgjekt${" ".repeat(Math.max(0, nameWidth - 6))}  Repo  Org  Status`
  );
  console.log(rule);
  for (const row of rows) {
    const clean =
      row.missing.length === 0 &&
      row.extra.length === 0 &&
      row.caseMismatches.length === 0 &&
      row.problems.length === 0;
    const status = clean
      ? "ok"
      : row.missing.length
        ? "FEHLT IM ORG"
        : "ABWEICHUNG";
    console.log(
      `${row.objectName.padEnd(nameWidth)}  ${String(row.repo).padStart(4)}  ${String(row.runtime).padStart(3)}  ${status}`
    );
    for (const field of row.missing) {
      // "Geist" = in der Metadatenschicht vorhanden, aber nie ins Runtime-Schema
      // kompiliert. "Fehlt ueberall" = gar nicht erst angelegt worden.
      const ghost = row.toolingLower?.has(field)
        ? "Geistfeld"
        : "fehlt ueberall";
      console.log(`${" ".repeat(nameWidth)}    - ${field}  [${ghost}]`);
    }
    for (const field of row.extra)
      console.log(`${" ".repeat(nameWidth)}    + ${field} (nur im Org)`);
    for (const { repo, org } of row.caseMismatches)
      console.log(
        `${" ".repeat(nameWidth)}    ! ${repo}  [Org schreibt: ${org}]`
      );
    for (const problem of row.problems)
      console.log(`${" ".repeat(nameWidth)}    ! ${problem}`);
  }
  for (const { objectName, runtime } of skipped)
    console.log(
      `${objectName.padEnd(nameWidth)}  ${"übersprungen".padEnd(6)}  ${String(runtime).padStart(3)}  Repo deklariert 0 Custom-Felder — Felder im Org stammen aus fremden Projekten`
    );
  console.log(rule);

  const summary = checks.find((c) => c.startsWith("SUMMARY|"));
  if (summary) console.log(`\n${summary.replace("SUMMARY|", "Apex-Probe: ")}`);

  const orgSideFailures = checks.filter(
    (c) =>
      /\|SOQL\|[^|]+\|FAIL/.test(c) ||
      /\|NEWOBJ\|[^|]+\|FAIL/.test(c) ||
      /^INSERT\|[^|]+\|FAIL:/.test(c)
  );
  if (orgSideFailures.length) {
    console.log("\nOrg-seitige Fehler:");
    for (const failure of orgSideFailures) console.log(`  ${failure}`);
  }

  const repoTotal = rows.reduce((sum, row) => sum + row.repo, 0);
  const runtimeTotal = rows.reduce((sum, row) => sum + row.runtime, 0);

  if (drift === 0) {
    console.log(
      `\nOK: Runtime-Schema entspricht dem Repository (${repoTotal} Felder in ${rows.length} Objekten).\n`
    );
    process.exit(0);
  }

  console.log(
    `\nDRIFT: ${drift} von ${rows.length} Objekten weichen ab ` +
      `(Repo ${repoTotal} Felder, Org ${runtimeTotal} Felder im Runtime-Schema).\n` +
      `Siehe docs/schema-repair-checklist.md fuer die Anlage in Salesforce Setup.\n`
  );
  process.exit(1);
}
