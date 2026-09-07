# dsh-skill-fusion (技能熔炉)

Skill lifecycle manager for DeepSeek Harness (DSH): **discover → audit → activate → freeze** any skill package — from the GitHub/npm skill market, a local folder, a zip archive, or the `~/.claude` / `~/.codex` / `~/.agents` skill roots.

DSH has a first-class `dsh plugin` command but no `dsh skill` — pure-skill packages install as plain dependencies and their `SKILL.md` is never discovered (see the [design doc](docs/superpowers/specs/2026-08-26-skill-fusion-design.md) for the source-verified gap analysis). Skill Fusion fills that gap, complementing `dshmarket` (plugins) with zero overlap.

## Features

- **Skill market** — search GitHub repos + npm packages by keyword, ranked by stars/popularity, with a curated featured homepage, pagination and infinite scroll.
- **8 discovery sources** — market, GitHub, npm, local folder, zip archive, and the `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills` roots (agents candidates are marked "already active"; promoting them into the DSH root is always an explicit action).
- **Pre-activation audit** — skills are model instructions, so the audit scans prompt-injection vectors (instruction override, concealment, chat-boundary injection, credential access, exfiltration URLs, base64 payloads) with line numbers, plus structural checks (frontmatter, name conflicts, trigger overlap). `pass` / `warn` (explicit confirm) / `block`.
- **Community-trust tiers** — verified / established / community / new / archived, computed from stars *and* maintenance recency; low-trust installs require confirmation.
- **Full lifecycle** — symlink-or-copy activation into `~/.dsh/skills` (native DSH discovery + HMR, sandboxed non-trusted root), freeze/pin, update with re-audit, snapshot rollback, export/import bundles, orphan reconciliation, local enable/disable.
- **Chinese-first UX** — bundled curated index (21 repos, 217 skills) with Chinese descriptions, offline browsing, and relevance-ranked intent search with synonym expansion; localized README/SKILL.md intros with English fallback.
- **Three faces, one core** — a settings page (Settings → Skill Forge), a `skill-fusion` CLI, and a `SKILL.md` so an agent can drive the whole lifecycle itself; all share `lib/*`.
- **Zero runtime dependencies** — Node 18+ built-ins and global `fetch` only; tarballs are fetched and extracted without running package scripts.

## Install

```bash
dsh plugin add dsh-skill-fusion
```

Then open **Settings → Skill Forge** for the GUI, or use the CLI:

## CLI

```bash
skill-fusion discover --market "code review"     # search the GitHub + npm skill market
skill-fusion discover --local ./my-skills        # … or a local folder
skill-fusion discover --zip ./bundle.zip         # … or a zip archive
skill-fusion discover --claude                   # … or ~/.claude/skills (also --codex, --agents)

skill-fusion audit --local ./my-skills --name my-skill     # pre-activation audit
skill-fusion activate --local ./my-skills --name my-skill  # audit → symlink/copy into ~/.dsh/skills
skill-fusion activate --github owner/repo --name some-skill
skill-fusion activate --npm some-pkg --name some-skill

skill-fusion list                                # managed skills (+ orphans)
skill-fusion freeze --name x --version 1.2.0     # pin; skipped by update
skill-fusion update [--name x]                   # re-fetch → re-audit → snapshot → activate
skill-fusion rollback --name x                   # restore the pre-update snapshot
skill-fusion export --out bundle.json            # backup / migrate
skill-fusion import --from bundle.json
skill-fusion uninstall --name x
```

## Architecture

| Face | Entry | Audience |
|---|---|---|
| Host plugin | `lib/index.js` + `cordis.patch.yml` | same-origin JSON routes under `/api/skill-fusion/*` |
| Browser client | `client/client.js` (generated from `client/src/*`) | settings-page GUI |
| CLI | `bin/skill-fusion.js` | humans & agents (bash) |
| Skill | `skills/skill-fusion/SKILL.md` | agents (model) |

State lives in `~/.dsh/skill-fusion/` (manifest, audit cache keyed by content hash, snapshots); activated skills land in `~/.dsh/skills/` so DSH discovers them natively — no discovery wheel reinvented, no trusted-host privilege granted to community skills.

## Development

```bash
npm test                 # 200+ tests, never touch the network (fetch is mocked)
npm run build:client     # regenerate client/client.js after editing client/src/*
node bin/build-client.js --check   # CI freshness check for the generated bundle
```

Design spec & phase plans: [`docs/superpowers/`](docs/superpowers/specs/2026-08-26-skill-fusion-design.md). License: MIT.

---

## 中文简介

**技能熔炉**是 DeepSeek Harness 的技能生命周期管理器：发现 → 审计 → 激活 → 固化,一站式接管任意来源的技能包(GitHub/npm 市场、本地目录、zip 压缩包、Claude/Codex/agents 技能根)。

- **技能市场**:按关键词搜索 GitHub + npm,星标/热度排序,精选首页 + 无限滚动。
- **激活前审计**:技能是模型指令而非可执行代码,审计扫描 prompt-injection 向量(指令覆写、隐瞒用户、伪造消息边界、凭证访问、外泄 URL、base64 载荷),带行号;结构性问题(frontmatter 损坏、重名冲突)直接阻断。
- **信任分层**:星标 + 维护活跃度双信号(verified/established/community/new/archived,长期未维护标"长期未更新"),低信任安装需显式确认。
- **完整生命周期**:软链/复制激活进 `~/.dsh/skills`(原生发现 + 热更新,社区技能保持沙箱化),冻结/更新(重审+快照)/回滚/导出导入/孤儿清理/本地启用停用。
- **中文体验**:内置 21 个仓库 217 个技能的精选中文索引,离线浏览 + 中文意图搜索(同义词扩展);README/SKILL.md 中文优先本地化。
- **零运行时依赖**:仅用 Node 18+ 内置模块与全局 fetch;tarball 下载解压,绝不执行包构建脚本。

安装:`dsh plugin add dsh-skill-fusion`,然后打开 **设置 → 技能熔炉**,或用 `skill-fusion` CLI( agent 可经 SKILL.md 自驱全流程)。
