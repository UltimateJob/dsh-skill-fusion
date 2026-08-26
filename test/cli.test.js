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

test("runCli discover prints candidate names", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const lines = [];
  const code = await runCli(["discover", "--local", src], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("adversarial-review"));
});

test("runCli activate symlinks and writes manifest", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const code = await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const target = join(home, "skills", "adversarial-review");
  assert.equal(lstatSync(target).isSymbolicLink(), true);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.sourceKind, "local");
  assert.equal(entry.activationMode, "symlink");
});

test("runCli list shows activated skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const lines = [];
  await runCli(["list"], { out: s => lines.push(s), dshHome: home });
  assert.ok(lines.join("\n").includes("adversarial-review"));
});

test("runCli uninstall removes activation + manifest entry", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const code = await runCli(["uninstall", "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  assert.equal(existsSync(join(home, "skills", "adversarial-review")), false);
  assert.equal(findSkill(readManifest(home), "adversarial-review"), null);
});

test("runCli unknown command returns code 2", async () => {
  assert.equal(await runCli(["nope"], { out: () => {}, dshHome: freshHome() }), 2);
});

test("runCli freeze marks skill frozen", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const code = await runCli(["freeze", "--name", "adversarial-review", "--version", "1.0.0"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.status, "frozen");
  assert.equal(entry.frozenVersion, "1.0.0");
});

test("runCli unfreeze restores active", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  await runCli(["freeze", "--name", "adversarial-review", "--version", "1.0.0"], { out: () => {}, dshHome: home });
  const code = await runCli(["unfreeze", "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.status, "active");
  assert.equal(entry.frozenVersion, null);
});

test("runCli update refreshes changed local skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  // change the source
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const lines = [];
  const code = await runCli(["update", "--name", "adversarial-review"], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("updated"));
});

test("runCli update on unchanged skill says no update", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const lines = [];
  const code = await runCli(["update", "--name", "adversarial-review"], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("no update"));
});

test("runCli rollback without snapshot fails", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const lines = [];
  const code = await runCli(["rollback", "--name", "adversarial-review"], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 1);
  assert.ok(lines.join("\n").includes("rollback failed"));
});

test("runCli export produces a bundle", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const outPath = join(home, "backup.json");
  const code = await runCli(["export", "--out", outPath], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  assert.ok(existsSync(outPath));
});

test("runCli import merges bundle", async () => {
  const home1 = freshHome();
  const home2 = freshHome();
  const src = fixture(join(home1, "src"));
  await runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home1 });
  const outPath = join(home1, "backup.json");
  await runCli(["export", "--out", outPath], { out: () => {}, dshHome: home1 });
  const lines = [];
  const code = await runCli(["import", "--from", outPath], { out: s => lines.push(s), dshHome: home2 });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("imported 1"));
});
