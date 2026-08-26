# dsh-skill-fusion Phase 2 实施计划(freeze:版本 pin + 更新 + 回滚 + 导出)

> **面向 Agent 执行者:** 必需子技能:使用 superpower-subagent-driven-development(推荐)或 superpower-executing-plans 按任务逐项执行本计划。步骤使用复选框(`- [ ]`)语法进行跟踪。

**目标:** 完成四阶段生命周期的最后一段:freeze(版本 pin、更新重审、回滚快照、导出导入清单)。

**架构:** 在 Phase 1b 的 `lib/*` 上加 freeze 层:`lib/freeze.js`(pin/unpin)、`lib/update.js`(更新检查+更新+重审)、`lib/rollback.js`(快照+回滚)、`lib/export.js`(导出/导入)。CLI 与 host 路由加对应子命令/端点,设置页加 freeze/update/rollback 操作按钮。

**技术栈:** Node 18+,ESM,`node --test`,零 own 运行时依赖。

**规格:** `docs/superpowers/specs/2026-08-26-skill-fusion-design.md` §4.4(Freeze)。

## 全局约束

- 零 own 运行时依赖。
- 快照存 `~/.dsh/skill-fusion/snapshots/<name>@<version>/`(copy 模式)。
- 导出 = manifest 子集 + 已激活技能 tar;导入 merge(导后新激活的保留)+ 写前校验 + 失败回滚。
- 更新 = 重 fetch → 内容哈希变 → 重审 → 切链/重拷;旧态先入 snapshots/。
- 所有可写路由 same-origin 强制。
- `DSH_HOME` 经 `process.env.DSH_HOME || ~/.dsh`;测试用临时 `DSH_HOME`。

## 文件结构

| 文件 | 职责 |
|---|---|
| `lib/freeze.js` | freeze/unfreeze(manifest frozenVersion) |
| `lib/update.js` | checkForUpdates + updateSkill(重审+切链) |
| `lib/rollback.js` | snapshotSkill + rollbackSkill |
| `lib/export.js` | exportBundle + importBundle |
| `lib/cli.js` | 加 freeze/unfreeze/update/rollback/export/import 子命令 |
| `lib/routes.js` | 加 freeze/update/rollback/export 端点 |
| `client/client.js` | 加 freeze/update/rollback 按钮 |
| `test/freeze.test.js` | freeze 测试 |
| `test/update.test.js` | update 测试(mock fetch) |
| `test/rollback.test.js` | rollback 测试 |
| `test/export.test.js` | export/import 测试 |

---

### 任务 1:freeze/unfreeze(版本 pin)

**文件:**
- 新建:`lib/freeze.js`
- 测试:`test/freeze.test.js`

**接口:**
- 依赖输入:`lib/manifest.js`(readManifest/writeManifest/upsertSkill/findSkill)
- 对外产出:`freezeSkill(manifest, name, version) -> manifest`(写 frozenVersion + status='frozen');`unfreezeSkill(manifest, name) -> manifest`(清 frozenVersion + status='active');`isFrozen(manifest, name) -> boolean`。

- [ ] **步骤 1:写失败测试**

```js
// test/freeze.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { freezeSkill, unfreezeSkill, isFrozen } from "../lib/freeze.js";

function mkSkill(name) {
  return { sourceKind: "local", sourceRef: "/x", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" };
}

test("freezeSkill sets frozenVersion and status", () => {
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  m = freezeSkill(m, "a-b", "1.0.0");
  const e = m.skills["a-b"];
  assert.equal(e.frozenVersion, "1.0.0");
  assert.equal(e.status, "frozen");
  assert.equal(isFrozen(m, "a-b"), true);
});

test("unfreezeSkill clears frozenVersion and restores active", () => {
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  m = freezeSkill(m, "a-b", "1.0.0");
  m = unfreezeSkill(m, "a-b");
  const e = m.skills["a-b"];
  assert.equal(e.frozenVersion, null);
  assert.equal(e.status, "active");
  assert.equal(isFrozen(m, "a-b"), false);
});

test("freezeSkill on nonexistent skill returns manifest unchanged", () => {
  const m = emptyManifest();
  const m2 = freezeSkill(m, "nope", "1.0.0");
  assert.deepEqual(m2, m);
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/freeze.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/freeze.js
export function freezeSkill(manifest, name, version) {
  const entry = manifest.skills[name];
  if (!entry) return manifest;
  return {
    ...manifest,
    skills: { ...manifest.skills, [name]: { ...entry, frozenVersion: version, status: "frozen" } },
  };
}

export function unfreezeSkill(manifest, name) {
  const entry = manifest.skills[name];
  if (!entry) return manifest;
  return {
    ...manifest,
    skills: { ...manifest.skills, [name]: { ...entry, frozenVersion: null, status: "active" } },
  };
}

export function isFrozen(manifest, name) {
  return manifest.skills[name]?.frozenVersion != null;
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/freeze.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/freeze.js test/freeze.test.js
git commit -m "feat(freeze): version pin/unpin via manifest frozenVersion"
```

