/**
 * Community-trust tier for a market result, based on usage signals
 * (stars / featured curation / archived status) plus a maintenance
 * (recency) signal — stars alone are gameable, so a repo that has not
 * been pushed to in a long time is surfaced as stale.
 *
 * Tiers: verified (featured or ≥10k★) → established (≥1k★) → community
 * (≥100★) → new (<100★, warn) → archived (repo archived, warn).
 *
 * Staleness: pushedAt older than STALE_DAYS marks the result `stale`.
 * Stale + weak validation (community/new) flips warn on; verified and
 * established repos keep their warn off but still carry the stale flag
 * so the UI can hint "long unmaintained".
 *
 * @param {object} sig - { stars, featured, archived, pushedAt }
 * @param {object} opts - { now } injectable clock (testing)
 * @returns {{tier: string, warn: boolean, stale: boolean}}
 */
const STALE_DAYS = 548; // ~18 months

export function trustTier({ stars = 0, featured = false, archived = false, pushedAt = null } = {}, { now = Date.now() } = {}) {
  if (archived) return { tier: "archived", warn: true, stale: true };
  const stale = isStale(pushedAt, now);
  let tier;
  if (featured || stars >= 10000) tier = "verified";
  else if (stars >= 1000) tier = "established";
  else if (stars >= 100) tier = "community";
  else tier = "new";
  const warn = tier === "new" || (stale && tier === "community");
  return { tier, warn, stale };
}

function isStale(pushedAt, now) {
  if (!pushedAt) return false; // unknown recency (e.g. npm packages) — no signal, no penalty
  const t = Date.parse(pushedAt);
  if (Number.isNaN(t)) return false;
  return now - t > STALE_DAYS * 24 * 3600 * 1000;
}
