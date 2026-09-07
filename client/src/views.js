// Source module for the client bundle. Edit here, then regenerate
// client/client.js with: npm run build:client

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
  const [zhIndex, setZhIndex] = react.useState(null); // bundled Chinese curated index
  const [searchHits, setSearchHits] = react.useState(null); // ranked intent-search hits

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

  // Load the bundled Chinese curated index on mount (offline, instant).
  // Falls back to the online featured homepage if the index is unavailable.
  react.useEffect(() => {
    (async () => {
      try {
        const data = await (await fetch("/api/skill-fusion/zh-index")).json();
        if (data.ok) setZhIndex(data.index);
        else doSearch("");
      } catch { doSearch(""); }
    })();
  }, []);

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
    if (key === "") {
      // 精选: back to the offline curated Chinese index.
      setQuery("");
      setResults(null);
    } else {
      setQuery(key);
      doSearch(key);
    }
  };

  // Curated index grouped by repo, filtered client-side by the query.
  const curatedGroups = react.useMemo(() => {
    if (!zhIndex) return [];
    const q = query.trim().toLowerCase();
    const byRepo = new Map();
    for (const [key, sk] of Object.entries(zhIndex.skills)) {
      const sep = key.indexOf(":");
      const repo = key.slice(0, sep);
      const name = key.slice(sep + 1);
      if (q && !name.toLowerCase().includes(q) && !(sk.zh || "").toLowerCase().includes(q) && !(sk.en || "").toLowerCase().includes(q) && !repo.toLowerCase().includes(q)) continue;
      if (!byRepo.has(repo)) byRepo.set(repo, []);
      byRepo.get(repo).push({ name, ...sk });
    }
    return [...byRepo.entries()];
  }, [zhIndex, query]);

  // Whether we're showing the offline curated view (精选 chip, no online results).
  const curatedMode = platform === "" && results === null;
  // Which repo groups are expanded in the curated browse view.
  const [openGroups, setOpenGroups] = react.useState(() => new Set());
  const toggleGroup = (repo) => setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(repo) ? next.delete(repo) : next.add(repo);
    return next;
  });

  // Debounced intent search over the bundled index (curated mode only):
  // matches name (zh/en) + Chinese descriptions with synonym expansion,
  // ranked server-side by relevance priority.
  react.useEffect(() => {
    if (!curatedMode) { setSearchHits(null); return; }
    const q = query.trim();
    if (!q) { setSearchHits(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/skill-fusion/search?q=${encodeURIComponent(q)}&limit=30`);
        const data = await res.json();
        setSearchHits(data.ok ? data.hits : []);
      } catch { setSearchHits([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, curatedMode]);

  const doInspect = async (item, { fresh = false } = {}) => {
    try {
      let url;
      if (item.sourceMarket === "github") url = `/api/skill-fusion/discover?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}${fresh ? "&fresh=1" : ""}`;
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

  // Curated view: offline Chinese index grouped by repo/developer.
  // With a query: relevance-ranked intent search across the whole index.
  const renderCurated = () => {
    if (!zhIndex) return react.createElement("p", { style: s.intro }, t("loading"));
    // Ranked intent search results (query non-empty)
    if (query.trim()) {
      if (searchHits === null) return react.createElement("p", { style: s.intro }, t("loading"));
      if (searchHits.length === 0) return react.createElement("p", { style: s.intro }, t("emptyCurated"));
      return react.createElement("div", { style: s.cards },
        searchHits.map(h => {
          const isNpm = !h.repo.includes("/");
          const item = isNpm ? { sourceMarket: "npm", name: h.repo } : { sourceMarket: "github", name: h.repo, ref: "main" };
          const skill = { name: h.name, description: h.zh || h.en, sourceKind: isNpm ? "npm" : "github" };
          return react.createElement("div", { key: h.key },
            react.createElement("p", { style: Object.assign({}, s.meta, { marginBottom: "-2px" }) },
              `${h.repo} · ${h.developer}`
            ),
            react.createElement(SkillCard, {
              skill, t,
              onAudit: () => doAudit({ name: h.name }, item),
              onActivate: () => doActivate({ name: h.name }, item),
              auditResult: auditMap[h.key],
            })
          );
        })
      );
    }
    // Grouped browse (query empty): collapsible repo/developer cards.
    if (curatedGroups.length === 0) return react.createElement("p", { style: s.intro }, t("emptyCurated"));
    return react.createElement("div", { style: s.cards },
      curatedGroups.map(([repo, skills]) => {
        const isNpm = !repo.includes("/");
        const repoMeta = zhIndex.repos[repo] || zhIndex.repos[`npm:${repo}`] || {};
        const open = openGroups.has(repo);
        const repoUrl = isNpm ? `https://www.npmjs.com/package/${repo}` : `https://github.com/${repo}`;
        return react.createElement("div", { key: repo, style: s.card },
          // Group header: repo + developer + skill count (always visible)
          react.createElement("div", { style: s.cardHead },
            react.createElement("a", { href: repoUrl, target: "_blank", rel: "noreferrer", style: Object.assign({}, s.link, { fontWeight: 600, fontSize: "14px" }) }, repo),
            react.createElement("div", { style: s.cardBadges },
              react.createElement("span", { style: s.srcBadge }, skills[0].developer),
              react.createElement("span", { style: s.rankBadge }, `${skills.length} ${t("skills")}`)
            )
          ),
          // Repo-level Chinese intro (上级介绍)
          repoMeta.zhIntro ? react.createElement("p", { style: s.cardDesc }, repoMeta.zhIntro) : null,
          // Actions: open repo link left, expand/collapse right
          react.createElement("div", { style: s.actionsSplit },
            react.createElement("a", { href: repoUrl, target: "_blank", rel: "noreferrer", style: s.link }, t("openRepo")),
            react.createElement("button", { style: s.btn(open), onClick: () => toggleGroup(repo) },
              open ? t("collapse") : `${t("inspect")} (${skills.length})`)
          ),
          // Expanded: the skills inside this repo
          open ? react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" } },
            skills.map(sk => {
              const item = isNpm ? { sourceMarket: "npm", name: repo } : { sourceMarket: "github", name: repo, ref: "main" };
              const skill = { name: sk.name, description: sk.zh || sk.en, sourceKind: isNpm ? "npm" : "github" };
              return react.createElement(SkillCard, {
                key: `${repo}:${sk.name}`, skill, t,
                onAudit: () => doAudit({ name: sk.name }, item),
                onActivate: () => doActivate({ name: sk.name }, item),
                auditResult: auditMap[`${repo}:${sk.name}`],
              });
            })
          ) : null
        );
      })
    );
  };

  return react.createElement("div", { style: s.section },
    react.createElement("p", { style: s.intro }, t("intro")),
    react.createElement("div", { style: s.chips },
      ...PLATFORMS.map(p => react.createElement("button", { key: p.key, style: s.chip(platform === p.key), onClick: () => pickPlatform(p.key) }, p.label))
    ),
    react.createElement("div", { style: s.searchRow },
      react.createElement("input", { style: s.input, value: query, onChange: e => setQuery(e.currentTarget.value), placeholder: curatedMode ? t("curatedPlaceholder") : t("marketPlaceholder"), onKeyDown: e => { if (e.key === "Enter") { doSearch(); } } }),
      react.createElement("button", { style: Object.assign({}, s.searchBtn(true), { opacity: loading ? 0.7 : 1 }), disabled: loading, onClick: () => { doSearch(); } },
        loading ? react.createElement(react.Fragment, null, spinner(), t("search")) : t("search")),
      react.createElement("button", { style: s.searchBtn(false), disabled: loading, onClick: () => doSearch(undefined, { fresh: true }), title: t("refreshHint") }, t("refresh"))
    ),
    curatedMode ? renderCurated() : null,
    !curatedMode && loading && !results ? react.createElement("p", { style: s.intro }, t("loading")) : null,
    !curatedMode && results !== null && results.length === 0 && !loading ? react.createElement("p", { style: s.intro }, t("emptyMarket")) : null,
    !curatedMode && results ? react.createElement("div", { style: s.cards },
      results.map(item => react.createElement(MarketCard, { key: item.name, item, t, onInspect: doInspect, expanded: expanded[item.name], onActivate: doActivate, onAudit: doAudit, auditMap, zhIndex }))
    ) : null,
    !curatedMode && results && results.length > 0 ? react.createElement("div", { ref: sentinelRef, style: { textAlign: "center", padding: "12px 0" } },
      loading ? react.createElement("span", { style: s.meta }, t("loading"))
        : hasMore ? react.createElement("button", { style: s.btn(false), onClick: () => doSearch(undefined, { append: true }) }, t("loadMore"))
        : react.createElement("span", { style: s.meta }, t("noMore"))
    ) : null
  );
}

