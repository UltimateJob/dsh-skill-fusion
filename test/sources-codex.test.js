import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverCodex } from "../lib/sources/codex.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-codex-")); }
function fixture(root) {
  mkdirSync(join(root, "brainstorming"), { recursive: true });
  writeFileSync(join(root, "brainstorming", "SKILL.md"), "---\nname: brainstorming\ndescription: creative work\n---\nbody", "utf8");
  return root;
}

test("discoverCodex: finds skills in ~/.codex/skills", () => {
  const codexHome = fixture(join(freshHome(), ".codex", "skills"));
  const cands = discoverCodex(codexHome);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].name, "brainstorming");
  assert.equal(cands[0].sourceKind, "codex");
  assert.equal(cands[0].sourceRef, codexHome);
  assert.equal(cands[0].kind, "bundle");
});

test("discoverCodex: returns empty for non-existent dir", () => {
  const cands = discoverCodex("/nonexistent/path");
  assert.equal(cands.length, 0);
});

test("discoverCodex: default path uses ~/.codex/skills", () => {
  const cands = discoverCodex();
  assert.ok(Array.isArray(cands));
});
