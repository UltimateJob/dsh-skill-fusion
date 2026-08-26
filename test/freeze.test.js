import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { freezeSkill, unfreezeSkill, isFrozen } from "../lib/freeze.js";

function mkSkill() {
  return { sourceKind: "local", sourceRef: "/x", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" };
}

test("freezeSkill sets frozenVersion and status", () => {
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill());
  m = freezeSkill(m, "a-b", "1.0.0");
  const e = m.skills["a-b"];
  assert.equal(e.frozenVersion, "1.0.0");
  assert.equal(e.status, "frozen");
  assert.equal(isFrozen(m, "a-b"), true);
});

test("unfreezeSkill clears frozenVersion and restores active", () => {
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill());
  m = freezeSkill(m, "a-b", "1.0.0");
  m = unfreezeSkill(m, "a-b");
  const e = m.skills["a-b"];
  assert.equal(e.frozenVersion, null);
  assert.equal(e.status, "active");
  assert.equal(isFrozen(m, "a-b"), false);
});

test("freezeSkill on nonexistent skill returns manifest unchanged", () => {
  const m = emptyManifest();
  const m2 = freezeSkill(m, "nope", "1.0.0");
  assert.deepEqual(m2, m);
});