// Local view: all skills across every source root (project / user / agents /
// plugin-bundled), grouped by source, with frontmatter enable/disable,
// create-skill scaffold, and a recoverable trash.
function ActivatedView({ t }) {
  const [skills, setSkills] = react.useState(null);
  const [loading, setLoading] = react.useState(true);
  const [exportMsg, setExportMsg] = react.useState(null);
  const [showCreate, setShowCreate] = react.useState(false);
  const [newName, setNewName] = react.useState("");
  const [newDesc, setNewDesc] = react.useState("");
  const [newRoot, setNewRoot] = react.useState("user");
  const [createMsg, setCreateMsg] = react.useState(null);
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
  const doToggle = async (sk) => { const data = await post("toggle", { name: sk.name, enabled: !sk.enabled }); if (data.ok) fetchList(); };
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
  const doDelete = async (sk) => {
    if (!confirm(t("confirmDelete"))) return;
    const data = await post("delete", { name: sk.name });
    if (data.ok) fetchList();
  };
  const doRestore = async (sk) => { const data = await post("restore", { name: sk.name }); if (data.ok) fetchList(); };
  const doCreate = async () => {
    const data = await post("create", { name: newName.trim(), description: newDesc.trim(), root: newRoot });
    if (data.ok) { setShowCreate(false); setNewName(""); setNewDesc(""); setCreateMsg(null); fetchList(); }
    else setCreateMsg(data.error === "exists" ? t("createExists") : t("createInvalid"));
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

  // Group by source root for display.
  const SOURCE_ORDER = ["user-dsh", "project-dsh", "project-agents", "user-agents", "plugin"];
  const srcLabel = (src) => src === "user-dsh" ? t("srcUser") : src === "project-dsh" ? t("srcProject") : src === "project-agents" ? t("srcProjectAgents") : src === "user-agents" ? t("srcAgents") : t("srcPlugin");
  const grouped = {};
  const trashed = [];
  for (const sk of skills || []) {
    if (sk.trashed) { trashed.push(sk); continue; }
    (grouped[sk.source] = grouped[sk.source] || []).push(sk);
  }
  const groups = SOURCE_ORDER.filter(src => grouped[src]?.length).map(src => [src, grouped[src]]);
  const activeCount = (skills || []).filter(sk => !sk.trashed).length;

  return react.createElement("div", { style: s.section },
    react.createElement("p", { style: s.intro }, t("localIntro")),
    react.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } },
      react.createElement("button", { style: s.btn(true), onClick: () => setShowCreate(!showCreate) }, t("create")),
      react.createElement("button", { style: s.btn(false), onClick: doExport }, t("export")),
      exportMsg ? react.createElement("span", { style: s.meta }, exportMsg) : null
    ),
    showCreate ? react.createElement("div", { style: s.card },
      react.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        react.createElement("input", { style: Object.assign({}, s.input, { flex: "0 0 200px" }), value: newName, onChange: e => setNewName(e.currentTarget.value), placeholder: t("namePlaceholder") }),
        react.createElement("select", { value: newRoot, onChange: e => setNewRoot(e.currentTarget.value), style: { height: "36px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", font: "inherit", padding: "0 8px" } },
          react.createElement("option", { value: "user" }, t("rootUser")),
          react.createElement("option", { value: "project" }, t("rootProject"))
        )
      ),
      react.createElement("input", { style: s.input, value: newDesc, onChange: e => setNewDesc(e.currentTarget.value), placeholder: t("descPlaceholder") }),
      react.createElement("div", { style: s.actions },
        react.createElement("button", { style: s.btn(true), onClick: doCreate }, t("createConfirm")),
        react.createElement("button", { style: s.btn(false), onClick: () => setShowCreate(false) }, t("createCancel")),
        createMsg ? react.createElement("span", { style: s.meta }, createMsg) : null
      )
    ) : null,
    loading ? react.createElement("p", { style: s.intro }, t("loading")) : null,
    skills !== null && activeCount === 0 ? react.createElement("p", { style: s.intro }, t("emptyLocal")) : null,
    groups.map(([src, list]) => react.createElement("div", { key: src, style: { display: "flex", flexDirection: "column", gap: "8px" } },
      react.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" } },
        react.createElement("strong", { style: s.cardTitle }, srcLabel(src)),
        react.createElement("span", { style: s.meta }, `${list.length} ${t("skills")}`),
        src === "plugin" ? react.createElement("span", { style: s.meta }, t("pluginReadonly")) : null
      ),
      ...list.map(sk => react.createElement(SkillCard, {
        key: sk.name, skill: sk, t,
        onToggle: sk.writable ? () => doToggle(sk) : undefined,
        onDelete: sk.writable ? () => doDelete(sk) : undefined,
        onUninstall: sk.managed ? () => doUninstall(sk.name) : undefined,
        onFreeze: sk.managed && !(sk.status === "frozen" || sk.frozenVersion) ? () => doFreeze(sk.name) : undefined,
        onUnfreeze: sk.managed && (sk.status === "frozen" || sk.frozenVersion) ? () => doUnfreeze(sk.name) : undefined,
        onUpdate: sk.managed ? () => doUpdate(sk.name) : undefined,
        onRollback: sk.managed ? () => doRollback(sk.name) : undefined,
      }))
    )),
    trashed.length > 0 ? react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" } },
      react.createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
        react.createElement("strong", { style: s.cardTitle }, t("trashTitle")),
        react.createElement("span", { style: s.meta }, `${trashed.length} ${t("skills")}`)
      ),
      ...trashed.map(sk => react.createElement(SkillCard, {
        key: sk.name, skill: sk, t,
        onRestore: () => doRestore(sk),
      }))
    ) : null
  );
}

function SkillForgeView({ t }) {
  const [view, setView] = react.useState("market");
  react.useEffect(() => { ensureSpinnerStyle(); }, []);
  return react.createElement("div", { style: s.section },
    react.createElement("div", { style: s.tabs },
      react.createElement("button", { style: s.tabBtn(view === "market"), onClick: () => setView("market") }, t("market")),
      react.createElement("button", { style: s.tabBtn(view === "local"), onClick: () => setView("local") }, t("local"))
    ),
    view === "market" ? react.createElement(DiscoverView, { t }) : react.createElement(ActivatedView, { t })
  );
}