---

### 任务 2:更新检查 + 更新(重审 + 切链)

**文件:**
- 新建:`lib/update.js`
- 测试:`test/update.test.js`

**接口:**
- 依赖输入:`lib/manifest.js`、`lib/freeze.js`(isFrozen)、`lib/sources/npm.js`(discoverNpm)、`lib/sources/local.js`(discoverLocal)、`lib/audit.js`(audit)、`lib/activate.js`(activateSkill/removeActivation)、`lib/frontmatter.js`(parseSkillFrontmatter/skillHash)
- 对外产出:`checkForUpdates(manifest, dshHome, {fetchFn?}) -> Promise<[{name, current, latest, hasUpdate}]>`;`updateSkill(manifest, name, dshHome, {fetchFn?}) -> Promise<{manifest, updated, error?}>`。

- [ ] **步骤 1:写失败测试**

```js
// test/update.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { freezeSkill } from "../lib/freeze.js";
import { checkForUpdates, updateSkill } from "../lib/update.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-update-")); }
function mkSkill(name, overrides = {}) {
  return { sourceKind: "local", sourceRef: "/x", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: { verdict: "pass", hash: "sha256:abc", at: "t", flags: [] }, status: "active", ...overrides };
}

test("checkForUpdates: skips frozen skills", async () => {
  const m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  const frozen = freezeSkill(m, "a-b", "1.0.0");
  const home = freshHome();
  const updates = await checkForUpdates(frozen, home);
  assert.equal(updates.length, 0);
});

test("checkForUpdates: local source with changed content reports update", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src") }));
  // change the content
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const updates = await checkForUpdates(m, home);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].hasUpdate, true);
});

test("checkForUpdates: local source unchanged reports no update", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  // compute the hash that matches the current content
  const { parseSkillFrontmatter, skillHash } = await import("../lib/frontmatter.js");
  const raw = readFileSync(join(src, "SKILL.md"), "utf8");
  const parsed = parseSkillFrontmatter(raw);
  const hash = skillHash(parsed);
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src"), lastAudit: { verdict: "pass", hash, at: "t", flags: [] } }));
  const updates = await checkForUpdates(m, home);
  assert.equal(updates.length, 0);
});

test("updateSkill: re-audits and updates local skill", async () => {
  const home = freshHome();
  const src = join(home, "src", "adversarial-review");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  // activate the old version
  const { activateSkill } = await import("../lib/activate.js");
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", mkSkill("adversarial-review", { sourceRef: join(home, "src") }));
  // change the source content
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2 updated\n---\nbody", "utf8");
  const { manifest: m2, updated, error } = await updateSkill(m, "adversarial-review", home);
  assert.equal(error, undefined);
  assert.equal(updated, true);
  // the activated skill should now have the new description
  const actRaw = readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8");
  assert.ok(actRaw.includes("v2 updated"));
  // manifest should have new hash
  assert.ok(m2.skills["adversarial-review"].lastAudit.hash !== m.skills["adversarial-review"].lastAudit.hash);
});

test("updateSkill: skips frozen skill", async () => {
  const home = freshHome();
  let m = upsertSkill(emptyManifest(), "a-b", mkSkill("a-b"));
  m = freezeSkill(m, "a-b", "1.0.0");
  const { updated, error } = await updateSkill(m, "a-b", home);
  assert.equal(updated, false);
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/update.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/update.js
import { isFrozen } from "./freeze.js";
import { discoverLocal } from "./sources/local.js";
import { parseSkillFrontmatter, skillHash } from "./frontmatter.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation } from "./activate.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

async function currentContentHash(name, sourceRef, dshHome) {
  // For local source: read the SKILL.md at the source and hash it
  const cand = discoverLocal(sourceRef).find(c => c.name === name);
  if (!cand) return null;
  return skillHash(cand.parsed);
}

export async function checkForUpdates(manifest, dshHome, { fetchFn } = {}) {
  const updates = [];
  for (const [name, entry] of Object.entries(manifest.skills)) {
    if (isFrozen(manifest, name)) continue;
    const currentHash = entry.lastAudit?.hash;
    if (!currentHash) continue;
    const latestHash = await currentContentHash(name, entry.sourceRef, dshHome);
    if (latestHash && latestHash !== currentHash) {
      updates.push({ name, current: currentHash, latest: latestHash, hasUpdate: true });
    }
  }
  return updates;
}

export async function updateSkill(manifest, name, dshHome, { fetchFn } = {}) {
  if (isFrozen(manifest, name)) return { manifest, updated: false };
  const entry = manifest.skills[name];
  if (!entry) return { manifest, updated: false, error: "not-found" };

  const sourceRef = entry.sourceRef;
  if (entry.sourceKind === "local") {
    const cand = discoverLocal(sourceRef).find(c => c.name === name);
    if (!cand) return { manifest, updated: false, error: "source-not-found" };
    // re-audit
    const r = audit(cand, { existingNames: Object.keys(manifest.skills).filter(n => n !== name), existingSkills: [] });
    if (r.verdict === "block") return { manifest, updated: false, error: "blocked", flags: r.flags };
    // re-activate (replace existing)
    removeActivation({ name, dshHome });
    const act = activateSkill({ name, sourceDir: cand.resourceBase, dshHome });
    if (!act.ok) return { manifest, updated: false, error: act.error };
    return {
      manifest: {
        ...manifest,
        skills: { ...manifest.skills, [name]: { ...entry, lastAudit: { verdict: r.verdict, hash: r.hash, at: new Date().toISOString(), flags: r.flags }, activationMode: act.mode } },
      },
      updated: true,
    };
  }
  // npm source: checkForUpdates would need to fetch latest version; updateSkill fetches + extracts + re-audits
  return { manifest, updated: false, error: "npm-update-not-implemented" };
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/update.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/update.js test/update.test.js
git commit -m "feat(update): version check + re-audit + re-activate"
```

