/**
 * Community-trust tier for a market result, based on usage signals
 * (stars / featured curation / archived status).
 *
 * Tiers: verified (featured or ≥10k★) → established (≥1k★) → community
 * (≥100★) → new (<100★, warn) → archived (repo archived, warn).
 *
 * @param {object} sig - { stars, featured, archived }
 * @returns {{tier: string, warn: boolean}}
 */
export function trustTier({ stars = 0, featured = false, archived = false } = {}) {
  if (archived) return { tier: "archived", warn: true };
  if (featured || stars >= 10000) return { tier: "verified", warn: false };
  if (stars >= 1000) return { tier: "established", warn: false };
  if (stars >= 100) return { tier: "community", warn: false };
  return { tier: "new", warn: true };
}
