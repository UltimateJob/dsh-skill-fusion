import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";
import { readManifest, findSkill } from "../lib/manifest.js";

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

test("POST /api/skill-fusion/freeze marks skill frozen", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  assert.equal(JSON.parse(actRes.result.body).ok, true);
  const frRoute = routes.find(r => r.path === "/api/skill-fusion/freeze");
  const frRes = mockRes();
  await frRoute.handler(mockReq("POST", "/api/skill-fusion/freeze", { body: { name: "adversarial-review", version: "1.0.0" } }), frRes);
  const payload = JSON.parse(frRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.frozen, "adversarial-review");
});

test("POST /api/skill-fusion/unfreeze restores active", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const frRoute = routes.find(r => r.path === "/api/skill-fusion/freeze");
  const frRes = mockRes();
  await frRoute.handler(mockReq("POST", "/api/skill-fusion/freeze", { body: { name: "adversarial-review", version: "1.0.0" } }), frRes);
  const ufRoute = routes.find(r => r.path === "/api/skill-fusion/unfreeze");
  const ufRes = mockRes();
  await ufRoute.handler(mockReq("POST", "/api/skill-fusion/unfreeze", { body: { name: "adversarial-review" } }), ufRes);
  const payload = JSON.parse(ufRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.unfrozen, "adversarial-review");
});

test("POST /api/skill-fusion/update refreshes changed skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  assert.equal(JSON.parse(actRes.result.body).ok, true);
  // change source content
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const upRoute = routes.find(r => r.path === "/api/skill-fusion/update");
  const upRes = mockRes();
  await upRoute.handler(mockReq("POST", "/api/skill-fusion/update", { body: { name: "adversarial-review" } }), upRes);
  const payload = JSON.parse(upRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.updated, true);
});

test("POST /api/skill-fusion/rollback without snapshot fails", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const rbRoute = routes.find(r => r.path === "/api/skill-fusion/rollback");
  const rbRes = mockRes();
  await rbRoute.handler(mockReq("POST", "/api/skill-fusion/rollback", { body: { name: "adversarial-review" } }), rbRes);
  const payload = JSON.parse(rbRes.result.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "no-snapshot");
});

test("GET /api/skill-fusion/export returns JSON bundle", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const expRoute = routes.find(r => r.path === "/api/skill-fusion/export");
  const expRes = mockRes();
  await expRoute.handler(mockReq("GET", "/api/skill-fusion/export"), expRes);
  const payload = JSON.parse(expRes.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.bundle.skills["adversarial-review"]);
  assert.ok(payload.bundle.skills["adversarial-review"].content.includes("adversarial-review"));
});

test("POST /api/skill-fusion/import merges bundle", async () => {
  const home1 = freshHome();
  const home2 = freshHome();
  const src = fixture(join(home1, "src"));
  const routes1 = skillFusionRoutes(home1);
  const actRoute = routes1.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  // export from home1
  const expRoute = routes1.find(r => r.path === "/api/skill-fusion/export");
  const expRes = mockRes();
  await expRoute.handler(mockReq("GET", "/api/skill-fusion/export"), expRes);
  const bundle = JSON.parse(expRes.result.body).bundle;
  // import into home2
  const routes2 = skillFusionRoutes(home2);
  const impRoute = routes2.find(r => r.path === "/api/skill-fusion/import");
  const impRes = mockRes();
  await impRoute.handler(mockReq("POST", "/api/skill-fusion/import", { body: { bundle } }), impRes);
  const payload = JSON.parse(impRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.imported, 1);
});
