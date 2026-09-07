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

const NOW = Date.parse("2026-09-01T00:00:00Z");

test("trustTier: recently-pushed repos are not stale", () => {
  const r = trustTier({ stars: 5000, pushedAt: "2026-08-01T00:00:00Z" }, { now: NOW });
  assert.equal(r.stale, false);
  assert.equal(r.warn, false);
});

test("trustTier: long-unmaintained repos are marked stale", () => {
  const r = trustTier({ stars: 5000, pushedAt: "2024-01-01T00:00:00Z" }, { now: NOW });
  assert.equal(r.tier, "established"); // tier unchanged — stars still count
  assert.equal(r.stale, true);
  assert.equal(r.warn, false); // established keeps warn off; UI hints via stale
});

test("trustTier: stale + weak validation (community) flips warn on", () => {
  const r = trustTier({ stars: 500, pushedAt: "2023-06-01T00:00:00Z" }, { now: NOW });
  assert.equal(r.tier, "community");
  assert.equal(r.stale, true);
  assert.equal(r.warn, true);
});

test("trustTier: missing/unparseable pushedAt is no signal, no penalty", () => {
  assert.equal(trustTier({ stars: 5000, pushedAt: null }, { now: NOW }).stale, false);
  assert.equal(trustTier({ stars: 5000, pushedAt: "not-a-date" }, { now: NOW }).stale, false);
});
