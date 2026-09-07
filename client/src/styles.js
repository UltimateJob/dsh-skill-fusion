// Source module for the client bundle. Edit here, then regenerate
// client/client.js with: npm run build:client

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
