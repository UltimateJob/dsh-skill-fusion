import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSkillFrontmatter } from "../frontmatter.js";

export function discoverLocal(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === ".system") continue;
    const full = join(dir, e.name);
    let skillPath, resourceBase;
    if (e.isDirectory()) {
      skillPath = join(full, "SKILL.md");
      resourceBase = full;
    } else if (e.name.endsWith(".md")) {
      skillPath = full;
      resourceBase = dir;
    } else continue;
    let raw;
    try { raw = readFileSync(skillPath, "utf8"); } catch { continue; }
    const parsed = parseSkillFrontmatter(raw);
    if (!parsed) continue;
    const isBundle = e.isDirectory();
    out.push({
      name: parsed.name,
      description: parsed.description,
      sourceKind: "local",
      sourceRef: dir,
      fetchPath: skillPath,
      resourceBase,
      kind: isBundle ? "bundle" : "flat",
      parsed,
    });
  }
  return out;
}
