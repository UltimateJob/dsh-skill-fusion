import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";
import { readManifest, findSkill } from "../lib/manifest.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-e2e-int-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review", "references"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: Skeptical ship/no-ship code review.\n---\n# Adversarial Review\nDo the review.", "utf8");
  writeFileSync(join(root, "adversarial-review", "references", "schema.json"), "{}", "utf8");
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

test("e2e: local source via routes -> discover -> audit -> activate -> list", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);

  // 1. Discover
  const discRoute = routes.find(r => r.path === "/api/skill-fusion/discover");
  const discRes = mockRes();
  await discRoute.handler(mockReq("GET", `/api/skill-fusion/discover?source=local&path=${src}`), discRes);
  const discPayload = JSON.parse(discRes.result.body);
  assert.equal(discPayload.ok, true);
  assert.ok(discPayload.candidates.some(c => c.name === "adversarial-review"));

  // 2. Audit
  const auditRoute = routes.find(r => r.path === "/api/skill-fusion/audit");
  const auditRes = mockRes();
  await auditRoute.handler(mockReq("GET", `/api/skill-fusion/audit?source=local&path=${src}&name=adversarial-review`), auditRes);
  const auditPayload = JSON.parse(auditRes.result.body);
  assert.equal(auditPayload.ok, true);
  assert.equal(auditPayload.verdict, "pass");

  // 3. Activate
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const actPayload = JSON.parse(actRes.result.body);
  assert.equal(actPayload.ok, true);
  assert.equal(actPayload.mode, "symlink");
  assert.ok(existsSync(join(home, "skills", "adversarial-review", "SKILL.md")));
  assert.ok(existsSync(join(home, "skills", "adversarial-review", "references", "schema.json")));

  // 4. List
  const listRoute = routes.find(r => r.path === "/api/skill-fusion/list");
  const listRes = mockRes();
  await listRoute.handler(mockReq("GET", "/api/skill-fusion/list"), listRes);
  const listPayload = JSON.parse(listRes.result.body);
  assert.equal(listPayload.ok, true);
  assert.ok(listPayload.skills.some(s => s.name === "adversarial-review" && s.status === "active"));

  // 5. Manifest round-trip
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.sourceKind, "local");
  assert.equal(entry.activationMode, "symlink");

  // 6. Uninstall
  const unRoute = routes.find(r => r.path === "/api/skill-fusion/uninstall");
  const unRes = mockRes();
  await unRoute.handler(mockReq("POST", "/api/skill-fusion/uninstall", { body: { name: "adversarial-review" } }), unRes);
  const unPayload = JSON.parse(unRes.result.body);
  assert.equal(unPayload.ok, true);
  assert.equal(existsSync(join(home, "skills", "adversarial-review")), false);
});

test("e2e: blocked skill via routes (name conflict) does not activate", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  // pre-create a skill of the same name directly in the root
  mkdirSync(join(home, "skills", "adversarial-review"), { recursive: true });
  writeFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: pre-existing\n---\n", "utf8");

  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const actPayload = JSON.parse(actRes.result.body);
  assert.equal(actPayload.ok, false);
  assert.equal(actPayload.error, "target-exists");
});

test("e2e: npm source via routes -> audit returns pending", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const auditRoute = routes.find(r => r.path === "/api/skill-fusion/audit");
  const auditRes = mockRes();
  await auditRoute.handler(mockReq("GET", `/api/skill-fusion/audit?source=npm&name=adversarial-review`), auditRes);
  const payload = JSON.parse(auditRes.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.verdict, "pending");
});
