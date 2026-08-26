import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function fusionDir(dshHome = process.env.DSH_HOME || join(homedir(), ".dsh")) {
  return join(dshHome, "skill-fusion");
}
export function manifestPath(dshHome) {
  return join(fusionDir(dshHome), "manifest.json");
}
export function emptyManifest() {
  return { version: 1, skills: {} };
}
export function readManifest(dshHome) {
  const p = manifestPath(dshHome);
  if (!existsSync(p)) return emptyManifest();
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    if (parsed && parsed.version === 1 && parsed.skills && typeof parsed.skills === "object") return parsed;
  } catch {}
  return emptyManifest();
}
export function writeManifest(dshHome, manifest) {
  mkdirSync(fusionDir(dshHome), { recursive: true });
  const p = manifestPath(dshHome);
  writeFileSync(p + ".tmp", JSON.stringify(manifest, null, 2) + "\n", "utf8");
  renameSync(p + ".tmp", p);
  return manifest;
}
export function upsertSkill(manifest, name, entry) {
  return { ...manifest, skills: { ...manifest.skills, [name]: entry } };
}
export function removeSkill(manifest, name) {
  const skills = { ...manifest.skills };
  delete skills[name];
  return { ...manifest, skills };
}
export function findSkill(manifest, name) {
  return manifest.skills[name] ?? null;
}
