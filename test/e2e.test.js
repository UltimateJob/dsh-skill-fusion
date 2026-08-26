import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../lib/cli.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-e2e-")); }
function fixtureSource(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  mkdirSync(join(root, "adversarial-review", "references"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"),
    "---\nname: adversarial-review\ndescription: Skeptical ship/no-ship code review.\n---\n# Adversarial Review\nDo the review.", "utf8");
  writeFileSync(join(root, "adversarial-review", "references", "schema.json"), "{}", "utf8");
  return root;
}

test("e2e: discover -> audit -> activate lands in ~/.dsh/skills and is discoverable", () => {
  const home = freshHome();
  const src = fixtureSource(join(home, "src"));
  const out = [];
  const log = s => out.push(s);

  assert.equal(runCli(["discover", "--local", src], { out: log, dshHome: home }), 0);
  assert.ok(out.join("\n").includes("adversarial-review"));

  out.length = 0;
  assert.equal(runCli(["audit", "--local", src, "--name", "adversarial-review"], { out: log, dshHome: home }), 0);
  assert.ok(out.join("\n").startsWith("pass"));

  out.length = 0;
  assert.equal(runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: log, dshHome: home }), 0);
  const target = join(home, "skills", "adversarial-review");
  assert.equal(existsSync(join(target, "SKILL.md")), true, "SKILL.md must exist at native root");
  assert.equal(existsSync(join(target, "references", "schema.json")), true, "references must follow the link");

  out.length = 0;
  runCli(["list"], { out: log, dshHome: home });
  assert.ok(out.join("\n").includes("adversarial-review\tlocal\tsymlink\tactive"));

  assert.equal(lstatSync(target).isSymbolicLink(), true);
});

test("e2e: blocked skill (name conflict) does not activate", () => {
  const home = freshHome();
  const src = fixtureSource(join(home, "src"));
  mkdirSync(join(home, "skills", "adversarial-review"), { recursive: true });
  writeFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: pre-existing\n---\n", "utf8");
  const out = [];
  assert.equal(runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: s => out.push(s), dshHome: home }), 1);
  assert.ok(out.join("\n").includes("activate failed: target-exists"));
});
