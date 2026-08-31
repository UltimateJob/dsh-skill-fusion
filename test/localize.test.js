import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readmeCandidates, fetchLocalizedReadme } from "../lib/localize.js";

const okText = (text) => ({ ok: true, text: async () => text });

test("readmeCandidates: repo root prefers zh variants then falls back to README.md", () => {
  const c = readmeCandidates("", "zh");
  assert.equal(c[0], "README.zh-CN.md");
  assert.ok(c.includes("README.zh.md"));
  assert.equal(c[c.length - 1], "README.md", "last resort is plain README.md");
});

test("readmeCandidates: skill dir prefixes variants under the dir", () => {
  const c = readmeCandidates("skills/foo", "zh");
  assert.equal(c[0], "skills/foo/SKILL.zh-CN.md");
  assert.equal(c[c.length - 1], "skills/foo/SKILL.md");
});

test("readmeCandidates: non-zh lang only tries the base file", () => {
  const c = readmeCandidates("", "en");
  assert.deepEqual(c, ["README.md"]);
});

test("fetchLocalizedReadme: returns zh content when a zh variant exists", async () => {
  const fetchFn = async (url) => {
    if (url.endsWith("README.zh-CN.md")) return okText("# 技能熔炉\n中文介绍");
    return { ok: false, status: 404 };
  };
  const r = await fetchLocalizedReadme("o/r", "main", "", { fetchFn });
  assert.equal(r.lang, "zh");
  assert.ok(r.text.includes("中文介绍"));
  assert.ok(r.path.endsWith("README.zh-CN.md"));
});

test("fetchLocalizedReadme: falls back to English README when no zh variant", async () => {
  const fetchFn = async (url) => {
    if (url.endsWith("README.md")) return okText("# Skill Forge\nEnglish intro");
    return { ok: false, status: 404 };
  };
  const r = await fetchLocalizedReadme("o/r", "main", "", { fetchFn });
  assert.equal(r.lang, "en");
  assert.ok(r.text.includes("English intro"));
});

test("fetchLocalizedReadme: skill dir localizes SKILL.md", async () => {
  const fetchFn = async (url) => {
    if (url.endsWith("skills/foo/SKILL.zh.md")) return okText("---\nname: foo\ndescription: 中文技能\n---\nbody");
    if (url.endsWith("skills/foo/SKILL.md")) return okText("---\nname: foo\ndescription: english\n---\nbody");
    return { ok: false, status: 404 };
  };
  const r = await fetchLocalizedReadme("o/r", "main", "skills/foo", { fetchFn });
  assert.equal(r.lang, "zh");
  assert.ok(r.text.includes("中文技能"));
});

test("fetchLocalizedReadme: returns null when nothing exists", async () => {
  const r = await fetchLocalizedReadme("o/r", "main", "", { fetchFn: async () => ({ ok: false, status: 404 }) });
  assert.equal(r, null);
});

test("fetchLocalizedReadme: caches result locally", async () => {
  const home = mkdtempSync(join(tmpdir(), "fusion-loc-"));
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    if (url.endsWith("README.md")) return okText("# cached");
    return { ok: false, status: 404 };
  };
  const r1 = await fetchLocalizedReadme("o/r", "main", "", { fetchFn, dshHome: home });
  assert.equal(r1.cached, undefined);
  const n = calls;
  const r2 = await fetchLocalizedReadme("o/r", "main", "", { fetchFn, dshHome: home });
  assert.equal(calls, n, "second call served from cache");
  assert.equal(r2.cached, true);
  assert.ok(r2.text.includes("# cached"));
});