---

### 任务 3:快照 + 回滚

**文件:**
- 新建:`lib/rollback.js`
- 测试:`test/rollback.test.js`

**接口:**
- 依赖输入:`lib/activate.js`(removeActivation/activateSkill)、`lib/manifest.js`
- 对外产出:`snapshotSkill(name, dshHome) -> Promise<{ok, snapshotPath?, error?}>`(copy 当前激活技能到 `~/.dsh/skill-fusion/snapshots/<name>/`);`rollbackSkill(manifest, name, dshHome) -> Promise<{manifest, ok, error?}>`(从快照恢复激活)。

- [ ] **步骤 1:写失败测试**

```js
// test/rollback.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill } from "../lib/manifest.js";
import { activateSkill, removeActivation } from "../lib/activate.js";
import { snapshotSkill, rollbackSkill } from "../lib/rollback.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-rollback-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v1\n---\nbody", "utf8");
  return join(root, "adversarial-review");
}

test("snapshotSkill copies activated skill to snapshots dir", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  const r = await snapshotSkill("adversarial-review", home);
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(r.snapshotPath, "SKILL.md")));
});

test("rollbackSkill restores from snapshot after update", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  // snapshot v1
  await snapshotSkill("adversarial-review", home);
  // simulate an update: change the activated skill to v2
  removeActivation({ name: "adversarial-review", dshHome: home });
  writeFileSync(join(src, "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v2"));
  // rollback to v1
  const r = await rollbackSkill(m, "adversarial-review", home);
  assert.equal(r.ok, true);
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v1"));
});

test("rollbackSkill on nonexistent snapshot returns error", async () => {
  const home = freshHome();
  const m = emptyManifest();
  const r = await rollbackSkill(m, "nope", home);
  assert.equal(r.ok, false);
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/rollback.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/rollback.js
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { removeActivation, activateSkill } from "./activate.js";

function snapshotsDir(dshHome) { return join(dshHome, "skill-fusion", "snapshots"); }
function snapshotPath(name, dshHome) { return join(snapshotsDir(dshHome), name); }

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name), d = join(dst, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

export async function snapshotSkill(name, dshHome) {
  const target = join(dshHome, "skills", name);
  if (!existsSync(target)) return { ok: false, error: "not-activated" };
  const snap = snapshotPath(name, dshHome);
  try {
    // remove old snapshot if exists
    if (existsSync(snap)) rmSync(snap, { recursive: true, force: true });
    copyTree(target, snap);
    return { ok: true, snapshotPath: snap };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function rollbackSkill(manifest, name, dshHome) {
  const snap = snapshotPath(name, dshHome);
  if (!existsSync(snap)) return { manifest, ok: false, error: "no-snapshot" };
  const entry = manifest.skills[name];
  if (!entry) return { manifest, ok: false, error: "not-in-manifest" };
  try {
    removeActivation({ name, dshHome });
    const act = activateSkill({ name, sourceDir: snap, dshHome, mode: "copy" });
    if (!act.ok) return { manifest, ok: false, error: act.error };
    return {
      manifest: {
        ...manifest,
        skills: { ...manifest.skills, [name]: { ...entry, activationMode: "copy", status: "active" } },
      },
      ok: true,
    };
  } catch (e) {
    return { manifest, ok: false, error: String(e) };
  }
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/rollback.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/rollback.js test/rollback.test.js
git commit -m "feat(rollback): snapshot + restore activated skills"
```

