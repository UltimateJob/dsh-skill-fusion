import { readdirSync, existsSync, mkdirSync, renameSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSkillFrontmatter } from "./frontmatter.js";
import { readManifest } from "./manifest.js";

function skillsDir(dshHome) { return join(dshHome, "skills"); }
function disabledDir(dshHome) { return join(dshHome, "skill-fusion", "disabled"); }

/**
 * List all skills DSH has locally: enabled ones in ~/.dsh/skills/ and
 * disabled ones parked in ~/.dsh/skill-fusion/disabled/.
 * Each entry: { name, description, enabled, managed }.
 * managed = has a fusion manifest entry (installed via skill-fusion).
 */
export function listLocalSkills(dshHome) {
  const manifest = readManifest(dshHome);
  const out = [];
  for (const [dir, enabled] of [[skillsDir(dshHome), true], [disabledDir(dshHome), false]]) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const name = e.name;
      const skillPath = join(dir, name, "SKILL.md");
      if (!existsSync(skillPath)) continue;
      let description = "";
      try {
        const parsed = parseSkillFrontmatter(readFileSync(skillPath, "utf8"));
        if (parsed) description = parsed.description || "";
      } catch { /* unreadable SKILL.md: still list it */ }
      out.push({ name, description, enabled, managed: !!findSkillEntry(manifest, name) });
    }
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
 * Enable or disable a local skill by moving it between ~/.dsh/skills/ and
 * ~/.dsh/skill-fusion/disabled/. renameSync moves symlinks without touching
 * their targets, so fusion-activated (symlink) skills toggle cleanly.
 */
export function setSkillEnabled(dshHome, name, enabled) {
  const from = join(enabled ? disabledDir(dshHome) : skillsDir(dshHome), name);
  const to = join(enabled ? skillsDir(dshHome) : disabledDir(dshHome), name);
  if (!existsSync(from)) return { ok: false, error: "not-found" };
  mkdirSync(enabled ? skillsDir(dshHome) : disabledDir(dshHome), { recursive: true });
  renameSync(from, to);
  return { ok: true, name, enabled };
}
