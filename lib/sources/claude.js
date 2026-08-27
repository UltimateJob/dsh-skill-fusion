import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLocal } from "./local.js";

/**
 * Discover skills from ~/.claude/skills/ (Claude Code skill root).
 * @param {string} claudeHome - override the scan root (testing)
 * @returns {Array} candidates with sourceKind="claude"
 */
export function discoverClaude(claudeHome) {
  const dir = claudeHome || join(homedir(), ".claude", "skills");
  return discoverLocal(dir).map(c => ({
    ...c,
    sourceKind: "claude",
    sourceRef: dir,
  }));
}
