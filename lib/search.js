/**
 * Relevance-ranked search over the bundled Chinese skill index.
 *
 * Matches by name (zh/en) and by (Chinese) description, with a curated
 * synonym/intent map so natural-language needs ("编程体验", "代码质量",
 * "海报") find related skills even when the exact words don't appear.
 * Results are scored and sorted by priority.
 */

// Curated intent → related tokens map. Keys and values are matched
// case-insensitively against name/zh/en fields. Keep entries broad-domain.
const SYNONYMS = {
  编程: ["code", "coding", "开发", "代码", "programming", "refactor", "debug", "review", "tdd", "实现"],
  代码: ["code", "coding", "编程", "开发", "refactor", "review"],
  体验: ["体验", "experience", "优化", "improve", "ux", "design"],
  质量: ["quality", "质量", "review", "test", "audit", "评审", "测试", "检查"],
  审查: ["review", "审查", "评审", "audit", "检查"],
  评审: ["review", "评审", "审查", "audit"],
  调试: ["debug", "调试", "诊断", "troubleshoot", "排查"],
  排错: ["debug", "调试", "排查", "diagnos"],
  重构: ["refactor", "重构", "简化", "simplif", "clean"],
  简化: ["simplif", "简化", "重构", "refactor", "clean"],
  测试: ["test", "测试", "tdd", "e2e", "testing", "coverage"],
  表格: ["excel", "xlsx", "csv", "spreadsheet", "表格"],
  excel: ["xlsx", "spreadsheet", "表格", "csv"],
  海报: ["poster", "海报", "art", "design", "canvas", "视觉", "图"],
  画图: ["art", "canvas", "design", "海报", "绘画", "图", "algorithmic-art", "生成"],
  设计: ["design", "设计", "ui", "ux", "视觉", "样式", "风格"],
  网页: ["web", "网页", "frontend", "前端", "page", "react"],
  前端: ["frontend", "前端", "react", "nextjs", "css", "web", "ui"],
  后端: ["backend", "后端", "api", "server", "express", "node"],
  数据库: ["database", "数据库", "sql", "postgres", "db", "表"],
  部署: ["deploy", "部署", "ci", "cd", "devops", "发布", "pipeline"],
  发布: ["deploy", "发布", "release", "部署", "ship"],
  文档: ["doc", "文档", "writing", "write", "写作", "README", "说明"],
  写作: ["writing", "write", "写作", "文档", "doc", "article"],
  安全: ["security", "安全", "audit", "漏洞", "vulnerab", "secret"],
  研究: ["research", "研究", "调研", "survey", "分析"],
  分析: ["analy", "分析", "研究", "research", "audit"],
  人工智能: ["ai", "llm", "agent", "智能", "模型", "gpt", "claude"],
  智能体: ["agent", "智能体", "代理", "ai"],
  代理: ["agent", "代理", "智能体"],
  模型: ["llm", "model", "模型", "claude", "gpt"],
  图片: ["image", "图片", "图", "png", "jpg", "photo", "图像"],
  视频: ["video", "视频", "mp4", "ffmpeg"],
  音频: ["audio", "音频", "mp3", "ffmpeg"],
  转换: ["convert", "转换", "格式", "transform"],
  格式: ["format", "格式", "convert", "转换"],
  简历: ["resume", "简历", "cv"],
  面试: ["interview", "面试"],
  学习: ["learn", "学习", "教程", "tutorial", "course", "课程", "academy"],
  教程: ["tutorial", "教程", "learn", "学习", "course"],
  记忆: ["memory", "记忆", "上下文", "context"],
  上下文: ["context", "上下文", "memory", "记忆"],
  计划: ["plan", "计划", "规划", "planning"],
  规划: ["plan", "规划", "计划", "planning"],
  审查代码: ["code-review", "review", "评审"],
  海报设计: ["canvas-design", "poster", "design"],
  excel表格: ["xlsx", "spreadsheet", "表格"],
};

/** Tokenize a mixed zh/en query: lowercase English words + Chinese bigrams. */
function tokenize(q) {
  const tokens = new Set();
  const lower = q.toLowerCase();
  for (const m of lower.match(/[a-z0-9][a-z0-9._-]*/g) || []) tokens.add(m);
  const zhOnly = q.replace(/[a-z0-9\s._-]/gi, "");
  for (let i = 0; i < zhOnly.length - 1; i++) tokens.add(zhOnly.slice(i, i + 2));
  if (zhOnly.length === 1) tokens.add(zhOnly);
  return [...tokens].filter(t => t.length >= 1);
}

/** Expand tokens via the synonym map (both directions), with decay weight. */
function expandTokens(tokens) {
  const out = new Map(); // token -> weight
  for (const t of tokens) {
    out.set(t, 1);
    for (const [key, values] of Object.entries(SYNONYMS)) {
      const keyL = key.toLowerCase();
      if (t === keyL || keyL.includes(t) || t.includes(keyL)) {
        for (const v of values) if (!out.has(v)) out.set(v, 0.5);
      }
      for (const v of values) {
        if (v.toLowerCase() === t) {
          if (!out.has(keyL)) out.set(keyL, 0.5);
          for (const v2 of values) if (!out.has(v2)) out.set(v2, 0.5);
        }
      }
    }
  }
  return out;
}

/**
 * Rank the bundled index against a query.
 * @returns {Array} [{key, name, repo, developer, zh, en, skillDir, score}] desc by score
 */
export function rankIndex(index, query, { limit = 30 } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const tokens = tokenize(q);
  const expanded = expandTokens(tokens);
  const hits = [];
  for (const [key, sk] of Object.entries(index.skills || {})) {
    const sep = key.indexOf(":");
    const repo = key.slice(0, sep);
    const name = key.slice(sep + 1);
    const nameL = name.toLowerCase();
    const zhD = (sk.zh || "").toLowerCase();
    const enD = (sk.en || "").toLowerCase();
    let score = 0;
    // Direct matches (highest priority)
    if (nameL === q) score += 100;
    if (nameL.includes(q)) score += 70;
    if (q.length >= 2 && zhD.includes(q)) score += 50;
    if (q.length >= 2 && enD.includes(q)) score += 40;
    if (repo.toLowerCase().includes(q)) score += 15;
    if ((sk.developer || "").toLowerCase().includes(q)) score += 10;
    // Token + synonym matches
    for (const [token, w] of expanded) {
      if (token.length < 2) continue;
      if (nameL.includes(token)) score += 24 * w;
      if (zhD.includes(token)) score += 16 * w;
      if (enD.includes(token)) score += 12 * w;
    }
    if (score > 0) hits.push({ key, name, repo, developer: sk.developer, zh: sk.zh, en: sk.en, skillDir: sk.skillDir, score: Math.round(score * 10) / 10 });
  }
  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return hits.slice(0, limit);
}