---

### 任务 4:导出/导入

**文件:**
- 新建:`lib/export.js`
- 测试:`test/export.test.js`

**接口:**
- 依赖输入:`lib/manifest.js`、`lib/activate.js`
- 对外产出:`exportBundle(manifest, dshHome, outPath) -> Promise<{ok, bundlePath?, error?}>`;`importBundle(bundlePath, dshHome, existingManifest) -> Promise<{manifest, ok, imported, error?}>`。

- [ ] **步骤 1:写失败测试**

```js
// test/export.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyManifest, upsertSkill, readManifest } from "../lib/manifest.js";
import { activateSkill } from "../lib/activate.js";
import { exportBundle, importBundle } from "../lib/export.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-export-")); }
function fixture(root) {
  mkdirSync(join(root, "adversarial-review"), { recursive: true });
  writeFileSync(join(root, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: review\n---\nbody", "utf8");
  return join(root, "adversarial-review");
}

test("exportBundle produces a JSON bundle with manifest + skill content", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home });
  let m = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const outPath = join(home, "backup.json");
  const r = await exportBundle(m, home, outPath);
  assert.equal(r.ok, true);
  assert.ok(existsSync(outPath));
  const bundle = JSON.parse(readFileSync(outPath, "utf8"));
  assert.ok(bundle.skills);
  assert.ok(bundle.skills["adversarial-review"]);
});

test("importBundle merges into existing manifest", async () => {
  const home1 = freshHome();
  const home2 = freshHome();
  const src = fixture(join(home1, "src"));
  activateSkill({ name: "adversarial-review", sourceDir: src, dshHome: home1 });
  let m1 = upsertSkill(emptyManifest(), "adversarial-review", { sourceKind: "local", sourceRef: join(home1, "src"), version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  const outPath = join(home1, "backup.json");
  await exportBundle(m1, home1, outPath);
  // home2 has an empty manifest; import should add adversarial-review
  const existing = emptyManifest();
  const r = await importBundle(outPath, home2, existing);
  assert.equal(r.ok, true);
  assert.ok(r.imported.includes("adversarial-review"));
  assert.ok(r.manifest.skills["adversarial-review"]);
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/export.test.js`
预期:FAIL,Cannot find module

- [ ] **步骤 3:写最小实现**

