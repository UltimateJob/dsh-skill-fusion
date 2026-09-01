window.__ModuleLoader__.load({
  id: "dsh-skill-fusion",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");

    const en = {
      nav: "Skill Forge",
      discover: "Discover",
      activated: "Activated",
      source: "Source",
      local: "Local",
      npm: "npm",
      github: "GitHub",
      claude: "Claude",
      codex: "Codex",
      market: "Market",
      search: "Search",
      allPlatforms: "Featured",
      loadMore: "Load more",
      noMore: "No more results",
      enable: "Enable",
      disable: "Disable",
      enabledBadge: "enabled",
      disabledBadge: "disabled",
      managedBadge: "managed",
      refresh: "Refresh",
      refreshHint: "Bypass the local cache and re-fetch from the network",
      localIntro: "Skills installed in DeepSeek Harness (~/.dsh/skills). Enable/disable any skill; managed ones (installed via Skill Forge) can also be frozen, updated, rolled back, or uninstalled.",
      emptyLocal: "No local skills yet. Install some from the Market tab.",
      about: "About",
      langZh: "中文",
      langEn: "EN",
      noAbout: "No README found for this item.",
      trustVerified: "Verified",
      trustEstablished: "Established",
      trustCommunity: "Community",
      trustNew: "New repo",
      trustArchived: "Archived",
      confirmLowTrust: "This repo has little community validation (few stars). Install anyway?",
      confirmWarnAudit: "Audit flagged potential risks. Install anyway?",
      inspect: "Find skills",
      inspectRepo: "Find skills inside",
      rank: "Rank",
      openRepo: "Open repo",
      stars: "stars",
      popularity: "popularity",
      noSkillsIn: "No skills found in",
      audit: "Audit",
      activate: "Activate",
      uninstall: "Uninstall",
      freeze: "Freeze",
      unfreeze: "Unfreeze",
      update: "Update",
      rollback: "Rollback",
      export: "Export",
      loading: "Loading…",
      empty: "No skills found.",
      emptyMarket: "No market results. Try a different keyword.",
      emptyActivated: "No skills activated yet.",
      verdict: "Verdict",
      pass: "pass",
      warn: "warn",
      block: "block",
      mode: "Mode",
      status: "Status",
      active: "active",
      orphan: "orphan",
      frozen: "frozen",
      intro: "Discover, audit, and activate skills for DeepSeek Harness. Search the GitHub/npm skill market by keyword and activate with one click.",
      marketPlaceholder: "Search skills… e.g. claude code review, web design, agent",
      npmPlaceholder: "Enter npm package name (e.g. adversarial-review)",
      localPlaceholder: "Enter local path (e.g. ~/my-skills)",
      githubPlaceholder: "owner/repo (e.g. UltimateJob/dsh-skill-fusion)",
      claudePlaceholder: "Path override (default: ~/.claude/skills)",
      codexPlaceholder: "Path override (default: ~/.codex/skills)",
      refPlaceholder: "Branch/tag/ref (default: main)",
      browse: "Browse",
      confirmActivate: "Activate this skill?",
      confirmUninstall: "Uninstall this skill?",
      blocked: "Blocked",
      skills: "skills",
      noFlags: "No injection vectors flagged.",
      exported: "Exported",
    };
    const zh = {
      nav: "技能熔炉",
      discover: "发现",
      activated: "已激活",
      source: "来源",
      local: "本地",
      npm: "npm",
      github: "GitHub",
      claude: "Claude",
      codex: "Codex",
      market: "市场",
      search: "搜索",
      allPlatforms: "精选",
      loadMore: "加载更多",
      noMore: "没有更多了",
      enable: "启用",
      disable: "停用",
      enabledBadge: "已启用",
      disabledBadge: "已停用",
      managedBadge: "托管",
      refresh: "刷新",
      refreshHint: "跳过本地缓存,重新联网获取",
      localIntro: "DeepSeek Harness 本地已安装的技能(~/.dsh/skills)。可启用/停用任意技能;托管技能(经技能熔炉安装)还可冻结、更新、回滚、卸载。",
      emptyLocal: "还没有本地技能。去市场 tab 安装一些吧。",
      about: "简介",
      langZh: "中文",
      langEn: "EN",
      noAbout: "未找到此项目的 README 介绍。",
      trustVerified: "社区验证",
      trustEstablished: "成熟",
      trustCommunity: "社区",
      trustNew: "新仓库",
      trustArchived: "已归档",
      confirmLowTrust: "此仓库社区验证较少(星标低)。仍要安装吗?",
      confirmWarnAudit: "审计发现潜在风险。仍要安装吗?",
      inspect: "发现技能",
      inspectRepo: "查找其中技能",
      rank: "排名",
      openRepo: "打开仓库",
      stars: "星标",
      popularity: "热度",
      noSkillsIn: "未在以下位置找到技能",
      audit: "审计",
      activate: "激活",
      uninstall: "卸载",
      freeze: "冻结",
      unfreeze: "解冻",
      update: "更新",
      rollback: "回滚",
      export: "导出",
      loading: "加载中…",
      empty: "未发现技能。",
      emptyMarket: "市场无结果。换个关键词试试。",
      emptyActivated: "尚未激活任何技能。",
      verdict: "结论",
      pass: "通过",
      warn: "警告",
      block: "阻断",
      mode: "方式",
      status: "状态",
      active: "已激活",
      orphan: "孤儿",
      frozen: "已冻结",
      intro: "发现、审计、激活 DeepSeek Harness 技能。按关键词搜索 GitHub/npm 技能市场,一键激活即可使用。",
      marketPlaceholder: "搜索技能…如 claude 代码审查、网页设计、agent",
      npmPlaceholder: "输入 npm 包名(如 adversarial-review)",
      localPlaceholder: "输入本地路径(如 ~/my-skills)",
      githubPlaceholder: "owner/repo(如 UltimateJob/dsh-skill-fusion)",
      claudePlaceholder: "路径覆盖(默认 ~/.claude/skills)",
      codexPlaceholder: "路径覆盖(默认 ~/.codex/skills)",
      refPlaceholder: "分支/标签/ref(默认 main)",
      browse: "浏览",
      confirmActivate: "激活此技能?",
      confirmUninstall: "卸载此技能?",
      blocked: "已阻断",
      skills: "技能",
      noFlags: "未标记注入向量。",
      exported: "已导出",
    };

    const s = {
      section: { width: "100%", maxWidth: "780px", display: "flex", flexDirection: "column", gap: "14px" },
      intro: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      // Segmented-control tab group (top-level 市场/本地 switcher)
      tabs: { display: "flex", gap: "2px", padding: "2px", borderRadius: "10px", background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l1)", alignSelf: "flex-start" },
      tabBtn: (active) => ({ padding: "6px 16px", border: "none", borderRadius: "8px", background: active ? "var(--dsw-alias-bg-layer-3)" : "transparent", color: active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-tertiary)", font: "inherit", cursor: "pointer", fontSize: "13px", fontWeight: active ? 600 : 400, boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }),
      // Subtle ecosystem chips row
      chips: { display: "flex", gap: "6px", flexWrap: "wrap" },
      chip: (active) => ({ padding: "3px 12px", border: active ? "1px solid var(--dsw-alias-accent, #4f8cff)" : "1px solid var(--dsw-alias-border-l1)", borderRadius: "999px", background: active ? "color-mix(in srgb, var(--dsw-alias-accent, #4f8cff) 10%, transparent)" : "transparent", color: active ? "var(--dsw-alias-accent, #4f8cff)" : "var(--dsw-alias-label-tertiary)", font: "inherit", cursor: "pointer", fontSize: "12px" }),
      searchRow: { display: "flex", gap: "8px", alignItems: "stretch" },
      input: { flex: 1, height: "36px", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: "8px", outline: "none", padding: "0 12px", fontSize: "13px" },
      card: { border: "1px solid var(--dsw-alias-border-l1)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 120ms ease, box-shadow 120ms ease" },
      cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" },
      cardBadges: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 },
      cardTitle: { fontSize: "14px", fontWeight: 600, margin: 0, wordBreak: "break-all" },
      cardDesc: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "12.5px", lineHeight: "1.55" },
      meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", lineHeight: "1.5" },
      badge: (color) => ({ fontSize: "11px", padding: "1px 8px", borderRadius: "999px", background: `color-mix(in srgb, ${color} 14%, transparent)`, color, whiteSpace: "nowrap", fontWeight: 500 }),
      actions: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", marginTop: "2px" },
      actionsSplit: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "2px" },
      btn: (primary) => ({ padding: "5px 14px", height: "30px", boxSizing: "border-box", border: primary ? "none" : "1px solid var(--dsw-alias-border-l2)", borderRadius: "7px", background: primary ? "var(--dsw-alias-bg-accent)" : "var(--dsw-alias-bg-layer-1)", color: primary ? "var(--dsw-alias-label-on-accent)" : "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center" }),
      searchBtn: (primary) => ({ padding: "0 16px", height: "36px", boxSizing: "border-box", border: primary ? "none" : "1px solid var(--dsw-alias-border-l2)", borderRadius: "8px", background: primary ? "var(--dsw-alias-bg-accent)" : "var(--dsw-alias-bg-layer-1)", color: primary ? "var(--dsw-alias-label-on-accent)" : "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "13px", whiteSpace: "nowrap" }),
      cards: { display: "flex", flexDirection: "column", gap: "12px" },
      auditBox: { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "6px", padding: "8px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-1)" },
      frozenBadge: { fontSize: "11px", padding: "1px 8px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 14%, transparent)", color: "var(--dsw-alias-state-warning-primary, #d97706)", whiteSpace: "nowrap" },
      rankBadge: { fontSize: "11px", padding: "1px 8px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 14%, transparent)", color: "var(--dsw-alias-state-success-primary, #16a34a)", fontWeight: 600, whiteSpace: "nowrap" },
      srcBadge: { fontSize: "11px", padding: "1px 8px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-border-l2, #888) 16%, transparent)", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" },
      link: { color: "var(--dsw-alias-accent, #4f8cff)", fontSize: "12px", textDecoration: "none", display: "inline-flex", alignItems: "center", height: "30px" },
      aboutBox: { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "8px", padding: "12px", fontSize: "12px", lineHeight: "1.65", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-1)", maxHeight: "260px", overflowY: "auto" },
    };

    const PASS_COLOR = "var(--dsw-alias-state-success-primary, #16a34a)";
    const WARN_COLOR = "var(--dsw-alias-state-warning-primary, #d97706)";
    const BLOCK_COLOR = "var(--dsw-alias-state-error-primary, #dc2626)";
    function verdictColor(v) { return v === "pass" ? PASS_COLOR : v === "warn" ? WARN_COLOR : BLOCK_COLOR; }

    // Community-trust badge for market results.
    function trustBadgeFor(trust, t) {
      if (!trust) return null;
      const color = trust.tier === "verified" ? PASS_COLOR
        : trust.tier === "established" ? "var(--dsw-alias-accent, #4f8cff)"
        : trust.tier === "community" ? "var(--dsw-alias-label-secondary)"
        : trust.tier === "archived" ? BLOCK_COLOR
        : WARN_COLOR;
      const label = trust.tier === "verified" ? t("trustVerified")
        : trust.tier === "established" ? t("trustEstablished")
        : trust.tier === "community" ? t("trustCommunity")
        : trust.tier === "archived" ? t("trustArchived")
        : t("trustNew");
      return react.createElement("span", { style: s.badge(color) }, label);
    }

    function SkillCard({ skill, t, onAudit, onActivate, onUninstall, onFreeze, onUnfreeze, onUpdate, onRollback, onToggle, onAbout, about, auditResult }) {
      const verdict = auditResult?.verdict;
      const isFrozen = skill.status === "frozen" || skill.frozenVersion != null;
      return react.createElement("div", { style: s.card },
        react.createElement("div", { style: s.cardHead },
          react.createElement("strong", { style: s.cardTitle }, skill.name),
          react.createElement("div", { style: s.cardBadges },
            verdict ? react.createElement("span", { style: s.badge(verdictColor(verdict)) }, t(verdict)) : null,
            isFrozen ? react.createElement("span", { style: s.frozenBadge }, t("frozen") + (skill.frozenVersion ? ` @${skill.frozenVersion}` : "")) : null,
            skill.enabled !== undefined ? react.createElement("span", { style: s.badge(skill.enabled ? PASS_COLOR : "var(--dsw-alias-label-tertiary)") }, skill.enabled ? t("enabledBadge") : t("disabledBadge")) : null,
            skill.managed ? react.createElement("span", { style: s.srcBadge }, t("managedBadge")) : null
          )
        ),
        react.createElement("p", { style: s.cardDesc }, skill.description),
        react.createElement("p", { style: s.meta },
          `${t("source")}: ${skill.sourceKind || "local"}` +
          (skill.version ? ` @${skill.version}` : "") +
          (skill.activationMode ? ` · ${t("mode")}: ${skill.activationMode}` : "") +
          (skill.status ? ` · ${t("status")}: ${t(skill.status)}` : "")
        ),
        auditResult?.flags?.length > 0 ? react.createElement("pre", { style: s.auditBox },
          auditResult.flags.map(f => `${f.severity}: ${f.kind}${f.line ? ` (line ${f.line})` : ""}`).join("\n")
        ) : auditResult ? react.createElement("p", { style: s.meta }, t("noFlags")) : null,
        about !== undefined ? (about
          ? react.createElement("div", null,
              react.createElement("span", { style: s.srcBadge }, about.lang === "zh" ? t("langZh") : t("langEn")),
              react.createElement("div", { style: s.aboutBox }, about.text)
            )
          : react.createElement("p", { style: s.meta }, t("noAbout"))) : null,
        react.createElement("div", { style: s.actions },
          onToggle ? react.createElement("button", { style: s.btn(!skill.enabled), onClick: onToggle }, skill.enabled ? t("disable") : t("enable")) : null,
          onAbout ? react.createElement("button", { style: s.btn(false), onClick: onAbout }, t("about")) : null,
          onAudit ? react.createElement("button", { style: s.btn(false), onClick: onAudit }, t("audit")) : null,
          onActivate ? react.createElement("button", { style: s.btn(true), onClick: onActivate }, t("activate")) : null,
          onFreeze ? react.createElement("button", { style: s.btn(false), onClick: onFreeze }, t("freeze")) : null,
          onUnfreeze ? react.createElement("button", { style: s.btn(false), onClick: onUnfreeze }, t("unfreeze")) : null,
          onUpdate ? react.createElement("button", { style: s.btn(false), onClick: onUpdate }, t("update")) : null,
          onRollback ? react.createElement("button", { style: s.btn(false), onClick: onRollback }, t("rollback")) : null,
          onUninstall ? react.createElement("button", { style: s.btn(false), onClick: onUninstall }, t("uninstall")) : null
        )
      );
    }

    // Market result card: a GitHub repo or npm package that may contain skills.
    function MarketCard({ item, t, onInspect, expanded, onActivate, onAudit, auditMap }) {
      const rankBadge = item.rankKind === "stars"
        ? react.createElement("span", { style: s.rankBadge }, `${item.rankLabel} ${t("stars")}`)
        : react.createElement("span", { style: s.rankBadge }, `${t("popularity")} ${item.rankLabel}`);
      const srcBadge = react.createElement("span", { style: s.srcBadge }, item.sourceMarket === "github" ? "GitHub" : "npm");
      const skillsInside = expanded ? expanded.filter(Boolean) : [];
      const [about, setAbout] = react.useState(undefined);       // repo-level README (zh-preferred)
      const [skillAbout, setSkillAbout] = react.useState({});    // per-skill localized SKILL.md
      const loadAbout = async () => {
        setAbout(undefined);
        try {
          const url = item.sourceMarket === "github"
            ? `/api/skill-fusion/readme?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}`
            : `/api/skill-fusion/readme?source=npm&name=${encodeURIComponent(item.name)}`;
          const data = await (await fetch(url)).json();
          setAbout(data.ok ? data : null);
        } catch { setAbout(null); }
      };
      const loadSkillAbout = async (sk) => {
        if (item.sourceMarket !== "github") return;
        try {
          const url = `/api/skill-fusion/readme?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}&path=${encodeURIComponent(sk.skillDir || "")}`;
          const data = await (await fetch(url)).json();
          setSkillAbout(prev => ({ ...prev, [sk.name]: data.ok ? data : null }));
        } catch { setSkillAbout(prev => ({ ...prev, [sk.name]: null })); }
      };
      return react.createElement("div", { style: s.card },
        react.createElement("div", { style: s.cardHead },
          react.createElement("strong", { style: s.cardTitle }, item.name),
          react.createElement("div", { style: s.cardBadges }, trustBadgeFor(item.trust, t), srcBadge, rankBadge)
        ),
        react.createElement("p", { style: s.cardDesc }, item.description || ""),
        about !== undefined ? (about
          ? react.createElement("div", null,
              react.createElement("span", { style: s.srcBadge }, about.lang === "zh" ? t("langZh") : t("langEn")),
              react.createElement("div", { style: s.aboutBox }, about.text)
            )
          : react.createElement("p", { style: s.meta }, t("noAbout"))) : null,
        react.createElement("div", { style: s.actionsSplit },
          item.url ? react.createElement("a", { href: item.url, target: "_blank", rel: "noreferrer", style: s.link }, t("openRepo")) : react.createElement("span"),
          react.createElement("div", { style: s.actions },
            react.createElement("button", { style: s.btn(false), onClick: loadAbout }, t("about")),
            react.createElement("button", { style: s.btn(false), onClick: () => onInspect(item) },
              skillsInside.length > 0 ? `${t("inspect")} (${skillsInside.length})` : t("inspect")
            )
          )
        ),
        skillsInside.length > 0 ? react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" } },
          skillsInside.map(sk => react.createElement(SkillCard, {
            key: sk.name, skill: sk, t,
            onAudit: () => onAudit(sk, item),
            onActivate: () => onActivate(sk, item),
            onAbout: item.sourceMarket === "github" ? () => loadSkillAbout(sk) : undefined,
            about: skillAbout[sk.name],
            auditResult: auditMap[item.name + ":" + sk.name],
          }))
        ) : expanded && expanded.length === 0 ? react.createElement("p", { style: s.meta }, `${t("noSkillsIn")} ${item.name}`) : null
      );
    }

    // Market view: search the GitHub/npm skill market by keyword or ecosystem
    // chips, ranked by stars/popularity, with infinite scroll and a local cache
    // on the server (24h TTL; 刷新 bypasses it).
    function DiscoverView({ t }) {
      const [query, setQuery] = react.useState("");
      const [results, setResults] = react.useState(null);
      const [expanded, setExpanded] = react.useState({});  // { repoName: [skillCandidates] }
      const [loading, setLoading] = react.useState(false);
      const [auditMap, setAuditMap] = react.useState({});
      const [platform, setPlatform] = react.useState(""); // ecosystem chip filter
      const [page, setPage] = react.useState(1);
      const [hasMore, setHasMore] = react.useState(false);
      const loadingRef = react.useRef(false);
      const sentinelRef = react.useRef(null);

      const doSearch = async (qOverride, { append = false, fresh = false } = {}) => {
        const effectiveQuery = qOverride !== undefined ? qOverride : query;
        const nextPage = append ? page + 1 : 1;
        setLoading(true);
        loadingRef.current = true;
        if (!append) { setResults(null); setAuditMap({}); setExpanded({}); }
        try {
          const url = `/api/skill-fusion/discover?source=market&q=${encodeURIComponent(effectiveQuery)}&page=${nextPage}${fresh ? "&fresh=1" : ""}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.ok) {
            setPage(nextPage);
            setHasMore(!!data.hasMore);
            if (append) {
              setResults(prev => {
                const seen = new Set((prev || []).map(c => c.name));
                return [...(prev || []), ...data.candidates.filter(c => !seen.has(c.name))];
              });
            } else {
              setResults(data.candidates);
            }
          } else if (!append) { setResults([]); setHasMore(false); }
        } catch { if (!append) { setResults([]); setHasMore(false); } }
        setLoading(false);
        loadingRef.current = false;
      };

      // Featured homepage on mount.
      react.useEffect(() => { doSearch(""); }, []);

      // Infinite scroll: when the bottom sentinel enters view, load the next page.
      react.useEffect(() => {
        if (!hasMore || !sentinelRef.current) return;
        const el = sentinelRef.current;
        const obs = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && !loadingRef.current) doSearch(undefined, { append: true });
        }, { rootMargin: "300px" });
        obs.observe(el);
        return () => obs.disconnect();
      }, [hasMore, loading, page]);

      // Ecosystem chips: find skills by platform (claude/codex/github/agent).
      const PLATFORMS = [
        { key: "", label: t("allPlatforms") },
        { key: "claude", label: "Claude" },
        { key: "codex", label: "Codex" },
        { key: "github", label: "GitHub" },
        { key: "agent", label: "Agent" },
      ];
      const pickPlatform = (key) => {
        setPlatform(key);
        setQuery(key);
        doSearch(key);
      };

      const doInspect = async (item) => {
        try {
          let url;
          if (item.sourceMarket === "github") url = `/api/skill-fusion/discover?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}`;
          else url = `/api/skill-fusion/discover?source=npm&name=${encodeURIComponent(item.name)}`;
          const res = await fetch(url);
          const data = await res.json();
          setExpanded(prev => ({ ...prev, [item.name]: data.ok ? data.candidates : [] }));
        } catch { setExpanded(prev => ({ ...prev, [item.name]: [] })); }
      };

      const doAudit = async (sk, item) => {
        let url;
        if (item && item.sourceMarket === "github") url = `/api/skill-fusion/audit?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}&name=${encodeURIComponent(sk.name)}`;
        else url = `/api/skill-fusion/audit?source=npm&name=${encodeURIComponent(sk.name)}`;
        const res = await fetch(url);
        const data = await res.json();
        const key = item ? `${item.name}:${sk.name}` : sk.name;
        setAuditMap(prev => ({ ...prev, [key]: data }));
      };

      const doActivate = async (sk, item) => {
        // Safety gates: warn-verdict audits and low-trust repos require confirmation.
        const av = auditMap[`${item.name}:${sk.name}`];
        if (av?.verdict === "warn" && !confirm(t("confirmWarnAudit"))) return { ok: false, cancelled: true };
        if (item.trust?.warn && !confirm(t("confirmLowTrust"))) return { ok: false, cancelled: true };
        let body;
        if (item && item.sourceMarket === "github") body = { sourceKind: "github", sourceRef: `${item.name}@${item.ref || "main"}`, name: sk.name };
        else body = { sourceKind: "npm", sourceRef: item.name, name: sk.name };
        const res = await fetch("/api/skill-fusion/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.ok && expanded[item.name]) {
          setExpanded(prev => ({ ...prev, [item.name]: prev[item.name].filter(c => c.name !== sk.name) }));
        }
        return data;
      };

      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("intro")),
        react.createElement("div", { style: s.chips },
          ...PLATFORMS.map(p => react.createElement("button", { key: p.key, style: s.chip(platform === p.key), onClick: () => pickPlatform(p.key) }, p.label))
        ),
        react.createElement("div", { style: s.searchRow },
          react.createElement("input", { style: s.input, value: query, onChange: e => setQuery(e.currentTarget.value), placeholder: t("marketPlaceholder"), onKeyDown: e => { if (e.key === "Enter") { setPlatform(""); doSearch(); } } }),
          react.createElement("button", { style: s.searchBtn(true), onClick: () => { setPlatform(""); doSearch(); } }, t("search")),
          react.createElement("button", { style: s.searchBtn(false), onClick: () => doSearch(undefined, { fresh: true }), title: t("refreshHint") }, t("refresh"))
        ),
        loading && !results ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        results !== null && results.length === 0 && !loading ? react.createElement("p", { style: s.intro }, t("emptyMarket")) : null,
        results ? react.createElement("div", { style: s.cards },
          results.map(item => react.createElement(MarketCard, { key: item.name, item, t, onInspect: doInspect, expanded: expanded[item.name], onActivate: doActivate, onAudit: doAudit, auditMap }))
        ) : null,
        results && results.length > 0 ? react.createElement("div", { ref: sentinelRef, style: { textAlign: "center", padding: "12px 0" } },
          loading ? react.createElement("span", { style: s.meta }, t("loading"))
            : hasMore ? react.createElement("button", { style: s.btn(false), onClick: () => doSearch(undefined, { append: true }) }, t("loadMore"))
            : react.createElement("span", { style: s.meta }, t("noMore"))
        ) : null
      );
    }

    // Local view: all skills DSH has locally (~/.dsh/skills), with enable/disable
    // management for every skill and lifecycle actions for fusion-managed ones.
    function ActivatedView({ t }) {
      const [skills, setSkills] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [exportMsg, setExportMsg] = react.useState(null);
      const fetchList = async () => {
        try {
          const res = await fetch("/api/skill-fusion/local");
          const data = await res.json();
          if (data.ok) setSkills(data.skills);
        } catch {}
        setLoading(false);
      };
      react.useEffect(() => { fetchList(); }, []);

      const post = async (path, body) => {
        const res = await fetch(`/api/skill-fusion/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        return res.json();
      };
      const doToggle = async (sk) => {
        const data = await post("toggle", { name: sk.name, enabled: !sk.enabled });
        if (data.ok) fetchList();
      };
      const doUninstall = async (name) => { const data = await post("uninstall", { name }); if (data.ok) fetchList(); };
      const doFreeze = async (name) => {
        const version = prompt("Version to freeze at (e.g. 1.0.0):");
        if (!version) return;
        const data = await post("freeze", { name, version });
        if (data.ok) fetchList();
      };
      const doUnfreeze = async (name) => { const data = await post("unfreeze", { name }); if (data.ok) fetchList(); };
      const doUpdate = async (name) => { const data = await post("update", { name }); if (data.ok) fetchList(); };
      const doRollback = async (name) => { const data = await post("rollback", { name }); if (data.ok) fetchList(); };
      const doExport = async () => {
        const res = await fetch("/api/skill-fusion/export");
        const data = await res.json();
        if (data.ok) {
          const blob = new Blob([JSON.stringify(data.bundle, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `skill-fusion-bundle-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          setExportMsg(t("exported"));
        }
      };

      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("localIntro")),
        react.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
          react.createElement("button", { style: s.btn(false), onClick: doExport }, t("export")),
          exportMsg ? react.createElement("span", { style: s.meta }, exportMsg) : null
        ),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        skills !== null && skills.length === 0 ? react.createElement("p", { style: s.intro }, t("emptyLocal")) : null,
        skills ? react.createElement("div", { style: s.cards },
          skills.map(sk => react.createElement(SkillCard, {
            key: sk.name, skill: sk, t,
            onToggle: () => doToggle(sk),
            onUninstall: sk.managed ? () => doUninstall(sk.name) : undefined,
            onFreeze: sk.managed && !(sk.status === "frozen" || sk.frozenVersion) ? () => doFreeze(sk.name) : undefined,
            onUnfreeze: sk.managed && (sk.status === "frozen" || sk.frozenVersion) ? () => doUnfreeze(sk.name) : undefined,
            onUpdate: sk.managed ? () => doUpdate(sk.name) : undefined,
            onRollback: sk.managed ? () => doRollback(sk.name) : undefined,
          }))
        ) : null
      );
    }

    function SkillForgeView({ t }) {
      const [view, setView] = react.useState("market");
      return react.createElement("div", { style: s.section },
        react.createElement("div", { style: s.tabs },
          react.createElement("button", { style: s.tabBtn(view === "market"), onClick: () => setView("market") }, t("market")),
          react.createElement("button", { style: s.tabBtn(view === "local"), onClick: () => setView("local") }, t("local"))
        ),
        view === "market" ? react.createElement(DiscoverView, { t }) : react.createElement(ActivatedView, { t })
      );
    }

    const NS = "skillFusion";
    const name = "dsh-skill-fusion";
    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-fusion: dictionaries");
      const t = ctx.locale.bind(NS);
      ctx.slots.inject("settings.section", () => {
        const off = ctx.slots.register({
          name: "settings.section",
          id: "skill-fusion",
          order: 15,
          label: () => t("nav"),
          locale: NS,
          inject: () => ({}),
        }, (props) => react.createElement(SkillForgeView, Object.assign({}, props, { t })));
        return off;
      });
    }
    exports.name = name;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
