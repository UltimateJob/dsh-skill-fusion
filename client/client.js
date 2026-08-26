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
      intro: "Discover, audit, and activate skills for DeepSeek Harness. Activated skills appear in ~/.dsh/skills and are discovered natively.",
      npmPlaceholder: "Enter npm package name (e.g. adversarial-review)",
      localPlaceholder: "Enter local path (e.g. ~/my-skills)",
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
      intro: "发现、审计、激活 DeepSeek Harness 技能。激活后技能出现在 ~/.dsh/skills 并被原生发现。",
      npmPlaceholder: "输入 npm 包名(如 adversarial-review)",
      localPlaceholder: "输入本地路径(如 ~/my-skills)",
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

    function DiscoverView({ t }) {
      const [mode, setMode] = react.useState("npm");
      const [query, setQuery] = react.useState("");
      const [path, setPath] = react.useState("");
      const [results, setResults] = react.useState(null);
      const [loading, setLoading] = react.useState(false);
      const [auditMap, setAuditMap] = react.useState({});

      const doSearch = async () => {
        setLoading(true);
        setResults(null);
        setAuditMap({});
        try {
          let url = "/api/skill-fusion/discover?source=" + mode;
          if (mode === "npm") url += "&name=" + encodeURIComponent(query);
          else url += "&path=" + encodeURIComponent(path);
          const res = await fetch(url);
          const data = await res.json();
          if (data.ok) setResults(data.candidates);
          else setResults([]);
        } catch { setResults([]); }
        setLoading(false);
      };

      const doAudit = async (name) => {
        const res = await fetch(`/api/skill-fusion/audit?source=${mode}&${mode === "npm" ? "name=" : "path="}${encodeURIComponent(mode === "npm" ? query : path)}&name=${encodeURIComponent(name)}`);
        const data = await res.json();
        setAuditMap(prev => ({ ...prev, [name]: data }));
      };

      const doActivate = async (name) => {
        const body = mode === "npm"
          ? { sourceKind: "npm", sourceRef: query, name }
          : { sourceKind: "local", sourceRef: path, name };
        const res = await fetch("/api/skill-fusion/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.ok) { setResults(prev => prev.filter(c => c.name !== name)); }
        return data;
      };

      return react.createElement("div", { style: s.section },
        react.createElement("p", { style: s.intro }, t("intro")),
        react.createElement("div", { style: s.tabs },
          react.createElement("button", { style: s.tabBtn(mode === "npm"), onClick: () => setMode("npm") }, "npm"),
          react.createElement("button", { style: s.tabBtn(mode === "local"), onClick: () => setMode("local") }, t("local"))
        ),
        react.createElement("div", { style: { display: "flex", gap: "8px" } },
          react.createElement("input", { style: s.input, value: mode === "npm" ? query : path, onChange: e => mode === "npm" ? setQuery(e.currentTarget.value) : setPath(e.currentTarget.value), placeholder: mode === "npm" ? t("npmPlaceholder") : t("localPlaceholder") }),
          react.createElement("button", { style: s.btn(true), onClick: doSearch }, t("browse"))
        ),
        loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
        results !== null && results.length === 0 ? react.createElement("p", { style: s.intro }, t("empty")) : null,
        results ? react.createElement("div", { style: s.cards },
          results.map(c => react.createElement(SkillCard, { key: c.name, skill: c, t, onAudit: () => doAudit(c.name), onActivate: () => doActivate(c.name), auditResult: auditMap[c.name] }))
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
    const inject = ["slots", "locale"];
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-fusion: dictionaries");
      const t = ctx.locale.bind(NS);
      ctx.effect(() => {
        const disposer = ctx.slots.register({
          name: "settings.section",
          id: "skill-fusion",
          order: 15,
          label: () => t("nav"),
          locale: NS,
          inject: () => ({}),
        }, (props) => react.createElement(SkillForgeView, Object.assign({}, props, { t })));
        return () => disposer();
      }, "skill-fusion: settings section");
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
