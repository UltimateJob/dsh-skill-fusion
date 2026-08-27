import { searchGithubRepos } from "./github.js";
import { searchNpmPackages } from "./npm.js";

// Well-known, high-quality skill-collection repos shown on the market homepage.
// Enriched live with star counts on load (falls back gracefully if a fetch fails).
const FEATURED_REPOS = [
  "obra/superpowers",
  "wshobson/agents",
  "anthropics/skills",
  "davila7/claude-code-templates",
  "VoltAgent/awesome-claude-code-subagents",
];

const FEATURED_QUERIES = ["claude skill", "claude code skill", "agent skill"];

/**
 * Aggregate skill-market search across GitHub repos and npm packages.
 * Each source returns ranked candidates (stars / popularity).
 *
 * With an empty query, returns a featured homepage: the curated well-known
 * collections (enriched with live stars) merged with trending search results.
 *
 * @param {string} query - search keywords (empty → featured homepage)
 * @param {object} opts - { limit, fetchFn }
 * @returns {Array} combined candidates, ranked (github repos by stars first)
 */
export async function searchMarket(query, { limit = 10, fetchFn = globalThis.fetch } = {}) {
  const q = (query || "").trim();
  if (!q) return searchFeatured({ limit, fetchFn });

  const [repos, pkgs] = await Promise.all([
    searchGithubRepos(q, { limit, fetchFn }),
    searchNpmPackages(q, { limit, fetchFn }),
  ]);
  return dedupeRanked([...repos, ...pkgs]);
}

/**
 * Featured market homepage (empty query): curated collections + trending search.
 * Repos sorted by stars descending; npm packages appended after repos.
 */
async function searchFeatured({ limit = 10, fetchFn = globalThis.fetch } = {}) {
  // Run trending queries in parallel + resolve featured repos' live star counts
  const trendingPromises = FEATURED_QUERIES.map(q => searchGithubRepos(q, { limit: Math.ceil(limit / 2), fetchFn }));
  const featuredPromises = FEATURED_REPOS.map(repo => fetchRepoMeta(repo, fetchFn));
  const [trendingLists, featuredList] = await Promise.all([
    Promise.all(trendingPromises),
    Promise.all(featuredPromises),
  ]);

  const featured = featuredList.filter(Boolean).map(r => ({ ...r, featured: true }));
  const trending = trendingLists.flat();
  const combined = dedupeRanked([...featured, ...trending]);
  return combined.slice(0, Math.max(limit * 2, 20));
}

/**
 * Fetch live metadata for a single repo (for the featured carousel).
 * Returns a ranked repo candidate, or null on error.
 */
async function fetchRepoMeta(ownerRepo, fetchFn) {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) return null;
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  let res;
  try { res = await fetchFn(url); } catch { return null; }
  if (!res?.ok) return null;
  const it = await res.json();
  if (!it?.full_name) return null;
  return {
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
  };
}

function formatStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return String(n);
}

/** Dedupe by name (first wins), sort github repos by stars desc, npm after. */
function dedupeRanked(list) {
  const seen = new Set();
  const repos = [];
  const pkgs = [];
  for (const c of list) {
    if (!c || seen.has(c.name)) continue;
    seen.add(c.name);
    (c.sourceMarket === "npm" ? pkgs : repos).push(c);
  }
  repos.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  pkgs.sort((a, b) => (b.rank || 0) - (a.rank || 0));
  return [...repos, ...pkgs];
}
