import { readManifest, writeManifest, upsertSkill, removeSkill } from "./manifest.js";
import { isSameOriginRequest } from "./same-origin.js";
import { discoverLocal } from "./sources/local.js";
import { discoverNpm, fetchTarball } from "./sources/npm.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { parseSkillFrontmatter } from "./frontmatter.js";
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
        if (source === "npm") {
          if (!name) return json(res, 400, { ok: false, error: "missing-name" });
          return json(res, 200, { ok: true, verdict: "pending", message: "npm audit requires fetch; activate will audit post-fetch" });
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

          let sourceDir, auditResult;
          if (sourceKind === "local") {
            const cand = discoverLocal(sourceRef).find(c => c.name === name);
            if (!cand) return json(res, 404, { ok: false, error: "not-found" });
            if (cand.kind !== "bundle") return json(res, 422, { ok: false, error: "flat-skill-not-supported", message: "wrap as <name>/SKILL.md" });
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
          } else {
            return json(res, 400, { ok: false, error: "unsupported-source" });
          }

          const act = activateSkill({ name, sourceDir, dshHome });
          if (!act.ok) return json(res, 409, { ok: false, error: act.error });

          let m = readManifest(dshHome);
          m = upsertSkill(m, name, {
            sourceKind, sourceRef, version: sourceKind === "npm" ? sourceRef.split("@")[1] : null,
            commit: null, activationMode: act.mode, activatedAt: new Date().toISOString(),
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
  ];
}
