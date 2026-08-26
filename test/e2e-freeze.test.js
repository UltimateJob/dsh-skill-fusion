import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";
import { readManifest, findSkill } from "../lib/manifest.js";
import { snapshotSkill } from "../lib/rollback.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-e2e-freeze-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
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

test("e2e freeze workflow: activate -> freeze -> unfreeze -> snapshot -> update -> rollback -> export", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);

  // 1. activate
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  assert.equal(JSON.parse(actRes.result.body).ok, true);

  // 2. freeze
  const frRoute = routes.find(r => r.path === "/api/skill-fusion/freeze");
  const frRes = mockRes();
  await frRoute.handler(mockReq("POST", "/api/skill-fusion/freeze", { body: { name: "adversarial-review", version: "1.0.0" } }), frRes);
  assert.equal(JSON.parse(frRes.result.body).ok, true);
  assert.equal(findSkill(readManifest(home), "adversarial-review").status, "frozen");

  // 3. unfreeze
  const ufRoute = routes.find(r => r.path === "/api/skill-fusion/unfreeze");
  const ufRes = mockRes();
  await ufRoute.handler(mockReq("POST", "/api/skill-fusion/unfreeze", { body: { name: "adversarial-review" } }), ufRes);
  assert.equal(JSON.parse(ufRes.result.body).ok, true);
  assert.equal(findSkill(readManifest(home), "adversarial-review").status, "active");

  // 4. snapshot v1 (before modifying source)
  const snapR = await snapshotSkill("adversarial-review", home);
  assert.equal(snapR.ok, true);

  // 5. modify source to v2 + update
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const upRoute = routes.find(r => r.path === "/api/skill-fusion/update");
  const upRes = mockRes();
  await upRoute.handler(mockReq("POST", "/api/skill-fusion/update", { body: { name: "adversarial-review" } }), upRes);
  assert.equal(JSON.parse(upRes.result.body).ok, true);
  assert.equal(JSON.parse(upRes.result.body).updated, true);
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v2"));

  // 6. rollback restores v1 from snapshot
  const rbRoute = routes.find(r => r.path === "/api/skill-fusion/rollback");
  const rbRes = mockRes();
  await rbRoute.handler(mockReq("POST", "/api/skill-fusion/rollback", { body: { name: "adversarial-review" } }), rbRes);
  assert.equal(JSON.parse(rbRes.result.body).ok, true);
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v1"));

  // 7. export
  const expRoute = routes.find(r => r.path === "/api/skill-fusion/export");
  const expRes = mockRes();
  await expRoute.handler(mockReq("GET", "/api/skill-fusion/export"), expRes);
  const bundle = JSON.parse(expRes.result.body).bundle;
  assert.ok(bundle.skills["adversarial-review"]);
});

test("e2e freeze: frozen skill skipped by update", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);

  // activate
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);

  // freeze
  const frRoute = routes.find(r => r.path === "/api/skill-fusion/freeze");
  const frRes = mockRes();
  await frRoute.handler(mockReq("POST", "/api/skill-fusion/freeze", { body: { name: "adversarial-review", version: "1.0.0" } }), frRes);

  // change source
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");

  // update should skip frozen skill
  const upRoute = routes.find(r => r.path === "/api/skill-fusion/update");
  const upRes = mockRes();
  await upRoute.handler(mockReq("POST", "/api/skill-fusion/update", { body: { name: "adversarial-review" } }), upRes);
  const payload = JSON.parse(upRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.updated, false);
  // skill should still be frozen
  assert.equal(findSkill(readManifest(home), "adversarial-review").status, "frozen");
});

test("e2e freeze: rollback without snapshot fails", async () => {
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
