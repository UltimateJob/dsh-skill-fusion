import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverNpm } from "../lib/sources/npm.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-npm-tar-")); }

/** Build a real npm-style .tgz: package/skills/<name>/SKILL.md */
function makeNpmTarball(root, skills = { "my-skill": "an npm skill" }) {
  for (const [name, desc] of Object.entries(skills)) {
    mkdirSync(join(root, "package", "skills", name), { recursive: true });
    writeFileSync(join(root, "package", "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`, "utf8");
  }
  writeFileSync(join(root, "package", "package.json"), JSON.stringify({ name: "test-pkg", version: "1.0.0" }), "utf8");
  const tgz = join(root, "pkg.tgz");
  execFileSync("tar", ["czf", tgz, "-C", root, "package"]);
  return readFileSync(tgz);
}

const registryMeta = (name = "test-pkg") => ({
  name, version: "1.0.0", description: "d",
  dist: { tarball: "https://registry.npmjs.org/test-pkg/-/test-pkg-1.0.0.tgz" },
});

test("discoverNpm with cacheDir: tarball walk finds skills", async () => {
  const home = freshHome();
  const buf = makeNpmTarball(home, { "my-skill": "an npm skill", "other-skill": "second" });
  const fetchFn = async (url) => {
    if (url.includes("/latest")) return { ok: true, json: async () => registryMeta() };
    if (url.endsWith(".tgz")) return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    return { ok: false };
  };
  const cands = await discoverNpm("test-pkg", { cacheDir: join(home, "cache"), fetchFn });
  assert.ok(Array.isArray(cands), "returns an array of candidates");
  assert.equal(cands.length, 2);
  const names = cands.map(c => c.name).sort();
  assert.deepEqual(names, ["my-skill", "other-skill"]);
  assert.equal(cands[0].sourceKind, "npm");
  assert.ok(cands[0].skillDir.startsWith("skills/"));
});

test("discoverNpm with cacheDir: second call reuses extraction", async () => {
  const home = freshHome();
  const buf = makeNpmTarball(home);
  const cacheDir = join(home, "cache");
  const fetchFn = async (url) => {
    if (url.includes("/latest")) return { ok: true, json: async () => registryMeta() };
    if (url.endsWith(".tgz")) return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    return { ok: false };
  };
  const r1 = await discoverNpm("test-pkg", { cacheDir, fetchFn });
  assert.equal(r1.length, 1);
  const r2 = await discoverNpm("test-pkg", { cacheDir, fetchFn: async () => { throw new Error("network should not be hit"); } });
  assert.equal(r2.length, 1);
});

test("discoverNpm without cacheDir: metadata fallback (legacy single object)", async () => {
  const fetchFn = async (url) => {
    if (url.includes("/latest")) return { ok: true, json: async () => ({ name: "some-skill-pkg", version: "2.0.0", description: "a skill package", dist: { tarball: "u" } }) };
    return { ok: false };
  };
  const r = await discoverNpm("some-skill-pkg", { fetchFn });
  assert.equal(r.name, "some-skill-pkg");
  assert.equal(r.tarballUrl, "u");
});

test("discoverNpm: registry error returns null", async () => {
  const r = await discoverNpm("nope", { fetchFn: async () => ({ ok: false, status: 404 }) });
  assert.equal(r, null);
});
