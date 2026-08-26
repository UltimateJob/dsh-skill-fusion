import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readManifest, writeManifest, upsertSkill, removeSkill, findSkill, emptyManifest, manifestPath,
} from "../lib/manifest.js";

function freshHome() {
  return mkdtempSync(join(tmpdir(), "fusion-home-"));
}

test("readManifest returns empty when missing", () => {
  const home = freshHome();
  assert.deepEqual(readManifest(home), emptyManifest());
});

test("readManifest returns empty on malformed JSON", () => {
  const home = freshHome();
  mkdirSync(join(home, "skill-fusion"), { recursive: true });
  writeFileSync(manifestPath(home), "{ not json", "utf8");
  assert.deepEqual(readManifest(home), emptyManifest());
});

test("writeManifest is atomic and round-trips", () => {
  const home = freshHome();
  const m = upsertSkill(emptyManifest(), "a-b", {
    sourceKind: "local", sourceRef: "/x", version: null, commit: null,
    activationMode: "symlink", activatedAt: "2026-08-26T00:00:00Z",
    frozenVersion: null, lastAudit: null, status: "active",
  });
  writeManifest(home, m);
  assert.equal(findSkill(readManifest(home), "a-b").sourceRef, "/x");
});

test("removeSkill drops one entry, leaves others", () => {
  let m = emptyManifest();
  m = upsertSkill(m, "a", { sourceKind: "local", sourceRef: "/a", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  m = upsertSkill(m, "b", { sourceKind: "local", sourceRef: "/b", version: null, commit: null, activationMode: "symlink", activatedAt: "t", frozenVersion: null, lastAudit: null, status: "active" });
  m = removeSkill(m, "a");
  assert.equal(findSkill(m, "a"), null);
  assert.equal(findSkill(m, "b").sourceRef, "/b");
});
