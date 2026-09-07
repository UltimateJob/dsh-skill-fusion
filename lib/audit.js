import { skillHash } from "./frontmatter.js";

const INJECTION_PATTERNS = [
  { id: "ignore-prior-instructions", re: /ignore (?:all )?(?:previous|prior|above) instructions/i, severity: "warn" },
  { id: "disregard-above", re: /disregard (?:everything )?(?:above|prior)/i, severity: "warn" },
  { id: "role-reset", re: /you are now (?:a|an) \w+/i, severity: "warn" },
  // Concealment: the skill asks the model to hide its behavior from the user.
  { id: "hidden-instruction", re: /\b(?:do not|don't|never)\s+(?:tell|inform|notify|mention to|reveal to|disclose to)\s+the\s+user\b/i, severity: "warn" },
  // Fake chat-message boundaries injected into the model context.
  { id: "system-tag-injection", re: /<\/?(?:system|assistant)>/i, severity: "warn" },
  // Prompt exfiltration: reveal/print/send the system prompt or initial instructions.
  { id: "prompt-exfil", re: /\b(?:reveal|print|output|repeat|send|upload)\b[^\n.]{0,40}\b(?:system prompt|initial (?:prompt|instructions)|your instructions)\b/i, severity: "warn" },
  // Long opaque base64 blob — likely an obfuscated payload (hashes/URLs don't form such runs).
  { id: "base64-blob", re: /[A-Za-z0-9+/]{160,}={0,2}/, severity: "warn" },
  { id: "external-fetch", re: /\b(?:curl|wget|fetch)\s+https?:\/\//i, severity: "warn" },
  { id: "credential-access", re: /\.(?:credentials|ssh|env|aws|kube)\b|~\/\.dsh\/\.credentials/i, severity: "warn" },
  // Any URL outside the well-known package/code hosts. Subdomains of those hosts
  // are allowed (api.github.com, registry.npmjs.org, …) — they are infrastructure
  // a skill legitimately references, not an exfiltration surface.
  { id: "exfil-baseurl", re: /https?:\/\/(?!(?:[\w-]+\.)*(?:github\.com|githubusercontent\.com|npmjs\.com|npmjs\.org|deepseek\.com|deepseek\.ai)(?:[\/:?"']|$))/i, severity: "warn" },
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
  const tokens = new Set((s.toLowerCase().match(/[a-z][a-z-]+/g) || []).filter(w => w.length > 3 && !STOP.has(w)));
  // Chinese trigger phrases: no word boundaries, so use bigrams of han runs
  // (same scheme as the market intent search) — otherwise Chinese skills
  // never participate in overlap detection at all.
  for (const run of s.match(/[一-鿿]+/g) || []) {
    if (run.length === 1) tokens.add(run);
    for (let i = 0; i < run.length - 1; i++) tokens.add(run.slice(i, i + 2));
  }
  return tokens;
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
