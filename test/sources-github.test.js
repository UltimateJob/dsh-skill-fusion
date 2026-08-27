import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverGithub } from "../lib/sources/github.js";

// Helper to build a GitHub API tree response
function mockTreeResponse(owner, repo, ref, skillPaths) {
  const tree = skillPaths.map((p, i) => ({ path: p, type: "blob", sha: `sha${i}` }));
  return {
    ok: true,
    json: async () => ({ tree, truncated: false, sha: "rootsha" }),
  };
}

// Helper to build a raw content response for SKILL.md
function mockRawResponse(content) {
  return {
    ok: true,
    text: async () => content,
  };
}

test("discoverGithub: finds skills in a repo tree", async () => {
  const skillMd = "---\nname: my-skill\ndescription: A test skill\n---\n# My Skill\nDo stuff.";
  const mockFetch = async (url) => {
    if (url.includes("/git/trees/")) return mockTreeResponse("owner", "repo", "main", ["skills/my-skill/SKILL.md"]);
    if (url.includes("raw.githubusercontent.com")) return mockRawResponse(skillMd);
    throw new Error(`unexpected: ${url}`);
  };
  const r = await discoverGithub("owner/repo", { ref: "main", fetchFn: mockFetch });
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "my-skill");
  assert.equal(r[0].sourceKind, "github");
  assert.equal(r[0].sourceRef, "owner/repo@main");
  assert.equal(r[0].version, "main");
});

test("discoverGithub: finds skills at repo root (no skills/ prefix)", async () => {
  const skillMd = "---\nname: root-skill\ndescription: root level\n---\nbody";
  const mockFetch = async (url) => {
    if (url.includes("/git/trees/")) return mockTreeResponse("owner", "repo", "v1", ["root-skill/SKILL.md", "README.md", "package.json"]);
    if (url.includes("raw.githubusercontent.com")) return mockRawResponse(skillMd);
    throw new Error(`unexpected: ${url}`);
  };
  const r = await discoverGithub("owner/repo", { ref: "v1", fetchFn: mockFetch });
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "root-skill");
});

test("discoverGithub: returns empty for repo without skills", async () => {
  const mockFetch = async (url) => {
    if (url.includes("/git/trees/")) return mockTreeResponse("owner", "repo", "main", ["README.md", "index.js"]);
    throw new Error(`unexpected: ${url}`);
  };
  const r = await discoverGithub("owner/repo", { ref: "main", fetchFn: mockFetch });
  assert.equal(r.length, 0);
});

test("discoverGithub: returns empty on API error", async () => {
  const mockFetch = async () => ({ ok: false, status: 404 });
  const r = await discoverGithub("owner/repo", { ref: "main", fetchFn: mockFetch });
  assert.equal(r.length, 0);
});

test("discoverGithub: default ref is main", async () => {
  let treeUrl = null;
  const skillMd = "---\nname: test\ndescription: t\n---\nbody";
  const mockFetch = async (url) => {
    if (url.includes("/git/trees/")) { treeUrl = url; return mockTreeResponse("owner", "repo", "main", ["skills/test/SKILL.md"]); }
    if (url.includes("raw.githubusercontent.com")) return mockRawResponse(skillMd);
    throw new Error(`unexpected: ${url}`);
  };
  await discoverGithub("owner/repo", { fetchFn: mockFetch });
  assert.ok(treeUrl && treeUrl.includes("/git/trees/main"), `treeUrl was: ${treeUrl}`);
});
