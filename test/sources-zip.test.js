import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractZip, discoverZip, listZipEntries } from "../lib/sources/zip.js";
import { buildZip, ZIP_SKILL_MD as SKILL_MD } from "./helpers/zip-fixture.js";

function makeZip(t, entries) {
  const dir = mkdtempSync(join(tmpdir(), "sf-zip-test-"));
  const zipPath = join(dir, "skills.zip");
  writeFileSync(zipPath, buildZip(entries));
  return { dir, zipPath };
}

test("extractZip: store + deflate entries round-trip with CRC verification", () => {
  const { dir, zipPath } = makeZip(null, [
    { name: "pkg/skills/zip-skill/SKILL.md", data: SKILL_MD, method: 8 },
    { name: "pkg/README.md", data: "hello zip", method: 0 },
    { name: "pkg/", data: "" },
  ]);
  const out = join(dir, "out");
  const r = extractZip(zipPath, out);
  assert.equal(r.ok, true);
  assert.deepEqual(r.files.sort(), ["pkg/README.md", "pkg/skills/zip-skill/SKILL.md"].sort());
  assert.equal(readFileSync(join(out, "pkg", "skills", "zip-skill", "SKILL.md"), "utf8"), SKILL_MD);
});

test("listZipEntries: parses central directory", () => {
  const { zipPath } = makeZip(null, [{ name: "a/b.txt", data: "x".repeat(1000), method: 8 }]);
  const entries = listZipEntries(readFileSync(zipPath));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "a/b.txt");
  assert.equal(entries[0].method, 8);
  assert.equal(entries[0].size, 1000);
});

test("extractZip: zip-slip entries are refused before touching disk", () => {
  const { dir, zipPath } = makeZip(null, [
    { name: "../escape/evil.md", data: "owned" },
    { name: "ok/SKILL.md", data: SKILL_MD },
  ]);
  assert.throws(() => extractZip(zipPath, join(dir, "out")), /unsafe path/);
  assert.equal(existsSync(join(dir, "escape")), false);
});

test("extractZip: windows-style ..\\ slip is refused too", () => {
  const { dir, zipPath } = makeZip(null, [{ name: "..\\escape\\evil.md", data: "owned" }]);
  assert.throws(() => extractZip(zipPath, join(dir, "out")), /unsafe path/);
});

test("extractZip: drive-letter and absolute entries are refused", () => {
  const { dir, zipPath } = makeZip(null, [{ name: "C:/temp/evil.md", data: "x" }]);
  assert.throws(() => extractZip(zipPath, join(dir, "out1")), /unsafe path/);
  const { dir: dir2, zipPath: zipPath2 } = makeZip(null, [{ name: "/etc/evil.md", data: "x" }]);
  assert.throws(() => extractZip(zipPath2, join(dir2, "out2")), /unsafe path/);
});

test("discoverZip: finds SKILL.md candidates with sourceKind zip", () => {
  const { dir, zipPath } = makeZip(null, [
    { name: "bundle/zip-skill/SKILL.md", data: SKILL_MD, method: 8 },
  ]);
  const cands = discoverZip(zipPath, { workDir: join(dir, "extracted") });
  assert.equal(cands.length, 1);
  assert.equal(cands[0].name, "zip-skill");
  assert.equal(cands[0].sourceKind, "zip");
  assert.equal(cands[0].skillDir, "bundle/zip-skill");
});

test("discoverZip: missing file returns empty, not an error", () => {
  assert.deepEqual(discoverZip(join(tmpdir(), "definitely-not-here.zip")), []);
});
