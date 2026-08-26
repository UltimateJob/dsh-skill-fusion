import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { freezeSkill } from "../lib/freeze.js";
import { checkForUpdates, updateSkill } from "../lib/update.js";
import { activateSkill } from "../lib/activate.js";
import { parseSkillFrontmatter, skillHash } from "../lib/frontmatter.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-update-")); }
function mkSkill(name, overrides = {}) {
  return { sourceKind: "local", sourceRef: "/x", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: { verdict: "pass", hash: "sha256:abc", at: "t", flags: [] }, status: "active", ...overrides };
}

test("checkForUpdates: skips frozen skills", async () => {
  const m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  const frozen = freezeSkill(m, "a-b", "1.0.0");
  const updates = await checkForUpdates(frozen, freshHome());
  assert.equal(updates.length, 0);
});

test("checkForUpdates: local source with changed content reports update", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src") }));
  // change the content
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const updates = await checkForUpdates(m, home);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].hasUpdate, true);
});

test("checkForUpdates: local source unchanged reports no update", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  const raw = readFileSync(join(src, "SKILL.md"), "utf8");
  const parsed = parseSkillFrontmatter(raw);
  const hash = skillHash(parsed);
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src"), lastAudit: { verdict: "pass", hash, at: "t", flags: [] } }));
  const updates = await checkForUpdates(m, home);
  assert.equal(updates.length, 0);
});

test("updateSkill: re-audits and updates local skill", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src") }));
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2 updated\n---\nbody", "utf8");
  const { manifest: m2, updated, error } = await updateSkill(m, "adversarial-review", home);
  assert.equal(error, undefined);
  assert.equal(updated, true);
  const actRaw = readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8");
  assert.ok(actRaw.includes("v2 updated"));
});

test("updateSkill: skips frozen skill", async () => {
  const home = freshHome();
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  m = freezeSkill(m, "a-b", "1.0.0");
  const { updated } = await updateSkill(m, "a-b", home);
  assert.equal(updated, false);
});
