import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { activateSkill, removeActivation } from "../lib/activate.js";
import { snapshotSkill, rollbackSkill } from "../lib/rollback.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-rollback-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  return join(root, "adversarial-review");
}

test("snapshotSkill copies activated skill to snapshots dir", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  const r = await snapshotSkill("adversarial-review", home);
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(r.snapshotPath, "SKILL.md")));
});

test("rollbackSkill restores from snapshot after update", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  // snapshot v1
  await snapshotSkill("adversarial-review", home);
  // simulate an update: change the activated skill to v2
  removeActivation({ name: "adversarial-review", dshHome: home });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v2"));
  // rollback to v1
  const r = await rollbackSkill(m, "adversarial-review", home);
  assert.equal(r.ok, true);
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v1"));
});

test("rollbackSkill on nonexistent snapshot returns error", async () => {
  const home = freshHome();
  const m = emptyManifest();
  const r = await rollbackSkill(m, "nope", home);
  assert.equal(r.ok, false);
});
