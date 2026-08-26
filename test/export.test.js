import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { activateSkill } from "../lib/activate.js";
import { exportBundle, importBundle } from "../lib/export.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-export-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: review\n---\nbody", "utf8");
  return join(root, "adversarial-review");
}

test("exportBundle produces a JSON bundle with manifest + skill content", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const outPath = join(home, "backup.json");
  const r = await exportBundle(m, home, outPath);
  assert.equal(r.ok, true);
  assert.ok(existsSync(outPath));
  const bundle = JSON.parse(readFileSync(outPath, "utf8"));
  assert.ok(bundle.skills);
  assert.ok(bundle.skills["adversarial-review"]);
  assert.ok(bundle.skills["adversarial-review"].content.includes("adversarial-review"));
});

test("importBundle merges into existing manifest", async () => {
  const home1 = freshHome();
  const home2 = freshHome();
  const src = fixture(join(home1, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home1 });
  let m1 = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home1, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const outPath = join(home1, "backup.json");
  await exportBundle(m1, home1, outPath);
  const existing = emptyManifest();
  const bundle = JSON.parse(readFileSync(outPath, "utf8"));
  const r = await importBundle(bundle, home2, existing);
  assert.equal(r.ok, true);
  assert.ok(r.imported.includes("adversarial-review"));
  assert.ok(r.manifest.skills["adversarial-review"]);
});

test("importBundle skips existing skills (merge semantics)", async () => {
  const home1 = freshHome();
  const home2 = freshHome();
  const src = fixture(join(home1, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home1 });
  let m1 = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home1, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const outPath = join(home1, "backup.json");
  await exportBundle(m1, home1, outPath);
  // home2 already has adversarial-review
  let existing = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: "/other", version: null, commit: null, activationMode: "copy", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const bundle2 = JSON.parse(readFileSync(outPath, "utf8"));
  const r = await importBundle(bundle2, home2, existing);
  assert.equal(r.ok, true);
  assert.equal(r.imported.length, 0);
  assert.equal(r.manifest.skills["adversarial-review"].sourceRef, "/other");
});

test("importBundle on invalid bundle returns error", async () => {
  const home = freshHome();
  const r = await importBundle({ version: 999 }, home, emptyManifest());
  assert.equal(r.ok, false);
});