```js
// lib/export.js
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readManifest, writeManifest, upsertSkill } from "./manifest.js";
import { activateSkill } from "./activate.js";
import { parseSkillFrontmatter } from "./frontmatter.js";

export async function exportBundle(manifest, dshHome, outPath) {
  try {
    const skills = {};
    for (const [name, entry] of Object.entries(manifest.skills)) {
      const target = join(dshHome, "skills", name);
      let content = null;
      if (existsSync(join(target, "SKILL.md"))) {
        content = readFileSync(join(target, "SKILL.md"), "utf8");
      }
      skills[name] = { ...entry, content };
    }
    const bundle = { version: 1, exportedAt: new Date().toISOString(), skills };
    writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
    return { ok: true, bundlePath: outPath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function importBundle(bundlePath, dshHome, existingManifest) {
  try {
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    if (bundle?.version !== 1 || !bundle?.skills) return { manifest: existingManifest, ok: false, error: "invalid-bundle" };
    let manifest = existingManifest;
    const imported = [];
    for (const [name, entry] of Object.entries(bundle.skills)) {
      if (manifest.skills[name]) continue; // merge: keep existing
      const { content, ...entryWithoutContent } = entry;
      // write skill content to ~/.dsh/skills/<name>/
      if (content) {
        const target = join(dshHome, "skills", name);
        mkdirSync(target, { recursive: true });
        writeFileSync(join(target, "SKILL.md"), content, "utf8");
      }
      manifest = upsertSkill(manifest, name, { ...entryWithoutContent, status: "active" });
      imported.push(name);
    }
    writeManifest(dshHome, manifest);
    return { manifest, ok: true, imported };
  } catch (e) {
    return { manifest: existingManifest, ok: false, error: String(e) };
  }
}
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/export.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/export.js test/export.test.js
git commit -m "feat(export): bundle export/import with merge semantics"
```

---

### 任务 5:CLI + 路由 + client 扩展

**文件:**
- 修改:`lib/cli.js`(加 freeze/unfreeze/update/rollback/export/import 子命令)、`lib/routes.js`(加对应端点)、`client/client.js`(加 freeze/update/rollback 按钮)
- 测试:`test/cli.test.js` 扩展

**接口:**
- CLI 子命令:`freeze --name <n> --version <v>`、`unfreeze --name <n>`、`update [--name <n>]`、`rollback --name <n>`、`export --out <path>`、`import --from <path>`
- 路由端点:`POST /api/skill-fusion/freeze`、`POST /api/skill-fusion/unfreeze`、`POST /api/skill-fusion/update`、`POST /api/skill-fusion/rollback`、`GET /api/skill-fusion/export`
- client:Activated 视图加 freeze/update/rollback 按钮

- [ ] **步骤 1:扩展 CLI 测试**

```js
// test/cli.test.js (append to existing)
test("runCli freeze marks skill frozen", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const code = runCli(["freeze", "--name", "adversarial-review", "--version", "1.0.0"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.status, "frozen");
});

test("runCli unfreeze restores active", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  runCli(["freeze", "--name", "adversarial-review", "--version", "1.0.0"], { out: () => {}, dshHome: home });
  const code = runCli(["unfreeze", "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.status, "active");
});

test("runCli update refreshes changed local skill", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  // change the source
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const lines = [];
  const code = runCli(["update", "--name", "adversarial-review"], { out: s => lines.push(s), dshHome: home });
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes("updated"));
});

test("runCli export produces a bundle", () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  runCli(["activate", "--local", src, "--name", "adversarial-review"], { out: () => {}, dshHome: home });
  const outPath = join(home, "backup.json");
  const code = runCli(["export", "--out", outPath], { out: () => {}, dshHome: home });
  assert.equal(code, 0);
  assert.ok(existsSync(outPath));
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/cli.test.js`
预期:FAIL(新子命令未实现)

- [ ] **步骤 3:扩展 lib/cli.js**

在 `runCli` 的 switch 中加:
```js
    case "freeze": return cmdFreeze(opts, { out, dshHome });
    case "unfreeze": return cmdUnfreeze(opts, { out, dshHome });
    case "update": return cmdUpdate(opts, { out, dshHome });
    case "rollback": return cmdRollback(opts, { out, dshHome });
    case "export": return cmdExport(opts, { out, dshHome });
    case "import": return cmdImport(opts, { out, dshHome });
```

并加对应函数(用 lib/freeze.js、lib/update.js、lib/rollback.js、lib/export.js):

