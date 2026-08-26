export function freezeSkill(manifest, name, version) {
  const entry = manifest.skills[name];
  if (!entry) return manifest;
  return {
    ...manifest,
    skills: { ...manifest.skills, [name]: { ...entry, frozenVersion: version, status: "frozen" } },
  };
}

export function unfreezeSkill(manifest, name) {
  const entry = manifest.skills[name];
  if (!entry) return manifest;
  return {
    ...manifest,
    skills: { ...manifest.skills, [name]: { ...entry, frozenVersion: null, status: "active" } },
  };
}

export function isFrozen(manifest, name) {
  return manifest.skills[name]?.frozenVersion != null;
}
