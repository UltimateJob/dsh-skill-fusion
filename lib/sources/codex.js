import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLocal } from "./local.js";

/**
 * Discover skills from ~/.codex/skills/ (Codex CLI skill root).
 * @param {string} codexHome - override the scan root (testing)
 * @returns {Array} candidates with sourceKind="codex"
 */
export function discoverCodex(codexHome) {
  const dir = codexHome || join(homedir(), ".codex", "skills");
  return discoverLocal(dir).map(c => ({
    ...c,
    sourceKind: "codex",
    sourceRef: dir,
  }));
}
