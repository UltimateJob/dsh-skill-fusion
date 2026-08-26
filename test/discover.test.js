import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverLocal } from "../lib/sources/local.js";
import { discover } from "../lib/discover.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-disc-")); }

test("discoverLocal: finds directory bundle + flat md", () => {
  const root = freshHome();
  mkdirSync(join(root, "bundle"), { recursive: true });
  writeFileSync(join(root, "bundle", "SKILL.md"), "---\nname: bundle\ndescription: a bundle\n---\nbody", "utf8");
  writeFileSync(join(root, "flat.md"), "---\nname: flat\ndescription: a flat skill\n---\nbody", "utf8");
  writeFileSync(join(root, "notaskill.txt"), "ignore me", "utf8");
  const c = discoverLocal(root);
  assert.equal(c.length, 2);
  assert.ok(c.find(x => x.name === "bundle"));
  assert.ok(c.find(x => x.name === "flat"));
});

test("discoverLocal: skips .system and malformed", () => {
  const root = freshHome();
  mkdirSync(join(root, ".system"), { recursive: true });
  writeFileSync(join(root, ".system", "SKILL.md"), "---\nname: sys\ndescription: x\n---\n", "utf8");
  mkdirSync(join(root, "bad"), { recursive: true });
  writeFileSync(join(root, "bad", "SKILL.md"), "no frontmatter here", "utf8");
  assert.equal(discoverLocal(root).length, 0);
});

test("discover: aggregates local and filters by q", () => {
  const root = freshHome();
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: ship/no-ship review\n---\nbody", "utf8");
  const all = discover({ local: root });
  assert.equal(all.length, 1);
  const filt = discover({ local: root, q: "ship" });
  assert.equal(filt.length, 1);
  const none = discover({ local: root, q: "zzz" });
  assert.equal(none.length, 0);
});
