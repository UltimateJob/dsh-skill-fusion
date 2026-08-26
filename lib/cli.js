import { join } from "node:path";
import { homedir } from "node:os";
import { discover } from "./discover.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation, reconcileOrphans } from "./activate.js";
import { readManifest, writeManifest, upsertSkill, removeSkill } from "./manifest.js";
import { discoverLocal } from "./sources/local.js";

function defaultHome() { return process.env.DSH_HOME || join(homedir(), ".dsh"); }

export function runCli(argv, { out = console.log, dshHome = defaultHome() } = {}) {
  const [cmd, ...rest] = argv;
  const opts = parseFlags(rest);
  switch (cmd) {
    case "discover": return cmdDiscover(opts, { out, dshHome });
    case "audit": return cmdAudit(opts, { out, dshHome });
    case "activate": return cmdActivate(opts, { out, dshHome });
    case "list": return cmdList(opts, { out, dshHome });
    case "uninstall": return cmdUninstall(opts, { out, dshHome });
    default:
      out("usage: skill-fusion <discover|audit|activate|list|uninstall> [flags]");
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
    out(`${name}\t${e.sourceKind}\t${e.activationMode}\t${st}`);
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
