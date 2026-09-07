// Source module for the client bundle. Edit here, then regenerate
// client/client.js with: npm run build:client

const PASS_COLOR = "var(--dsw-alias-state-success-primary, #16a34a)";
const WARN_COLOR = "var(--dsw-alias-state-warning-primary, #d97706)";
const BLOCK_COLOR = "var(--dsw-alias-state-error-primary, #dc2626)";

// Loading spinner: inject keyframes once, then <span className="sf-spinner">.
function ensureSpinnerStyle() {
  if (typeof document === "undefined" || document.getElementById("sf-spin-style")) return;
  const st = document.createElement("style");
  st.id = "sf-spin-style";
  st.textContent = "@keyframes sfSpin{to{transform:rotate(360deg)}}.sf-spinner{display:inline-block;width:11px;height:11px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-accent,#4f8cff);border-radius:50%;animation:sfSpin .7s linear infinite;vertical-align:-1px;margin-right:6px}";
  document.head.appendChild(st);
}
function spinner() { return react.createElement("span", { className: "sf-spinner" }); }
function verdictColor(v) { return v === "pass" ? PASS_COLOR : v === "warn" ? WARN_COLOR : BLOCK_COLOR; }

// Community-trust badge for market results; a stale (long-unmaintained)
// result gets an extra warning badge next to its tier badge.
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
  const badge = react.createElement("span", { style: s.badge(color) }, label);
  if (!trust.stale || trust.tier === "archived") return badge; // archived already signals dead
  return react.createElement(react.Fragment, null, badge, react.createElement("span", { style: s.badge(WARN_COLOR) }, t("trustStale")));
}

function SkillCard({ skill, t, onAudit, onActivate, onUninstall, onFreeze, onUnfreeze, onUpdate, onRollback, onToggle, onDelete, onRestore, onAbout, about, auditResult }) {
  const verdict = auditResult?.verdict;
  const isFrozen = skill.status === "frozen" || skill.frozenVersion != null;
  // Busy wrapper: disable all buttons while an action runs, spinner on the active one.
  const [busy, setBusy] = react.useState(null);
  const run = (key, fn) => async () => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };
  const busyBtn = (key, primary, onClick, label) => onClick
    ? react.createElement("button", { style: Object.assign({}, s.btn(primary), { opacity: busy && busy !== key ? 0.5 : 1 }), disabled: !!busy, onClick: run(key, onClick) },
        busy === key ? react.createElement(react.Fragment, null, spinner(), label) : label)
    : null;
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
      busyBtn("toggle", !skill.enabled, onToggle, skill.enabled ? t("disable") : t("enable")),
      busyBtn("restore", true, onRestore, t("restore")),
      busyBtn("delete", false, onDelete, t("deleteBtn")),
      busyBtn("about", false, onAbout, t("about")),
      busyBtn("audit", false, onAudit, t("audit")),
      busyBtn("activate", true, onActivate, t("activate")),
      busyBtn("freeze", false, onFreeze, t("freeze")),
      busyBtn("unfreeze", false, onUnfreeze, t("unfreeze")),
      busyBtn("update", false, onUpdate, t("update")),
      busyBtn("rollback", false, onRollback, t("rollback")),
      busyBtn("uninstall", false, onUninstall, t("uninstall"))
    )
  );
}

// Market result card: a GitHub repo or npm package that may contain skills.
function MarketCard({ item, t, onInspect, expanded, onActivate, onAudit, auditMap, zhIndex }) {
  // Chinese intro from the bundled index when this repo is curated (中文介绍优先).
  const repoZh = zhIndex?.repos?.[item.name] || zhIndex?.repos?.[`npm:${item.name}`] || null;
  const mainDesc = repoZh?.zhIntro || item.description || "";
  const rankBadge = item.rankKind === "stars"
    ? react.createElement("span", { style: s.rankBadge }, `${item.rankLabel} ${t("stars")}`)
    : react.createElement("span", { style: s.rankBadge }, `${t("popularity")} ${item.rankLabel}`);
  const srcBadge = react.createElement("span", { style: s.srcBadge }, item.sourceMarket === "github" ? "GitHub" : "npm");
  const skillsInside = expanded ? expanded.filter(Boolean) : [];
  const [about, setAbout] = react.useState(undefined);       // repo-level README (zh-preferred)
  const [skillAbout, setSkillAbout] = react.useState({});    // per-skill localized SKILL.md
  const [inspecting, setInspecting] = react.useState(false);
  const [aboutLoading, setAboutLoading] = react.useState(false);
  const handleInspect = async (fresh) => {
    if (inspecting) return;
    setInspecting(true);
    try { await onInspect(item, { fresh: !!fresh }); } finally { setInspecting(false); }
  };
  const loadAbout = async () => {
    if (aboutLoading) return;
    setAboutLoading(true);
    setAbout(undefined);
    try {
      const url = item.sourceMarket === "github"
        ? `/api/skill-fusion/readme?source=github&repo=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref || "main")}`
        : `/api/skill-fusion/readme?source=npm&name=${encodeURIComponent(item.name)}`;
      const data = await (await fetch(url)).json();
      setAbout(data.ok ? data : null);
    } catch { setAbout(null); }
    setAboutLoading(false);
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
    react.createElement("p", { style: s.cardDesc }, mainDesc),
    repoZh && item.description && repoZh.zhIntro !== item.description ? react.createElement("p", { style: s.meta }, item.description) : null,
    about !== undefined ? (about
      ? react.createElement("div", null,
          react.createElement("span", { style: s.srcBadge }, about.lang === "zh" ? t("langZh") : t("langEn")),
          react.createElement("div", { style: s.aboutBox }, about.text)
        )
      : react.createElement("p", { style: s.meta }, t("noAbout"))) : null,
    react.createElement("div", { style: s.actionsSplit },
      item.url ? react.createElement("a", { href: item.url, target: "_blank", rel: "noreferrer", style: s.link }, t("openRepo")) : react.createElement("span"),
      react.createElement("div", { style: s.actions },
        react.createElement("button", { style: s.btn(false), disabled: aboutLoading, onClick: loadAbout },
          aboutLoading ? react.createElement(react.Fragment, null, spinner(), t("about")) : t("about")),
        react.createElement("button", { style: s.btn(false), disabled: inspecting, onClick: () => handleInspect(false) },
          inspecting
            ? react.createElement(react.Fragment, null, spinner(), t("discovering"))
            : skillsInside.length > 0 ? `${t("inspect")} (${skillsInside.length})` : t("inspect")
        )
      )
    ),
    skillsInside.length > 0 ? react.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" } },
      skillsInside.map(sk => {
        // Overlay Chinese description from the bundled index when available.
        const zhSk = zhIndex?.skills?.[`${item.name}:${sk.name}`];
        const skill = zhSk ? { ...sk, description: zhSk.zh || sk.description } : sk;
        return react.createElement(SkillCard, {
          key: sk.name, skill, t,
          onAudit: () => onAudit(sk, item),
          onActivate: () => onActivate(sk, item),
          onAbout: item.sourceMarket === "github" ? () => loadSkillAbout(sk) : undefined,
          about: skillAbout[sk.name],
          auditResult: auditMap[item.name + ":" + sk.name],
        });
      })
    ) : expanded && expanded.length === 0 && !inspecting ? react.createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
      react.createElement("p", { style: s.meta }, `${t("noSkillsIn")} ${item.name}. ${t("inspectFailHint")}`),
      react.createElement("button", { style: s.btn(false), onClick: () => handleInspect(true) }, t("retryFresh"))
    ) : null
  );
}
