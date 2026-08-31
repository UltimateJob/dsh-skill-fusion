import { join } from "node:path";
import { createHash } from "node:crypto";
import { readCache, writeCache } from "./cache.js";

const RAW = "https://raw.githubusercontent.com";
const MAX_README_CHARS = 4000;

/**
 * Candidate README/SKILL file paths for a repo dir, localized variants first.
 * lang "zh" tries zh-CN/zh variants before the plain base file; other langs
 * only try the base file.
 *
 * @param {string} basePath - "" for repo root README, or a skill dir like "skills/foo"
 * @param {string} lang - preferred language ("zh" enables Chinese variants)
 * @returns {string[]} candidate repo-relative paths in preference order
 */
export function readmeCandidates(basePath, lang = "zh") {
  const base = basePath ? `${basePath.replace(/\/+$/, "")}/` : "";
  const file = basePath ? "SKILL" : "README";
  const names = lang === "zh"
    ? [`${file}.zh-CN.md`, `${file}.zh.md`, `${file}_zh.md`, `${file}.zh-Hans.md`, `${file}.zh-Hans-CN.md`, `${file}-CN.md`, `${file}_CN.md`, `${file}.md`]
    : [`${file}.md`];
  return names.map(n => base + n);
}

/**
 * Fetch the first existing localized README/SKILL for a GitHub repo dir.
 * Results are cached locally (24h TTL) when dshHome is provided.
 *
 * @returns {object|null} { text, lang, path } or null when nothing exists
 */
export async function fetchLocalizedReadme(ownerRepo, ref, basePath, { lang = "zh", fetchFn = globalThis.fetch, dshHome } = {}) {
  const [owner, repo] = (ownerRepo || "").split("/");
  if (!owner || !repo) return null;

  const key = createHash("sha256").update(["readme", ownerRepo, ref, basePath || "", lang].join("|")).digest("hex").slice(0, 24) + ".json";
  if (dshHome) {
    const hit = readCache(dshHome, key);
    if (hit) return { ...hit, cached: true };
  }

  const candidates = readmeCandidates(basePath, lang);
  for (let i = 0; i < candidates.length; i++) {
    const path = candidates[i];
    const url = `${RAW}/${owner}/${repo}/${ref}/${path}`;
    let res;
    try { res = await fetchFn(url); } catch { continue; }
    if (!res?.ok) continue;
    const text = (await res.text()).slice(0, MAX_README_CHARS);
    // The last candidate is always the plain base file (English fallback).
    const result = { text, lang: i < candidates.length - 1 ? lang : "en", path };
    if (dshHome) writeCache(dshHome, key, result);
    return result;
  }
  return null;
}
