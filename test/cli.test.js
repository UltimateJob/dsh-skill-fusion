import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../lib/cli.js";
import { readManifest, findSkill } from "../lib/manifest.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-cli-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: ship/no-ship review\n---\nDo the review.", "utf8");
  return root;
}

test("runCli discover prints candidate names", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const lines = [];
  const code = runCli(["discover", "--local", src], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("adversarial-review"));
});

test("runCli activate symlinks and writes manifest", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const code = runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const target = join(home, "skills", "adversarial-review");
  assert.equal(lstatSync(target).isSymbolicLink(), true);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.sourceKind, "local");
  assert.equal(entry.activationMode, "symlink");
});

test("runCli list shows activated skill", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const lines = [];
  runCli(["list"], { out: s => lines.push(s), dshHome: home });
  assert.ok(lines.join("\n").includes("adversarial-review"));
});

test("runCli uninstall removes activation + manifest entry", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const code = runCli(["uninstall", "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  assert.equal(existsSync(join(home, "skills", "adversarial-review")), false);
  assert.equal(findSkill(readManifest(home), "adversarial-review"), null);
});

test("runCli unknown command returns code 2", () => {
  assert.equal(runCli(["nope"], { out: () => {}, dshHome: freshHome() }), 2);
});
