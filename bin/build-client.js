#!/usr/bin/env node
/**
 * Assemble client/client.js from the source modules in client/src/.
 *
 * The DSH client runtime loads a single self-contained module through
 * window.__ModuleLoader__ (the factory only gets `require("react")` — relative
 * imports are not supported), so the shipped bundle is a concatenation of the
 * src modules inside the module-loader wrapper. Zero build dependencies: the
 * src files share the factory scope, declared in concatenation order.
 *
 * Usage:
 *   node bin/build-client.js          # write client/client.js
 *   node bin/build-client.js --check  # verify the bundle is up to date (CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SRC_DIR = new URL("../client/src/", import.meta.url);
const OUT_FILE = new URL("../client/client.js", import.meta.url);
const ORDER = ["i18n.js", "styles.js", "components.js", "views.js", "entry.js"];
const INDENT = "    ";

const HEADER = `// GENERATED FILE — do not edit directly.
// Sources live in client/src/${ORDER.join(", ")}; regenerate with: npm run build:client
window.__ModuleLoader__.load({
  id: "dsh-skill-fusion",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
`;

const FOOTER = `    return module.exports;
  }
});
`;

export function buildClientSource() {
  const parts = ORDER.map(f => {
    const body = readFileSync(new URL(f, SRC_DIR), "utf8").trim();
    const indented = body.split("\n").map(l => (l.trim() === "" ? "" : INDENT + l)).join("\n");
    return `${INDENT}// ---- client/src/${f} ----\n${indented}`;
  });
  return HEADER + "\n" + parts.join("\n\n") + "\n\n" + FOOTER;
}

/** Compare ignoring CRLF/LF differences so Windows checkouts pass the check. */
export function bundleUpToDate() {
  let current;
  try { current = readFileSync(OUT_FILE, "utf8"); } catch { return false; }
  return current.replace(/\r\n/g, "\n") === buildClientSource().replace(/\r\n/g, "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) {
    if (bundleUpToDate()) {
      console.log("client/client.js is up to date");
    } else {
      console.error("client/client.js is stale — run: npm run build:client");
      process.exitCode = 1;
    }
  } else {
    writeFileSync(OUT_FILE, buildClientSource());
    console.log("wrote client/client.js");
  }
}
