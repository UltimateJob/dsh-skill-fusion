import { createHash } from "node:crypto";

export function parseSkillFrontmatter(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const firstLineEnd = raw.indexOf("\n");
  if (firstLineEnd < 0) return null;
  if (raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return null;
  const start = firstLineEnd + 1;
  const closing = findClosingFrontmatter(raw, start);
  if (closing === null) return null;
  const fm = raw.slice(start, closing.start);
  const body = raw.slice(closing.bodyStart);
  const name = scalar(fm, "name");
  const description = scalar(fm, "description") || folded(fm, "description");
  if (!name || !description) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return null;
  return {
    name,
    description,
    whenToUse: scalar(fm, "whenToUse") || undefined,
    disableModelInvocation: bool(fm, "disable-model-invocation") === true,
    userInvocable: bool(fm, "user-invocable") !== false,
    body: body.trim(),
  };
}

export function skillHash(parsed) {
  return "sha256:" + createHash("sha256").update(`${parsed.name}\n${parsed.description}\n${parsed.body}`).digest("hex");
}

function findClosingFrontmatter(raw, start) {
  let lineStart = start;
  while (lineStart <= raw.length) {
    const nl = raw.indexOf("\n", lineStart);
    const lineEnd = nl < 0 ? raw.length : nl;
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
      return { start: lineStart, bodyStart: nl < 0 ? raw.length : nl + 1 };
    }
    if (nl < 0) return null;
    lineStart = nl + 1;
  }
  return null;
}
function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, "m"));
  if (!m) return undefined;
  const v = m[1].replace(/^["']|["']$/g, "");
  if (v === "|" || v === ">") return undefined;
  return v;
}
function folded(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*([|>])?\\s*$`, "m"));
  if (!m) return undefined;
  const after = fm.slice(m.index + m[0].length);
  const lines = [];
  for (const line of after.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    if (/^\s*[-#]/.test(line) || !/^\s+/.test(line)) break;
    lines.push(line.trim());
  }
  return lines.length ? lines.join(" ") : undefined;
}
function bool(fm, key) {
  const v = scalar(fm, key);
  if (v === undefined) return undefined;
  const lc = String(v).trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(lc)) return true;
  if (["false", "no", "off", "0"].includes(lc)) return false;
  return undefined;
}
