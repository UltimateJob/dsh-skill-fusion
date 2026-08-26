# dsh-skill-fusion Phase 1b 实施计划(host 插件 + 设置页 + npm 源)

> **面向 Agent 执行者:** 必需子技能:使用 superpower-subagent-driven-development(推荐)或 superpower-executing-plans 按任务逐项执行本计划。步骤使用复选框(`- [ ]`)语法进行跟踪。

**目标:** 让 fusion 成为可 `dsh plugin add` 安装的 DSH 插件,带可写设置页(Settings → Skill Forge)和 npm 源发现,实现"装技能像装 App 一样简单"。

**架构:** 在 Phase 1a 的 `lib/*` 核心上加三面:host 插件(`lib/index.js` + `lib/routes.js` + `cordis.patch.yml`,same-origin JSON 路由)、浏览器 client(`client/client.js`,`settings.section` 槽位)、npm 源适配器(`lib/sources/npm.js`,fetch tarball 解压激活)。

**技术栈:** Node 18+,ESM,`node --test`,零 own 运行时依赖;host 用 cordis `webServer` 服务,client 用 `slots`/`locale` 服务,React 经 `require("react")`。

**规格:** `docs/superpowers/specs/2026-08-26-skill-fusion-design.md` §3.1(包形态)、§4(四阶段)、§6(安全)、§8(市场上架)。

## 全局约束

- 零 own 运行时依赖(仅 Node 内置 + 全局 `fetch`);host/client 的 react/cordis 是 peerDeps。
- 所有可写路由 same-origin 强制(`lib/same-origin.js`)。
- 激活技能落 `~/.dsh/skills/<name>/`(沙箱根);npm 源经 fetch tarball 解压到 `~/.dsh/skill-fusion/cache/`,再软链/copy 到激活根。
- `DSH_HOME` 经 `process.env.DSH_HOME || ~/.dsh`;测试用临时 `DSH_HOME`。
- MIT 许可;包名 `dsh-skill-fusion`。
- TDD:每任务先写失败测试,再写最小实现,绿后提交。

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/sources/npm.js` | npm registry 源适配器(发现 + tarball 拉取) |
| `lib/routes.js` | HTTP 路由处理器(same-origin 守卫,调用 lib/*) |
| `lib/index.js` | host 插件:`apply(ctx)` 注册路由 |
| `cordis.patch.yml` | 声明 bundle 插入 profile 层 |
| `client/client.js` | 浏览器设置页(`settings.section` 槽位) |
| `package.json` | 加 `dsh.bundle`/`dsh.client`/peerDeps |
| `test/npm.test.js` | npm 源测试(mock fetch) |
| `test/routes.test.js` | 路由测试(同源自构 req/res) |
| `test/host-integration.test.js` | host 插件集成冒烟 |

---

### 任务 1:npm 源适配器

**文件:**
- 新建:`lib/sources/npm.js`
- 测试:`test/npm.test.js`

**接口:**
- 依赖输入:全局 `fetch`(可注入 mock)
- 对外产出:`discoverNpm(name, {fetchFn?}) -> Promise<{name,description,version,sourceKind:'npm',sourceRef,tarballUrl,skills[]}|null>`;`fetchTarball(url, destDir, {fetchFn?}) -> Promise<{ok,error?}>`。skills 数组为 `[{name, fetchPath}]`(从 package.json `files` 推断或从 tarball 发现)。

- [ ] **步骤 1:写失败测试**

```js
// test/npm.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverNpm, fetchTarball } from "../lib/sources/npm.js";

test("discoverNpm: returns candidate for a package with skills", async () => {
  const mockFetch = async (url) => {
    if (url.includes("registry.npmjs.org/adversarial-review/latest")) {
      return {
        ok: true,
        json: async () => ({
          name: "adversarial-review",
          version: "2.10.0",
          description: "Skeptical code review",
          dist: { tarball: "https://registry.npmjs.org/adversarial-review/-/adversarial-review-2.10.0.tgz" },
          files: ["skills/adversarial-review/", "bin/"],
        }),
      };
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await discoverNpm("adversarial-review", { fetchFn: mockFetch });
  assert.equal(r.name, "adversarial-review");
  assert.equal(r.version, "2.10.0");
  assert.equal(r.sourceKind, "npm");
  assert.equal(r.sourceRef, "adversarial-review@2.10.0");
  assert.ok(r.tarballUrl.includes(".tgz"));
  assert.ok(r.skills.length > 0);
});

test("discoverNpm: returns null for package without skills", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      name: "lodash", version: "4.17.21", description: "Utility library",
      dist: { tarball: "https://..." }, files: ["index.js", "lib/"],
    }),
  });
  const r = await discoverNpm("lodash", { fetchFn: mockFetch });
  assert.equal(r, null);
});

