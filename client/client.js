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
      section: { width: "100%", maxWidth: "760px", display: "flex", flexDirection: "column", gap: "14px" },
      intro: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "13px", lineHeight: "20px" },
      tabs: { display: "flex", gap: "8px" },
      tabBtn: (active) => ({ padding: "6px 14px", border: active ? "1px solid var(--dsw-alias-border-l2)" : "1px solid transparent", borderRadius: "8px", background: active ? "var(--dsw-alias-bg-layer-3)" : "transparent", color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "13px" }),
      input: { width: "100%", height: "36px", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", borderRadius: "8px", outline: "none", padding: "0 12px", fontSize: "13px" },
      card: { border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-3)", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" },
      cardTitle: { fontSize: "13.5px", fontWeight: 600, margin: 0 },
      cardDesc: { margin: 0, color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "1.5" },
      meta: { margin: 0, color: "var(--dsw-alias-label-tertiary)", fontSize: "11.5px", lineHeight: "1.5" },
      badge: (color) => ({ fontSize: "11px", padding: "0 6px", borderRadius: "999px", background: `color-mix(in srgb, ${color} 14%, transparent)`, color }),
      actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
      btn: (primary) => ({ padding: "5px 12px", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "6px", background: primary ? "var(--dsw-alias-bg-accent)" : "var(--dsw-alias-bg-layer-1)", color: primary ? "var(--dsw-alias-label-on-accent)" : "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer", fontSize: "12px" }),
      cards: { display: "flex", flexDirection: "column", gap: "10px" },
      auditBox: { border: "1px solid var(--dsw-alias-border-l1)", borderRadius: "6px", padding: "8px", fontSize: "12px", fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-1)" },
      frozenBadge: { fontSize: "11px", padding: "0 6px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d97706) 14%, transparent)", color: "var(--dsw-alias-state-warning-primary, #d97706)" },
      rankBadge: { fontSize: "11px", padding: "0 8px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-state-success-primary, #16a34a) 14%, transparent)", color: "var(--dsw-alias-state-success-primary, #16a34a)", fontWeight: 600, whiteSpace: "nowrap" },
      srcBadge: { fontSize: "11px", padding: "0 8px", borderRadius: "999px", background: "color-mix(in srgb, var(--dsw-alias-border-l2, #888) 20%, transparent)", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" },
      link: { color: "var(--dsw-alias-accent, #4f8cff)", fontSize: "12px", textDecoration: "none" },
    };

    const PASS_COLOR = "var(--dsw-alias-state-success-primary, #16a34a)";
    const WARN_COLOR = "var(--dsw-alias-state-warning-primary, #d97706)";
    const BLOCK_COLOR = "var(--dsw-alias-state-error-primary, #dc2626)";
    function verdictColor(v) { return v === "pass" ? PASS_COLOR : v === "warn" ? WARN_COLOR : BLOCK_COLOR; }

    function SkillCard({ skill, t, onAudit, onActivate, onUninstall, onFreeze, onUnfreeze, onUpdate, onRollback, auditResult }) {
      const verdict = auditResult?.verdict;
      const isFrozen = skill.status === "frozen" || skill.frozenVersion != null;
      return react.createElement("div", { style: s.card },
        react.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          react.createElement("strong", { style: s.cardTitle }, skill.name),
          verdict ? react.createElement("span", { style: s.badge(verdictColor(verdict)) }, t(verdict)) : null,
          isFrozen ? react.createElement("span", { style: s.frozenBadge }, t("frozen") + (skill.frozenVersion ? ` @${skill.frozenVersion}` : "")) : null
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
        react.createElement("div", { style: s.actions },
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
      return react.createElement("div", { style: s.card },
        react.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
          react.createElement("strong", { style: s.cardTitle }, item.name),
          react.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } }, srcBadge, rankBadge)
        ),
        react.createElement("p", { style: s.cardDesc }, item.description || ""),
        react.createElement("div", { style: s.actions },
          item.url ? react.createElement("a", { href: item.url, target: "_blank", rel: "noreferrer", style: s.link }, t("openRepo")) : null,
          react.createElement("button", { style: s.btn(false), onClick: () => onInspect(item) },
            skillsInside.length > 0 ? `${t("inspect")} (${skillsInside.length})` : t("inspect")
          )
        ),
        skillsInside.length > 0 ? react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" } },
          skillsInside.map(sk => react.createElement(SkillCard, {
            key: sk.name, skill: sk, t,
            onAudit: () => onAudit(sk, item),
            onActivate: () => onActivate(sk, item),
            auditResult: auditMap[item.name + ":" + sk.name],
          }))
        ) : expanded && expanded.length === 0 ? react.createElement("p", { style: s.meta }, `${t("noSkillsIn")} ${item.name}`) : null
      );
    }

    function DiscoverView({ t }) {
      const SOURCES = ["market", "npm", "github", "local", "claude", "codex"];
      const [mode, setMode] = react.useState("market");
      const [query, setQuery] = react.useState("");      // market keyword / npm pkg / github repo
      const [path, setPath] = react.useState("");        // local/claude/codex path override
      const [ref, setRef] = react.useState("");           // github ref
      const [results, setResults] = react.useState(null);
      const [marketMode, setMarketMode] = react.useState(false);
      const [expanded, setExpanded] = react.useState({});  // { repoName: [skillCandidates] }
      const [loading, setLoading] = react.useState(false);
      const [auditMap, setAuditMap] = react.useState({});
      const [platform, setPlatform] = react.useState(""); // market platform chip filter

      const doSearch = async (qOverride) => {
        const effectiveQuery = qOverride !== undefined ? qOverride : query;
        setLoading(true);
        setResults(null);
        setAuditMap({});
        setExpanded({});
        try {
          let url;
          if (mode === "market") url = `/api/skill-fusion/discover?source=market&q=${encodeURIComponent(effectiveQuery)}`;
          else if (mode === "npm") url = `/api/skill-fusion/discover?source=npm&name=${encodeURIComponent(query)}`;
          else if (mode === "github") url = `/api/skill-fusion/discover?source=github&repo=${encodeURIComponent(query)}&ref=${encodeURIComponent(ref || "main")}`;
          else if (mode === "local") url = `/api/skill-fusion/discover?source=local&path=${encodeURIComponent(path)}`;
          else if (mode === "claude") url = `/api/skill-fusion/discover?source=claude${path ? "&path=" + encodeURIComponent(path) : ""}`;
          else url = `/api/skill-fusion/discover?source=codex${path ? "&path=" + encodeURIComponent(path) : ""}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.ok) setResults(data.candidates);
          else setResults([]);
          setMarketMode(mode === "market");
        } catch { setResults([]); setMarketMode(false); }
        setLoading(false);
      };

      // Clear stale results and load sensible defaults whenever the source tab changes.
      // market → featured homepage; claude/codex → scan default dirs immediately.
      react.useEffect(() => {
        setResults(null);
        setExpanded({});
        setAuditMap({});
        setPlatform("");
        setMarketMode(mode === "market");
        if (mode === "market") doSearch("");
        else if (mode === "claude" || mode === "codex") doSearch();
      }, [mode]);

      // Platform filter chips inside the market tab (find skills by ecosystem).
      const PLATFORMS = [
        { key: "", label: t("allPlatforms") },
        { key: "claude", label: "Claude" },
        { key: "codex", label: "Codex" },
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
        else if (item && item.sourceMarket === "npm") url = `/api/skill-fusion/audit?source=npm&name=${encodeURIComponent(sk.name)}`;
        else {
          url = `/api/skill-fusion/audit?source=${mode}`;
          if (mode === "npm") url += `&name=${encodeURIComponent(sk.name)}`;
          else if (mode === "github") url += `&repo=${encodeURIComponent(query)}&ref=${encodeURIComponent(ref || "main")}&name=${encodeURIComponent(sk.name)}`;
          else if (path) url += `&path=${encodeURIComponent(path)}`;
          url += `&name=${encodeURIComponent(sk.name)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        const key = item ? `${item.name}:${sk.name}` : sk.name;
        setAuditMap(prev => ({ ...prev, [key]: data }));
      };

      const doActivate = async (sk, item) => {
        let body;
        if (item && item.sourceMarket === "github") body = { sourceKind: "github", sourceRef: `${item.name}@${item.ref || "main"}`, name: sk.name };
        else if (item && item.sourceMarket === "npm") body = { sourceKind: "npm", sourceRef: item.name, name: sk.name };
        else if (mode === "npm") body = { sourceKind: "npm", sourceRef: query, name: sk.name };
        else if (mode === "github") body = { sourceKind: "github", sourceRef: `${query}@${ref || "main"}`, name: sk.name };
        else if (mode === "local") body = { sourceKind: "local", sourceRef: path, name: sk.name };
        else if (mode === "claude") body = { sourceKind: "claude", sourceRef: path || null, name: sk.name };
        else body = { sourceKind: "codex", sourceRef: path || null, name: sk.name };
        const res = await fetch("/api/skill-fusion/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.ok) setResults(prev => (prev || []).filter(c => c.name !== sk.name));
        return data;
      };

      const inputVal = mode === "market" || mode === "npm" || mode === "github" ? query : path;
      const onInput = e => (mode === "market" || mode === "npm" || mode === "github") ? setQuery(e.currentTarget.value) : setPath(e.currentTarget.value);
      const placeholder = mode === "market" ? t("marketPlaceholder")
        : mode === "npm" ? t("npmPlaceholder")
        : mode === "github" ? t("githubPlaceholder")
        : mode === "local" ? t("localPlaceholder")
        : mode === "claude" ? t("claudePlaceholder")
        : t("codexPlaceholder");

      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("intro")),
        react.createElement("div", { style: s.tabs },
          ...SOURCES.map(src => react.createElement("button", { key: src, style: s.tabBtn(mode === src), onClick: () => setMode(src) }, t(src)))
        ),
        mode === "market" ? react.createElement("div", { style: s.tabs },
          ...PLATFORMS.map(p => react.createElement("button", { key: p.key, style: s.tabBtn(platform === p.key), onClick: () => pickPlatform(p.key) }, p.label))
        ) : null,
        react.createElement("div", { style: { display: "flex", gap: "8px" } },
          react.createElement("input", { style: s.input, value: inputVal, onChange: onInput, placeholder, onKeyDown: e => { if (e.key === "Enter") doSearch(); } }),
          mode === "github" ? react.createElement("input", { style: Object.assign({}, s.input, { flex: "0 0 120px" }), value: ref, onChange: e => setRef(e.currentTarget.value), placeholder: t("refPlaceholder") }) : null,
          react.createElement("button", { style: s.btn(true), onClick: doSearch }, mode === "market" ? t("search") : t("browse"))
        ),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        results !== null && results.length === 0 ? react.createElement("p", { style: s.intro }, marketMode ? t("emptyMarket") : t("empty")) : null,
        results ? react.createElement("div", { style: s.cards },
          marketMode
            ? results.map(item => react.createElement(MarketCard, { key: item.name, item, t, onInspect: doInspect, expanded: expanded[item.name], onActivate: doActivate, onAudit: doAudit, auditMap }))
            : results.map(c => react.createElement(SkillCard, { key: c.name, skill: c, t, onAudit: () => doAudit(c), onActivate: () => doActivate(c), auditResult: auditMap[c.name] }))
        ) : null
      );
    }

    function ActivatedView({ t }) {
      const [skills, setSkills] = react.useState(null);
      const [loading, setLoading] = react.useState(true);
      const [exportMsg, setExportMsg] = react.useState(null);
      const fetchList = async () => {
        try {
          const res = await fetch("/api/skill-fusion/list");
          const data = await res.json();
          if (data.ok) setSkills(data.skills);
        } catch {}
        setLoading(false);
      };
      react.useEffect(() => { fetchList(); }, []);

      const doUninstall = async (name) => {
        const res = await fetch("/api/skill-fusion/uninstall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
      const doFreeze = async (name) => {
        const version = prompt("Version to freeze at (e.g. 1.0.0):");
        if (!version) return;
        const res = await fetch("/api/skill-fusion/freeze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, version }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
      const doUnfreeze = async (name) => {
        const res = await fetch("/api/skill-fusion/unfreeze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
      const doUpdate = async (name) => {
        const res = await fetch("/api/skill-fusion/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
      const doRollback = async (name) => {
        const res = await fetch("/api/skill-fusion/rollback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        const data = await res.json();
        if (data.ok) fetchList();
      };
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
        react.createElement("p", { style: s.intro }, t("intro")),
        react.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
          react.createElement("button", { style: s.btn(false), onClick: doExport }, t("export")),
          exportMsg ? react.createElement("span", { style: s.meta }, exportMsg) : null
        ),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        skills !== null && skills.length === 0 ? react.createElement("p", { style: s.intro }, t("emptyActivated")) : null,
        skills ? react.createElement("div", { style: s.cards },
          skills.map(sk => react.createElement(SkillCard, {
            key: sk.name, skill: sk, t,
            onUninstall: () => doUninstall(sk.name),
            onFreeze: sk.status === "frozen" || sk.frozenVersion ? undefined : () => doFreeze(sk.name),
            onUnfreeze: sk.status === "frozen" || sk.frozenVersion ? () => doUnfreeze(sk.name) : undefined,
            onUpdate: () => doUpdate(sk.name),
            onRollback: () => doRollback(sk.name),
          }))
        ) : null
      );
    }

    function SkillForgeView({ t }) {
      const [view, setView] = react.useState("discover");
      return react.createElement("div", { style: s.section },
        react.createElement("div", { style: s.tabs },
          react.createElement("button", { style: s.tabBtn(view === "discover"), onClick: () => setView("discover") }, t("discover")),
          react.createElement("button", { style: s.tabBtn(view === "activated"), onClick: () => setView("activated") }, t("activated"))
        ),
        view === "discover" ? react.createElement(DiscoverView, { t }) : react.createElement(ActivatedView, { t })
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
