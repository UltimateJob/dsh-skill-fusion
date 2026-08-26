import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chooseMode, activateSkill, reconcileOrphans, removeActivation } from "../lib/activate.js";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-act-")); }
function fixtureSkill(dir) {
  mkdirSync(join(dir, "adversarial-review", "references"), { recursive: true });
  writeFileSync(join(dir, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: x\n---\nbody", "utf8");
  writeFileSync(join(dir, "adversarial-review", "references", "r.md"), "ref", "utf8");
  return join(dir, "adversarial-review");
}

test("chooseMode: symlink for a real dir", () => {
  const home = freshHome();
  const src = fixtureSkill(join(home, "src"));
  assert.equal(chooseMode(src), "symlink");
});

test("activateSkill: symlinks source into ~/.dsh/skills/<name>", () => {
  const home = freshHome();
  const src = fixtureSkill(join(home, "src"));
  const r = activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "symlink");
  assert.equal(lstatSync(r.target).isSymbolicLink(), true);
  assert.equal(existsSync(join(r.target, "SKILL.md")), true);
  assert.equal(existsSync(join(r.target, "references", "r.md")), true);
});

test("activateSkill: target exists -> not ok", () => {
  const home = freshHome();
  const src = fixtureSkill(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  const r2 = activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  assert.equal(r2.ok, false);
  assert.equal(r2.error, "target-exists");
});

test("activateSkill: force copy mode", () => {
  const home = freshHome();
  const src = fixtureSkill(join(home, "src"));
  const r = activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home, mode: "copy" });
  assert.equal(r.ok, true);
  assert.equal(r.mode, "copy");
  assert.equal(lstatSync(r.target).isDirectory(), true);
});

test("reconcileOrphans: flags skills whose target vanished", () => {
  const home = freshHome();
  const src = fixtureSkill(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: src, version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  removeActivation({ name: "adversarial-review", dshHome: home });
  assert.deepEqual(reconcileOrphans({ manifest: m, dshHome: home }), ["adversarial-review"]);
});

test("removeActivation: idempotent on missing", () => {
  const home = freshHome();
  const r = removeActivation({ name: "nope", dshHome: home });
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-found");
});
