/**
 * Single source of truth for the target org.
 *
 * WHY THIS EXISTS
 *   Three scripts each carried their own hardcoded `"organiser-dev"` fallback, so the
 *   effective target org depended on which entry point you happened to use. That is
 *   the worst failure mode for a deploy: the code runs, the org is different from
 *   what you believed, and records land somewhere you did not intend.
 *
 * RESOLUTION ORDER
 *   1. explicit `--target-org <alias>` — always wins
 *   2. `sf config get target-org` — the value in .sfdx/sfdx-config.json
 *   3. abort
 *
 * There is deliberately no hardcoded fallback. If neither source yields an org, this
 * throws rather than guessing: a wrong guess writes to the wrong org, an absent
 * guess writes nowhere and says so.
 */

import { execFileSync } from "node:child_process";

/**
 * @typedef {object} ResolveOptions
 * @property {string[]} [argv] process.argv slice; scanned for `--target-org <value>`
 * @property {string} [label] name used in messages, e.g. 'schema-check'
 * @property {boolean} [log] print the resolved org to stdout (default true)
 * @property {(msg: string) => void} [logger] override the sink for the log line
 */

/**
 * Reads the configured default org via the Salesforce CLI.
 *
 * The CLI's own precedence is: project-local `.sf/config.json` (repo root of the cwd)
 * first, then the global `~/.sf/config.json`. Both are honoured automatically because
 * the CLI applies them, not this function. Note the response shape: `result` is an
 * ARRAY of {name, value, path, success, location} entries, not a bare string.
 *
 * @returns {string|null} alias, or null when unset / unreadable
 */
export function readConfiguredTargetOrg() {
  try {
    const out = execFileSync("sf", ["config", "get", "target-org", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const parsed = JSON.parse(out);
    const entries = Array.isArray(parsed?.result)
      ? parsed.result
      : [parsed?.result];
    for (const entry of entries) {
      if (
        entry &&
        entry.success !== false &&
        typeof entry.value === "string" &&
        entry.value.trim()
      ) {
        return entry.value.trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Pulls `--target-org <alias>` out of an argv array.
 * @param {string[]} argv
 * @returns {string|null}
 */
export function explicitTargetOrg(argv = []) {
  const i = argv.indexOf("--target-org");
  if (i !== -1 && argv[i + 1] && !String(argv[i + 1]).startsWith("--")) {
    return String(argv[i + 1]).trim();
  }
  return null;
}

/**
 * Resolves the target org, or throws with an actionable message.
 * @param {ResolveOptions} [options]
 * @returns {{org: string, source: 'argument'|'config'}}
 */
export function resolveTargetOrgOrThrow(options = {}) {
  const {
    argv = [],
    label = "script",
    log = true,
    logger = console.log
  } = options;

  const explicit = explicitTargetOrg(argv);
  if (explicit) {
    if (log) logger(`Target org: ${explicit} (from --target-org)`);
    return { org: explicit, source: "argument" };
  }

  const configured = readConfiguredTargetOrg();
  if (configured) {
    if (log)
      logger(`Target org: ${configured} (from sf config get target-org)`);
    return { org: configured, source: "config" };
  }

  throw new Error(
    `No target org could be resolved for ${label}.\n\n` +
      "Neither --target-org was passed nor is a default org configured.\n" +
      "Set one, or pass the flag explicitly:\n\n" +
      "    sf config set target-org=<alias>\n" +
      `    node ${label} --target-org <alias>\n\n` +
      "Aborting. This script will not fall back to a hardcoded org: a wrong guess\n" +
      "would write to an org you did not intend."
  );
}
