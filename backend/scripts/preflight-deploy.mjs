#!/usr/bin/env node
/**
 * Preflight for `sf project deploy start` over the whole `force-app` tree.
 *
 * WHY THIS EXISTS
 *   Both org-setup entry points deploy with `--source-dir force-app`, which sweeps up
 *   every file in the project, untracked ones included. A Profile in that tree is not a
 *   cosmetic problem: per AGENTS.md control test E3 a Profile deploy cannot provision a
 *   required field, fails, and `rollbackOnError` then rolls back the ENTIRE deploy —
 *   every custom object with it. A failed deploy is a null deploy.
 *
 * WHY .forceignore IS NOT ENOUGH
 *   It was measured, not assumed. With @salesforce/cli 2.149.9, a pattern listed in
 *   .forceignore still shows up as a component in `sf project deploy start --dry-run`
 *   (verified with `package.xml`, which is listed in both projects' .forceignore and
 *   still appears). So .forceignore is kept as a second layer, but it is NOT the
 *   protection. This function is.
 *
 * PROTECTION SCOPE — do not overstate it
 *
 *   Entry point                          Guard
 *   ------------------------------------ -----------------------------------------
 *   org-setup.mjs                        preflight + .forceignore
 *   org-setup-dev.mjs                    preflight + .forceignore
 *   a repo-owned npm deploy wrapper      preflight + .forceignore
 *   direct `sf project deploy start`     .forceignore only, and per the measurement
 *                                        above that is unproven — not a guarantee
 *   direct CLI with explicit --metadata  MUST be tested separately; an explicit scope
 *                                        can bypass source traversal entirely
 *
 *   The preflight guards every deploy path this repository owns. It cannot guard a
 *   command a developer types by hand.
 *
 * Usage:
 *   node scripts/preflight-deploy.mjs                 # check backend
 *   node scripts/preflight-deploy.mjs --project ../frontend
 *   node scripts/preflight-deploy.mjs --json
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(HERE, "..");
const DEFAULT_DIR = join(BACKEND_ROOT, "force-app", "main", "default");

/**
 * Metadata types that must never be swept into a wholesale deploy.
 * `Profile` is the hard blocker; the rest are recorded because the same class of
 * damage applies and the listing is what makes the check auditable.
 */
const BLOCKING = {
  Profile:
    "cannot provision required fields; a failure rolls back the whole deploy (E3)",
  SharingRule:
    "not deployable against an org without Experience Cloud; rejected outright",
  SharingGuestRule: "same as SharingRule",
  SharingSet: "same as SharingRule",
  CustomProfile: "alias for Profile in some sources"
};

/**
 * Rules that only apply to ONE project.
 *
 * Experience Cloud belongs to the `frontend` project (AGENTS.md ownership), and
 * `frontend/scripts/org-setup.mjs` reuses this module against its own tree with
 * `projectRoot: "frontend"`. A flat BLOCKING table would therefore block the
 * frontend's legitimate Network/Site/bundle deploy, so these live behind a
 * project key.
 *
 * The `backend` entry covers a retrieve without an explicit member list: it
 * drags the stock Communities template set into the backend tree. Because that
 * project deploys with a bare `sf project deploy start`, the residue goes live
 * on the next deploy and re-opens the self-registration surface that Phase 0
 * and ADR-005 removed.
 */
const BLOCKING_BY_PROJECT = {
  backend: {
    Network: "owned by the frontend project; deploys a second Experience Cloud network",
    Site: "owned by the frontend project; deploys a second site",
    CustomSite: "same as Site",
    DigitalExperienceBundle: "owned by the frontend project",
    ExperienceBundle: "alias for DigitalExperienceBundle in some sources",
    DigitalExperienceConfig: "owned by the frontend project",
    NetworkBranding: "owned by the frontend project",
    CustomIndex: "owned by the frontend project",
    CustomAudience: "owned by the frontend project",
    NavigationMenu: "owned by the frontend project",
    AppMenu: "owned by the frontend project",
    SiteProfile: "owned by the frontend project",

    // This project ships a UI bundle, not Visualforce. Any ApexPage in the tree
    // came from the Communities template (`CommunitiesSelfReg.page`,
    // `SiteRegisterConfirm.page`, `MicrobatchSelfReg.page`, ...).
    ApexPage: "stock Visualforce from the Communities template; no VF in this app"
  }
};

