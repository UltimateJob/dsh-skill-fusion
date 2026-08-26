import { skillHash } from "./frontmatter.js";

const INJECTION_PATTERNS = [
  { id: "ignore-prior-instructions", re: /ignore (?:all )?(?:previous|prior|above) instructions/i, severity: "warn" },
  { id: "disregard-above", re: /disregard (?:everything )?(?:above|prior)/i, severity: "warn" },
  { id: "role-reset", re: /you are now (?:a|an) \w+/i, severity: "warn" },
  { id: "external-fetch", re: /\b(?:curl|wget|fetch)\s+https?:\/\//i, severity: "warn" },
  { id: "credential-access", re: /\.(?:credentials|ssh|env|aws|kube)\b|~\/\.dsh\/\.credentials/i, severity: "warn" },
  { id: "exfil-baseurl", re: /https?:\/\/(?!github\.com|www\.npmjs\.com|npmjs\.org|raw\.githubusercontent\.com)/i, severity: "warn" },
];

export function scanInjectionVectors(body) {
  const flags = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of INJECTION_PATTERNS) {
      if (p.re.test(lines[i])) flags.push({ kind: p.id, line: i + 1, severity: p.severity });
    }
  }
  return flags;
}

export function detectNameConflict(candidateName, existingNames) {
  return new Set(existingNames).has(candidateName);
}

const STOP = new Set(["the", "a", "an", "to", "my", "this", "that", "use", "before", "for", "and", "or", "of", "in", "on", "is", "it", "with", "your", "you", "are", "be", "will", "can", "when", "how", "what", "why", "as", "at", "by", "from"]);
function tokenizeTriggers(s = "") {
  return new Set((s.toLowerCase().match(/[a-z][a-z-]+/g) || []).filter(w => w.length > 3 && !STOP.has(w)));
}

export function detectTriggerOverlap(candidateTriggers, existingSkills = []) {
  const overlaps = [];
  const cand = tokenizeTriggers(candidateTriggers);
  if (cand.size === 0) return overlaps;
  for (const s of existingSkills) {
    const ex = tokenizeTriggers(s.triggers ?? s.description ?? "");
    for (const phrase of cand) {
      if (ex.has(phrase)) overlaps.push({ with: s.name, phrase });
    }
  }
  return overlaps;
}

export function audit(candidate, { existingSkills = [], existingNames = [] } = {}) {
  const parsed = candidate?.parsed;
  if (!parsed?.name || !parsed?.description) {
    return { verdict: "block", flags: [{ kind: "invalid-frontmatter", severity: "block" }], hash: null };
  }
  const flags = [];
  let verdict = "pass";
  if (detectNameConflict(parsed.name, existingNames)) {
    flags.push({ kind: "name-conflict", severity: "block" });
    verdict = "block";
  }
  const inj = scanInjectionVectors(parsed.body);
  flags.push(...inj);
  if (inj.length > 0 && verdict !== "block") verdict = "warn";
  const ov = detectTriggerOverlap(parsed.whenToUse ?? parsed.description, existingSkills);
  for (const o of ov) flags.push({ kind: "trigger-overlap", with: o.with, phrase: o.phrase, severity: "warn" });
  if (ov.length > 0 && verdict !== "block") verdict = "warn";
  return { verdict, flags, hash: skillHash(parsed) };
}
