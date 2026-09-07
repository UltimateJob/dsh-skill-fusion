import { discoverLocal } from "./sources/local.js";
import { discoverClaude } from "./sources/claude.js";
import { discoverCodex } from "./sources/codex.js";
import { discoverAgents } from "./sources/agents.js";

export function discover({ local, claude, codex, agents, q } = {}) {
  let candidates = [];
  if (local) candidates = candidates.concat(discoverLocal(local));
  if (claude) candidates = candidates.concat(discoverClaude(claude));
  if (codex) candidates = candidates.concat(discoverCodex(codex));
  if (agents) candidates = candidates.concat(discoverAgents(agents));
  if (q) {
    const n = q.trim().toLowerCase();
    candidates = candidates.filter(c =>
      c.name.toLowerCase().includes(n) || (c.description || "").toLowerCase().includes(n)
    );
  }
  return candidates;
}
