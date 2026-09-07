import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAgents } from "../lib/sources/agents.js";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "sf-agents-test-"));
  const skills = join(dir, "skills");
  mkdirSync(join(skills, "shared-skill"), { recursive: true });
  writeFileSync(join(skills, "shared-skill", "SKILL.md"), `---
name: shared-skill
description: A cross-agent shared skill.
---
# Body`);
  return skills;
}

test("discoverAgents: candidates carry sourceKind agents and promote suggestion", () => {
  const cands = discoverAgents(fixture());
  assert.equal(cands.length, 1);
  const c = cands[0];
  assert.equal(c.name, "shared-skill");
  assert.equal(c.sourceKind, "agents");
  assert.equal(c.alreadyActive, true);
  assert.equal(c.promote, "suggested");
});

test("discoverAgents: missing root returns empty, not an error", () => {
  assert.deepEqual(discoverAgents(join(tmpdir(), "no-such-agents-root")), []);
});
