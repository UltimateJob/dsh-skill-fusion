import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCache, writeCache, cachedSearchMarket, cachedDiscoverGithub } from "../lib/cache.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-cache-")); }

test("readCache: miss returns null", () => {
  const home = freshHome();
  assert.equal(readCache(home, "nonexistent.json"), null);
});

test("writeCache + readCache: round-trips data", () => {
  const home = freshHome();
  writeCache(home, "k.json", [{ name: "a" }]);
  assert.deepEqual(readCache(home, "k.json"), [{ name: "a" }]);
});

test("readCache: expired entry returns null", () => {
  const home = freshHome();
  writeCache(home, "old.json", [1]);
  // Backdate the file beyond TTL
  const p = join(home, "skill-fusion", "cache", "search", "old.json");
  const past = new Date(Date.now() - 48 * 3600 * 1000);
  utimesSync(p, past, past);
  assert.equal(readCache(home, "old.json", 24 * 3600 * 1000), null);
});

test("cachedSearchMarket: first call hits network, second uses cache", async () => {
  const home = freshHome();
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    if (url.includes("search/repositories")) {
      return { ok: true, json: async () => ({ items: [{ full_name: "x/repo", stargazers_count: 5, description: "d", html_url: "u", default_branch: "main" }] }) };
    }
    if (url.includes("/-/v1/search")) return { ok: true, json: async () => ({ objects: [] }) };
    const repoMeta = url.match(/api\.github\.com\/repos\/([^/]+\/[^/]+)$/);
    if (repoMeta) return { ok: true, json: async () => ({ full_name: repoMeta[1], stargazers_count: 5, description: "d", html_url: "u", default_branch: "main" }) };
    return { ok: false };
  };
  const r1 = await cachedSearchMarket("claude", { page: 1, dshHome: home, fetchFn });
  assert.equal(r1.cached, false);
  assert.ok(calls > 0);
  const callsAfterFirst = calls;
  const r2 = await cachedSearchMarket("claude", { page: 1, dshHome: home, fetchFn });
  assert.equal(r2.cached, true);
  assert.equal(calls, callsAfterFirst, "second call must not hit network");
  assert.deepEqual(r2.candidates, r1.candidates);
});

test("cachedSearchMarket: different pages cached separately", async () => {
  const home = freshHome();
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    if (url.includes("search/repositories")) {
      const page = url.match(/[?&]page=(\d+)/)[1];
      return { ok: true, json: async () => ({ items: [{ full_name: `x/p${page}`, stargazers_count: 5, description: "d", html_url: "u", default_branch: "main" }] }) };
    }
    if (url.includes("/-/v1/search")) return { ok: true, json: async () => ({ objects: [] }) };
    return { ok: false };
  };
  const p1 = await cachedSearchMarket("claude", { page: 1, dshHome: home, fetchFn });
  const p2 = await cachedSearchMarket("claude", { page: 2, dshHome: home, fetchFn });
  assert.equal(p1.candidates[0].name, "x/p1");
  assert.equal(p2.candidates[0].name, "x/p2");
});

test("cachedDiscoverGithub: caches repo inspection results", async () => {
  const home = freshHome();
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    if (url.includes("git/trees")) {
      return { ok: true, json: async () => ({ sha: "abc", tree: [{ type: "blob", path: "skills/foo/SKILL.md" }] }) };
    }
    if (url.includes("raw.githubusercontent.com")) {
      return { ok: true, text: async () => "---\nname: foo\ndescription: cached skill\n---\nbody" };
    }
    return { ok: false };
  };
  const r1 = await cachedDiscoverGithub("o/r", { dshHome: home, fetchFn });
  assert.equal(r1.cached, false);
  assert.equal(r1.candidates[0].name, "foo");
  const callsAfterFirst = calls;
  const r2 = await cachedDiscoverGithub("o/r", { dshHome: home, fetchFn });
  assert.equal(r2.cached, true);
  assert.equal(calls, callsAfterFirst);
  // parsed field is stripped before caching (internal), so cached name still there
  assert.equal(r2.candidates[0].name, "foo");
});
