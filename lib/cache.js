import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { searchMarket } from "./sources/market.js";
import { discoverGithub } from "./sources/github.js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheDir(dshHome) { return join(dshHome, "skill-fusion", "cache", "search"); }
function cacheKey(parts) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24) + ".json";
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

/** Repo inspection (skills inside a GitHub repo) with a local cache. */
export async function cachedDiscoverGithub(ownerRepo, { ref = "main", dshHome, ttlMs = DEFAULT_TTL_MS, fresh = false, fetchFn = globalThis.fetch } = {}) {
  const key = cacheKey(["ghrepo", ownerRepo, ref]);
  if (dshHome && !fresh) {
    const hit = readCache(dshHome, key, ttlMs);
    if (hit) return { candidates: hit, cached: true };
  }
  const candidates = await discoverGithub(ownerRepo, { ref, fetchFn });
  if (dshHome) writeCache(dshHome, key, stripInternal(candidates));
  return { candidates, cached: false };
}

/** Strip internal-only fields (parsed frontmatter) before caching. */
function stripInternal(candidates) {
  return candidates.map(({ parsed, ...rest }) => rest);
}
