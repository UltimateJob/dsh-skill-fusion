import { test } from "node:test";
import assert from "node:assert/strict";
import { searchMarket } from "../lib/sources/market.js";

test("searchMarket: aggregates github + npm ranked results", async () => {
  const mockFetch = async (url) => {
    if (url.includes("search/repositories")) {
      return { ok: true, json: async () => ({ items: [
        { full_name: "obra/superpowers", stargazers_count: 278181, description: "skills framework", html_url: "u1", default_branch: "main" },
        { full_name: "small/skill", stargazers_count: 50, description: "small", html_url: "u2", default_branch: "main" },
      ] }) };
    }
    if (url.includes("/-/v1/search")) {
      return { ok: true, json: async () => ({ objects: [
        { package: { name: "claude-skill", version: "1.0.0", description: "pkg skill", links: { npm: "n1" } }, score: { detail: { popularity: 0.9 } } },
      ] }) };
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await searchMarket("claude skill", { fetchFn: mockFetch });
  assert.equal(r.length, 3);
  // GitHub results should be sorted by stars descending
  assert.equal(r[0].name, "obra/superpowers");
  assert.equal(r[0].sourceMarket, "github");
  assert.equal(r[0].rankKind, "stars");
  // npm result present
  const npm = r.find(x => x.sourceMarket === "npm");
  assert.ok(npm);
  assert.equal(npm.rankKind, "popularity");
});

test("searchMarket: handles one source failing", async () => {
  const mockFetch = async (url) => {
    if (url.includes("search/repositories")) return { ok: false, status: 403 };
    if (url.includes("/-/v1/search")) {
      return { ok: true, json: async () => ({ objects: [
        { package: { name: "only-npm", version: "1.0.0", description: "d", links: { npm: "n" } }, score: { detail: { popularity: 0.5 } } },
      ] }) };
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await searchMarket("x", { fetchFn: mockFetch });
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "only-npm");
});

test("searchMarket: empty query returns empty", async () => {
  const r = await searchMarket("", { fetchFn: async () => ({ ok: false }) });
  assert.equal(r.length, 0);
});