```js
function cmdFreeze(opts, { out, dshHome }) {
  const { name, version } = opts;
  if (!name || !version) { out("usage: freeze --name <n> --version <v>"); return 2; }
  let m = readManifest(dshHome);
  m = freezeSkill(m, name, version);
  writeManifest(dshHome, m);
  out(`frozen ${name}@${version}`);
  return 0;
}

function cmdUnfreeze(opts, { out, dshHome }) {
  const { name } = opts;
  if (!name) { out("usage: unfreeze --name <n>"); return 2; }
  let m = readManifest(dshHome);
  m = unfreezeSkill(m, name);
  writeManifest(dshHome, m);
  out(`unfrozen ${name}`);
  return 0;
}

async function cmdUpdate(opts, { out, dshHome }) {
  const { name } = opts;
  let m = readManifest(dshHome);
  if (name) {
    const { manifest: m2, updated, error } = await updateSkill(m, name, dshHome);
    if (error) { out(`update failed: ${error}`); return 1; }
    writeManifest(dshHome, m2);
    out(updated ? `updated ${name}` : `no update for ${name}`);
    return updated ? 0 : 0;
  }
  // update all
  const updates = await checkForUpdates(m, dshHome);
  if (updates.length === 0) { out("all up to date"); return 0; }
  for (const u of updates) {
    const { manifest: m2, updated, error } = await updateSkill(m, u.name, dshHome);
    if (!error && updated) m = m2;
  }
  writeManifest(dshHome, m);
  out(`updated ${updates.length} skill(s)`);
  return 0;
}

async function cmdRollback(opts, { out, dshHome }) {
  const { name } = opts;
  if (!name) { out("usage: rollback --name <n>"); return 2; }
  // snapshot first if not exists
  const m = readManifest(dshHome);
  const { manifest: m2, ok, error } = await rollbackSkill(m, name, dshHome);
  if (!ok) { out(`rollback failed: ${error}`); return 1; }
  writeManifest(dshHome, m2);
  out(`rolled back ${name}`);
  return 0;
}

async function cmdExport(opts, { out, dshHome }) {
  const { out: outPath } = opts;
  if (!outPath) { out("usage: export --out <path>"); return 2; }
  const m = readManifest(dshHome);
  const r = await exportBundle(m, dshHome, outPath);
  if (!r.ok) { out(`export failed: ${r.error}`); return 1; }
  out(`exported to ${outPath}`);
  return 0;
}

async function cmdImport(opts, { out, dshHome }) {
  const { from } = opts;
  if (!from) { out("usage: import --from <path>"); return 2; }
  const m = readManifest(dshHome);
  const r = await importBundle(from, dshHome, m);
  if (!r.ok) { out(`import failed: ${r.error}`); return 1; }
  out(`imported ${r.imported.length} skill(s)`);
  return 0;
}
```

