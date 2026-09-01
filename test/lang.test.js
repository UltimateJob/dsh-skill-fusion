import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLang, dedupeByLang } from "../lib/lang.js";

test("detectLang: path hints win (docs/zh-CN, docs/ja-JP)", () => {
  assert.equal(detectLang("docs/zh-CN/skills/accessibility", ""), "zh");
  assert.equal(detectLang("docs/ja-JP/skills/accessibility", ""), "ja");
  assert.equal(detectLang("skills/accessibility", ""), "en");
});

test("detectLang: content fallback — kana is Japanese, han is Chinese", () => {
  assert.equal(detectLang("skills/x", "WCAG 2.2 レベル AA 標準を用いて"), "ja");
  assert.equal(detectLang("skills/x", "使用 WCAG 2.2 标准设计"), "zh");
  assert.equal(detectLang("skills/x", "Design inclusive products"), "en");
});

const v = (name, lang, dir) => ({ name, description: `desc-${lang}`, skillDir: dir, lang: undefined });

test("dedupeByLang: zh wins over en and ja; ja dropped entirely", () => {
  const cands = [
    { name: "a11y", description: "Japanese テスト", skillDir: "docs/ja-JP/skills/a11y" },
    { name: "a11y", description: "English version", skillDir: "skills/a11y" },
    { name: "a11y", description: "中文版本", skillDir: "docs/zh-CN/skills/a11y" },
  ];
  const r = dedupeByLang(cands);
  assert.equal(r.length, 1, "only one variant kept");
  assert.equal(r[0].skillDir, "docs/zh-CN/skills/a11y", "zh variant kept");
  assert.equal(r[0].lang, "zh");
});

test("dedupeByLang: no zh → en kept; ja-only skill dropped", () => {
  const cands = [
    { name: "x", description: "Japanese のみ", skillDir: "docs/ja-JP/skills/x" },
    { name: "y", description: "English only", skillDir: "skills/y" },
    { name: "z", description: "日本語だけ", skillDir: "docs/ja-JP/skills/z" },
  ];
  const r = dedupeByLang(cands);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "y");
  assert.equal(r[0].lang, "en");
});

test("dedupeByLang: distinct names all kept, sorted", () => {
  const cands = [
    { name: "b-skill", description: "b", skillDir: "skills/b" },
    { name: "a-skill", description: "a", skillDir: "skills/a" },
  ];
  const r = dedupeByLang(cands);
  assert.equal(r.length, 2);
  assert.equal(r[0].name, "a-skill");
});
