import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverGithub, skillsFromExtractedRoot } from "../lib/sources/github.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-gh-tar-")); }

/** Build a real .tgz fixture: pkg/skills/<name>/SKILL.md */
function makeTarballFixture(root, skills = { foo: "tarball skill" }) {
  for (const [name, desc] of Object.entries(skills)) {
    mkdirSync(join(root, "pkg", "skills", name), { recursive: true });
    writeFileSync(join(root, "pkg", "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`, "utf8");
  }
  const tgz = join(root, "repo.tgz");
  execFileSync("tar", ["czf", tgz, "-C", root, "pkg"]);
  return readFileSync(tgz);
}

function tgzResponse(buf) {
  return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

test("skillsFromExtractedRoot: walks nested dirs and parses SKILL.md", () => {
  const home = freshHome();
  mkdirSync(join(home, "pkg", "skills", "a"), { recursive: true });
  writeFileSync(join(home, "pkg", "skills", "a", "SKILL.md"), "---\nname: a\ndescription: first\n---\nbody");
  mkdirSync(join(home, "pkg", "deep", "nested", "b"), { recursive: true });
  writeFileSync(join(home, "pkg", "deep", "nested", "b", "SKILL.md"), "---\nname: b\ndescription: second\n---\nbody");
  writeFileSync(join(home, "pkg", "README.md"), "not a skill");
  const cands = skillsFromExtractedRoot(join(home, "pkg"), { ownerRepo: "o/r", ref: "main", commit: "abc" });
  assert.equal(cands.length, 2);
  const byName = Object.fromEntries(cands.map(c => [c.name, c]));
  assert.equal(byName.a.skillDir, "skills/a");
  assert.equal(byName.b.skillDir, "deep/nested/b");
  assert.equal(byName.a.sourceKind, "github");
  assert.equal(byName.a.commit, "abc");
});

test("discoverGithub with cacheDir: tarball path discovers skills", async () => {
  const home = freshHome();
  const buf = makeTarballFixture(home, { foo: "tarball skill", bar: "second skill" });
  const fetchFn = async (url) => {
    assert.ok(url.includes("/tarball/"), `should fetch tarball: ${url}`);
    return tgzResponse(buf);
  };
  const cands = await discoverGithub("o/r", { ref: "main", cacheDir: join(home, "extract"), fetchFn });
  assert.equal(cands.length, 2);
  const names = cands.map(c => c.name).sort();
  assert.deepEqual(names, ["bar", "foo"]);
  assert.equal(cands[0].skillDir.startsWith("skills/"), true);
});

test("discoverGithub with cacheDir: second call reuses extraction (no re-download)", async () => {
  const home = freshHome();
  const buf = makeTarballFixture(home);
  const extractDir = join(home, "extract");
  const r1 = await discoverGithub("o/r", { ref: "main", cacheDir: extractDir, fetchFn: async () => tgzResponse(buf) });
  assert.equal(r1.length, 1);
  // Second call: fetch must NOT be used again
  const r2 = await discoverGithub("o/r", { ref: "main", cacheDir: extractDir, fetchFn: async () => { throw new Error("network should not be hit"); } });
  assert.equal(r2.length, 1);
  assert.equal(r2[0].name, "foo");
});

test("discoverGithub without cacheDir: contents API preferred over raw", async () => {
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    if (url.includes("git/trees")) {
      return { ok: true, json: async () => ({ sha: "abc", tree: [{ type: "blob", path: "skills/foo/SKILL.md" }] }) };
    }
    if (url.includes("/contents/")) {
      return { ok: true, text: async () => "---\nname: foo\ndescription: via contents api\n---\nbody" };
    }
    return { ok: false, status: 404 };
  };
  const cands = await discoverGithub("o/r", { ref: "main", fetchFn });
  assert.equal(cands.length, 1);
  assert.equal(cands[0].description, "via contents api");
  assert.ok(seen.some(u => u.includes("/contents/")), "contents API used");
  assert.ok(!seen.some(u => u.includes("raw.githubusercontent.com")), "raw not needed when contents works");
});

test("discoverGithub without cacheDir: falls back to raw when contents fails", async () => {
  const fetchFn = async (url) => {
    if (url.includes("git/trees")) {
      return { ok: true, json: async () => ({ sha: "abc", tree: [{ type: "blob", path: "skills/foo/SKILL.md" }] }) };
    }
    if (url.includes("/contents/")) return { ok: false, status: 403 };
    if (url.includes("raw.githubusercontent.com")) {
      return { ok: true, text: async () => "---\nname: foo\ndescription: via raw fallback\n---\nbody" };
    }
    return { ok: false, status: 404 };
  };
  const cands = await discoverGithub("o/r", { ref: "main", fetchFn });
  assert.equal(cands.length, 1);
  assert.equal(cands[0].description, "via raw fallback");
});
