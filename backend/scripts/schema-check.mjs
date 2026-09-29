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
const TARGET_ORG = opt("--target-org", "organiser-dev");

// ---------------------------------------------------------------------------
// Org side: run the Apex probe and parse its report
// ---------------------------------------------------------------------------
/**
 * `sf apex run` prints the script, then a log block. The debug payload is the
 * last log block and arrives as real, separate lines with the pipes HTML
 * escaped as `&#124;`. Apex also lower-cases field API names, so every name is
 * compared case-insensitively.
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
      if (!fieldsByObject.has(parts[1]))
        fieldsByObject.set(parts[1], new Set());
    } else if (parts[0] === "FIELD" && parts[3] === "PRESENT") {
      if (!fieldsByObject.has(parts[1]))
        fieldsByObject.set(parts[1], new Set());
      fieldsByObject.get(parts[1]).add(parts[2].toLowerCase());
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
  return { fieldsByObject, checks };
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
 */
function repoFieldsFor(objectName) {
  const dir = path.join(OBJECTS_DIR, objectName, "fields");
  if (!existsSync(dir))
    return {
      fields: new Set(),
      problems: [`object ${objectName} not in source`]
    };

  const fields = new Set();
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
  }
  return { fields, problems };
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
 * Returns a Set of lower-cased custom field API names known to the Tooling API.
 */
function toolingFieldsFor(objectName) {
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
    return null; // Tooling API unavailable; degrade to runtime-only comparison.
  }

  try {
    const records = JSON.parse(raw).result?.records ?? [];
    return new Set(records.map((r) => r.QualifiedApiName.toLowerCase()));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
try {
  report();
} catch (err) {
  console.error(`\nHealthcheck abgebrochen: ${err.message}\n`);
  process.exit(2);
}

function report() {
  const { fieldsByObject, checks } = probeRuntimeSchema();

  const objectNames = [...fieldsByObject.keys()].sort();
  const rows = [];
  let drift = 0;

  for (const objectName of objectNames) {
    const runtime = fieldsByObject.get(objectName);
    const { fields: repo, problems } = repoFieldsFor(objectName);
    const tooling = toolingFieldsFor(objectName);

    const missing = [...repo].filter((f) => !runtime.has(f)).sort();
    const extra = [...runtime].filter((f) => !repo.has(f)).sort();
    if (missing.length || extra.length || problems.length) drift++;

    rows.push({
      objectName,
      repo: repo.size,
      runtime: runtime.size,
      missing,
      extra,
      problems,
      tooling
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
      const ghost = row.tooling?.has(field) ? "Geistfeld" : "fehlt ueberall";
      console.log(`${" ".repeat(nameWidth)}    - ${field}  [${ghost}]`);
    }
    for (const field of row.extra)
      console.log(`${" ".repeat(nameWidth)}    + ${field} (nur im Org)`);
    for (const problem of row.problems)
      console.log(`${" ".repeat(nameWidth)}    ! ${problem}`);
  }
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
