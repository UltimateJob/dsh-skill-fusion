import { symlinkSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export function chooseMode(sourceDir) {
  try {
    return statSync(sourceDir).isDirectory() ? "symlink" : "copy";
  } catch {
    return "copy";
  }
}

function isLink(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

export function activateSkill({ name, sourceDir, dshHome, mode }) {
  const skillsDir = join(dshHome, "skills");
  const target = join(skillsDir, name);
  mode = mode || chooseMode(sourceDir);
  if (existsSync(target) || isLink(target)) {
    return { ok: false, error: "target-exists", target, mode };
  }
  mkdirSync(skillsDir, { recursive: true });
  try {
    if (mode === "symlink") {
      symlinkSync(sourceDir, target, "dir");
      return { ok: true, mode: "symlink", target };
    }
    copyTree(sourceDir, target);
    return { ok: true, mode: "copy", target };
  } catch (e) {
    if (mode === "symlink") {
      try {
        copyTree(sourceDir, target);
        return { ok: true, mode: "copy", target, fellBackFrom: "symlink" };
      } catch (e2) {
        return { ok: false, error: String(e2), target, mode: "copy" };
      }
    }
    return { ok: false, error: String(e), target, mode };
  }
}

export function reconcileOrphans({ manifest, dshHome }) {
  const orphans = [];
  for (const name of Object.keys(manifest.skills)) {
    const target = join(dshHome, "skills", name);
    if (!existsSync(target) && !isLink(target)) orphans.push(name);
  }
  return orphans;
}

export function removeActivation({ name, dshHome }) {
  const target = join(dshHome, "skills", name);
  if (isLink(target)) {
    rmSync(target);
    return { ok: true, mode: "symlink", target };
  }
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    return { ok: true, mode: "copy", target };
  }
  return { ok: false, error: "not-found", target };
}
