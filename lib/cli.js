import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { discover } from "./discover.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { readManifest, writeManifest, upsertSkill, removeSkill, findSkill } from "./manifest.js";
import { discoverLocal } from "./sources/local.js";
import { freezeSkill, unfreezeSkill } from "./freeze.js";
import { checkForUpdates, updateSkill } from "./update.js";
import { snapshotSkill, rollbackSkill } from "./rollback.js";
import { exportBundle, importBundle } from "./export.js";

function defaultHome() { return process.env.DSH_HOME || join(homedir(), ".dsh"); }

export async function runCli(argv, { out = console.log, dshHome = defaultHome() } = {}) {
  const [cmd, ...rest] = argv;
  const opts = parseFlags(rest);
  switch (cmd) {
    case "discover": return cmdDiscover(opts, { out, dshHome });
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
  const dir = opts.local;
  if (!dir) return null;
  const all = discoverLocal(dir);
  return all.find(c => c.name === opts.name) || null;
}

function cmdDiscover(opts, { out, dshHome }) {
  const cands = discover({ local: opts.local, q: opts.q });
  for (const c of cands) out(`${c.name}\t${c.description}`);
  return 0;
}

function cmdAudit(opts, { out, dshHome }) {
  const cand = findCandidate(opts, dshHome);
  if (!cand) { out(`not found: ${opts.name || ""}`); return 1; }
  const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
  out(`${r.verdict}\t${r.hash || "-"}`);
  for (const f of r.flags) out(`  ${f.severity}\t${f.kind}${f.line ? `:${f.line}` : ""}${f.with ? ` (vs ${f.with})` : ""}`);
  return r.verdict === "block" ? 1 : 0;
}

function cmdActivate(opts, { out, dshHome }) {
  const cand = findCandidate(opts, dshHome);
  if (!cand) { out(`not found: ${opts.name || ""}`); return 1; }
  if (cand.kind !== "bundle") {
    out(`activate supports directory bundles only in Phase 1a; "${cand.name}" is a flat .md - wrap it as <name>/SKILL.md`);
    return 1;
  }
  const r = audit(cand, { existingNames: Object.keys(readManifest(dshHome).skills), existingSkills: [] });
  if (r.verdict === "block") { out(`blocked: ${r.flags.map(f => f.kind).join(",")}`); return 1; }
  const act = activateSkill({ name: cand.name, sourceDir: cand.resourceBase, dshHome, mode: opts.mode });
  if (!act.ok) { out(`activate failed: ${act.error}`); return 1; }
  let m = readManifest(dshHome);
  m = upsertSkill(m, cand.name, {
    sourceKind: "local", sourceRef: opts.local, version: null, commit: null,
    activationMode: act.mode, activatedAt: new Date().toISOString(),
    frozenVersion: null, lastAudit: { verdict: r.verdict, hash: r.hash, at: new Date().toISOString(), flags: r.flags },
    status: "active",
  });
  writeManifest(dshHome, m);
  out(`activated ${cand.name} (${act.mode}) -> ${act.target}`);
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
