import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { removeActivation, activateSkill } from "./activate.js";

function snapshotsDir(dshHome) { return join(dshHome, "skill-fusion", "snapshots"); }
function snapshotPath(name, dshHome) { return join(snapshotsDir(dshHome), name); }

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name), d = join(dst, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else copyFileSync(s, d);
  }
}

export async function snapshotSkill(name, dshHome) {
  const target = join(dshHome, "skills", name);
  if (!existsSync(target)) return { ok: false, error: "not-activated" };
  const snap = snapshotPath(name, dshHome);
  try {
    if (existsSync(snap)) rmSync(snap, { recursive: true, force: true });
    copyTree(target, snap);
    return { ok: true, snapshotPath: snap };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function rollbackSkill(manifest, name, dshHome) {
  const snap = snapshotPath(name, dshHome);
  if (!existsSync(snap)) return { manifest, ok: false, error: "no-snapshot" };
  const entry = manifest.skills[name];
  if (!entry) return { manifest, ok: false, error: "not-in-manifest" };
  try {
    removeActivation({ name, dshHome });
    const act = activateSkill({ name, sourceDir: snap, dshHome, mode: "copy" });
    if (!act.ok) return { manifest, ok: false, error: act.error };
    return {
      manifest: {
        ...manifest,
        skills: { ...manifest.skills, [name]: { ...entry, activationMode: "copy", status: "active" } },
      },
      ok: true,
    };
  } catch (e) {
    return { manifest, ok: false, error: String(e) };
  }
}
