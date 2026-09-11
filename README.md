# dsh-skill-fusion (技能熔炉)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Status: Phase 1-2](https://img.shields.io/badge/status-Phase%201--2-blue.svg)](#project-status)
[![Tests: 19 files](https://img.shields.io/badge/tests-19%20files-success.svg)](#testing)

> **Skill lifecycle manager for DeepSeek Harness (DSH)** — discover, audit, activate, and freeze any skill package from npm, GitHub, `~/.claude/skills`, `~/.codex/skills`, or local folders. Fills the structural gap where pure skill npm packages ship `skills/<name>/SKILL.md` but never get discovered by DSH's 6-root scan.

**中文** | [English](#english)

---

## 中文

### 它解决什么问题

DSH 有"技能"和"插件"两条割裂的安装路径:

- `dsh plugin` 是 pnpm 转发器,只管有 `dsh.bundle` 声明的包能不能进 profile 层
- 技能发现只认 6 个固定根目录(`~/.dsh/skills/` 等),一层深

纯技能 npm 包(如 `adversarial-review`)发到 npm,`skills/<name>/SKILL.md` 是 ship 了的,但**包没有 `dsh.bundle`** → `dsh plugin add` 把它装成普通依赖 → SKILL.md 静躺在 `node_modules` → **永不被发现**。

用户被迫手动 `cp` 到 `~/.dsh/skills/`。没版本管理、没安全检查、没回滚。官方 `dsh-skill-manager` 还是只读的。

**fusion 填这个缺口**:任何来源的技能包,经统一四阶段进入可用态。

### 四阶段生命周期

```
Discover(只读) → Audit(只读+缓存) → Activate(写 ~/.dsh/skills + manifest) → [native 发现/HMR]
                                                              ↓
                                          Freeze(重审→切链→快照) / Export / Uninstall
```

| 阶段         | 作用                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| **Discover** | 扫源列候选,零写盘。是"可装技能的货架"                                                      |
| **Audit**    | **prompt-injection 向量扫描**(非脚本扫描)+ name/trigger 冲突检测。verdict: pass/warn/block |
| **Activate** | symlink 优先、copy 回退,落 `~/.dsh/skills/<name>/`(沙箱根,原生发现)                        |
| **Freeze**   | 版本 pin / 更新(重审) / 回滚快照 / 导出导入清单                                            |

### 审计威胁模型:为什么扫指令而非扫脚本

DSH 技能是**模型指令**(body 进模型 context),非可执行代码。恶意 SKILL.md 的真实攻击面是 prompt injection:

- 调度劫持(恶意 `whenToUse` 触发短语)
- 指令覆写(`disregard above instructions`)
- 数据外泄(fetch 外部 URL 带凭证)
- 越界写(写 skill 资源目录外)

"扫描脚本"会给人虚假安全感——技能没有可执行脚本。fusion 扫**指令向量**,warn 为主、显式确认放行。hard block 仅用于结构性无效(frontmatter 坏、引用断、name 冲突)。

### 五种来源

```bash
skill-fusion activate --local <dir> --name <name>          # 本地文件夹
skill-fusion activate --npm <pkg> --name <name>           # npm 包
skill-fusion activate --github owner/repo --name <name>   # GitHub 仓库
skill-fusion activate --claude --name <name>              # ~/.claude/skills/
skill-fusion activate --codex --name <name>               # ~/.codex/skills/
```

### 安装

```bash
# 从 npm 装(发布后)
dsh plugin --profile web add dsh-skill-fusion

# 或从本地源码装
dsh plugin --profile web add /path/to/dsh-skill-fusion
```

### 使用

**CLI:**

```bash
skill-fusion discover --local ./my-skills
skill-fusion audit --local ./my-skills --name my-skill
skill-fusion activate --local ./my-skills --name my-skill
skill-fusion list
skill-fusion freeze --name my-skill --version 1.0.0
skill-fusion update --name my-skill
skill-fusion rollback --name my-skill
skill-fusion export --out backup.json
skill-fusion import --from backup.json
```

**浏览器 GUI:** DSH Web UI → Settings → **Skill Forge / 技能熔炉**

**自然语言:** 直接对 DSH agent 说"把 `./my-skills/foo` 激活一下",agent 自驱 discover → audit → 等确认 → activate。

### 一体四面架构

| 面           | 文件                                 | 调用者            |
| ------------ | ------------------------------------ | ----------------- |
| Host 插件    | `lib/index.js` + `cordis.patch.yml`  | GUI(浏览器 fetch) |
| 浏览器设置页 | `client/client.js`                   | 人(点按钮)        |
| CLI          | `bin/skill-fusion.js` + `lib/cli.js` | agent(bash)       |
| 技能         | `skills/skill-fusion/SKILL.md`       | agent(模型自驱)   |

四者共享 `lib/*` 核心,改一处四面同步。

### 安全模型

- **社区技能落沙箱根** `~/.dsh/skills/`(非 `trustedHost`),body 经 `ctx.fs` 沙箱读取
- **绝不滥用 `DSH_BUNDLED_SKILL_DIR`** 受信根(安全降级)
- **POST 路由 same-origin 强制**(校 `sec-fetch-site` / origin / host)
- **不重启**:HMR 热加载
- **不跑构建脚本**:全局 `fetch` 拉 tarball 解压,不执行 scripts
- **激活前审计**:body 每 session 进模型 context

### 零运行时依赖

`dependencies: {}`,仅 Node 内置 + 全局 `fetch`。peerDeps 只有 react 和 cordis。

### 与 dshmarket 的边界

|                   | dshmarket                      | dsh-skill-fusion                     |
| ----------------- | ------------------------------ | ------------------------------------ |
| 管                | 插件(install/update/uninstall) | 技能(discover/audit/activate/freeze) |
| 触发 `dsh.bundle` | 是                             | 否(只 symlink 其 ship 的 skill)      |
| 重启机制          | loopback 重启                  | HMR 热加载                           |

严格互补,零功能重叠。

---

## English

A **skill lifecycle manager for DeepSeek Harness (DSH)** — discover, audit, activate, and freeze any skill package from npm, GitHub, `~/.claude/skills`, `~/.codex/skills`, or local folders.

Fills the structural gap where pure skill npm packages ship `skills/<name>/SKILL.md` but never get discovered by DSH's 6-root scan (because they lack `dsh.bundle` and land in `node_modules`, not in any scanned skill root).

### Four-Stage Lifecycle

| Stage                         | Purpose                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Discover** (read-only)      | Scan sources, list candidates. Zero disk writes.                                                                |
| **Audit** (read-only + cache) | **Prompt-injection vector scan** (not script scan) + name/trigger conflict detection. Verdict: pass/warn/block. |
| **Activate** (write)          | Symlink preferred, copy fallback. Lands in `~/.dsh/skills/<name>/` (sandbox root, natively discovered).         |
| **Freeze**                    | Version pin / update (re-audit) / rollback snapshot / export-import bundle.                                     |

### Why scan injection vectors, not scripts

DSH skills are **model instructions** (body enters model context), not executable code. Malicious SKILL.md's real attack surface is prompt injection:

- Dispatch hijacking (malicious `whenToUse`)
- Instruction override (`disregard above instructions`)
- Data exfiltration (fetch external URL with credentials)
- Out-of-bounds writes

"Script scanning" gives false confidence — skills have no executable scripts. fusion scans **instruction vectors**, warns primarily, requires explicit confirmation. Hard block only for structural invalidity (broken frontmatter, broken refs, name conflict).

### Five Sources

```bash
skill-fusion activate --local <dir> --name <name>          # local folder
skill-fusion activate --npm <pkg> --name <name>           # npm package
skill-fusion activate --github owner/repo --name <name>   # GitHub repo
skill-fusion activate --claude --name <name>              # ~/.claude/skills/
skill-fusion activate --codex --name <name>               # ~/.codex/skills/
```

### Install

```bash
dsh plugin --profile web add dsh-skill-fusion
# or from local source:
dsh plugin --profile web add /path/to/dsh-skill-fusion
```

### Usage

**CLI:**

```bash
skill-fusion discover --local ./my-skills
skill-fusion audit --local ./my-skills --name my-skill
skill-fusion activate --local ./my-skills --name my-skill
skill-fusion list
skill-fusion freeze --name my-skill --version 1.0.0
skill-fusion update --name my-skill
skill-fusion rollback --name my-skill
skill-fusion export --out backup.json
skill-fusion import --from backup.json
```

**Browser GUI:** DSH Web UI → Settings → **Skill Forge**

**Natural language:** Tell the DSH agent "activate the skill at `./my-skills/foo`" — it auto-runs discover → audit → waits for confirmation → activate.

### Architecture: One Package, Four Surfaces

| Surface          | File                                 | Caller                   |
| ---------------- | ------------------------------------ | ------------------------ |
| Host plugin      | `lib/index.js` + `cordis.patch.yml`  | GUI (browser fetch)      |
| Browser settings | `client/client.js`                   | Human (click)            |
| CLI              | `bin/skill-fusion.js` + `lib/cli.js` | Agent (bash)             |
| Skill            | `skills/skill-fusion/SKILL.md`       | Agent (model self-drive) |

All four share the same `lib/*` core. Change one, all four sync.

### Security Model

- **Community skills land in sandbox root** `~/.dsh/skills/` (non-`trustedHost`), body read via `ctx.fs` sandbox
- **Never abuse `DSH_BUNDLED_SKILL_DIR`** trusted root (security downgrade)
- **POST routes same-origin enforced** (checks `sec-fetch-site` / origin / host)
- **No restarts**: HMR hot-reload
- **No build scripts**: global `fetch` for tarball extraction, no script execution
- **Pre-activation audit**: body enters model context every session

### Zero Runtime Dependencies

`dependencies: {}`, only Node built-ins + global `fetch`. peerDeps: react, cordis.

### Boundary with dshmarket

|                       | dshmarket                          | dsh-skill-fusion                        |
| --------------------- | ---------------------------------- | --------------------------------------- |
| Manages               | Plugins (install/update/uninstall) | Skills (discover/audit/activate/freeze) |
| Triggers `dsh.bundle` | Yes                                | No (only symlinks shipped skill)        |
| Restart mechanism     | loopback restart                   | HMR hot-reload                          |

Strictly complementary, zero overlap.

---

## Project Status

- ✅ **Phase 1a** — Walking skeleton (lib core + CLI + local source)
- ✅ **Phase 1b** — Host plugin + Settings GUI + npm source
- ✅ **Phase 2** — Freeze (pin/update/rollback/export)

19 test files covering: pure-function unit tests, activation integration, source adapters (mock fetch, never touches network), platform matrix, audit caching, orphan reconciliation, e2e.

See `docs/superpowers/specs/2026-08-26-skill-fusion-design.md` for the full design spec.

## Testing

```bash
node --test
```

19 test files, all passing. Tests never touch the network (mock `fetch` injected).

## Contributing

MIT license. PRs welcome. See the design spec for the threat model and architectural constraints.

## Related

- [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) — The host platform
- [DSH Documentation](https://deepseek-harness.github.io/deepseek-harness/)
- [dshmarket](https://github.com/topics/dsh-plugin) — Plugin lifecycle manager (complementary)

## Keywords

`deepseek` `deepseek-harness` `dsh` `dsh-skill` `skill` `skill-lifecycle` `skill-manager` `skill-forge` `agent` `ai-agent` `prompt-injection` `skill-activation` `npm-skill` `github-skill` `claude-skill` `codex-skill` `skill-audit` `skill-freeze` `skill-rollback` `skill-export` `nodejs` `esm` `zero-dependency` `sandbox` `cordis` `react` `mit-license` `open-source`
