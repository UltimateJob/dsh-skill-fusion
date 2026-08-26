import { discoverLocal } from "./sources/local.js";

export function discover({ local, q } = {}) {
  let candidates = [];
  if (local) candidates = candidates.concat(discoverLocal(local));
  if (q) {
    const n = q.trim().toLowerCase();
    candidates = candidates.filter(c =>
      c.name.toLowerCase().includes(n) || (c.description || "").toLowerCase().includes(n)
    );
  }
  return candidates;
}
