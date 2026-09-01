import { parseSkillFrontmatter } from "../frontmatter.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

/**
 * Search GitHub repositories likely to contain skills.
 * Uses the search/repositories API, sorted by stars (usage ranking).
 *
 * @param {string} query - search keywords
 * @param {object} opts - { limit (default 10), page (default 1), fetchFn }
 * @returns {Array} ranked repo candidates with rank metadata
 */
export async function searchGithubRepos(query, { limit = 10, page = 1, fetchFn = globalThis.fetch } = {}) {
  if (!query || !query.trim()) return [];
  const q = encodeURIComponent(`${query.trim()} skill`);
  const url = `${API}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}&page=${page}`;
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
    forks: it.forks_count || 0,
    archived: !!it.archived,
    pushedAt: it.pushed_at || null,
  }));
}

function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return String(n);
}

/**
 * Discover skills from an extracted repo tree on disk: walk for SKILL.md
 * files and parse frontmatter. skillDir is relative to pkgRoot (repo root).
 */
export function skillsFromExtractedRoot(pkgRoot, { ownerRepo, ref = "main", commit = null } = {}) {
  const skillFiles = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === "SKILL.md") skillFiles.push(full);
    }
  };
  walk(pkgRoot);
  const candidates = [];
  for (const file of skillFiles) {
    let parsed;
    try { parsed = parseSkillFrontmatter(readFileSync(file, "utf8")); } catch { continue; }
    if (!parsed) continue;
    const skillDir = relative(pkgRoot, join(file, "..")).split(sep).join("/");
    candidates.push({
      name: parsed.name,
      description: parsed.description,
      sourceKind: "github",
      sourceRef: `${ownerRepo}@${ref}`,
      version: ref,
      commit,
      skillDir,
      rawUrl: null,
      parsed,
      kind: "bundle",
    });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return candidates;
}

/**
 * Discover skills from a GitHub repo.
 *
 * With opts.cacheDir (recommended): downloads the repo tarball ONCE (codeload,
 * no API rate limit, works even when raw.githubusercontent.com is blocked),
 * reuses the extraction on repeat calls, and discovers skills from disk.
 *
 * Without cacheDir: tree API + per-file fetch via the contents API
 * (api.github.com, raw accept header) with raw.githubusercontent.com fallback.
 *
 * @param {string} ownerRepo - "owner/repo"
 * @param {object} opts - { ref: "main" (default), fetchFn, cacheDir, concurrency (default 8), timeoutMs (default 15000) }
 * @returns {Array} candidates with sourceKind="github"
 */
export async function discoverGithub(ownerRepo, { ref = "main", fetchFn = globalThis.fetch, cacheDir, concurrency = 8, timeoutMs = 15000 } = {}) {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) return [];

  // Path A: tarball-based discovery (one codeload request + local reads)
  if (cacheDir) {
    let pkgRoot = resolveTarballRoot(cacheDir);
    if (!pkgRoot) {
      const r = await fetchGithubTarball(ownerRepo, ref, cacheDir, { fetchFn });
      if (r.ok) pkgRoot = resolveTarballRoot(cacheDir);
    }
    if (pkgRoot) return skillsFromExtractedRoot(pkgRoot, { ownerRepo, ref });
    // Tarball failed → fall through to the API path.
  }

  // Path B: tree API + per-file content fetch
  const treeUrl = `${API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  let treeRes;
  try { treeRes = await fetchFn(treeUrl); } catch { return []; }
  if (!treeRes?.ok) return [];
  const treeData = await treeRes.json();
  if (!treeData?.tree) return [];

  const skillPaths = treeData.tree
    .filter(e => e.type === "blob" && e.path.endsWith("/SKILL.md"))
    .map(e => e.path);
  if (skillPaths.length === 0) return [];

  const results = new Array(skillPaths.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= skillPaths.length) return;
      const skillPath = skillPaths[i];
      const rawUrl = `${RAW}/${owner}/${repo}/${ref}/${skillPath}`;
      const contentsUrl = `${API}/repos/${owner}/${repo}/contents/${skillPath}?ref=${ref}`;
      try {
        const fetchOnce = async (url, opts) => Promise.race([
          fetchFn(url, opts),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
        ]);
        // Contents API first (api.github.com is reachable where raw is blocked), raw as fallback.
        // Each attempt gets its own try/catch so a contents failure still tries raw.
        let res = null;
        try { res = await fetchOnce(contentsUrl, { headers: { accept: "application/vnd.github.raw" } }); } catch { /* try raw next */ }
        if (!res?.ok) {
          try { res = await fetchOnce(rawUrl); } catch { /* skip this skill */ }
        }
        if (!res?.ok) return;
        const raw = await res.text();
        const parsed = parseSkillFrontmatter(raw);
        if (!parsed) return;
        const skillDir = skillPath.replace(/\/SKILL\.md$/, "");
        results[i] = {
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
        };
      } catch { /* skip failed/timeout fetch */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, skillPaths.length) }, worker));

  return results.filter(Boolean);
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
