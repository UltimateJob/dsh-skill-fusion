import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-routes-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: review\n---\nbody", "utf8");
  return root;
}

function mockReq(method, urlPath, { body, headers } = {}) {
  return {
    method,
    url: urlPath,
    headers: { host: "127.0.0.1:3080", ...headers },
    [Symbol.asyncIterator]: body ? async function*() { yield Buffer.from(JSON.stringify(body)); } : async function*() {},
  };
}

function mockRes() {
  const result = { status: null, body: null, headers: {} };
  return {
    result,
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(data) { result.body = data; },
  };
}

test("GET /api/skill-fusion/list returns empty manifest skills", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/list");
  assert.ok(route);
  const res = mockRes();
  await route.handler(mockReq("GET", "/api/skill-fusion/list"), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.skills, []);
});

test("GET /api/skill-fusion/discover?source=local returns candidates", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/discover");
  const res = mockRes();
  await route.handler(mockReq("GET", `/api/skill-fusion/discover?source=local&path=${src}`), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.candidates.some(c => c.name === "adversarial-review"));
});

test("GET /api/skill-fusion/audit returns verdict for local candidate", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/audit");
  const res = mockRes();
  await route.handler(mockReq("GET", `/api/skill-fusion/audit?source=local&path=${src}&name=adversarial-review`), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.verdict, "pass");
});

test("POST /api/skill-fusion/activate activates a local skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/activate");
  const res = mockRes();
  await route.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.activated, "adversarial-review");
  assert.equal(payload.mode, "symlink");
});

test("POST /api/skill-fusion/activate rejects cross-site", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/activate");
  const res = mockRes();
  await route.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" }, headers: { "sec-fetch-site": "cross-site" } }), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, false);
});

test("POST /api/skill-fusion/uninstall removes a skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  // activate first
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  assert.equal(JSON.parse(actRes.result.body).ok, true);
  // then uninstall
  const unRoute = routes.find(r => r.path === "/api/skill-fusion/uninstall");
  const unRes = mockRes();
  await unRoute.handler(mockReq("POST", "/api/skill-fusion/uninstall", { body: { name: "adversarial-review" } }), unRes);
  const payload = JSON.parse(unRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.uninstalled, "adversarial-review");
});
