import { test } from "node:test";
import assert from "node:assert/strict";
import { searchNpmPackages } from "../lib/sources/npm.js";

// Mock npm registry search response
function mockNpmSearch(pkgs) {
  return {
    ok: true,
    json: async () => ({
      total: pkgs.length,
      objects: pkgs.map(p => ({
        package: {
          name: p.name,
          version: p.version,
          description: p.description,
          links: { npm: `https://www.npmjs.com/package/${p.name}` },
        },
        score: { detail: { popularity: p.popularity } },
      })),
    }),
  };
}

test("searchNpmPackages: returns ranked packages with popularity", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/-/v1/search")) {
      return mockNpmSearch([
        { name: "antd-claude-skill", version: "1.0.0", description: "An Ant Design Claude skill", popularity: 0.95 },
        { name: "claude-skill-search", version: "0.3.0", description: "Skill search server", popularity: 0.8 },
      ]);
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await searchNpmPackages("claude skill", { fetchFn: mockFetch });
  assert.equal(r.length, 2);
  assert.equal(r[0].name, "antd-claude-skill");
  assert.equal(r[0].rank, 0.95);
  assert.equal(r[0].rankKind, "popularity");
  assert.equal(r[0].marketKind, "package");
  assert.equal(r[0].sourceKind, "npm");
  assert.equal(r[0].version, "1.0.0");
});

test("searchNpmPackages: includes skill keyword and size", async () => {
  let captured = null;
  const mockFetch = async (url) => {
    captured = url;
    return mockNpmSearch([]);
  };
  await searchNpmPackages("code review", { limit: 8, fetchFn: mockFetch });
  const decoded = decodeURIComponent(captured);
  assert.ok(decoded.includes("text=code review skill"), `should add skill keyword: ${decoded}`);
  assert.ok(captured.includes("size=8"), "should set size");
});

test("searchNpmPackages: returns empty on error", async () => {
  const mockFetch = async () => ({ ok: false, status: 429 });
  const r = await searchNpmPackages("x", { fetchFn: mockFetch });
  assert.equal(r.length, 0);
});
