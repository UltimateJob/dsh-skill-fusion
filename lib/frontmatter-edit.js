/**
 * Minimal frontmatter editor for the DSH-native disable flag.
 * dsh-skill-filesystem hot-reloads `disable-model-invocation: true` in a
 * skill's frontmatter — toggling it disables the skill without moving files.
 */

const FLAG = "disable-model-invocation";

/** Insert/set the disable flag (disabled=true) or remove it (false). */
export function setFrontmatterDisabled(raw, disabled) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const flagIdx = lines.findIndex(l => l.trim().startsWith(`${FLAG}:`));
  let newLines;
  if (disabled) {
    if (flagIdx >= 0) {
      newLines = lines.map((l, i) => i === flagIdx ? `${FLAG}: true` : l);
    } else {
      newLines = [...lines, `${FLAG}: true`];
    }
  } else {
    newLines = flagIdx >= 0 ? lines.filter((_, i) => i !== flagIdx) : lines;
  }
  return `---\n${newLines.join("\n")}\n---${raw.slice(m[0].length)}`;
}

/** Read whether the skill is disabled via its frontmatter flag. */
export function isDisabledByFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  const line = m[1].split("\n").find(l => l.trim().startsWith(`${FLAG}:`));
  return !!line && /:\s*true\s*$/.test(line);
}
