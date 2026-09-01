import { test } from "node:test";
import assert from "node:assert/strict";
import { rankIndex } from "../lib/search.js";

const INDEX = {
  version: 1,
  repos: { "anthropics/skills": { developer: "Anthropic 官方" } },
  skills: {
    "anthropics/skills:xlsx": { developer: "Anthropic 官方", zh: "处理 Excel/CSV 表格文件的读写、公式、图表与数据清洗", en: "Use this skill any time a spreadsheet file is the primary input or output", skillDir: "skills/xlsx" },
    "addyosmani/agent-skills:code-review-and-quality": { developer: "Addy Osmani", zh: "在合并前对代码做多维度质量评审,适用于人或 agent 写的代码", en: "Conducts multi-axis code review. Use before merging any change", skillDir: "skills/code-review-and-quality" },
    "addyosmani/agent-skills:code-simplification": { developer: "Addy Osmani", zh: "重构简化代码,让代码更清晰易读易维护", en: "Simplifies code for clarity. Use when refactoring", skillDir: "skills/code-simplification" },
    "obra/superpowers:test-driven-development": { developer: "obra", zh: "测试驱动开发:先写测试再实现,保障代码质量", en: "Write tests before implementation", skillDir: "skills/test-driven-development" },
    "anthropics/skills:canvas-design": { developer: "Anthropic 官方", zh: "用设计哲学创作精美的 PNG/PDF 视觉海报", en: "Create beautiful visual art in .png and .pdf documents", skillDir: "skills/canvas-design" },
  },
};

test("rankIndex: exact name match ranks first", () => {
  const r = rankIndex(INDEX, "xlsx");
  assert.equal(r[0].name, "xlsx");
  assert.ok(r[0].score >= 70);
});

test("rankIndex: English description keyword finds skill", () => {
  const r = rankIndex(INDEX, "spreadsheet");
  assert.equal(r[0].name, "xlsx");
});

test("rankIndex: Chinese description match (表格 finds xlsx)", () => {
  const r = rankIndex(INDEX, "表格");
  assert.equal(r[0].name, "xlsx");
});

test("rankIndex: intent query 编程体验 finds coding-related skills via synonyms", () => {
  const r = rankIndex(INDEX, "编程体验");
  assert.ok(r.length >= 2, "should find multiple related skills");
  const names = r.map(x => x.name);
  assert.ok(names.some(n => n.includes("code") || n.includes("test")), `expected coding skills, got ${names.join(",")}`);
  // ranked: all results have positive scores, sorted desc
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score, "sorted by score desc");
});

test("rankIndex: intent 代码质量 ranks review/tdd/simplify high", () => {
  const r = rankIndex(INDEX, "代码质量");
  const top3 = r.slice(0, 3).map(x => x.name);
  assert.ok(top3.includes("code-review-and-quality") || top3.includes("test-driven-development") || top3.includes("code-simplification"),
    `expected quality skills in top 3, got ${top3.join(",")}`);
});

test("rankIndex: name substring beats description-only match", () => {
  const r = rankIndex(INDEX, "code");
  assert.equal(r[0].name.startsWith("code"), true, "name match ranks above others");
});

test("rankIndex: 海报 finds canvas-design", () => {
  const r = rankIndex(INDEX, "海报");
  assert.equal(r[0].name, "canvas-design");
});

test("rankIndex: no match returns empty", () => {
  const r = rankIndex(INDEX, "zzzzzz不存在的东西");
  assert.equal(r.length, 0);
});

test("rankIndex: respects limit", () => {
  const r = rankIndex(INDEX, "code", { limit: 1 });
  assert.equal(r.length, 1);
});

test("rankIndex: empty query returns empty", () => {
  assert.deepEqual(rankIndex(INDEX, ""), []);
  assert.deepEqual(rankIndex(INDEX, "   "), []);
});
