import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scanSourceDir,
  preflightDeploy,
  blockingRulesFor
} from "./preflight-deploy.mjs";

/**
 * Builds a throwaway metadata tree.
 * @param {Record<string, string[]>} files dir -> file names
 * @returns {string} absolute path to the tree root
 */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), "preflight-test-"));
  for (const [dir, names] of Object.entries(files)) {
    mkdirSync(join(root, dir), { recursive: true });
    for (const name of names) {
      writeFileSync(join(root, dir, name), "<stub/>");
    }
  }
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test("Network and Site block the backend project", () => {
  const root = tree({
    networks: ["organisator.network-meta.xml"],
    sites: ["organisator.site-meta.xml"]
  });
  try {
    const { blocking } = scanSourceDir(root, blockingRulesFor("backend"));
    const types = blocking.map((b) => b.type).sort();
    assert.deepEqual(types, ["Network", "Site"]);
  } finally {
    cleanup(root);
  }
});

test("the same files do NOT block the frontend project", () => {
  const root = tree({
    networks: ["frontend.network-meta.xml"],
    sites: ["frontend.site-meta.xml"],
    digitalExperienceConfigs: ["frontend1.digitalExperienceConfig-meta.xml"]
  });
  try {
    // frontend/scripts/org-setup.mjs runs this module against its own tree with
    // projectRoot "frontend" — a flat rule table would break the portal deploy.
    const { blocking, counts } = scanSourceDir(root, blockingRulesFor("frontend"));
    assert.deepEqual(blocking, []);
    assert.equal(counts.Network, 1);
    assert.equal(counts.Site, 1);
    assert.equal(counts.DigitalExperienceConfig, 1);
  } finally {
    cleanup(root);
  }
});

test("Profile blocks in every project", () => {
  const root = tree({ profiles: ["backend Profile.profile-meta.xml"] });
  try {
    for (const project of ["backend", "frontend"]) {
      const { blocking } = scanSourceDir(root, blockingRulesFor(project));
      assert.deepEqual(
        blocking.map((b) => b.type),
        ["Profile"],
        `Profile must block in ${project}`
      );
    }
  } finally {
    cleanup(root);
  }
});

test("stock Visualforce blocks the backend project only", () => {
  const root = tree({
    pages: ["CommunitiesSelfReg.page-meta.xml", "SiteLogin.page-meta.xml"]
  });
  try {
    assert.equal(scanSourceDir(root, blockingRulesFor("backend")).blocking.length, 2);
    assert.equal(scanSourceDir(root, blockingRulesFor("frontend")).blocking.length, 0);
  } finally {
    cleanup(root);
  }
});

test("preflightDeploy throws with every blocking type listed", () => {
  const root = tree({ networks: ["organisator.network-meta.xml"] });
  try {
    assert.throws(
      () => preflightDeploy({ sourceDir: root, projectRoot: "backend" }),
      /Preflight failed for "backend"[\s\S]*Network/
    );
  } finally {
    cleanup(root);
  }
});

test("the real backend tree is clean", () => {
  // Regression guard for the 2026-09-30 retrieve: a bulk retrieve pulled the
  // stock Communities template set (1 network, 1 site, 46 VF pages, 28 stock
  // controllers) into this project. Any reappearance fails here.
  const result = preflightDeploy();
  assert.deepEqual(result.blocking, [], `blocking metadata in backend tree: ${JSON.stringify(result.blocking)}`);
  assert.equal(result.ok, true);
});