import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { discover } from "./discover.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { readManifest, writeManifest, upsertSkill, removeSkill, findSkill } from "./manifest.js";
import { discoverLocal } from "./sources/local.js";
import { discoverClaude } from "./sources/claude.js";
import { discoverCodex } from "./sources/codex.js";
import { discoverGithub, fetchGithubTarball, resolveTarballRoot } from "./sources/github.js";
import { discoverNpm, fetchTarball } from "./sources/npm.js";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { freezeSkill, unfreezeSkill } from "./freeze.js";
import { checkForUpdates, updateSkill } from "./update.js";
import { snapshotSkill, rollbackSkill } from "./rollback.js";
import { exportBundle, importBundle } from "./export.js";
import { searchMarket } from "./sources/market.js";

function defaultHome() { return process.env.DSH_HOME || join(homedir(), ".dsh"); }

export async function runCli(argv, { out = console.log, dshHome = defaultHome() } = {}) {
  const [cmd, ...rest] = argv;
  const opts = parseFlags(rest);
  switch (cmd) {
    case "discover": return await cmdDiscover(opts, { out, dshHome });
    case "audit": return cmdAudit(opts, { out, dshHome });
    case "activate": return cmdActivate(opts, { out, dshHome });
    case "list": return cmdList(opts, { out, dshHome });
    case "uninstall": return cmdUninstall(opts, { out, dshHome });
    case "freeze": return cmdFreeze(opts, { out, dshHome });
    case "unfreeze": return cmdUnfreeze(opts, { out, dshHome });
    case "update": return await cmdUpdate(opts, { out, dshHome });
    case "rollback": return await cmdRollback(opts, { out, dshHome });
    case "export": return await cmdExport(opts, { out, dshHome });
    case "import": return await cmdImport(opts, { out, dshHome });
    default:
      out("usage: skill-fusion <discover|audit|activate|list|uninstall|freeze|unfreeze|update|rollback|export|import> [flags]");
      out("  discover: --market <query> | --local <dir> | --claude <dir> | --codex <dir> [--q <query>]");
      out("  activate: --name <n> --local <dir> | --claude <dir> | --codex <dir> | --npm <pkg> | --github <owner/repo> [--ref <ref>]");
      return 2;
  }
}

function parseFlags(args) {
  const o = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) { o[a.slice(2)] = args[i + 1]; i++; }
  }
  return o;
}

function findCandidate(opts, dshHome) {
  const name = opts.name;
  if (!name) return null;
  if (opts.local) return discoverLocal(opts.local).find(c => c.name === name) || null;
  if (opts.claude) return discoverClaude(opts.claude || undefined).find(c => c.name === name) || null;
  if (opts.codex) return discoverCodex(opts.codex || undefined).find(c => c.name === name) || null;
  if (opts.npm) return null; // npm handled separately in activate
  if (opts.github) return null; // github handled separately in activate
  return null;
}

async function cmdDiscover(opts, { out, dshHome }) {
  if (opts.market) {
    const q = opts.market;
    const results = await searchMarket(q);
    if (results.length === 0) { out(`no market results for "${q}"`); return 0; }
    for (const r of results) {
      const src = r.sourceMarket === "github" ? "github" : "npm";
      const rank = r.rankKind === "stars" ? `${r.rankLabel}★` : `pop ${r.rankLabel}`;
      out(`${r.name}\t[${src} ${rank}]\t${r.description}`);
    }
    out("");
    out(`tip: discover inside a repo -> discover --github <owner/repo> --q <skill>`);
    out(`tip: inspect a package -> discover --npm <pkg>`);
    return 0;
  }
  const cands = discover({ local: opts.local, claude: opts.claude, codex: opts.codex, q: opts.q });
  for (const c of cands) out(`${c.name}\t${c.sourceKind}\t${c.description}`);
  return 0;
}

function cmdAudit(opts, { out, dshHome }) {
  const cand = findCandidate(opts, dshHome);
  if (!cand && !opts.npm && !opts.github) { out(`not found: ${opts.name || ""}`); return 1; }
  if (opts.npm) { out(`pending\tnpm audit deferred to activate`); return 0; }
  if (opts.github) { out(`pending\tgithub audit deferred to activate`); return 0; }
  const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
  out(`${r.verdict}\t${r.hash || "-"}`);
  for (const f of r.flags) out(`  ${f.severity}\t${f.kind}${f.line ? `:${f.line}` : ""}${f.with ? ` (vs ${f.with})` : ""}`);
  return r.verdict === "block" ? 1 : 0;
}

