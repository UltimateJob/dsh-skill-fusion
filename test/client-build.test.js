import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleUpToDate, buildClientSource } from "../bin/build-client.js";

test("client bundle: client/client.js matches client/src/* (run npm run build:client after editing src)", () => {
  assert.equal(bundleUpToDate(), true, "client/client.js is stale — regenerate with `npm run build:client`");
});

test("client bundle: generated output wraps all src modules in the module loader", () => {
  const out = buildClientSource();
  assert.match(out, /^\/\/ GENERATED FILE/);
  assert.ok(out.includes('window.__ModuleLoader__.load({'));
  for (const f of ["i18n.js", "styles.js", "components.js", "views.js", "entry.js"]) {
    assert.ok(out.includes(`// ---- client/src/${f} ----`), `missing section ${f}`);
  }
  // The factory scope closes over react and returns module.exports.
  assert.ok(out.includes('require("react")'));
  assert.ok(out.trimEnd().endsWith("});\n") || out.trimEnd().endsWith("});"));
});

test("client bundle: src modules carry no import/export (they share factory scope)", () => {
  const out = buildClientSource();
  const body = out.slice(out.indexOf('require("react")'));
  assert.ok(!/^\s*(import|export)\s/m.test(body.replace(/exports\./g, "")), "src modules must stay import/export-free");
});
