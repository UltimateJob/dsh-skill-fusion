import { isFrozen } from "./freeze.js";
import { discoverLocal } from "./sources/local.js";
import { skillHash } from "./frontmatter.js";
import { audit } from "./audit.js";
import { activateSkill, removeActivation } from "./activate.js";

async function currentContentHash(name, sourceRef, dshHome) {
  const cand = discoverLocal(sourceRef).find(c => c.name === name);
  if (!cand) return null;
  return skillHash(cand.parsed);
}

export async function checkForUpdates(manifest, dshHome, { fetchFn } = {}) {
  const updates = [];
  for (const [name, entry] of Object.entries(manifest.skills)) {
    if (isFrozen(manifest, name)) continue;
    const currentHash = entry.lastAudit?.hash;
    if (!currentHash) continue;
    const latestHash = await currentContentHash(name, entry.sourceRef, dshHome);
    if (latestHash && latestHash !== currentHash) {
      updates.push({ name, current: currentHash, latest: latestHash, hasUpdate: true });
    }
  }
  return updates;
}

export async function updateSkill(manifest, name, dshHome, { fetchFn } = {}) {
  if (isFrozen(manifest, name)) return { manifest, updated: false };
  const entry = manifest.skills[name];
  if (!entry) return { manifest, updated: false, error: "not-found" };

  if (entry.sourceKind === "local") {
    const cand = discoverLocal(entry.sourceRef).find(c => c.name === name);
    if (!cand) return { manifest, updated: false, error: "source-not-found" };
    // Skip if content unchanged (hash match)
    const currentHash = skillHash(cand.parsed);
    if (entry.lastAudit?.hash === currentHash) return { manifest, updated: false };
    const r = audit(cand, { existingNames: Object.keys(manifest.skills).filter(n => n !== name), existingSkills: [] });
    if (r.verdict === "block") return { manifest, updated: false, error: "blocked", flags: r.flags };
    removeActivation({ name, dshHome });
    const act = activateSkill({ name, sourceDir: cand.resourceBase, dshHome });
    if (!act.ok) return { manifest, updated: false, error: act.error };
    return {
      manifest: {
        ...manifest,
        skills: { ...manifest.skills, [name]: { ...entry, lastAudit: { verdict: r.verdict, hash: r.hash, at: new Date().toISOString(), flags: r.flags }, activationMode: act.mode } },
      },
      updated: true,
    };
  }
  return { manifest, updated: false, error: "npm-update-not-implemented" };
}
