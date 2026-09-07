import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { discoverNpm } from "./sources/npm.js";
import { discoverGithub, fetchGithubTarball, resolveTarballRoot } from "./sources/github.js";
import { npmCacheDir, githubCacheDir } from "./cache.js";
import { parseSkillFrontmatter } from "./frontmatter.js";

/**
 * Shared resolution for the two remote (tarball-backed) sources, npm and
 * github. Used by the CLI and the HTTP routes for audit + activate + update,
 * so the fetch → extract → locate → parse flow exists exactly once.
 *
 * Tarball extractions are shared with discovery via the fusion cache dirs —
 * a skill that was inspected in the GUI activates without a second download.
 */

/**
 * Parse an npm package reference, scoped packages included:
 *   "pkg" → { name: "pkg" }        "pkg@1.2.0" → { name, version }
 *   "@scope/pkg" → { name }        "@scope/pkg@1.2.0" → { name, version }
 * (A naive split("@") breaks scoped names — "" before the first "@".)
 */
export function parsePackageRef(ref) {
  const m = /^(@[^/@]+\/)?[^@]+/.exec(ref || "");
  if (!m) return { name: null, version: null };
  const name = m[0];
  const version = ref.slice(name.length).replace(/^@/, "") || null;
  return { name, version };
}

/** Parse "owner/repo@ref" — the ref is after the LAST "@", default "main". */
export function parseRepoRef(sourceRef) {
  const at = (sourceRef || "").lastIndexOf("@");
  if (at <= 0) return { ownerRepo: sourceRef, ref: "main" };
  return { ownerRepo: sourceRef.slice(0, at), ref: sourceRef.slice(at + 1) || "main" };
}

/**
 * Resolve a named skill inside a remote source to an on-disk directory +
 * parsed frontmatter. Downloads and extracts the tarball when the shared
 * cache doesn't have it (or fresh=true forces a re-download, e.g. update).
 *
 * @returns {object} { ok: true, parsed, sourceDir, version, commit } |
 *                   { ok: false, status, error }  (status: suggested HTTP/CLI semantics)
 */
export async function resolveRemoteCandidate({ sourceKind, sourceRef, name, dshHome, fresh = false, fetchFn = globalThis.fetch } = {}) {
  if (sourceKind === "npm") {
    const { name: pkgName, version: refVersion } = parsePackageRef(sourceRef);
    if (!pkgName) return { ok: false, status: 400, error: "invalid-package-ref" };
    const cacheDir = npmCacheDir(dshHome, pkgName);
    if (fresh) rmSync(cacheDir, { recursive: true, force: true });
    const cands = await discoverNpm(pkgName, { cacheDir, fetchFn });
    if (!Array.isArray(cands) || cands.length === 0) return { ok: false, status: 404, error: "not-found" };
    const cand = cands.find(c => c.name === name);
    if (!cand) return { ok: false, status: 404, error: "not-found" };
    const sourceDir = join(cacheDir, "package", cand.skillDir);
    return readParsed(sourceDir, { version: cand.version || refVersion, commit: null });
  }
  if (sourceKind === "github") {
    const { ownerRepo, ref } = parseRepoRef(sourceRef);
    const cacheDir = githubCacheDir(dshHome, ownerRepo, ref);
    if (fresh) rmSync(cacheDir, { recursive: true, force: true });
    const cands = await discoverGithub(ownerRepo, { ref, cacheDir, fetchFn });
    const cand = cands.find(c => c.name === name);
    if (!cand) return { ok: false, status: 404, error: "not-found" };
    let pkgRoot = resolveTarballRoot(cacheDir);
    if (!pkgRoot) {
      const fetchR = await fetchGithubTarball(ownerRepo, ref, cacheDir, { fetchFn });
      if (!fetchR.ok) return { ok: false, status: 502, error: fetchR.error };
      pkgRoot = resolveTarballRoot(cacheDir);
    }
    if (!pkgRoot) return { ok: false, status: 500, error: "tarball-extract-failed" };
    const sourceDir = join(pkgRoot, cand.skillDir);
    return readParsed(sourceDir, { version: ref, commit: cand.commit || null });
  }
  return { ok: false, status: 400, error: "unsupported-source" };
}

function readParsed(sourceDir, { version, commit }) {
  const skillMdPath = join(sourceDir, "SKILL.md");
  if (!existsSync(skillMdPath)) return { ok: false, status: 404, error: "skill-not-in-package" };
  const parsed = parseSkillFrontmatter(readFileSync(skillMdPath, "utf8"));
  if (!parsed) return { ok: false, status: 422, error: "invalid-frontmatter" };
  return { ok: true, parsed, sourceDir, version, commit };
}
