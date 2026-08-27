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

test("searchMarket: empty query returns featured homepage ranked by stars", async () => {
  const mockFetch = async (url) => {
    // Featured repo metadata fetches (repos/<owner>/<repo>)
    const repoMeta = url.match(/api\.github\.com\/repos\/([^/]+\/[^/]+)$/);
    if (repoMeta) {
      const stars = { "obra/superpowers": 278322, "wshobson/agents": 39177, "anthropics/skills": 171934 }[repoMeta[1]] || 1000;
      return { ok: true, json: async () => ({ full_name: repoMeta[1], stargazers_count: stars, description: "d", html_url: "u", default_branch: "main" }) };
    }
    // Trending search
    if (url.includes("search/repositories")) {
      return { ok: true, json: async () => ({ items: [
        { full_name: "trending/one", stargazers_count: 5000, description: "t", html_url: "u", default_branch: "main" },
      ] }) };
    }
    return { ok: false, status: 404 };
  };
  const r = await searchMarket("", { fetchFn: mockFetch });
  assert.ok(r.length > 0, "should return featured content");
  // Sorted by stars descending: obra/superpowers (278k) first
  assert.equal(r[0].name, "obra/superpowers");
  assert.equal(r[0].featured, true);
  assert.ok(r[0].rank > r[r.length - 1].rank, "should be ranked by stars descending");
  // Featured repos + trending all present
  const names = r.map(c => c.name);
  assert.ok(names.includes("anthropics/skills"));
  assert.ok(names.includes("trending/one"));
});
