import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../lib/cli.js";
import { readManifest, findSkill } from "../lib/manifest.js";
import { buildZip, ZIP_SKILL_MD } from "./helpers/zip-fixture.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-cli-za-")); }

function agentsFixture(home) {
  const dir = join(home, ".agents", "skills");
  mkdirSync(join(dir, "shared-skill"), { recursive: true });
  writeFileSync(join(dir, "shared-skill", "SKILL.md"), "---\nname: shared-skill\ndescription: cross-agent skill\n---\nDo shared things.", "utf8");
  return dir;
}

function zipFixture(home) {
  const zipPath = join(home, "skills.zip");
  writeFileSync(zipPath, buildZip([{ name: "bundle/zip-skill/SKILL.md", data: ZIP_SKILL_MD, method: 8 }]));
  return zipPath;
}

test("cli discover --agents lists candidates with a promote hint", async () => {
  const home = freshHome();
  const dir = agentsFixture(home);
  const lines = [];
  const code = await runCli(["discover", "--agents", dir], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  const text = lines.join("\n");
  assert.ok(text.includes("shared-skill"), text);
  assert.ok(text.includes("agents"), text);
  assert.ok(text.includes("promote"), "should hint at the promote path");
});

test("cli activate --agents promotes into ~/.dsh/skills with manifest entry", async () => {
  const home = freshHome();
  const dir = agentsFixture(home);
  const code = await runCli(["activate", "--agents", dir, "--name", "shared-skill"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  assert.equal(existsSync(join(home, "skills", "shared-skill", "SKILL.md")), true);
  const entry = findSkill(readManifest(home), "shared-skill");
  assert.equal(entry.sourceKind, "agents");
});

test("cli audit --agents audits a shared-root skill", async () => {
  const home = freshHome();
  const dir = agentsFixture(home);
  const lines = [];
  const code = await runCli(["audit", "--agents", dir, "--name", "shared-skill"], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").startsWith("pass"), lines.join("\n"));
});

test("cli discover --zip lists skills inside the archive", async () => {
  const home = freshHome();
  const zipPath = zipFixture(home);
  const lines = [];
  const code = await runCli(["discover", "--zip", zipPath], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  const text = lines.join("\n");
  assert.ok(text.includes("zip-skill"), text);
  assert.ok(text.includes("zip"), text);
});

test("cli activate --zip activates with copy mode (temp extraction is never linked)", async () => {
  const home = freshHome();
  const zipPath = zipFixture(home);
  const code = await runCli(["activate", "--zip", zipPath, "--name", "zip-skill"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const target = join(home, "skills", "zip-skill");
  assert.equal(existsSync(join(target, "SKILL.md")), true);
  assert.equal(lstatSync(target).isSymbolicLink(), false);
  const entry = findSkill(readManifest(home), "zip-skill");
  assert.equal(entry.sourceKind, "zip");
  assert.equal(entry.activationMode, "copy");
});