/**
 * The effective rule set for a project.
 * @param {string} projectRoot project directory name, e.g. "backend"
 * @returns {Record<string, string>} type -> reason
 */
export function blockingRulesFor(projectRoot) {
  return { ...BLOCKING, ...(BLOCKING_BY_PROJECT[projectRoot] ?? {}) };
}

/** Types worth printing so a human can see what a deploy would carry. */
const NOTABLE = new Set([
  "Profile",
  "ApexClass",
  "ApexTrigger",
  "ApexPage",
  "AuraComponentBundle",
  "CustomObject",
  "CustomField",
  "CustomPermission",
  "CustomSetting",
  "CustomMetadataType",
  "CustomTab",
  "Layout",
  "PermissionSet",
  "RecordType",
  "StaticResource",
  "ValidationRule",
  "WorkflowRule",
  "UIBundle"
]);

const METADATA_SUFFIXES = [
  [".object-meta.xml", "CustomObject"],
  [".field-meta.xml", "CustomField"],
  [".cls-meta.xml", "ApexClass"],
  [".trigger-meta.xml", "ApexTrigger"],
  [".page-meta.xml", "ApexPage"],
  [".component-meta.xml", "AuraComponentBundle"],
  [".permissionset-meta.xml", "PermissionSet"],
  [".profile-meta.xml", "Profile"],
  [".layout-meta.xml", "Layout"],
  [".recordType-meta.xml", "RecordType"],
  [".validationRule-meta.xml", "ValidationRule"],
  [".workflowRule-meta.xml", "WorkflowRule"],
  [".customPermission-meta.xml", "CustomPermission"],
  [".customMetadataType-meta.xml", "CustomMetadataType"],
  [".objectTranslation-meta.xml", "Translation"],
  [".sharingRules-meta.xml", "SharingRule"],
  [".sharingSet-meta.xml", "SharingSet"],
  [".listView-meta.xml", "ListView"],
  [".compactLayout-meta.xml", "CompactLayout"],
  [".flexiPage-meta.xml", "FlexiPage"],
  [".settings-meta.xml", "Settings"],
  [".md-meta.xml", "CustomMetadata"],
  [".cmp-meta.xml", "LightningComponentBundle"],
  [".resource-meta.xml", "StaticResource"],
  [".resource", "StaticResource"],
  [".labels-meta.xml", "Labels"],
  [".tab-meta.xml", "CustomTab"],
  [".network-meta.xml", "Network"],
  [".site-meta.xml", "Site"],
  [".digitalExperienceBundle-meta.xml", "DigitalExperienceBundle"],
  [".digitalExperienceConfig-meta.xml", "DigitalExperienceConfig"],
  [".networkBranding-meta.xml", "NetworkBranding"],
  [".customindex-meta.xml", "CustomIndex"],
  [".audience-meta.xml", "CustomAudience"],
  [".navigationMenu-meta.xml", "NavigationMenu"],
  [".appMenu-meta.xml", "AppMenu"],
  [".siteProfile-meta.xml", "SiteProfile"]
];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".sf",
  "coverage",
  "playwright-report",
  "test-results"
]);

/**
 * Walks the metadata tree and returns the file counts per type.
 * @param {string} sourceDir absolute path to force-app/main/default
 * @param {Record<string, string>} [blocking] type -> reason; defaults to the
 *   project-independent rule set only. Callers that know the project should use
 *   {@link blockingRulesFor}.
 * @returns {{counts: Record<string, number>, blocking: Array<{type: string, file: string}>}}
 */
