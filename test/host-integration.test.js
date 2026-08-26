import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, name, inject } from "../lib/index.js";

function freshHome() { return mkdtempSync(join(tmpdir(), "fusion-host-")); }

test("host plugin: exports name/inject/apply", () => {
  assert.equal(name, "skill-fusion");
  assert.deepEqual(inject, ["webServer"]);
  assert.equal(typeof apply, "function");
});

test("host plugin: apply registers routes on webServer", () => {
  const home = freshHome();
  process.env.DSH_HOME = home;
  const registered = [];
  const ctx = {
    webServer: {
      register(route) { registered.push(route); return () => {}; },
    },
    effect(fn, label) { fn(); return () => {}; },
  };
  apply(ctx);
  assert.ok(registered.length >= 5, `expected >=5 routes, got ${registered.length}`);
  assert.ok(registered.some(r => r.path === "/api/skill-fusion/list"));
  assert.ok(registered.some(r => r.path === "/api/skill-fusion/activate"));
});
