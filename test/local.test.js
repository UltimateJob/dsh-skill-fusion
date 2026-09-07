import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listLocalSkills, setSkillEnabled } from "../lib/local.js";
import { symlinkSupported } from "./helpers/platform.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-local-")); }
function addSkill(dshHome, name, { disabled = false, desc = "test skill" } = {}) {
  const dir = disabled ? join(dshHome, "skill-fusion", "disabled", name) : join(dshHome, "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`, "utf8");
  return dir;
}

test("listLocalSkills: lists enabled and disabled skills with metadata", () => {
  const home = freshHome();
  addSkill(home, "alpha");
  addSkill(home, "beta", { desc: "second skill" });
  addSkill(home, "gamma", { disabled: true });
  const list = listLocalSkills(home);
  assert.equal(list.length, 3);
  const byName = Object.fromEntries(list.map(s => [s.name, s]));
  assert.equal(byName.alpha.enabled, true);
  assert.equal(byName.beta.description, "second skill");
  assert.equal(byName.gamma.enabled, false);
});

test("listLocalSkills: empty home returns empty array", () => {
  const home = freshHome();
  assert.deepEqual(listLocalSkills(home), []);
});

test("listLocalSkills: marks fusion-managed skills", () => {
  const home = freshHome();
  addSkill(home, "managed-one");
  // Write a fusion manifest entry
  mkdirSync(join(home, "skill-fusion"), { recursive: true });
  writeFileSync(join(home, "skill-fusion", "manifest.json"), JSON.stringify({ version: 1, skills: { "managed-one": { name: "managed-one", sourceKind: "local" } } }), "utf8");
  const list = listLocalSkills(home);
  assert.equal(list[0].managed, true);
});

test("setSkillEnabled: disable rewrites frontmatter (skill stays in place)", () => {
  const home = freshHome();
  addSkill(home, "toggle-me");
  const r = setSkillEnabled(home, "toggle-me", false);
  assert.equal(r.ok, true);
  assert.equal(r.via, "frontmatter");
  // Skill stays in place with the disable flag
  const p = join(home, "skills", "toggle-me", "SKILL.md");
  assert.equal(existsSync(p), true);
  // And it now shows as disabled
  const list = listLocalSkills(home);
  assert.equal(list.find(s => s.name === "toggle-me").enabled, false);
});

test("setSkillEnabled: enable clears the flag", () => {
  const home = freshHome();
  addSkill(home, "toggle-me");
  setSkillEnabled(home, "toggle-me", false);
  const r = setSkillEnabled(home, "toggle-me", true);
  assert.equal(r.ok, true);
  assert.equal(listLocalSkills(home).find(s => s.name === "toggle-me").enabled, true);
});

test("setSkillEnabled: frontmatter toggle works through symlinks (fusion-activated)", { skip: !symlinkSupported() && "host cannot create directory symlinks" }, () => {
  const home = freshHome();
  // Simulate a fusion symlink: target dir elsewhere, symlink inside skills/
  const target = join(home, "cache", "real-skill");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "SKILL.md"), "---\nname: real-skill\ndescription: via symlink\n---\nbody", "utf8");
  mkdirSync(join(home, "skills"), { recursive: true });
  symlinkSync(target, join(home, "skills", "real-skill"), "dir");
  // Disable rewrites the target's frontmatter through the link
  const r = setSkillEnabled(home, "real-skill", false);
  assert.equal(r.ok, true);
  assert.equal(r.via, "frontmatter");
  assert.equal(existsSync(join(home, "skills", "real-skill")), true, "symlink stays in place");
  assert.ok(readFileSync(join(target, "SKILL.md"), "utf8").includes("disable-model-invocation: true"));
});

test("setSkillEnabled: not-found returns error", () => {
  const home = freshHome();
  const r = setSkillEnabled(home, "nope", false);
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-found");
});