async function cmdActivate(opts, { out, dshHome }) {
  const name = opts.name;
  if (!name) { out("usage: activate --name <n> --local <dir> | --claude <dir> | --codex <dir> | --npm <pkg> | --github <owner/repo> [--ref <ref>]"); return 2; }

  let sourceKind, sourceRef, cand, sourceDir, auditResult, version = null, commit = null;

  if (opts.local) {
    sourceKind = "local"; sourceRef = opts.local;
    cand = discoverLocal(opts.local).find(c => c.name === name);
  } else if (opts.claude) {
    sourceKind = "claude"; sourceRef = opts.claude || undefined;
    cand = discoverClaude(opts.claude || undefined).find(c => c.name === name);
  } else if (opts.codex) {
    sourceKind = "codex"; sourceRef = opts.codex || undefined;
    cand = discoverCodex(opts.codex || undefined).find(c => c.name === name);
  } else if (opts.npm) {
    sourceKind = "npm"; sourceRef = opts.npm;
    const pkgCand = await discoverNpm(opts.npm.split("@")[0]);
    if (!pkgCand) { out(`npm: not found: ${opts.npm}`); return 1; }
    if (!pkgCand.tarballUrl) { out(`npm: no tarball`); return 1; }
    const cacheDir = join(dshHome, "skill-fusion", "cache", pkgCand.sourceRef);
    const fetchR = await fetchTarball(pkgCand.tarballUrl, cacheDir);
    if (!fetchR.ok) { out(`npm fetch failed: ${fetchR.error}`); return 1; }
    const pkgDir = join(cacheDir, "package");
    const candidates = [
      join(pkgDir, "skills", name, "SKILL.md"),
      join(pkgDir, "skill", name, "SKILL.md"),
      join(pkgDir, name, "SKILL.md"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) { sourceDir = join(p, ".."); break; }
    }
    if (!sourceDir) { out(`npm: skill not in tarball`); return 1; }
    const raw = readFileSync(join(sourceDir, "SKILL.md"), "utf8");
    const parsed = parseSkillFrontmatter(raw);
    if (!parsed) { out(`npm: invalid frontmatter`); return 1; }
    auditResult = audit({ parsed }, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
    version = opts.npm.split("@")[1] || pkgCand.version;
  } else if (opts.github) {
    sourceKind = "github";
    const ref = opts.ref || "main";
    sourceRef = `${opts.github}@${ref}`;
    const cands = await discoverGithub(opts.github, { ref });
    cand = cands.find(c => c.name === name);
    if (!cand) { out(`github: not found: ${name}`); return 1; }
    const cacheDir = join(dshHome, "skill-fusion", "cache", `${opts.github.replace("/", "-")}-${ref}`);
    const fetchR = await fetchGithubTarball(opts.github, ref, cacheDir);
    if (!fetchR.ok) { out(`github fetch failed: ${fetchR.error}`); return 1; }
    const pkgRoot = resolveTarballRoot(cacheDir);
    if (!pkgRoot) { out(`github: tarball extract failed`); return 1; }
    const skillMdPath = join(pkgRoot, cand.skillDir, "SKILL.md");
    if (!existsSync(skillMdPath)) { out(`github: skill not in tarball`); return 1; }
    sourceDir = join(pkgRoot, cand.skillDir);
    const raw = readFileSync(skillMdPath, "utf8");
    const parsed = parseSkillFrontmatter(raw);
    if (!parsed) { out(`github: invalid frontmatter`); return 1; }
    auditResult = audit({ parsed }, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
    version = ref;
    commit = cand.commit;
  } else {
    out("usage: activate --name <n> --local <dir> | --claude <dir> | --codex <dir> | --npm <pkg> | --github <owner/repo> [--ref <ref>]");
    return 2;
  }

  // For local/claude/codex: validate candidate
  if (cand) {
    if (cand.kind !== "bundle") { out(`activate supports directory bundles only; "${name}" is a flat .md - wrap it as <name>/SKILL.md`); return 1; }
    auditResult = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
    sourceDir = cand.resourceBase;
  }

  if (!sourceDir) { out(`could not resolve source directory`); return 1; }
  if (auditResult.verdict === "block") { out(`blocked: ${auditResult.flags.map(f => f.kind).join(",")}`); return 1; }

  const act = activateSkill({ name, sourceDir, dshHome, mode: opts.mode });
  if (!act.ok) { out(`activate failed: ${act.error}`); return 1; }
  let m = readManifest(dshHome);
  m = upsertSkill(m, name, {
    sourceKind, sourceRef, version, commit,
    activationMode: act.mode, activatedAt: new Date().toISOString(),
    frozenVersion: null,
    lastAudit: { verdict: auditResult.verdict, hash: auditResult.hash, at: new Date().toISOString(), flags: auditResult.flags },
    status: "active",
  });
  writeManifest(dshHome, m);
  out(`activated ${name} (${act.mode}) -> ${act.target}`);
  return 0;
}

function cmdList(opts, { out, dshHome }) {
  const m = readManifest(dshHome);
  const orphans = reconcileOrphans({ manifest: m, dshHome });
  for (const [name, e] of Object.entries(m.skills)) {
    const st = orphans.includes(name) ? "orphan" : e.status;
    const frozen = e.frozenVersion ? ` @${e.frozenVersion}` : "";
    out(`${name}\t${e.sourceKind}\t${e.activationMode}\t${st}${frozen}`);
  }
  return 0;
}

function cmdUninstall(opts, { out, dshHome }) {
  const name = opts.name;
  if (!name) { out("usage: uninstall --name <n>"); return 2; }
  removeActivation({ name, dshHome });
  let m = readManifest(dshHome);
  m = removeSkill(m, name);
  writeManifest(dshHome, m);
  out(`uninstalled ${name}`);
  return 0;
}

function cmdFreeze(opts, { out, dshHome }) {
  const { name, version } = opts;
  if (!name || !version) { out("usage: freeze --name <n> --version <v>"); return 2; }
  let m = readManifest(dshHome);
  if (!findSkill(m, name)) { out(`not found: ${name}`); return 1; }
  m = freezeSkill(m, name, version);
  writeManifest(dshHome, m);
  out(`frozen ${name}@${version}`);
  return 0;
}

function cmdUnfreeze(opts, { out, dshHome }) {
  const { name } = opts;
  if (!name) { out("usage: unfreeze --name <n>"); return 2; }
  let m = readManifest(dshHome);
  if (!findSkill(m, name)) { out(`not found: ${name}`); return 1; }
  m = unfreezeSkill(m, name);
  writeManifest(dshHome, m);
  out(`unfrozen ${name}`);
  return 0;
}

async function cmdUpdate(opts, { out, dshHome }) {
  const { name } = opts;
  let m = readManifest(dshHome);
  if (name) {
    await snapshotSkill(name, dshHome);
    const { manifest: m2, updated, error } = await updateSkill(m, name, dshHome);
    if (error) { out(`update failed: ${error}`); return 1; }
    writeManifest(dshHome, m2);
    out(updated ? `updated ${name}` : `no update for ${name}`);
    return 0;
  }
  const updates = await checkForUpdates(m, dshHome);
  if (updates.length === 0) { out("all up to date"); return 0; }
  for (const u of updates) {
    await snapshotSkill(u.name, dshHome);
    const { manifest: m2, updated, error } = await updateSkill(m, u.name, dshHome);
    if (!error && updated) m = m2;
  }
  writeManifest(dshHome, m);
  out(`updated ${updates.length} skill(s)`);
  return 0;
}

async function cmdRollback(opts, { out, dshHome }) {
  const { name } = opts;
  if (!name) { out("usage: rollback --name <n>"); return 2; }
  const m = readManifest(dshHome);
  const { manifest: m2, ok, error } = await rollbackSkill(m, name, dshHome);
  if (!ok) { out(`rollback failed: ${error}`); return 1; }
  writeManifest(dshHome, m2);
  out(`rolled back ${name}`);
  return 0;
}

async function cmdExport(opts, { out, dshHome }) {
  const { out: outPath } = opts;
  if (!outPath) { out("usage: export --out <path>"); return 2; }
  const m = readManifest(dshHome);
  const r = await exportBundle(m, dshHome, outPath);
  if (!r.ok) { out(`export failed: ${r.error}`); return 1; }
  out(`exported to ${outPath}`);
  return 0;
}

async function cmdImport(opts, { out, dshHome }) {
  const { from } = opts;
  if (!from) { out("usage: import --from <path>"); return 2; }
  const m = readManifest(dshHome);
  let bundle;
  try { bundle = JSON.parse(readFileSync(from, "utf8")); } catch (e) { out(`import failed: ${String(e)}`); return 1; }
  const r = await importBundle(bundle, dshHome, m);
  if (!r.ok) { out(`import failed: ${r.error}`); return 1; }
  out(`imported ${r.imported.length} skill(s)`);
  return 0;
}
