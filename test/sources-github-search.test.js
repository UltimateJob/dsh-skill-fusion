import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGithubRepos } from "../lib/sources/github.js";

// Mock GitHub search/repositories response
function mockRepoSearch(items) {
  return {
    ok: true,
    json: async () => ({ total_count: items.length, incomplete_results: false, items }),
  };
}

test("searchGithubRepos: returns ranked repos with stars", async () => {
  const mockFetch = async (url) => {
    if (url.includes("search/repositories")) {
      return mockRepoSearch([
        { full_name: "obra/superpowers", stargazers_count: 278181, description: "An agentic skills framework", html_url: "https://github.com/obra/superpowers", default_branch: "main" },
        { full_name: "anthrophic/skills", stargazers_count: 1200, description: "Official skills", html_url: "https://github.com/anthrophic/skills", default_branch: "main" },
      ]);
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await searchGithubRepos("claude skill", { fetchFn: mockFetch });
  assert.equal(r.length, 2);
  assert.equal(r[0].name, "obra/superpowers");
  assert.equal(r[0].rank, 278181);
  assert.equal(r[0].rankKind, "stars");
  assert.equal(r[0].marketKind, "repo");
  assert.equal(r[0].sourceKind, "github");
  assert.ok(r[0].rankLabel.includes("278"));
});

test("searchGithubRepos: includes skill keyword in query", async () => {
  let captured = null;
  const mockFetch = async (url) => {
    captured = url;
    return mockRepoSearch([]);
  };
  await searchGithubRepos("code review", { fetchFn: mockFetch });
  const decoded = decodeURIComponent(captured);
  assert.ok(decoded.includes("q=code review skill"), `query should add skill keyword: ${decoded}`);
  assert.ok(captured.includes("sort=stars"), "should sort by stars");
  assert.ok(captured.includes("per_page=10"), "should cap results");
});

test("searchGithubRepos: returns empty on error", async () => {
  const mockFetch = async () => ({ ok: false, status: 403 });
  const r = await searchGithubRepos("anything", { fetchFn: mockFetch });
  assert.equal(r.length, 0);
});

test("searchGithubRepos: respects limit option", async () => {
  let perPage = null;
  const mockFetch = async (url) => {
    const m = url.match(/per_page=(\d+)/);
    if (m) perPage = m[1];
    return mockRepoSearch([]);
  };
  await searchGithubRepos("test", { limit: 5, fetchFn: mockFetch });
  assert.equal(perPage, "5");
});
