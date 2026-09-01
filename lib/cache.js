import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { searchMarket } from "./sources/market.js";
import { discoverGithub } from "./sources/github.js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Bump when the cached payload shape changes (e.g. new fields like trust),
// so stale entries are automatically invalidated instead of served.
const SCHEMA = "v2";

function cacheDir(dshHome) { return join(dshHome, "skill-fusion", "cache", "search"); }
function cacheKey(parts) {
  return createHash("sha256").update([SCHEMA, ...parts].join("|")).digest("hex").slice(0, 24) + ".json";
}

/** Read a cache entry; null on miss or expiry (mtime older than ttlMs). */
export function readCache(dshHome, key, ttlMs = DEFAULT_TTL_MS) {
  const p = join(cacheDir(dshHome), key);
  try {
    if (!existsSync(p)) return null;
    if (Date.now() - statSync(p).mtimeMs > ttlMs) return null;
    return JSON.parse(readFileSync(p, "utf8"));
  } catch { return null; }
}

/** Write a cache entry (best-effort; never throws). */
export function writeCache(dshHome, key, data) {
  try {
    mkdirSync(cacheDir(dshHome), { recursive: true });
    writeFileSync(join(cacheDir(dshHome), key), JSON.stringify(data), "utf8");
  } catch { /* cache write failure must not break search */ }
}

/**
 * Market search with a local cache: first query hits the network, repeat
 * queries within the TTL are served from ~/.dsh/skill-fusion/cache/search/.
 * Pass fresh=true to bypass the cache (manual refresh).
 */
export async function cachedSearchMarket(query, { page = 1, dshHome, ttlMs = DEFAULT_TTL_MS, fresh = false, fetchFn = globalThis.fetch } = {}) {
  const key = cacheKey(["market", query || "", String(page)]);
  if (dshHome && !fresh) {
    const hit = readCache(dshHome, key, ttlMs);
    if (hit) return { candidates: hit, cached: true };
  }
  const candidates = await searchMarket(query, { page, fetchFn });
  if (dshHome) writeCache(dshHome, key, stripInternal(candidates));
  return { candidates, cached: false };
}

/** Repo inspection (skills inside a GitHub repo) with a local cache.
 *  When dshHome is set, discovery uses a shared tarball cache dir — the same
 *  one activation reuses — so inspect+activate downloads the repo only once. */
export async function cachedDiscoverGithub(ownerRepo, { ref = "main", dshHome, ttlMs = DEFAULT_TTL_MS, fresh = false, fetchFn = globalThis.fetch } = {}) {
  const key = cacheKey(["ghrepo", ownerRepo, ref]);
  if (dshHome && !fresh) {
    const hit = readCache(dshHome, key, ttlMs);
    if (hit) return { candidates: hit, cached: true };
  }
  const cacheDir = dshHome ? githubCacheDir(dshHome, ownerRepo, ref) : undefined;
  const candidates = await discoverGithub(ownerRepo, { ref, cacheDir, fetchFn });
  if (dshHome) writeCache(dshHome, key, stripInternal(candidates));
  return { candidates, cached: false };
}

/** Shared tarball cache dir for a github repo@ref (inspect + activate). */
export function githubCacheDir(dshHome, ownerRepo, ref) {
  return join(dshHome, "skill-fusion", "cache", `${ownerRepo.replace("/", "-")}-${ref}`);
}

/** Shared tarball cache dir for an npm package (discover + activate). */
export function npmCacheDir(dshHome, pkgName) {
  return join(dshHome, "skill-fusion", "cache", `npm-${pkgName.replace(/[/@]/g, "-")}`);
}

/** Strip internal-only fields (parsed frontmatter) before caching. */
function stripInternal(candidates) {
  return candidates.map(({ parsed, ...rest }) => rest);
}
