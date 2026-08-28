import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-routes-src-")); }
function fixtureBundle(root) {
  mkdirSync(join(root, "my-skill"), { recursive: true });
  writeFileSync(join(root, "my-skill", "SKILL.md"), "---\nname: my-skill\ndescription: test\n---\nbody", "utf8");
  return root;
}
function mockReq(method, urlPath, { body, headers } = {}) {
  return {
    method, url: urlPath,
    headers: { host: "127.0.0.1:3080", ...headers },
    [Symbol.asyncIterator]: body ? async function*() { yield Buffer.from(JSON.stringify(body)); } : async function*() {},
  };
}
function mockRes() {
  const result = { status: null, body: null, headers: {} };
  return { result, writeHead(s, h) { result.status = s; result.headers = h; }, end(d) { result.body = d; } };
}

test("GET /api/skill-fusion/discover?source=claude returns candidates", async () => {
  const home = freshHome();
  const claudeDir = fixtureBundle(join(home, ".claude", "skills"));
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/discover");
  const res = mockRes();
  await r.handler(mockReq("GET", `/api/skill-fusion/discover?source=claude&path=${encodeURIComponent(claudeDir)}`), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.candidates.some(c => c.name === "my-skill" && c.sourceKind === "claude"));
});

test("GET /api/skill-fusion/discover?source=codex returns candidates", async () => {
  const home = freshHome();
  const codexDir = fixtureBundle(join(home, ".codex", "skills"));
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/discover");
  const res = mockRes();
  await r.handler(mockReq("GET", `/api/skill-fusion/discover?source=codex&path=${encodeURIComponent(codexDir)}`), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.candidates.some(c => c.name === "my-skill" && c.sourceKind === "codex"));
});

test("GET /api/skill-fusion/audit?source=claude returns verdict", async () => {
  const home = freshHome();
  const claudeDir = fixtureBundle(join(home, ".claude", "skills"));
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/audit");
  const res = mockRes();
  await r.handler(mockReq("GET", `/api/skill-fusion/audit?source=claude&path=${encodeURIComponent(claudeDir)}&name=my-skill`), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.verdict, "pass");
});

test("POST /api/skill-fusion/activate with sourceKind=claude activates", async () => {
  const home = freshHome();
  const claudeDir = fixtureBundle(join(home, ".claude", "skills"));
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/activate");
  const res = mockRes();
  await r.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "claude", sourceRef: claudeDir, name: "my-skill" } }), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.activated, "my-skill");
  assert.equal(payload.mode, "symlink");
});

test("GET /api/skill-fusion/discover?source=market returns ranked results", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const origFetch = globalThis.fetch;
  // Stub both search endpoints used by searchMarket
  globalThis.fetch = async (url) => {
    if (url.includes("search/repositories")) {
      return { ok: true, json: async () => ({ items: [
        { full_name: "obra/superpowers", stargazers_count: 278181, description: "skills framework", html_url: "u1", default_branch: "main" },
      ] }) };
    }
    if (url.includes("/-/v1/search")) {
      return { ok: true, json: async () => ({ objects: [
        { package: { name: "claude-skill", version: "1.0.0", description: "pkg", links: { npm: "n1" } }, score: { detail: { popularity: 0.9 } } },
      ] }) };
    }
    throw new Error(`unexpected: ${url}`);
  };
  try {
    const r = routes.find(x => x.path === "/api/skill-fusion/discover");
    const res = mockRes();
    await r.handler(mockReq("GET", "/api/skill-fusion/discover?source=market&q=claude%20skill"), res);
    const payload = JSON.parse(res.result.body);
    assert.equal(payload.ok, true);
    assert.ok(Array.isArray(payload.candidates));
    assert.equal(payload.candidates.length, 2);
    assert.equal(payload.candidates[0].name, "obra/superpowers");
    assert.equal(payload.candidates[0].rankKind, "stars");
    const npm = payload.candidates.find(c => c.sourceMarket === "npm");
    assert.ok(npm);
    assert.equal(npm.rankKind, "popularity");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("GET /api/skill-fusion/discover?source=market with empty/missing q returns featured homepage", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const repoMeta = url.match(/api\.github\.com\/repos\/([^/]+\/[^/]+)$/);
    if (repoMeta) {
      return { ok: true, json: async () => ({ full_name: repoMeta[1], stargazers_count: 99999, description: "d", html_url: "u", default_branch: "main" }) };
    }
    if (url.includes("search/repositories")) {
      return { ok: true, json: async () => ({ items: [
        { full_name: "trending/one", stargazers_count: 5000, description: "t", html_url: "u", default_branch: "main" },
      ] }) };
    }
    if (url.includes("/-/v1/search")) return { ok: true, json: async () => ({ objects: [] }) };
    return { ok: false, status: 404 };
  };
  try {
    const r = routes.find(x => x.path === "/api/skill-fusion/discover");
    // Both q= (empty) and missing q must trigger searchMarket → featured homepage
    for (const url of ["/api/skill-fusion/discover?source=market&q=", "/api/skill-fusion/discover?source=market"]) {
      const res = mockRes();
      await r.handler(mockReq("GET", url), res);
      const payload = JSON.parse(res.result.body);
      assert.equal(payload.ok, true);
      assert.ok(payload.candidates.length > 0, `featured homepage should return results for ${url}`);
      assert.ok(payload.candidates[0].rank > 0, "featured results should be ranked");
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});
