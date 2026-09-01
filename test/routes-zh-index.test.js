import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";

function mockReq(method, urlPath) {
  return { method, url: urlPath, headers: { host: "127.0.0.1:3080" }, [Symbol.asyncIterator]: async function*() {} };
}
function mockRes() {
  const result = { status: null, body: null };
  return { result, writeHead(s) { result.status = s; }, end(d) { result.body = d; } };
}

test("GET /api/skill-fusion/zh-index serves the bundled Chinese skill index", async () => {
  const home = mkdtempSync(join(tmpdir(), "fusion-zhidx-"));
  const routes = skillFusionRoutes(home);
  const r = routes.find(x => x.path === "/api/skill-fusion/zh-index");
  assert.ok(r, "zh-index route exists");
  const res = mockRes();
  await r.handler(mockReq("GET", "/api/skill-fusion/zh-index"), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.index.skills, "has skills map");
  assert.ok(payload.index.repos, "has repos map");
  // Every entry carries developer + zh description
  const entries = Object.entries(payload.index.skills);
  assert.ok(entries.length > 50, "covers the mainstream skills");
  for (const [, v] of entries) {
    assert.ok(v.developer, "developer present");
    assert.ok(typeof v.zh === "string", "zh field present");
  }
});
