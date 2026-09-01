/**
 * Language detection + per-name dedupe for multi-language skill repos
 * (e.g. affaan-m/ECC ships every skill in en/zh-CN/ja-JP variants).
 *
 * Policy: keep ONE variant per skill name — Chinese preferred, English
 * fallback, Japanese (and other languages) not shown.
 */

/**
 * Detect the language of a skill from its path and/or text content.
 * Path components like docs/zh-CN/ or docs/ja-JP/ win; otherwise content
 * heuristics: kana → ja, han → zh, else en.
 */
export function detectLang(path = "", text = "") {
  const p = `/${String(path).replace(/\\/g, "/")}/`.toLowerCase().replace(/_/g, "-");
  if (/\/(zh|zh-cn|zh-hans|zh-hant|cn)\//.test(p)) return "zh";
  if (/\/(ja|ja-jp|jp)\//.test(p)) return "ja";
  if (/\/(en|en-us|en-gb)\//.test(p)) return "en";
  // Content heuristics: hiragana/katakana → ja; CJK han → zh; else en.
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  return "en";
}

/**
 * Dedupe candidates by name with language preference.
 * Groups variants sharing a name, keeps the best per `prefer` order,
 * and drops variants whose language is in `skip` entirely.
 * Result is sorted by name. Each kept candidate gets a `lang` field.
 */
export function dedupeByLang(candidates, { prefer = ["zh", "en"], skip = ["ja"] } = {}) {
  const groups = new Map();
  for (const c of candidates) {
    const lang = detectLang(c.skillDir || "", `${c.name || ""}\n${c.description || ""}`);
    if (skip.includes(lang)) continue;
    const g = groups.get(c.name) || [];
    g.push({ ...c, lang });
    groups.set(c.name, g);
  }
  const rank = (lang) => {
    const i = prefer.indexOf(lang);
    return i === -1 ? prefer.length : i;
  };
  const out = [];
  for (const [, variants] of groups) {
    variants.sort((a, b) => rank(a.lang) - rank(b.lang));
    out.push(variants[0]);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
