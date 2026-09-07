import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillRoots, listLocalSkills, setSkillEnabled, createSkill, deleteSkill, restoreSkill } from "../lib/local.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-roots-")); }
function addSkill(dir, name, desc = "test skill") {
  mkdirSync(join(dir, name), { recursive: true });
  writeFileSync(join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`, "utf8");
}

test("skillRoots: covers project/user/agents roots", () => {
  const home = freshHome();
  const cwd = join(home, "proj");
  mkdirSync(join(cwd, ".git"), { recursive: true });
  const roots = skillRoots(home, { cwd });
  const sources = roots.map(r => r.source);
  assert.ok(sources.includes("project-dsh"));
  assert.ok(sources.includes("project-agents"));
  assert.ok(sources.includes("user-dsh"));
  assert.ok(sources.includes("user-agents"));
  assert.ok(sources.includes("plugin"), "plugin-shipped skills root present");
  const plugin = roots.find(r => r.source === "plugin");
  assert.equal(plugin.writable, false, "plugin skills are read-only");
});

test("listLocalSkills: groups by source root with enabled from frontmatter", () => {
  const home = freshHome();
  const cwd = join(home, "proj");
  mkdirSync(join(cwd, ".git"), { recursive: true });
  addSkill(join(home, "skills"), "user-skill");
  addSkill(join(cwd, ".dsh", "skills"), "project-skill");
  addSkill(join(home, "skills"), "disabled-skill");
  writeFileSync(join(home, "skills", "disabled-skill", "SKILL.md"),
    "---\nname: disabled-skill\ndescription: off\ndisable-model-invocation: true\n---\nbody", "utf8");
  const list = listLocalSkills(home, { cwd });
  const byName = Object.fromEntries(list.map(s => [s.name, s]));
  assert.equal(byName["user-skill"].source, "user-dsh");
  assert.equal(byName["user-skill"].enabled, true);
  assert.equal(byName["project-skill"].source, "project-dsh");
  assert.equal(byName["disabled-skill"].enabled, false, "frontmatter flag respected");
});

test("setSkillEnabled: rewrites frontmatter instead of moving directories", () => {
  const home = freshHome();
  addSkill(join(home, "skills"), "toggle-me");
  const r = setSkillEnabled(home, "toggle-me", false);
  assert.equal(r.ok, true);
  assert.equal(r.via, "frontmatter");
  // Skill stays in place
  const p = join(home, "skills", "toggle-me", "SKILL.md");
  assert.equal(existsSync(p), true);
  assert.ok(readFileSync(p, "utf8").includes("disable-model-invocation: true"));
  // Re-enable
  const r2 = setSkillEnabled(home, "toggle-me", true);
  assert.equal(r2.ok, true);
  assert.ok(!readFileSync(p, "utf8").includes("disable-model-invocation"));
});

test("createSkill: scaffolds a new skill at the user root", () => {
  const home = freshHome();
  const r = createSkill(home, { name: "my-new-skill", description: "我的新技能" });
  assert.equal(r.ok, true);
  const p = join(home, "skills", "my-new-skill", "SKILL.md");
  assert.equal(existsSync(p), true);
  const content = readFileSync(p, "utf8");
  assert.ok(content.includes("name: my-new-skill"));
  assert.ok(content.includes("我的新技能"));
});

test("createSkill: rejects invalid names and duplicates", () => {
  const home = freshHome();
  assert.equal(createSkill(home, { name: "Bad Name!" }).ok, false);
  addSkill(join(home, "skills"), "existing");
  assert.equal(createSkill(home, { name: "existing" }).ok, false);
});

test("deleteSkill: moves to trash (recoverable), restoreSkill brings it back", () => {
  const home = freshHome();
  addSkill(join(home, "skills"), "trash-me");
  const r = deleteSkill(home, "trash-me");
  assert.equal(r.ok, true);
  assert.equal(existsSync(join(home, "skills", "trash-me")), false);
  // Trash entry exists with origin recorded
  assert.equal(existsSync(join(home, "skill-fusion", "trash", "trash-me", "SKILL.md")), true);
  // And it appears in listing as trashed
  const list = listLocalSkills(home);
  const entry = list.find(s => s.name === "trash-me");
  assert.equal(entry.trashed, true);
  // Restore
  const r2 = restoreSkill(home, "trash-me");
  assert.equal(r2.ok, true);
  assert.equal(existsSync(join(home, "skills", "trash-me", "SKILL.md")), true);
});

test("deleteSkill: conflict in trash gets a suffix", () => {
  const home = freshHome();
  addSkill(join(home, "skills"), "dupe");
  deleteSkill(home, "dupe");
  addSkill(join(home, "skills"), "dupe");
  const r = deleteSkill(home, "dupe");
  assert.equal(r.ok, true);
  assert.ok(existsSync(join(home, "skill-fusion", "trash", "dupe", "SKILL.md")));
  // second copy got a suffixed trash name
  const trash = listLocalSkills(home).filter(s => s.trashed);
  assert.equal(trash.length, 2);
});
