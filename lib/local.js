import { readdirSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { setFrontmatterDisabled, isDisabledByFrontmatter } from "./frontmatter-edit.js";
import { readManifest } from "./manifest.js";

function skillsDir(dshHome) { return join(dshHome, "skills"); }
function legacyDisabledDir(dshHome) { return join(dshHome, "skill-fusion", "disabled"); }
function trashDir(dshHome) { return join(dshHome, "skill-fusion", "trash"); }
function profilesDir(dshHome) { return join(dshHome, "profiles"); }

/** Nearest ancestor dir containing .git (project root convention). */
function findProjectRoot(cwd) {
  let dir = cwd;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return cwd;
    dir = parent;
  }
}

/**
 * All skill source roots, following dsh-skill-filesystem conventions:
 * project (.dsh/skills, .agents/skills) → user (~/.dsh/skills,
 * ~/.agents/skills) → plugin-shipped (profile node_modules/∗/skills).
 */
export function skillRoots(dshHome, { cwd } = {}) {
  const roots = [];
  if (cwd) {
    const projectRoot = findProjectRoot(cwd);
    roots.push(
      { path: join(projectRoot, ".dsh", "skills"), source: "project-dsh", writable: true },
      { path: join(projectRoot, ".agents", "skills"), source: "project-agents", writable: true },
    );
  }
  roots.push(
    { path: skillsDir(dshHome), source: "user-dsh", writable: true },
    { path: join(homedir(), ".agents", "skills"), source: "user-agents", writable: true },
  );
  roots.push({ path: null, source: "plugin", writable: false }); // expanded at scan time
  return roots;
}

/** Plugin-shipped skill dirs: ~/.dsh/profiles/<profile>/node_modules/<pkg>/skills */
function pluginSkillDirs(dshHome) {
  const out = [];
  let profiles;
  try { profiles = readdirSync(profilesDir(dshHome), { withFileTypes: true }); } catch { return out; }
  for (const p of profiles) {
    if (!p.isDirectory()) continue;
    const nm = join(profilesDir(dshHome), p.name, "node_modules");
    let pkgs;
    try { pkgs = readdirSync(nm, { withFileTypes: true }); } catch { continue; }
    for (const pkg of pkgs) {
      if (pkg.name.startsWith("@")) {
        let inner;
        try { inner = readdirSync(join(nm, pkg.name), { withFileTypes: true }); } catch { continue; }
        for (const sub of inner) {
          const skillsPath = join(nm, pkg.name, sub.name, "skills");
          if (existsSync(skillsPath)) out.push(skillsPath);
        }
      } else {
        const skillsPath = join(nm, pkg.name, "skills");
        if (existsSync(skillsPath)) out.push(skillsPath);
      }
    }
  }
  return out;
}

function scanDir(dir, { source, writable, enabledOverride = null, trashed = false }) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    if (e.name.startsWith(".")) continue;
    const skillPath = join(dir, e.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    let description = "";
    let enabled = true;
    try {
      const raw = readFileSync(skillPath, "utf8");
      const parsed = parseSkillFrontmatter(raw);
      if (parsed) description = parsed.description || "";
      enabled = !isDisabledByFrontmatter(raw);
    } catch { /* still list it */ }
    out.push({
      name: e.name,
      description,
      enabled: enabledOverride !== null ? enabledOverride : enabled,
      source,
      writable,
      trashed,
      linked: e.isSymbolicLink(),
      path: join(dir, e.name),
    });
  }
  return out;
}

/**
 * List all skills across every source root. Each entry:
 * { name, description, enabled, managed, source, writable, trashed, linked, path }
 * managed = has a fusion manifest entry. Trashed skills live in
 * ~/.dsh/skill-fusion/trash/ (recoverable). Legacy disabled-dir entries are
 * still listed (enabled=false) for backward compatibility.
 */
