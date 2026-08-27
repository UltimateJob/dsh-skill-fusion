import { parseSkillFrontmatter } from "../frontmatter.js";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

/**
 * Search GitHub repositories likely to contain skills.
 * Uses the search/repositories API, sorted by stars (usage ranking).
 *
 * @param {string} query - search keywords
 * @param {object} opts - { limit (default 10), fetchFn }
 * @returns {Array} ranked repo candidates with rank metadata
 */
export async function searchGithubRepos(query, { limit = 10, fetchFn = globalThis.fetch } = {}) {
  if (!query || !query.trim()) return [];
  const q = encodeURIComponent(`${query.trim()} skill`);
  const url = `${API}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`;
  let res;
  try { res = await fetchFn(url); } catch { return []; }
  if (!res?.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data?.items)) return [];
  return data.items.map(it => ({
    name: it.full_name,
    description: it.description || "",
    sourceKind: "github",
    sourceMarket: "github",
    marketKind: "repo",
    rank: it.stargazers_count || 0,
    rankKind: "stars",
    rankLabel: formatStars(it.stargazers_count || 0),
    url: it.html_url || `https://github.com/${it.full_name}`,
    ref: it.default_branch || "main",
  }));
}

function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * Discover skills from a GitHub repo.
 * Uses the git tree API (one call) to find SKILL.md files,
 * then fetches each to parse frontmatter.
 *
 * @param {string} ownerRepo - "owner/repo"
 * @param {object} opts - { ref: "main" (default), fetchFn }
 * @returns {Array} candidates with sourceKind="github"
 */
export async function discoverGithub(ownerRepo, { ref = "main", fetchFn = globalThis.fetch } = {}) {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) return [];

  // 1. Fetch the repo tree (recursive)
  const treeUrl = `${API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  let treeRes;
  try { treeRes = await fetchFn(treeUrl); } catch { return []; }
  if (!treeRes?.ok) return [];
  const treeData = await treeRes.json();
  if (!treeData?.tree) return [];

  // 2. Find SKILL.md paths (either skills/<name>/SKILL.md or <name>/SKILL.md)
  const skillPaths = treeData.tree
    .filter(e => e.type === "blob" && e.path.endsWith("/SKILL.md"))
    .map(e => e.path);
  if (skillPaths.length === 0) return [];

  const candidates = [];
  for (const skillPath of skillPaths) {
    // Extract skill name from path: skills/<name>/SKILL.md or <name>/SKILL.md
    const parts = skillPath.split("/");
    const fileName = parts[parts.length - 1]; // SKILL.md
    const skillName = parts[parts.length - 2]; // the dir name

    // Fetch raw content to parse frontmatter
    const rawUrl = `${RAW}/${owner}/${repo}/${ref}/${skillPath}`;
    let rawRes;
    try { rawRes = await fetchFn(rawUrl); } catch { continue; }
    if (!rawRes?.ok) continue;
    const raw = await rawRes.text();
    const parsed = parseSkillFrontmatter(raw);
    if (!parsed) continue;

    // Determine resourceBase relative to repo root
    const skillDir = skillPath.replace(/\/SKILL\.md$/, "");
    candidates.push({
      name: parsed.name,
      description: parsed.description,
      sourceKind: "github",
      sourceRef: `${ownerRepo}@${ref}`,
      version: ref,
      commit: treeData.sha || null,
      skillDir,
      rawUrl,
      parsed,
      kind: "bundle",
    });
  }

  return candidates;
}

/**
 * Download a GitHub repo tarball and extract it.
 * Reuses the same tar extract logic as npm.
 */
export async function fetchGithubTarball(ownerRepo, ref, destDir, { fetchFn = globalThis.fetch } = {}) {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) return { ok: false, error: "invalid-owner-repo" };
  const url = `${API}/repos/${owner}/${repo}/tarball/${ref}`;
  // Reuse npm's fetchTarball (same tar extract)
  const { fetchTarball } = await import("./npm.js");
  return fetchTarball(url, destDir, { fetchFn });
}

/**
 * Resolve the extracted tarball dir for a github source.
 * GitHub tarballs extract to a dir like owner-repo-ref-<sha>/
 */
export function resolveTarballRoot(destDir) {
  try {
    const entries = readdirSync(destDir, { withFileTypes: true });
    const dir = entries.find(e => e.isDirectory());
    return dir ? join(destDir, dir.name) : null;
  } catch { return null; }
}
