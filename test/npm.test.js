import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverNpm, fetchTarball } from "../lib/sources/npm.js";

test("discoverNpm: returns candidate for a package with skills", async () => {
  const mockFetch = async (url) => {
    if (url.includes("registry.npmjs.org/adversarial-review/latest")) {
      return {
        ok: true,
        json: async () => ({
          name: "adversarial-review",
          version: "2.10.0",
          description: "Skeptical code review",
          dist: { tarball: "https://registry.npmjs.org/adversarial-review/-/adversarial-review-2.10.0.tgz" },
          files: ["skills/adversarial-review/", "bin/"],
        }),
      };
    }
    throw new Error(`unexpected: ${url}`);
  };
  const r = await discoverNpm("adversarial-review", { fetchFn: mockFetch });
  assert.equal(r.name, "adversarial-review");
  assert.equal(r.version, "2.10.0");
  assert.equal(r.sourceKind, "npm");
  assert.equal(r.sourceRef, "adversarial-review@2.10.0");
  assert.ok(r.tarballUrl.includes(".tgz"));
  assert.ok(r.skills.length > 0);
});

test("discoverNpm: returns null for package without skills", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      name: "lodash", version: "4.17.21", description: "Utility library",
      dist: { tarball: "https://..." }, files: ["index.js", "lib/"],
    }),
  });
  const r = await discoverNpm("lodash", { fetchFn: mockFetch });
  assert.equal(r, null);
});

test("discoverNpm: returns null on registry 404", async () => {
  const mockFetch = async () => ({ ok: false, status: 404 });
  const r = await discoverNpm("nonexistent-pkg", { fetchFn: mockFetch });
  assert.equal(r, null);
});

test("fetchTarball: returns error on fetch failure", async () => {
  const mockFetch = async () => { throw new Error("network down"); };
  const r = await fetchTarball("https://example.com/pkg.tgz", "/tmp/dest", { fetchFn: mockFetch });
  assert.equal(r.ok, false);
});