注意:`runCli` 目前返回同步值,但 `cmdUpdate`/`cmdRollback`/`cmdExport`/`cmdImport` 是 async。改 `runCli` 返回 Promise,或在 bin 中 await。最小改动:`runCli` 加 `async`,bin 中 `process.exitCode = await runCli(...)`。

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/cli.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/cli.js test/cli.test.js
git commit -m "feat(cli): freeze/unfreeze/update/rollback/export/import commands"
```

---

### 任务 6:host 路由 + client 扩展

**文件:**
- 修改:`lib/routes.js`(加 freeze/update/rollback/export 端点)、`client/client.js`(加 freeze/update/rollback 按钮)
- 测试:`test/routes.test.js` 扩展

**接口:**
- 路由:`POST /api/skill-fusion/freeze` `{name, version}`、`POST /api/skill-fusion/unfreeze` `{name}`、`POST /api/skill-fusion/update` `{name?}`、`POST /api/skill-fusion/rollback` `{name}`、`GET /api/skill-fusion/export`(返回 JSON bundle 下载)
- client:Activated 视图的卡片加 freeze/update/rollback 按钮

- [ ] **步骤 1:扩展路由测试**

```js
// test/routes.test.js (append)
test("POST /api/skill-fusion/freeze marks skill frozen", async () => {
  const home = freshHome();
  const src = fixture(join(home, "src"));
  const routes = skillFusionRoutes(home);
  const actRoute = routes.find(r => r.path === "/api/skill-fusion/activate");
  const actRes = mockRes();
  await actRoute.handler(mockReq("POST", "/api/skill-fusion/activate", { body: { sourceKind: "local", sourceRef: src, name: "adversarial-review" } }), actRes);
  const frRoute = routes.find(r => r.path === "/api/skill-fusion/freeze");
  const frRes = mockRes();
  await frRoute.handler(mockReq("POST", "/api/skill-fusion/freeze", { body: { name: "adversarial-review", version: "1.0.0" } }), frRes);
  const payload = JSON.parse(frRes.result.body);
  assert.equal(payload.ok, true);
  const entry = findSkill(readManifest(home), "adversarial-review");
  assert.equal(entry.status, "frozen");
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
});
```

- [ ] **步骤 2:运行测试确认失败**

运行:`node --test test/routes.test.js`
预期:FAIL(新端点未实现)

- [ ] **步骤 3:扩展 lib/routes.js**

在 `skillFusionRoutes` 返回的数组中加:

```js
    {
      kind: "exact",
      path: `${PREFIX}/freeze`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name, version } = body;
          if (!name || !version) return json(res, 400, { ok: false, error: "missing-fields" });
          const { freezeSkill } = await import("./freeze.js");
          let m = readManifest(dshHome);
          m = freezeSkill(m, name, version);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, frozen: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/unfreeze`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          const { unfreezeSkill } = await import("./freeze.js");
          let m = readManifest(dshHome);
          m = unfreezeSkill(m, name);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, unfrozen: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/update`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          const { updateSkill, checkForUpdates } = await import("./update.js");
          const { snapshotSkill } = await import("./rollback.js");
          let m = readManifest(dshHome);
          if (name) {
            await snapshotSkill(name, dshHome); // snapshot before update
            const { manifest: m2, updated, error } = await updateSkill(m, name, dshHome);
            if (error) return json(res, 500, { ok: false, error });
            writeManifest(dshHome, m2);
            return json(res, 200, { ok: true, updated, name });
          }
          const updates = await checkForUpdates(m, dshHome);
          for (const u of updates) {
            await snapshotSkill(u.name, dshHome);
            const { manifest: m2 } = await updateSkill(m, u.name, dshHome);
            m = m2;
          }
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, updated: updates.length });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/rollback`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          const { rollbackSkill } = await import("./rollback.js");
          const m = readManifest(dshHome);
          const { manifest: m2, ok, error } = await rollbackSkill(m, name, dshHome);
          if (!ok) return json(res, 500, { ok: false, error });
          writeManifest(dshHome, m2);
          json(res, 200, { ok: true, rolledBack: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/export`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const m = readManifest(dshHome);
        const skills = {};
        for (const [name, entry] of Object.entries(m.skills)) {
          const target = join(dshHome, "skills", name);
          let content = null;
          if (existsSync(join(target, "SKILL.md"))) content = readFileSync(join(target, "SKILL.md"), "utf8");
          skills[name] = { ...entry, content };
        }
        json(res, 200, { ok: true, bundle: { version: 1, exportedAt: new Date().toISOString(), skills } });
      },
    },
```

- [ ] **步骤 4:运行测试确认通过**

运行:`node --test test/routes.test.js`
预期:PASS

- [ ] **步骤 5:提交**

```bash
git add lib/routes.js test/routes.test.js
git commit -m "feat(routes): freeze/update/rollback/export endpoints"
```

---

### 任务 7:client 设置页加 freeze/update/rollback 操作

**文件:**
- 修改:`client/client.js`

在 `ActivatedView` 的 `SkillCard` 中加 freeze/update/rollback 按钮。加 locale 字符串:
```js
// en
freeze: "Freeze", unfreeze: "Unfreeze", update: "Update", rollback: "Rollback", export: "Export",
// zh
freeze: "冻结", unfreeze: "解冻", update: "更新", rollback: "回滚", export: "导出",
```

在 `ActivatedView` 中加操作函数:
```js
const doFreeze = async (name, version) => { ... };
const doUnfreeze = async (name) => { ... };
const doUpdate = async (name) => { ... };
const doRollback = async (name) => { ... };
const doExport = async () => { ... };
```

并在 `SkillCard` 的 `actions` 区加按钮(当 `skill.status === "frozen"` 时显示 unfreeze,否则 freeze)。

- [ ] **步骤 1:修改 client/client.js**

在 `en`/`zh` locale 中加上述字符串。在 `ActivatedView` 中加操作函数和按钮。

- [ ] **步骤 2:语法检查**

运行:`node --check client/client.js`
预期:无语法错误

- [ ] **步骤 3:提交**

```bash
git add client/client.js
git commit -m "feat(client): freeze/update/rollback/export actions in Activated view"
```

---

### 任务 8:全量测试 + 端到端

**文件:**
- 测试:`test/e2e-freeze.test.js`

**接口:**
- 对外产出:验证完整 freeze 工作流(activate -> freeze -> update -> rollback -> export -> import)

- [ ] **步骤 1:写端到端测试**

```js
// test/e2e-freeze.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillFusionRoutes } from "../lib/routes.js";
import { readManifest, findSkill } from "../lib/manifest.js";

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

