import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { upsertSkill, writeManifest } from "./manifest.js";

export async function exportBundle(manifest, dshHome, outPath) {
  try {
    const skills = {};
    for (const [name, entry] of Object.entries(manifest.skills)) {
      const target = join(dshHome, "skills", name);
      let content = null;
      if (existsSync(join(target, "SKILL.md"))) {
        content = readFileSync(join(target, "SKILL.md"), "utf8");
      }
      skills[name] = { ...entry, content };
    }
    const bundle = { version: 1, exportedAt: new Date().toISOString(), skills };
    writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
    return { ok: true, bundlePath: outPath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function importBundle(bundlePath, dshHome, existingManifest) {
  try {
    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    if (bundle?.version !== 1 || !bundle?.skills) return { manifest: existingManifest, ok: false, error: "invalid-bundle" };
    let manifest = existingManifest;
    const imported = [];
    for (const [name, entry] of Object.entries(bundle.skills)) {
      if (manifest.skills[name]) continue; // merge: keep existing
      const { content, ...entryWithoutContent } = entry;
      if (content) {
        const target = join(dshHome, "skills", name);
        mkdirSync(target, { recursive: true });
        writeFileSync(join(target, "SKILL.md"), content, "utf8");
      }
      manifest = upsertSkill(manifest, name, { ...entryWithoutContent, status: "active" });
      imported.push(name);
    }
    writeManifest(dshHome, manifest);
    return { manifest, ok: true, imported };
  } catch (e) {
    return { manifest: existingManifest, ok: false, error: String(e) };
  }
}
