import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../lib/cli.js";
import { readManifest, findSkill } from "../lib/manifest.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-cli-src-")); }
function fixtureBundle(root) {
  mkdirSync(join(root, "my-skill"), { recursive: true });
  writeFileSync(join(root, "my-skill", "SKILL.md"), "---\nname: my-skill\ndescription: test skill\n---\nDo the thing.", "utf8");
  return root;
}

test("cli discover --claude finds skill", async () => {
  const home = freshHome();
  const claudeDir = fixtureBundle(join(home, ".claude", "skills"));
  const lines = [];
  const code = await runCli(["discover", "--claude", claudeDir], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("my-skill"));
  assert.ok(lines.join("\n").includes("claude"));
});

test("cli discover --codex finds skill", async () => {
  const home = freshHome();
  const codexDir = fixtureBundle(join(home, ".codex", "skills"));
  const lines = [];
  const code = await runCli(["discover", "--codex", codexDir], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("my-skill"));
  assert.ok(lines.join("\n").includes("codex"));
});

test("cli activate --claude activates and writes manifest", async () => {
  const home = freshHome();
  const claudeDir = fixtureBundle(join(home, ".claude", "skills"));
  const code = await runCli(["activate", "--claude", claudeDir, "--name", "my-skill"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const target = join(home, "skills", "my-skill");
  assert.equal(existsSync(join(target, "SKILL.md")), true);
  assert.equal(lstatSync(target).isSymbolicLink(), true);
  const entry = findSkill(readManifest(home), "my-skill");
  assert.equal(entry.sourceKind, "claude");
  assert.equal(entry.activationMode, "symlink");
});

test("cli activate --codex activates and writes manifest", async () => {
  const home = freshHome();
  const codexDir = fixtureBundle(join(home, ".codex", "skills"));
  const code = await runCli(["activate", "--codex", codexDir, "--name", "my-skill"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const entry = findSkill(readManifest(home), "my-skill");
  assert.equal(entry.sourceKind, "codex");
});

test("cli activate without source flag shows usage", async () => {
  const home = freshHome();
  const code = await runCli(["activate", "--name", "test"], { out: () => {}, dshHome: home });
  assert.equal(code, 2);
});
