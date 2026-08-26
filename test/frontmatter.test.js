import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSkillFrontmatter, skillHash } from "../lib/frontmatter.js";

test("parses a valid directory-bundle SKILL.md", () => {
  const raw = `---
name: my-skill
description: Does a thing.
---
# Body
Do the thing.`;
  const p = parseSkillFrontmatter(raw);
  assert.equal(p.name, "my-skill");
  assert.equal(p.description, "Does a thing.");
  assert.equal(p.disableModelInvocation, false);
  assert.equal(p.userInvocable, true);
  assert.match(p.body, /Do the thing/);
});

test("returns null on missing name", () => {
  assert.equal(parseSkillFrontmatter(`---
description: x
---
body`), null);
});

test("returns null on non-kebab name", () => {
  assert.equal(parseSkillFrontmatter(`---
name: MySkill
description: x
---
`), null);
});

test("respects disable-model-invocation and user-invocable booleans", () => {
  const raw = `---
name: a-b
description: x
disable-model-invocation: yes
user-invocable: off
---
`;
  const p = parseSkillFrontmatter(raw);
  assert.equal(p.disableModelInvocation, true);
  assert.equal(p.userInvocable, false);
});

test("parses folded description block", () => {
  const raw = `---
name: a-b
description: >
  Multi line
  description here.
---
body`;
  const p = parseSkillFrontmatter(raw);
  assert.equal(p.description, "Multi line description here.");
});

test("skillHash is stable and content-addressed", () => {
  const p = parseSkillFrontmatter(`---
name: a-b
description: x
---
body`);
  const h1 = skillHash(p), h2 = skillHash({ ...p });
  assert.equal(h1, h2);
  assert.match(h1, /^sha256:[0-9a-f]+$/);
});