export function scanSourceDir(sourceDir = DEFAULT_DIR, blockingRules = BLOCKING) {
  const counts = Object.create(null);
  const blocking = [];

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".forceignore") continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;

      for (const [suffix, type] of METADATA_SUFFIXES) {
        if (!entry.name.endsWith(suffix)) continue;
        counts[type] = (counts[type] ?? 0) + 1;
        if (blockingRules[type]) {
          blocking.push({
            type,
            file: full.replace(`${sourceDir}/`, ""),
            reason: blockingRules[type]
          });
        }
        break;
      }
    }
  }

  if (existsSync(sourceDir)) walk(sourceDir);
  return { counts, blocking };
}

/**
 * Runs the check. Throws when a blocking type is present, so a caller can fail fast.
 * @param {{sourceDir?: string, projectRoot?: string}} [opts]
 * @returns {{ok: boolean, counts: Record<string, number>, blocking: Array<object>, sourceDir: string}}
 */
export function preflightDeploy(opts = {}) {
  const sourceDir = opts.sourceDir ?? DEFAULT_DIR;
  const projectRoot =
    opts.projectRoot ?? basename(resolve(sourceDir, "..", "..", ".."));
  const { counts, blocking } = scanSourceDir(sourceDir, blockingRulesFor(projectRoot));

  if (blocking.length > 0) {
    const lines = blocking.map(
      (b) => `    ${b.type.padEnd(12)} ${b.file}\n      → ${b.reason}`
    );
    throw new Error(
      `Preflight failed for "${projectRoot}". ${blocking.length} blocking metadata file(s) in the deploy tree:\n\n` +
        `${lines.join("\n\n")}\n\n` +
        "A wholesale `sf project deploy start` over this tree would fail and, with\n" +
        "rollbackOnError, take every custom object down with it.\n\n" +
        "Fix: remove the files, or narrow the deploy to an explicit --metadata scope.\n" +
        "A .forceignore entry alone is not sufficient — see the note in this file."
    );
  }

  return { ok: true, counts, blocking, sourceDir };
}

/** Prints the metadata a deploy would carry, most relevant first. */
export function formatReport(result) {
  const { counts, sourceDir } = result;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const notable = entries.filter(([t]) => NOTABLE.has(t));
  const rest = entries.filter(([t]) => !NOTABLE.has(t));

  const pad = Math.max(...notable.map(([t]) => t.length), 10);
  const lines = [`Source tree: ${sourceDir}`, ""];

  if (notable.length === 0) {
    lines.push("  (no deployable metadata found)");
  } else {
    for (const [type, n] of notable) {
      lines.push(`  ${type.padEnd(pad)}  ${String(n).padStart(4)}`);
    }
  }
  if (rest.length) {
    const otherTotal = rest.reduce((s, [, n]) => s + n, 0);
    lines.push(
      `  ${"(other types)".padEnd(pad)}  ${String(otherTotal).padStart(4)}`
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  const args = process.argv.slice(2);
  const get = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")
      ? args[i + 1]
      : fallback;
  };
  const projectArg = get("--project");
  const sourceDir = projectArg
    ? resolve(process.cwd(), projectArg, "force-app", "main", "default")
    : DEFAULT_DIR;
  const asJson = args.includes("--json");

  try {
    const result = preflightDeploy({ sourceDir });
    if (asJson) {
      console.log(
        JSON.stringify({ ok: true, sourceDir, counts: result.counts }, null, 2)
      );
    } else {
      console.log("Preflight OK — no blocking metadata in the deploy tree.\n");
      console.log(formatReport(result));
    }
    process.exit(0);
  } catch (error) {
    if (asJson) {
      console.log(
        JSON.stringify({ ok: false, sourceDir, error: error.message }, null, 2)
      );
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

export { BLOCKING, NOTABLE };