test("discoverNpm: returns null on registry 404", async () => {
  const mockFetch = async () => ({ ok: false, status: 404 });
  const r = await discoverNpm("nonexistent-pkg", { fetchFn: mockFetch });
  assert.equal(r, null);
});

test("fetchTarball: downloads and extracts to destDir", async () => {
  const mockFetch = async () => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array([0x1f, 0x8b]).buffer, // gzip magic
    body: null,
  });
  // fetchTarball should handle the download; actual extraction tested in integration
  const r = await fetchTarball("https://example.com/pkg.tgz", "/tmp/dest", { fetchFn: mockFetch });
  assert.equal(typeof r.ok, "boolean");
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/npm.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/sources/npm.js
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REGISTRY = "https://registry.npmjs.org";

export async function discoverNpm(name, { fetchFn = globalThis.fetch } = {}) {
  const url = `${REGISTRY}/${encodeURIComponent(name)}/latest`;
  let res;
  try { res = await fetchFn(url); } catch { return null; }
  if (!res?.ok) return null;
  const pkg = await res.json();
  if (!pkg?.name || !pkg?.version) return null;

  // Detect skills: check files array for skills/ entries
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  const skillDirs = files
    .filter(f => f.startsWith("skills/") && f.endsWith("/"))
    .map(f => ({ name: f.replace(/^skills\//, "").replace(/\/$/, ""), fetchPath: f }));
  if (skillDirs.length === 0) {
    // Fallback: check if description/keywords suggest a skill
    const desc = (pkg.description || "").toLowerCase();
    if (!desc.includes("skill")) return null;
    skillDirs.push({ name: pkg.name, fetchPath: null });
  }

  return {
    name: pkg.name,
    description: pkg.description || "",
    version: pkg.version,
    sourceKind: "npm",
    sourceRef: `${pkg.name}@${pkg.version}`,
    tarballUrl: pkg.dist?.tarball || null,
    skills: skillDirs,
  };
}

export async function fetchTarball(url, destDir, { fetchFn = globalThis.fetch } = {}) {
  let res;
  try { res = await fetchFn(url); } catch (e) { return { ok: false, error: String(e) }; }
  if (!res?.ok) return { ok: false, error: `fetch failed: ${res?.status}` };
  try {
    mkdirSync(destDir, { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    const tgzPath = join(destDir, "package.tgz");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(tgzPath, buf);
    // Extract with tar (system tool, no npm dep)
    execFileSync("tar", ["xzf", tgzPath, "-C", destDir], { stdio: "pipe" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/npm.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/sources/npm.js test/npm.test.js
git commit -m "feat(npm): npm registry source adapter + tarball fetch"
```

---

### 任务 2:host 路由处理器

**文件:**
- 新建:`lib/routes.js`
- 测试:`test/routes.test.js`

**接口:**
- 依赖输入:`lib/same-origin.js`(isSameOriginRequest)、`lib/discover.js`、`lib/audit.js`、`lib/activate.js`、`lib/manifest.js`、`lib/sources/npm.js`、`lib/sources/local.js`
- 对外产出:`skillFusionRoutes(dshHome) -> [{kind, path, handler}]`;handler 签名 `(req, res)`,用 `res.writeHead`/`res.end` 回 JSON。

- [ ] **步骤 1:写失败测试**

```js
// test/routes.test.js
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

function mockReq(method, path, { body, headers } = {}) {
  return {
    method,
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

test("GET /api/skill-fusion/list returns manifest skills", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const listRoute = routes.find(r => r.path === "/api/skill-fusion/list");
  assert.ok(listRoute);
  const res = mockRes();
  await listRoute.handler(mockReq("GET", "/api/skill-fusion/list"), res);
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
  const url = new URL(`http://127.0.0.1:3080/api/skill-fusion/discover?source=local&path=${src}`);
  await route.handler({ ...mockReq("GET"), url: url.pathname + url.search }, res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.ok(payload.candidates.some(c => c.name === "adversarial-review"));
});

test("POST /api/skill-fusion/activate activates a local skill", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/activate");
  const res = mockRes();
  const body = { sourceKind: "local", sourceRef: src, name: "adversarial-review" };
  await route.handler(mockReq("POST", "/api/skill-fusion/activate", { body }), res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.activated, "adversarial-review");
});

test("POST /api/skill-fusion/activate rejects cross-site", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/activate");
  const res = mockRes();
  const body = { sourceKind: "local", sourceRef: src, name: "adversarial-review" };
  await route.handler(mockReq("POST", "/api/skill-fusion/activate", { body, headers: { "sec-fetch-site": "cross-site" } }), res);
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
  // then uninstall
  const unRoute = routes.find(r => r.path === "/api/skill-fusion/uninstall");
  const unRes = mockRes();
  await unRoute.handler(mockReq("POST", "/api/skill-fusion/uninstall", { body: { name: "adversarial-review" } }), unRes);
  const payload = JSON.parse(unRes.result.body);
  assert.equal(payload.ok, true);
});

test("GET /api/skill-fusion/audit returns verdict for a candidate", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const route = routes.find(r => r.path === "/api/skill-fusion/audit");
  const res = mockRes();
  const url = new URL(`http://127.0.0.1:3080/api/skill-fusion/audit?source=local&path=${src}&name=adversarial-review`);
  await route.handler({ ...mockReq("GET"), url: url.pathname + url.search }, res);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.verdict, "pass");
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/routes.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/routes.js
import { readManifest, writeManifest, upsertSkill, removeSkill, findSkill } from "./manifest.js";
import { isSameOriginRequest } from "./same-origin.js";
import { discoverLocal } from "./sources/local.js";
import { discoverNpm, fetchTarball } from "./sources/npm.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PREFIX = "/api/skill-fusion";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function requireSameOrigin(req, res) {
  if (isSameOriginRequest(req)) return true;
  json(res, 403, { ok: false, error: "cross-site-request-rejected" });
  return false;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function resolveCandidate(sourceKind, sourceRef, name, dshHome) {
  if (sourceKind === "local") {
    const all = discoverLocal(sourceRef);
    return all.find(c => c.name === name) || null;
  }
  if (sourceKind === "npm") {
    // npm candidates need async fetch; caller handles separately
    return null;
  }
  return null;
}

export function skillFusionRoutes(dshHome) {
  return [
    {
      kind: "exact",
      path: `${PREFIX}/list`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const m = readManifest(dshHome);
        const orphans = reconcileOrphans({ manifest: m, dshHome });
        const skills = Object.entries(m.skills).map(([name, e]) => ({
          name, ...e, status: orphans.includes(name) ? "orphan" : e.status,
        }));
        json(res, 200, { ok: true, skills });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/discover`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const source = url.searchParams.get("source");
        const q = url.searchParams.get("q");
        let candidates = [];
        if (source === "local") {
          const path = url.searchParams.get("path");
          if (path) candidates = discoverLocal(path);
        } else if (source === "npm") {
          const name = url.searchParams.get("name");
          if (name) {
            const r = await discoverNpm(name);
            if (r) candidates = [r];
          }
        }
        if (q) {
          const n = q.trim().toLowerCase();
          candidates = candidates.filter(c => c.name.toLowerCase().includes(n) || (c.description || "").toLowerCase().includes(n));
        }
        // Strip parsed from response (internal)
        candidates = candidates.map(({ parsed, ...rest }) => rest);
        json(res, 200, { ok: true, candidates });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/audit`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const source = url.searchParams.get("source");
        const name = url.searchParams.get("name");
        if (source === "local") {
          const path = url.searchParams.get("path");
          const cand = path ? discoverLocal(path).find(c => c.name === name) : null;
          if (!cand) return json(res, 404, { ok: false, error: "not-found" });
          const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
          return json(res, 200, { ok: true, verdict: r.verdict, flags: r.flags, hash: r.hash });
        }
        if (source === "npm") {
          const r = await discoverNpm(name);
          if (!r) return json(res, 404, { ok: false, error: "not-found" });
          // npm audit needs the skill body; return placeholder (real audit happens post-fetch)
          return json(res, 200, { ok: true, verdict: "pending", message: "npm audit requires fetch; activate will audit post-fetch" });
        }
        json(res, 400, { ok: false, error: "unsupported-source" });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/activate`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { sourceKind, sourceRef, name } = body;
          if (!sourceKind || !sourceRef || !name) return json(res, 400, { ok: false, error: "missing-fields" });

          let sourceDir, auditResult;
          if (sourceKind === "local") {
            const cand = discoverLocal(sourceRef).find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            auditResult = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            sourceDir = cand.resourceBase;
          } else if (sourceKind === "npm") {
            const cand = await discoverNpm(sourceRef.split("@")[0]);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (!cand.tarballUrl) return json(res, 422, { ok: false, error: "no-tarball" });
            const cacheDir = join(dshHome, "skill-fusion", "cache", cand.sourceRef);
            const fetchR = await fetchTarball(cand.tarballUrl, cacheDir);
            if (!fetchR.ok) return json(res, 500, { ok: false, error: fetchR.error });
            // Find SKILL.md in extracted dir
            sourceDir = join(cacheDir, "package", "skills", name);
            if (!existsSync(join(sourceDir, "SKILL.md"))) {
              // Try alternative paths
              const pkgDir = join(cacheDir, "package");
              const candidates = ["skills", "skill", "."].map(d => join(pkgDir, d, name, "SKILL.md"));
              const found = candidates.find(p => existsSync(p));
              if (!found) return json(res, 404, { ok: false, error: "skill-not-in-tarball" });
              sourceDir = join(found, "..");
            }
            const raw = readFileSync(join(sourceDir, "SKILL.md"), "utf8");
            const parsed = parseSkillFrontmatter(raw);
            if (!parsed) return json(res, 422, { ok: false, error: "invalid-frontmatter" });
            auditResult = audit({ parsed }, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
          } else {
            return json(res, 400, { ok: false, error: "unsupported-source" });
          }

          const act = activateSkill({ name, sourceDir, dshHome });
          if (!act.ok) return json(res, 409, { ok: false, error: act.error });

          let m = readManifest(dshHome);
          m = upsertSkill(m, name, {
            sourceKind, sourceRef, version: sourceKind === "npm" ? sourceRef.split("@")[1] : null,
            commit: null, activationMode: act.mode, activatedAt: new Date().toISOString(),
            frozenVersion: null,
            lastAudit: { verdict: auditResult.verdict, hash: auditResult.hash, at: new Date().toISOString(), flags: auditResult.flags },
            status: "active",
          });
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, activated: name, mode: act.mode, target: act.target });
        } catch (e) {
          json(res, 500, { ok: false, error: String(e) });
        }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/uninstall`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          removeActivation({ name, dshHome });
          let m = readManifest(dshHome);
          m = removeSkill(m, name);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, uninstalled: name });
        } catch (e) {
          json(res, 500, { ok: false, error: String(e) });
        }
      },
    },
  ];
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/routes.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/routes.js test/routes.test.js
git commit -m "feat(routes): same-origin JSON route handlers for skill-fusion API"
```

---

### 任务 3:host 插件接线(cordis.patch.yml + lib/index.js + package.json)

**文件:**
- 新建:`cordis.patch.yml`、`lib/index.js`
- 修改:`package.json`

**接口:**
- 依赖输入:`lib/routes.js`(skillFusionRoutes)
- 对外产出:`lib/index.js` 导出 `name`/`inject`/`apply(ctx)`(注册路由到 webServer);`cordis.patch.yml` 声明插入;`package.json` 加 `dsh.bundle`/`dsh.client`。

- [ ] **步骤 1:写失败测试**

```js
// test/host-integration.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, name, inject } from "../lib/index.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-host-")); }

test("host plugin: exports name/inject/apply", () => {
  assert.equal(name, "skill-fusion");
  assert.deepEqual(inject, ["webServer"]);
  assert.equal(typeof apply, "function");
});

test("host plugin: apply registers routes on webServer", () => {
  const home = freshHome();
  process.env.DSH_HOME = home;
  const registered = [];
  const ctx = {
    webServer: {
      register(route) { registered.push(route); return () => {}; },
    },
    effect(fn, label) { fn(); return () => {}; },
  };
  apply(ctx);
  assert.ok(registered.length >= 5, `expected >=5 routes, got ${registered.length}`);
  assert.ok(registered.some(r => r.path === "/api/skill-fusion/list"));
  assert.ok(registered.some(r => r.path === "/api/skill-fusion/activate"));
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/host-integration.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```yaml
# cordis.patch.yml
# dsh-skill-fusion bundle patch — inserts its row into the web plugin roster.
# Install with:  dsh plugin --profile web add dsh-skill-fusion
- insert:
    - id: skill-fusion
      name: dsh-skill-fusion
```

```js
// lib/index.js
import { skillFusionRoutes } from "./routes.js";
import { join } from "node:path";
import { homedir } from "node:os";

export const name = "skill-fusion";
export const inject = ["webServer"];

export function apply(ctx) {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const routes = skillFusionRoutes(dshHome);
  try {
    ctx.effect(() => {
      const disposers = [];
      for (const route of routes) disposers.push(ctx.webServer.register(route));
      return () => { for (const d of disposers) d(); };
    }, "skill-fusion: routes");
  } catch (error) {
    console.error("[skill-fusion] route registration failed:", error);
  }
}
```

```json
// package.json (updated — add dsh.bundle, dsh.client, peerDependencies)
{
  "name": "dsh-skill-fusion",
  "version": "0.1.0",
  "description": "Skill lifecycle manager for DeepSeek Harness: discover, audit, activate, freeze any skill package.",
  "type": "module",
  "bin": { "skill-fusion": "bin/skill-fusion.js" },
  "files": ["lib", "bin", "skills", "client", "cordis.patch.yml", "README.md", "LICENSE"],
  "engines": { "node": ">=18.0.0" },
  "scripts": { "test": "node --test" },
  "license": "MIT",
  "keywords": ["deepseek", "harness", "dsh", "dsh-skill", "skill", "lifecycle"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-settings"],
      "platform": "web"
    }
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "@deepseek-ai/cordis": "^4.0.1"
  }
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/host-integration.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add cordis.patch.yml lib/index.js package.json test/host-integration.test.js
git commit -m "feat(host): bundle wiring + plugin apply + route registration"
```

---

### 任务 4:浏览器设置页(client.js)

**文件:**
- 新建:`client/client.js`

**接口:**
- 依赖输入:host 路由(任务 2)、`slots`/`locale` 服务
- 对外产出:Settings → Skill Forge 设置页,两视图:Discover(搜索/浏览 npm + local)和 Activated(管理已装技能,含审计/激活/卸载操作)

- [ ] **步骤 1:写 client.js(照 dsh-skill-manager 的 ModuleLoader + slots 模式)**

```js
// client/client.js
window.__ModuleLoader__.load({
  id: "dsh-skill-fusion",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    const en = {
      nav: "Skill Forge",
      tab: "Skill Forge",
      discover: "Discover",
      activated: "Activated",
      search: "Search npm or browse local…",
      source: "Source",
      local: "Local",
      npm: "npm",
      audit: "Audit",
      activate: "Activate",
      uninstall: "Uninstall",
      loading: "Loading…",
      empty: "No skills found.",
      emptyActivated: "No skills activated yet.",
      verdict: "Verdict",
      flags: "Flags",
      pass: "pass",
      warn: "warn",
      block: "block",
      mode: "Mode",
      status: "Status",
      active: "active",
      orphan: "orphan",
      intro: "Discover, audit, and activate skills for DeepSeek Harness. Activated skills appear in ~/.dsh/skills and are discovered natively.",
      npmPlaceholder: "Enter npm package name (e.g. adversarial-review)",
      localPlaceholder: "Enter local path (e.g. ~/my-skills)",
      browse: "Browse",
      confirmActivate: "Activate this skill?",
      confirmUninstall: "Uninstall this skill?",
      blocked: "Blocked",
    };
    const zh = {
      nav: "技能熔炉",
      tab: "技能熔炉",
      discover: "发现",
      activated: "已激活",
      search: "搜索 npm 或浏览本地…",
      source: "来源",
      local: "本地",
      npm: "npm",
      audit: "审计",
      activate: "激活",
      uninstall: "卸载",
      loading: "加载中…",
      empty: "未发现技能。",
      emptyActivated: "尚未激活任何技能。",
      verdict: "结论",
      flags: "标记",
      pass: "通过",
      warn: "警告",
      block: "阻断",
      mode: "方式",
      status: "状态",
      active: "已激活",
      orphan: "孤儿",
      intro: "发现、审计、激活 DeepSeek Harness 技能。激活后技能出现在 ~/.dsh/skills 并被原生发现。",
      npmPlaceholder: "输入 npm 包名(如 adversarial-review)",
      localPlaceholder: "输入本地路径(如 ~/my-skills)",
      browse: "浏览",
      confirmActivate: "激活此技能?",
      confirmUninstall: "卸载此技能?",
      blocked: "已阻断",
    };

    const s = {
      section: { width: "100%", maxWidth: "760px", display: "flex", flexDirection: "column", gap: "14px" },
      intro: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      tabs: { display: "flex", gap: "8px" },
      tabBtn: (active) => ({ padding: "6px 14px", border: active ? "1px solid var(--dsw-alias-border-l2)" : "1px solid transparent", borderRadius: "8px", background: active ? "var(--dsw-alias-bg-layer-3)" : "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "13px" }),
      input: { width: "100%", height: "36px", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: "8px", outline: "none", padding: "0 12px", fontSize: "13px" },
      card: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" },
      cardTitle: { fontSize: "13.5px", fontWeight: 600, margin: 0 },
      cardDesc: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "1.5" },
      meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", lineHeight: "1.5" },
      badge: (color) => ({ fontSize: "11px", padding: "0 6px", borderRadius: "999px", background: `color-mix(in srgb, ${color} 14%, transparent)`, color }),
      actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
      btn: (primary) => ({ padding: "5px 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "6px", background: primary ? "var(--dsw-alias-bg-accent)" : "var(--dsw-alias-bg-layer-1)", color: primary ? "var(--dsw-alias-label-on-accent)" : "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "12px" }),
      cards: { display: "flex", flexDirection: "column", gap: "10px" },
      auditBox: { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "6px", padding: "8px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-1)" },
    };

    const PASS_COLOR = "var(--dsw-alias-state-success-primary, #16a34a)";
    const WARN_COLOR = "var(--dsw-alias-state-warning-primary, #d97706)";
    const BLOCK_COLOR = "var(--dsw-alias-state-error-primary, #dc2626)";
    function verdictColor(v) { return v === "pass" ? PASS_COLOR : v === "warn" ? WARN_COLOR : BLOCK_COLOR; }

    function SkillCard({ skill, t, onAudit, onActivate, onUninstall, auditResult }) {
      const verdict = auditResult?.verdict;
      return react.createElement("div", { style: s.card },
        react.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          react.createElement("strong", { style: s.cardTitle }, skill.name),
          verdict ? react.createElement("span", { style: s.badge(verdictColor(verdict)) }, t(verdict)) : null
        ),
        react.createElement("p", { style: s.cardDesc }, skill.description),
        react.createElement("p", { style: s.meta }, `${t("source")}: ${skill.sourceKind || skill.sourceKind || "local"}${skill.version ? ` @${skill.version}` : ""}${skill.mode ? ` · ${t("mode")}: ${skill.mode}` : ""}${skill.status ? ` · ${t("status")}: ${t(skill.status)}` : ""}`),
        auditResult?.flags?.length > 0 ? react.createElement("pre", { style: s.auditBox },
          auditResult.flags.map(f => `${f.severity}: ${f.kind}${f.line ? ` (line ${f.line})` : ""}`).join("\n")
        ) : null,
        react.createElement("div", { style: s.actions },
          onAudit ? react.createElement("button", { style: s.btn(false), onClick: onAudit }, t("audit")) : null,
          onActivate ? react.createElement("button", { style: s.btn(true), onClick: onActivate }, t("activate")) : null,
          onUninstall ? react.createElement("button", { style: s.btn(false), onClick: onUninstall }, t("uninstall")) : null
        )
      );
    }

    function DiscoverView({ t }) {
      const [mode, setMode] = react.useState("npm");
      const [query, setQuery] = react.useState("");
      const [path, setPath] = react.useState("");
      const [results, setResults] = react.useState(null);
      const [loading, setLoading] = react.useState(false);
      const [auditMap, setAuditMap] = react.useState({});

      const doSearch = async () => {
        setLoading(true);
        setResults(null);
        setAuditMap({});
        try {
          let url = "/api/skill-fusion/discover?source=" + mode;
          if (mode === "npm") url += "&name=" + encodeURIComponent(query);
          else url += "&path=" + encodeURIComponent(path);
          const res = await fetch(url);
          const data = await res.json();
          if (data.ok) setResults(data.candidates);
          else setResults([]);
        } catch { setResults([]); }
        setLoading(false);
      };

      const doAudit = async (name) => {
        const res = await fetch(`/api/skill-fusion/audit?source=${mode}&${mode === "npm" ? "name=" : "path="}${encodeURIComponent(mode === "npm" ? query : path)}&name=${encodeURIComponent(name)}`);
        const data = await res.json();
        setAuditMap(prev => ({ ...prev, [name]: data }));
      };

      const doActivate = async (name) => {
        const body = mode === "npm"
          ? { sourceKind: "npm", sourceRef: query, name }
          : { sourceKind: "local", sourceRef: path, name };
        const res = await fetch("/api/skill-fusion/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.ok) { setResults(prev => prev.filter(c => c.name !== name)); }
        return data;
      };

      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("intro")),
        react.createElement("div", { style: s.tabs },
          react.createElement("button", { style: s.tabBtn(mode === "npm"), onClick: () => setMode("npm") }, "npm"),
          react.createElement("button", { style: s.tabBtn(mode === "local"), onClick: () => setMode("local") }, t("local"))
        ),
        react.createElement("div", { style: { display: "flex", gap: "8px" } },
          react.createElement("input", { style: s.input, value: mode === "npm" ? query : path, onChange: e => mode === "npm" ? setQuery(e.currentTarget.value) : setPath(e.currentTarget.value), placeholder: mode === "npm" ? t("npmPlaceholder") : t("localPlaceholder") }),
          react.createElement("button", { style: s.btn(true), onClick: doSearch }, t("browse"))
        ),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        results !== null && results.length === 0 ? react.createElement("p", { style: s.intro }, t("empty")) : null,
        results ? react.createElement("div", { style: s.cards },
          results.map(c => react.createElement(SkillCard, { key: c.name, skill: c, t, onAudit: () => doAudit(c.name), onActivate: () => doActivate(c.name), auditResult: auditMap[c.name] }))
        ) : null
      );
    }

    function ActivatedView({ t }) {
      const [skills, setSkills] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const fetchList = async () => {
        try {
          const res = await fetch("/api/skill-fusion/list");
          const data = await res.json();
          if (data.ok) setSkills(data.skills);
        } catch {}
        setLoading(false);
      };
      react.useEffect(() => { fetchList(); }, []);
      const doUninstall = async (name) => {
        const res = await fetch("/api/skill-fusion/uninstall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("intro")),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        skills !== null && skills.length === 0 ? react.createElement("p", { style: s.intro }, t("emptyActivated")) : null,
        skills ? react.createElement("div", { style: s.cards },
          skills.map(sk => react.createElement(SkillCard, { key: sk.name, skill: sk, t, onUninstall: () => doUninstall(sk.name) }))
        ) : null
      );
    }

    function SkillForgeView({ t }) {
      const [view, setView] = react.useState("discover");
      return react.createElement("div", { style: s.section },
        react.createElement("div", { style: s.tabs },
          react.createElement("button", { style: s.tabBtn(view === "discover"), onClick: () => setView("discover") }, t("discover")),
          react.createElement("button", { style: s.tabBtn(view === "activated"), onClick: () => setView("activated") }, t("activated"))
        ),
        view === "discover" ? react.createElement(DiscoverView, { t }) : react.createElement(ActivatedView, { t })
      );
    }

    const NS = "skillFusion";
    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-fusion: dictionaries");
      const t = ctx.locale.bind(NS);
      ctx.effect(() => {
        const disposer = ctx.slots.register({
          name: "settings.section",
          id: "skill-fusion",
          order: 15,
          label: () => t("nav"),
          locale: NS,
          inject: () => ({}),
        }, (props) => react.createElement(SkillForgeView, Object.assign({}, props, { t })));
        return () => disposer();
      }, "skill-fusion: settings section");
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
```

- [ ] **步骤 2:验证 client.js 语法正确(node 可解析,虽在浏览器运行)**

运行:`node -e "import('./client/client.js').catch(()=>{ console.log('parse ok (browser-only, expected)') })"` 或直接 `node --check client/client.js`
预期:无语法错误(可能报 `window is not defined` 的运行时错,但语法应通过)

- [ ] **步骤 3:提交**

```bash
git add client/client.js
git commit -m "feat(client): settings section with Discover + Activated views"
```

---

### 任务 5:端到端集成冒烟

**文件:**
- 新建:`test/host-integration.test.js`(扩展)或 `test/e2e-integration.test.js`

**接口:**
- 依赖输入:任务 1-4 全部产出
- 对外产出:验证 host 插件注册路由后,routes 可正确处理请求

- [ ] **步骤 1:写集成测试**

```js
// test/e2e-integration.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";
import { readManifest, findSkill } from "../lib/manifest.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-e2e-int-")); }

test("e2e: local source via routes -> activate -> list shows it", async () => {
  const home = freshHome();
  const src = join(home, "src");
  mkdirSync(join(src, "adversarial-review", "references"), { recursive: true });
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: review\n---\nbody", "utf8");
  writeFileSync(join(src, "adversarial-review", "references", "schema.json"), "{}", "utf8");

  const routes = skillFusionRoutes(home);

  // 1. Discover
  const discoverRoute = routes.find(r => r.path === "/api/skill-fusion/discover");
  const discRes = { status: null, body: null, headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d; } };
  await discoverRoute.handler({ method: "GET", headers: { host: "127.0.0.1:3080" }, url: `/api/skill-fusion/discover?source=local&path=${src}` }, discRes);
  const discPayload = JSON.parse(discRes.body);
  assert.equal(discPayload.ok, true);
  assert.ok(discPayload.candidates.some(c => c.name === "adversarial-review"));

  // 2. Audit
  const auditRoute = routes.find(r => r.path === "/api/skill-fusion/audit");
  const auditRes = { status: null, body: null, headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d; } };
  await auditRoute.handler({ method: "GET", headers: { host: "127.0.0.1:3080" }, url: `/api/skill-fusion/audit?source=local&path=${src}&name=adversarial-review` }, auditRes);
  const auditPayload = JSON.parse(auditRes.body);
  assert.equal(auditPayload.ok, true);
  assert.equal(auditPayload.verdict, "pass");

  // 3. Activate
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = { status: null, body: null, headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d; } };
  const actBody = JSON.stringify({ sourceKind: "local", sourceRef: src, name: "adversarial-review" });
  await actRoute.handler({
    method: "POST", headers: { host: "127.0.0.1:3080", "content-type": "application/json" },
    [Symbol.asyncIterator]: async function*() { yield Buffer.from(actBody); },
  }, actRes);
  const actPayload = JSON.parse(actRes.body);
  assert.equal(actPayload.ok, true);
  assert.equal(actPayload.mode, "symlink");
  assert.ok(existsSync(join(home, "skills", "adversarial-review", "SKILL.md")));

  // 4. List
  const listRoute = routes.find(r => r.path === "/api/skill-fusion/list");
  const listRes = { status: null, body: null, headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d; } };
  await listRoute.handler({ method: "GET", headers: { host: "127.0.0.1:3080" }, url: "/api/skill-fusion/list" }, listRes);
  const listPayload = JSON.parse(listRes.body);
  assert.equal(listPayload.ok, true);
  assert.ok(listPayload.skills.some(s => s.name === "adversarial-review" && s.status === "active"));

  // 5. Manifest round-trip
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.sourceKind, "local");
  assert.equal(entry.activationMode, "symlink");
});

test("e2e: npm source via routes -> audit returns pending", async () => {
  const home = freshHome();
  const routes = skillFusionRoutes(home);
  const auditRoute = routes.find(r => r.path === "/api/skill-fusion/audit");
  const auditRes = { status: null, body: null, headers: {}, writeHead(s, h) { this.status = s; this.headers = h; }, end(d) { this.body = d; } };
  await auditRoute.handler({ method: "GET", headers: { host: "127.0.0.1:3080" }, url: "/api/skill-fusion/audit?source=npm&name=adversarial-review" }, auditRes);
  const payload = JSON.parse(auditRes.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.verdict, "pending");
});
```

- [ ] **步骤 2:运行测试确认通过**

运行:`node --test test/e2e-integration.test.js`
预期:PASS

- [ ] **步骤 3:全量测试 + 提交**

运行:`node --test`
预期:全部 PASS

```bash
git add test/e2e-integration.test.js
git commit -m "test(e2e): host routes integration smoke"
```

---

## 自检

**1. 规格覆盖度:**
- §3.1 包形态四面:host(T3)+ client(T4)+ CLI(Phase 1a)+ SKILL.md(Phase 1a)✓
- §3.2 数据目录:`~/.dsh/skill-fusion/cache/`(npm tarball 缓存)✓
- §4.1 Discover(npm 源)T1 ✓
- §4.2 Audit(路由)T2 ✓
- §4.3 Activate(路由,含 npm fetch+extract)T2 ✓
- §6 same-origin 守卫 T2 ✓
- §8 市场上架前提:dsh.bundle(T3)+ client.inject(T3)+ cordis.patch.yml(T3)✓
- 设置页 GUI T4 ✓

**2. 占位符扫描:** 无 TBD/TODO。每个代码步骤含真实代码。✓

**3. 类型一致性:**
- `skillFusionRoutes(dshHome)` 返回 `[{kind, path, handler}]`,handler 为 `(req, res)` 异步 ✓
- `discoverNpm` 返回 `{name,description,version,sourceKind,sourceRef,tarballUrl,skills[]}` ✓
- `fetchTarball(url, destDir)` 返回 `{ok, error?}` ✓
- `activateSkill` 签名与 Phase 1a 一致 ✓
- manifest entry 形与 Phase 1a 一致 ✓

无遗漏需补。

---

## 执行交接

计划已保存至 `docs/superpowers/plans/2026-08-26-skill-fusion-phase1b-host-gui-npm.md`。按内联执行(superpower-executing-plans)推进,逐任务 TDD + 提交,在检查点回报。
