import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGithubRepos } from "../lib/sources/github.js";
import { searchNpmPackages } from "../lib/sources/npm.js";
import { searchMarket } from "../lib/sources/market.js";

const okJson = (data) => ({ ok: true, json: async () => data });

test("searchGithubRepos: passes page param", async () => {
  let url = null;
  await searchGithubRepos("claude", { page: 3, fetchFn: async (u) => { url = u; return okJson({ items: [] }); } });
  assert.ok(url.includes("page=3"), `should include page=3: ${url}`);
});

test("searchGithubRepos: page defaults to 1", async () => {
  let url = null;
  await searchGithubRepos("claude", { fetchFn: async (u) => { url = u; return okJson({ items: [] }); } });
  assert.ok(url.includes("page=1"), `should include page=1: ${url}`);
});

test("searchNpmPackages: passes from offset based on page", async () => {
  let url = null;
  await searchNpmPackages("claude", { limit: 10, page: 3, fetchFn: async (u) => { url = u; return okJson({ objects: [] }); } });
  assert.ok(url.includes("from=20"), `page 3 with limit 10 → from=20: ${url}`);
});

test("searchMarket: page 2 of a keyword query returns next batch", async () => {
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    if (url.includes("search/repositories")) {
      const page = url.match(/[?&]page=(\d+)/)[1];
      return okJson({ total_count: 100, items: [{ full_name: `p${page}/repo`, stargazers_count: 100, description: "d", html_url: "u", default_branch: "main" }] });
    }
    if (url.includes("/-/v1/search")) return okJson({ total: 100, objects: [] });
    return { ok: false };
  };
  const p1 = await searchMarket("claude", { page: 1, fetchFn });
  const p2 = await searchMarket("claude", { page: 2, fetchFn });
  assert.equal(p1[0].name, "p1/repo");
  assert.equal(p2[0].name, "p2/repo");
  assert.ok(seen.some(u => u.includes("page=2")), "page 2 request issued");
});

test("searchMarket: featured page 2 returns trending without featured repos repeated", async () => {
  const fetchFn = async (url) => {
    const repoMeta = url.match(/api\.github\.com\/repos\/([^/]+\/[^/]+)$/);
    if (repoMeta) {
      return okJson({ full_name: repoMeta[1], stargazers_count: 99999, description: "d", html_url: "u", default_branch: "main" });
    }
    if (url.includes("search/repositories")) {
      const page = url.match(/[?&]page=(\d+)/)[1];
      return okJson({ items: [{ full_name: `trending/p${page}`, stargazers_count: 100, description: "t", html_url: "u", default_branch: "main" }] });
    }
    return { ok: false };
  };
  const p1 = await searchMarket("", { page: 1, fetchFn });
  const p2 = await searchMarket("", { page: 2, fetchFn });
  assert.ok(p1.some(c => c.featured), "page 1 has featured repos");
  assert.ok(!p2.some(c => c.featured), "page 2 should not repeat featured repos");
  assert.ok(p2.length > 0, "page 2 returns more trending results");
});
