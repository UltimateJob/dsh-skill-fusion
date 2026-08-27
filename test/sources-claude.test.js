import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverClaude } from "../lib/sources/claude.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-claude-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: review\n---\nbody", "utf8");
  return root;
}

test("discoverClaude: finds skills in ~/.claude/skills", () => {
  const claudeHome = fixture(join(freshHome(), ".claude", "skills"));
  const cands = discoverClaude(claudeHome);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].name, "adversarial-review");
  assert.equal(cands[0].sourceKind, "claude");
  assert.equal(cands[0].sourceRef, claudeHome);
  assert.equal(cands[0].kind, "bundle");
});

test("discoverClaude: returns empty for non-existent dir", () => {
  const cands = discoverClaude("/nonexistent/path");
  assert.equal(cands.length, 0);
});

test("discoverClaude: default path uses ~/.claude/skills", () => {
  // Just verify it doesn't throw
  const cands = discoverClaude();
  assert.ok(Array.isArray(cands));
});
