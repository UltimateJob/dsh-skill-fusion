import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-routes-local-")); }
function addSkill(dshHome, name, { disabled = false } = {}) {
  const dir = disabled ? join(dshHome, "skill-fusion", "disabled", name) : join(dshHome, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: d\n---\nbody`, "utf8");
}
function mockReq(method, urlPath, { body, headers } = {}) {
  return {
    method, url: urlPath,
    headers: { host: "127.0.0.1:3080", ...headers },
    [Symbol.asyncIterator]: body ? async function*() { yield Buffer.from(JSON.stringify(body)); } : async function*() {},
  };
}
function mockRes() {
  const result = { status: null, body: null };
  return { result, writeHead(s) { result.status = s; }, end(d) { result.body = d; } };
}

test("GET /api/skill-fusion/local lists local skills with enabled state", async () => {
  const home = freshHome();
  addSkill(home, "on-skill");
  addSkill(home, "off-skill", { disabled: true });
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/local");
  const res = mockRes();
  await r.handler(mockReq("GET", "/api/skill-fusion/local"), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.skills.length, 2);
  const byName = Object.fromEntries(payload.skills.map(s => [s.name, s]));
  assert.equal(byName["on-skill"].enabled, true);
  assert.equal(byName["off-skill"].enabled, false);
});

test("POST /api/skill-fusion/toggle disables a skill", async () => {
  const home = freshHome();
  addSkill(home, "toggle-me");
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/toggle");
  const res = mockRes();
  await r.handler(mockReq("POST", "/api/skill-fusion/toggle", { body: { name: "toggle-me", enabled: false }, headers: { origin: "http://127.0.0.1:3080" } }), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.enabled, false);
});

test("POST /api/skill-fusion/toggle rejects cross-origin", async () => {
  const home = freshHome();
  addSkill(home, "x");
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/toggle");
  const res = mockRes();
  await r.handler(mockReq("POST", "/api/skill-fusion/toggle", { body: { name: "x", enabled: false }, headers: { origin: "https://evil.example" } }), res);
  assert.equal(res.result.status, 403);
});

test("POST /api/skill-fusion/toggle 404 for unknown skill", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/toggle");
  const res = mockRes();
  await r.handler(mockReq("POST", "/api/skill-fusion/toggle", { body: { name: "ghost", enabled: false }, headers: { origin: "http://127.0.0.1:3080" } }), res);
  assert.equal(res.result.status, 404);
});
