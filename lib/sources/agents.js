import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLocal } from "./local.js";

/**
 * Discover skills from ~/.agents/skills/ (the cross-agent shared root).
 *
 * DSH already activates this root natively (rank 500), so candidates are
 * marked alreadyActive — fusion never auto-copies anything out of it. A
 * candidate marked promote:"suggested" is worth promoting into ~/.dsh/skills
 * (rank 400, outranks 500) so it is owned by the fusion lifecycle (audit
 * trail, freeze/update/rollback); the promote itself only ever happens on an
 * explicit user action (`activate --agents`), never implicitly.
 *
 * @param {string} agentsHome - override the scan root (testing)
 * @returns {Array} candidates with sourceKind="agents"
 */
export function discoverAgents(agentsHome) {
  const dir = agentsHome || join(homedir(), ".agents", "skills");
  return discoverLocal(dir).map(c => ({
    ...c,
    sourceKind: "agents",
    sourceRef: dir,
    alreadyActive: true,
    promote: "suggested",
  }));
}
