import { searchGithubRepos } from "./github.js";
import { searchNpmPackages } from "./npm.js";

/**
 * Aggregate skill-market search across GitHub repos and npm packages.
 * Each source returns ranked candidates (stars / popularity).
 *
 * @param {string} query - search keywords
 * @param {object} opts - { limit, fetchFn }
 * @returns {Array} combined candidates, github repos (stars) before npm packages (popularity)
 */
export async function searchMarket(query, { limit = 10, fetchFn = globalThis.fetch } = {}) {
  if (!query || !query.trim()) return [];
  const [repos, pkgs] = await Promise.all([
    searchGithubRepos(query, { limit, fetchFn }),
    searchNpmPackages(query, { limit, fetchFn }),
  ]);
  // Dedupe by name, keep first occurrence (github wins on ties)
  const seen = new Set();
  const combined = [];
  for (const c of [...repos, ...pkgs]) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    combined.push(c);
  }
  return combined;
}
