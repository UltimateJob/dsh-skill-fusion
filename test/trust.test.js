import { test } from "node:test";
import assert from "node:assert/strict";
import { trustTier } from "../lib/trust.js";

test("trustTier: featured repos are verified", () => {
  const r = trustTier({ stars: 5, featured: true });
  assert.equal(r.tier, "verified");
  assert.equal(r.warn, false);
});

test("trustTier: high-star repos are verified", () => {
  assert.equal(trustTier({ stars: 50000 }).tier, "verified");
  assert.equal(trustTier({ stars: 10000 }).tier, "verified");
});

test("trustTier: mid tiers by star count", () => {
  assert.equal(trustTier({ stars: 5000 }).tier, "established");
  assert.equal(trustTier({ stars: 500 }).tier, "community");
  assert.equal(trustTier({ stars: 50 }).tier, "new");
  assert.equal(trustTier({ stars: 0 }).tier, "new");
});

test("trustTier: low-trust repos carry a warn flag", () => {
  assert.equal(trustTier({ stars: 500 }).warn, false);
  assert.equal(trustTier({ stars: 50 }).warn, true);
  assert.equal(trustTier({ stars: 0 }).warn, true);
});

test("trustTier: archived repos are flagged regardless of stars", () => {
  const r = trustTier({ stars: 999999, archived: true });
  assert.equal(r.tier, "archived");
  assert.equal(r.warn, true);
});