export function listLocalSkills(dshHome, { cwd } = {}) {
  const manifest = readManifest(dshHome);
  const seen = new Set();
  const out = [];
  for (const root of skillRoots(dshHome, { cwd })) {
    const dirs = root.source === "plugin" ? pluginSkillDirs(dshHome) : [root.path];
    for (const dir of dirs) {
      if (!dir) continue;
      for (const sk of scanDir(dir, { source: root.source, writable: root.writable })) {
        if (seen.has(sk.name)) continue; // first root wins (rank order)
        seen.add(sk.name);
        sk.managed = !!findSkillEntry(manifest, sk.name);
        out.push(sk);
      }
    }
  }
  // Legacy move-to-disabled entries (pre-frontmatter toggle)
  for (const sk of scanDir(legacyDisabledDir(dshHome), { source: "user-dsh", writable: true, enabledOverride: false })) {
    if (seen.has(sk.name)) continue;
    seen.add(sk.name);
    sk.managed = !!findSkillEntry(manifest, sk.name);
    out.push(sk);
  }
  // Trash (recoverable deletes)
  for (const sk of scanDir(trashDir(dshHome), { source: "user-dsh", writable: true, enabledOverride: false, trashed: true })) {
    sk.managed = !!findSkillEntry(manifest, sk.name);
    sk.trashed = true;
    out.push(sk);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function findSkillEntry(manifest, name) {
  if (!manifest) return null;
  const skills = manifest.skills || manifest;
  return skills[name] || null;
}

/**
 * Audit context: the skills an audit must check conflicts against — every
 * skill DSH can see across all roots (manifest-managed + locally installed),
 * not just fusion-managed ones. existingNames feeds name-conflict blocks;
 * existingSkills feeds trigger-overlap warnings.
 */
export function auditContext(dshHome, { cwd, excludeName } = {}) {
  const local = listLocalSkills(dshHome, { cwd });
  const names = new Set(Object.keys(readManifest(dshHome).skills));
  for (const s of local) names.add(s.name);
  if (excludeName) names.delete(excludeName);
  return {
    existingNames: [...names],
    existingSkills: local
      .filter(s => s.name !== excludeName)
      .map(s => ({ name: s.name, description: s.description })),
  };
}

/** Find a skill dir by name across writable roots (rank order). */
function locateSkill(dshHome, name, cwd) {
  for (const root of skillRoots(dshHome, { cwd })) {
    if (!root.writable || !root.path) continue;
    const p = join(root.path, name, "SKILL.md");
    if (existsSync(p)) return { skillPath: p, root };
  }
  return null;
}

/**
 * Enable/disable a skill by rewriting `disable-model-invocation` in its
 * SKILL.md frontmatter — the DSH-native toggle (hot-reloaded by the skill
 * catalog watcher; no files move). Skills parked in the legacy disabled dir
 * move back on enable for backward compatibility.
 */
export function setSkillEnabled(dshHome, name, enabled, { cwd } = {}) {
  // Legacy: skills parked in the disabled dir move back on enable.
  const legacyPath = join(legacyDisabledDir(dshHome), name, "SKILL.md");
  if (existsSync(legacyPath) && enabled) {
    mkdirSync(skillsDir(dshHome), { recursive: true });
    renameSync(join(legacyDisabledDir(dshHome), name), join(skillsDir(dshHome), name));
    return { ok: true, name, enabled, via: "move" };
  }
  const found = locateSkill(dshHome, name, cwd);
  if (!found) return { ok: false, error: "not-found" };
  try {
    const raw = readFileSync(found.skillPath, "utf8");
    const updated = setFrontmatterDisabled(raw, !enabled);
    if (updated === null) return { ok: false, error: "no-frontmatter" };
    writeFileSync(found.skillPath, updated, "utf8");
    return { ok: true, name, enabled, via: "frontmatter" };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/** Create a new skill scaffold. root: "user" (default) or "project". */
export function createSkill(dshHome, { name, description = "", root = "user", cwd } = {}) {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) return { ok: false, error: "invalid-name" };
  const base = root === "project"
    ? join(findProjectRoot(cwd || process.cwd()), ".dsh", "skills")
    : skillsDir(dshHome);
  const dir = join(base, name);
  if (existsSync(dir)) return { ok: false, error: "exists" };
  mkdirSync(dir, { recursive: true });
  const title = name.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  writeFileSync(join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description || "TODO: describe when to use this skill"}\n---\n\n# ${title}\n\nTODO: write the skill instructions here.\n`, "utf8");
  return { ok: true, name, path: dir };
}

/** Move a skill into the fusion trash (recoverable). */
export function deleteSkill(dshHome, name, { cwd } = {}) {
  const found = locateSkill(dshHome, name, cwd);
  if (!found) return { ok: false, error: "not-found" };
  const trash = trashDir(dshHome);
  mkdirSync(trash, { recursive: true });
  let trashName = name;
  let i = 2;
  while (existsSync(join(trash, trashName))) trashName = `${name}-${i++}`;
  renameSync(join(found.root.path, name), join(trash, trashName));
  writeFileSync(join(trash, `${trashName}.origin.json`), JSON.stringify({ name, originalPath: join(found.root.path, name), source: found.root.source, deletedAt: new Date().toISOString() }), "utf8");
  return { ok: true, name: trashName, trashed: true };
}

/** Restore a skill from the trash to its original location. */
export function restoreSkill(dshHome, name) {
  const trash = trashDir(dshHome);
  const originFile = join(trash, `${name}.origin.json`);
  const skillDir = join(trash, name);
  if (!existsSync(skillDir)) return { ok: false, error: "not-found" };
  let originalPath = null;
  try { originalPath = JSON.parse(readFileSync(originFile, "utf8")).originalPath; } catch {}
  const target = originalPath || join(skillsDir(dshHome), name);
  if (existsSync(target)) return { ok: false, error: "target-exists" };
  mkdirSync(dirname(target), { recursive: true });
  renameSync(skillDir, target);
  try { renameSync(originFile, originFile + ".restored"); } catch {}
  return { ok: true, name, restored: true };
}
