import { readManifest, writeManifest, upsertSkill, removeSkill } from "./manifest.js";
import { isSameOriginRequest } from "./same-origin.js";
import { discoverLocal } from "./sources/local.js";
import { discoverNpm, fetchTarball } from "./sources/npm.js";
import { discoverClaude } from "./sources/claude.js";
import { discoverCodex } from "./sources/codex.js";
import { discoverGithub, fetchGithubTarball, resolveTarballRoot } from "./sources/github.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { freezeSkill, unfreezeSkill } from "./freeze.js";
import { checkForUpdates, updateSkill } from "./update.js";
import { snapshotSkill, rollbackSkill } from "./rollback.js";
import { exportBundle, importBundle } from "./export.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PREFIX = "/api/skill-fusion";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function requireSameOrigin(req, res) {
  if (isSameOriginRequest(req)) return true;
  json(res, 403, { ok: false, error: "cross-site-request-rejected" });
  return false;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function skillFusionRoutes(dshHome) {
  return [
    {
      kind: "exact",
      path: `${PREFIX}/list`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const m = readManifest(dshHome);
        const orphans = reconcileOrphans({ manifest: m, dshHome });
        const skills = Object.entries(m.skills).map(([name, e]) => ({
          name, ...e, status: orphans.includes(name) ? "orphan" : e.status,
        }));
        json(res, 200, { ok: true, skills });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/discover`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const source = url.searchParams.get("source");
        const q = url.searchParams.get("q");
        let candidates = [];
        if (source === "local") {
          const path = url.searchParams.get("path");
          if (path) candidates = discoverLocal(path);
        } else if (source === "npm") {
          const name = url.searchParams.get("name");
          if (name) {
            const r = await discoverNpm(name);
            if (r) candidates = [r];
          }
        } else if (source === "claude") {
          const path = url.searchParams.get("path");
          candidates = discoverClaude(path || undefined);
        } else if (source === "codex") {
          const path = url.searchParams.get("path");
          candidates = discoverCodex(path || undefined);
        } else if (source === "github") {
          const repo = url.searchParams.get("repo");
          const ref = url.searchParams.get("ref") || "main";
          if (repo) {
            const r = await discoverGithub(repo, { ref });
            if (r) candidates = r;
          }
        }
        if (q) {
          const n = q.trim().toLowerCase();
          candidates = candidates.filter(c => c.name.toLowerCase().includes(n) || (c.description || "").toLowerCase().includes(n));
        }
        // Strip parsed from response (internal)
        candidates = candidates.map(({ parsed, ...rest }) => rest);
        json(res, 200, { ok: true, candidates });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/audit`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const source = url.searchParams.get("source");
        const name = url.searchParams.get("name");
        if (source === "local") {
          const path = url.searchParams.get("path");
          const cand = path ? discoverLocal(path).find(c => c.name === name) : null;
          if (!cand) return json(res, 404, { ok: false, error: "not-found" });
          const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
          return json(res, 200, { ok: true, verdict: r.verdict, flags: r.flags, hash: r.hash });
        }
        if (source === "claude") {
          const path = url.searchParams.get("path");
          const cand = discoverClaude(path || undefined).find(c => c.name === name);
          if (!cand) return json(res, 404, { ok: false, error: "not-found" });
          const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
          return json(res, 200, { ok: true, verdict: r.verdict, flags: r.flags, hash: r.hash });
        }
        if (source === "codex") {
          const path = url.searchParams.get("path");
          const cand = discoverCodex(path || undefined).find(c => c.name === name);
          if (!cand) return json(res, 404, { ok: false, error: "not-found" });
          const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
          return json(res, 200, { ok: true, verdict: r.verdict, flags: r.flags, hash: r.hash });
        }
        if (source === "npm") {
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          return json(res, 200, { ok: true, verdict: "pending", message: "npm audit requires fetch; activate will audit post-fetch" });
        }
        if (source === "github") {
          const repo = url.searchParams.get("repo");
          const ref = url.searchParams.get("ref") || "main";
          if (!repo) return json(res, 400, { ok: false, error: "missing-repo" });
          const cands = await discoverGithub(repo, { ref });
          const cand = cands.find(c => c.name === name);
          if (!cand) return json(res, 404, { ok: false, error: "not-found" });
          const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
          return json(res, 200, { ok: true, verdict: r.verdict, flags: r.flags, hash: r.hash });
        }
        json(res, 400, { ok: false, error: "unsupported-source" });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/activate`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { sourceKind, sourceRef, name } = body;
          if (!sourceKind || !sourceRef || !name) return json(res, 400, { ok: false, error: "missing-fields" });

          let sourceDir, auditResult, commit = null, version = null;
          if (sourceKind === "local") {
            const cand = discoverLocal(sourceRef).find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (cand.kind !== "bundle") return json(res, 422, { ok: false, error: "flat-skill-not-supported", message: "wrap as <name>/SKILL.md" });
            auditResult = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            sourceDir = cand.resourceBase;
          } else if (sourceKind === "claude") {
            const cand = discoverClaude(sourceRef || undefined).find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (cand.kind !== "bundle") return json(res, 422, { ok: false, error: "flat-skill-not-supported" });
            auditResult = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            sourceDir = cand.resourceBase;
          } else if (sourceKind === "codex") {
            const cand = discoverCodex(sourceRef || undefined).find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (cand.kind !== "bundle") return json(res, 422, { ok: false, error: "flat-skill-not-supported" });
            auditResult = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            sourceDir = cand.resourceBase;
          } else if (sourceKind === "npm") {
            const pkgName = sourceRef.split("@")[0];
            const cand = await discoverNpm(pkgName);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (!cand.tarballUrl) return json(res, 422, { ok: false, error: "no-tarball" });
            const cacheDir = join(dshHome, "skill-fusion", "cache", cand.sourceRef);
            const fetchR = await fetchTarball(cand.tarballUrl, cacheDir);
            if (!fetchR.ok) return json(res, 500, { ok: false, error: fetchR.error });
            // Find SKILL.md in extracted dir
            const pkgDir = join(cacheDir, "package");
            let skillDir = null;
            const candidates = [
              join(pkgDir, "skills", name, "SKILL.md"),
              join(pkgDir, "skill", name, "SKILL.md"),
              join(pkgDir, name, "SKILL.md"),
            ];
            for (const p of candidates) {
              if (existsSync(p)) { skillDir = join(p, ".."); break; }
            }
            if (!skillDir) return json(res, 404, { ok: false, error: "skill-not-in-tarball" });
            sourceDir = skillDir;
            const raw = readFileSync(join(sourceDir, "SKILL.md"), "utf8");
            const parsed = parseSkillFrontmatter(raw);
            if (!parsed) return json(res, 422, { ok: false, error: "invalid-frontmatter" });
            auditResult = audit({ parsed }, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            version = sourceRef.split("@")[1];
          } else if (sourceKind === "github") {
            // sourceRef = "owner/repo@ref"
            const [ownerRepo, ref] = sourceRef.includes("@") ? sourceRef.split("@") : [sourceRef, "main"];
            const cands = await discoverGithub(ownerRepo, { ref });
            const cand = cands.find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            // Download tarball
            const cacheDir = join(dshHome, "skill-fusion", "cache", `${ownerRepo.replace("/", "-")}-${ref}`);
            const fetchR = await fetchGithubTarball(ownerRepo, ref, cacheDir);
            if (!fetchR.ok) return json(res, 500, { ok: false, error: fetchR.error });
            // Resolve extracted root (github tarball extracts to owner-repo-ref-<sha>/)
            const pkgRoot = resolveTarballRoot(cacheDir);
            if (!pkgRoot) return json(res, 500, { ok: false, error: "tarball-extract-failed" });
            // Find skill dir within extracted root
            const skillMdPath = join(pkgRoot, cand.skillDir, "SKILL.md");
            if (!existsSync(skillMdPath)) return json(res, 404, { ok: false, error: "skill-not-in-tarball" });
            sourceDir = join(pkgRoot, cand.skillDir);
            const raw = readFileSync(skillMdPath, "utf8");
            const parsed = parseSkillFrontmatter(raw);
            if (!parsed) return json(res, 422, { ok: false, error: "invalid-frontmatter" });
            auditResult = audit({ parsed }, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
            if (auditResult.verdict === "block") return json(res, 422, { ok: false, error: "blocked", flags: auditResult.flags });
            version = ref;
            commit = cand.commit;
          } else {
            return json(res, 400, { ok: false, error: "unsupported-source" });
          }

          const act = activateSkill({ name, sourceDir, dshHome });
          if (!act.ok) return json(res, 409, { ok: false, error: act.error });

          let m = readManifest(dshHome);
          m = upsertSkill(m, name, {
            sourceKind, sourceRef,
            version: version !== null ? version : (sourceKind === "npm" ? sourceRef.split("@")[1] : null),
            commit, activationMode: act.mode, activatedAt: new Date().toISOString(),
            frozenVersion: null,
            lastAudit: { verdict: auditResult.verdict, hash: auditResult.hash, at: new Date().toISOString(), flags: auditResult.flags },
            status: "active",
          });
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, activated: name, mode: act.mode, target: act.target });
        } catch (e) {
          json(res, 500, { ok: false, error: String(e) });
        }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/uninstall`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          removeActivation({ name, dshHome });
          let m = readManifest(dshHome);
          m = removeSkill(m, name);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, uninstalled: name });
        } catch (e) {
          json(res, 500, { ok: false, error: String(e) });
        }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/freeze`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name, version } = body;
          if (!name || !version) return json(res, 400, { ok: false, error: "missing-fields" });
          let m = readManifest(dshHome);
          m = freezeSkill(m, name, version);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, frozen: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/unfreeze`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          let m = readManifest(dshHome);
          m = unfreezeSkill(m, name);
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, unfrozen: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/update`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          let m = readManifest(dshHome);
          if (name) {
            // snapshot only if none exists (preserve pre-update state for rollback)
            const snapDir = join(dshHome, "skill-fusion", "snapshots", name);
            if (!existsSync(snapDir)) await snapshotSkill(name, dshHome);
            const { manifest: m2, updated, error } = await updateSkill(m, name, dshHome);
            if (error) return json(res, 500, { ok: false, error });
            writeManifest(dshHome, m2);
            return json(res, 200, { ok: true, updated, name });
          }
          const updates = await checkForUpdates(m, dshHome);
          for (const u of updates) {
            const snapDir = join(dshHome, "skill-fusion", "snapshots", u.name);
            if (!existsSync(snapDir)) await snapshotSkill(u.name, dshHome);
            const { manifest: m2 } = await updateSkill(m, u.name, dshHome);
            m = m2;
          }
          writeManifest(dshHome, m);
          json(res, 200, { ok: true, updated: updates.length });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/rollback`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { name } = body;
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          const m = readManifest(dshHome);
          const { manifest: m2, ok, error } = await rollbackSkill(m, name, dshHome);
          if (!ok) return json(res, 500, { ok: false, error });
          writeManifest(dshHome, m2);
          json(res, 200, { ok: true, rolledBack: name });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/export`,
      handler: async (req, res) => {
        if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
        const m = readManifest(dshHome);
        const skills = {};
        for (const [name, entry] of Object.entries(m.skills)) {
          const target = join(dshHome, "skills", name);
          let content = null;
          if (existsSync(join(target, "SKILL.md"))) content = readFileSync(join(target, "SKILL.md"), "utf8");
          skills[name] = { ...entry, content };
        }
        json(res, 200, { ok: true, bundle: { version: 1, exportedAt: new Date().toISOString(), skills } });
      },
    },
    {
      kind: "exact",
      path: `${PREFIX}/import`,
      handler: async (req, res) => {
        if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
        if (!requireSameOrigin(req, res)) return;
        try {
          const body = await readBody(req);
          const { bundle } = body;
          if (!bundle) return json(res, 400, { ok: false, error: "missing-bundle" });
          const m = readManifest(dshHome);
          const r = await importBundle(bundle, dshHome, m);
          if (!r.ok) return json(res, 500, { ok: false, error: r.error });
          json(res, 200, { ok: true, imported: r.imported.length });
        } catch (e) { json(res, 500, { ok: false, error: String(e) }); }
      },
    },
  ];
}