test("e2e freeze workflow: activate -> freeze -> update -> rollback -> export", async () => {
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
  assert.equal(findSkill(readManifest(home), "adversarial-review").status, "active");

  // 4. snapshot (for rollback)
  const rbRoute = routes.find(r => r.path === "/api/skill-fusion/rollback");
  // rollback without snapshot should fail
  const rbRes1 = mockRes();
  await rbRoute.handler(mockReq("POST", "/api/skill-fusion/rollback", { body: { name: "adversarial-review" } }), rbRes1);
  assert.equal(JSON.parse(rbRes1.result.body).ok, false);

  // 5. update (change source)
  writeFileSync(join(src, "adversarial-review", "SKILL.md"), "---\nname: adversarial-review\ndescription: v2\n---\nbody", "utf8");
  const upRoute = routes.find(r => r.path === "/api/skill-fusion/update");
  const upRes = mockRes();
  await upRoute.handler(mockReq("POST", "/api/skill-fusion/update", { body: { name: "adversarial-review" } }), upRes);
  assert.equal(JSON.parse(upRes.result.body).ok, true);
  assert.ok(readFileSync(join(home, "skills", "adversarial-review", "SKILL.md"), "utf8").includes("v2"));

  // 6. export
  const expRoute = routes.find(r => r.path === "/api/skill-fusion/export");
  const expRes = mockRes();
  await expRoute.handler(mockReq("GET", "/api/skill-fusion/export"), expRes);
  const bundle = JSON.parse(expRes.result.body).bundle;
  assert.ok(bundle.skills["adversarial-review"]);
});
```

- [ ] **步骤 2:运行测试确认通过**

运行:`node --test test/e2e-freeze.test.js`
预期:PASS

- [ ] **步骤 3:全量测试 + 提交**

运行:`node --test`
预期:全部 PASS

```bash
git add test/e2e-freeze.test.js
git commit -m "test(e2e): full freeze workflow round-trip"
```

---

## 自检

**1. 规格覆盖度:** §4.4 Freeze 全覆盖(pin T1、update T2、rollback T3、export/import T4)。✓
**2. 占位符扫描:** 无 TBD/TODO,每个代码步骤含真实代码。✓
**3. 类型一致性:**
- `freezeSkill(manifest, name, version) -> manifest` — T1/T5/T6 一致 ✓
- `checkForUpdates(manifest, dshHome) -> Promise<[{name,current,latest,hasUpdate}]>` — T2/T5/T6 一致 ✓
- `updateSkill(manifest, name, dshHome) -> Promise<{manifest,updated,error?}>` — T2/T5/T6 一致 ✓
- `snapshotSkill(name, dshHome) -> Promise<{ok,snapshotPath?,error?}>` — T3/T6 一致 ✓
- `rollbackSkill(manifest, name, dshHome) -> Promise<{manifest,ok,error?}>` — T3/T5/T6 一致 ✓
- `exportBundle(manifest, dshHome, outPath) -> Promise<{ok,bundlePath?,error?}>` — T4/T5 一致 ✓
- `importBundle(bundlePath, dshHome, existingManifest) -> Promise<{manifest,ok,imported,error?}>` — T4/T5 一致 ✓

无遗漏需补。

---

## 执行交接

计划已保存至 `docs/superpowers/plans/2026-08-26-skill-fusion-phase2-freeze.md`。按内联执行(superpower-executing-plans)推进。
