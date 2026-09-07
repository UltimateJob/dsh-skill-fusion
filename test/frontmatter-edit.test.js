import { test } from "node:test";
import assert from "node:assert/strict";
import { setFrontmatterDisabled, isDisabledByFrontmatter } from "../lib/frontmatter-edit.js";

const base = "---\nname: foo\ndescription: bar\n---\nbody";

test("setFrontmatterDisabled: adds disable-model-invocation when disabling", () => {
  const out = setFrontmatterDisabled(base, true);
  assert.ok(out.includes("disable-model-invocation: true"));
  assert.ok(out.startsWith("---\nname: foo"));
  assert.ok(out.endsWith("body"));
});

test("setFrontmatterDisabled: removes the flag when enabling", () => {
  const disabled = setFrontmatterDisabled(base, true);
  const out = setFrontmatterDisabled(disabled, false);
  assert.ok(!out.includes("disable-model-invocation"));
  assert.ok(out.includes("name: foo"));
});

test("setFrontmatterDisabled: replaces an existing false flag when disabling", () => {
  const withFalse = "---\nname: foo\ndisable-model-invocation: false\n---\nbody";
  const out = setFrontmatterDisabled(withFalse, true);
  assert.ok(out.includes("disable-model-invocation: true"));
  assert.ok(!out.includes("false"));
});

test("setFrontmatterDisabled: idempotent", () => {
  const once = setFrontmatterDisabled(base, true);
  const twice = setFrontmatterDisabled(once, true);
  assert.equal(once, twice);
});

test("setFrontmatterDisabled: no frontmatter returns null", () => {
  assert.equal(setFrontmatterDisabled("# no frontmatter", true), null);
});

test("isDisabledByFrontmatter: reads the flag", () => {
  assert.equal(isDisabledByFrontmatter(base), false);
  assert.equal(isDisabledByFrontmatter(setFrontmatterDisabled(base, true)), true);
  assert.equal(isDisabledByFrontmatter("---\nname: x\ndisable-model-invocation: false\n---\nb"), false);
});
