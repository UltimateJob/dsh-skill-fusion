# dsh-skill-fusion(技能熔炉)设计规格

- **日期**: 2026-08-26
- **状态**: 设计完成,待用户复核规格(通过后方进实现计划)
- **范围**: 全四阶段生命周期(discover → audit → activate → freeze)
- **边界**: 只管技能,与 `dshmarket`(管插件)互补,零功能重叠

---

## 1. 背景:已验证的结构性断裂

DSH 的技能与插件是两条割裂的安装路径,断裂点已被源码与当前 profile 状态证实:

1. **`dsh plugin` 是 pnpm 转发器,只调和 `dsh.profile.bundles`。** `plugin-9h8shc4d.js` 的协调逻辑:"a dependency resolving to a package that declares `dsh.bundle` joins the layer stack; a removed or bundle-less dependency leaves it"。无 `dsh.bundle` 的包触发警告:`declares no dsh.bundle - installed as a plain dependency, not a profile layer`。
2. **adversarial-review 是这条裂缝的实证**:它存在于当前 web profile 的 `dependencies` 但**不在** `dsh.profile.bundles` 列表;其 `package.json` 声明 `bin`(CLI)并发布 `skills/adversarial-review/`,但**无 `dsh.bundle`**。`dsh plugin add` 把它装成普通依赖,`SKILL.md` 静躺在 `node_modules/adversarial-review/skills/` 不被发现,用户被迫手动 `cp` 到 `~/.dsh/skills/adversarial-review/`。(包作者自己的 `sync-skill` 脚本把 references 拷到 `.agents/skills/...`,等于承认了这个缺口。)
3. **技能发现只认 6 个有序根**(`dsh-skill-filesystem`):`<project>/.dsh/skills`(100)、`<project>/.agents/skills`(200)、custom(300)、`~/.dsh/skills`(400, user-dsh)、`~/.agents/skills`(500, user-agents)、`$DSH_BUNDLED_SKILL_DIR`(bundled,**`trustedHost: true`**)。一层深。frontmatter 需 `name`(kebab-case)+ `description`。纯技能 npm 包的 `skills/<name>/SKILL.md` 不落在任何根里 → 永不被发现。
4. **DSH 没有 `dsh skill` 命令**——CLI 只有 `dsh plugin`(→ pnpm)与 `dsh web`。技能安装无一等公民命令,生命周期(版本/更新/回滚/导出)无人管理。
5. **`dsh-skill-manager` 是只读的**:包描述明写 "Read-only browser",`lib/index.js` 仅一个 `GET /api/skill-manager/list` 路由,从不写文件,只扫 2 个根。缺口比直觉更大——连增删改都没有。

**结论**:缺口真实且已机理性证实。dsh-skill-fusion 填补"纯技能包的安装/激活/生命周期"这一空缺,与 dshmarket(插件生命周期)严格互补。

---

## 2. 目标与非目标

### 目标
- 任何来源(npm / GitHub / `~/.claude/skills` / `~/.codex/skills` / `~/.agents/skills` / 本地文件夹 / zip)的技能包,经统一四阶段(发现→审计→激活→固化)进入可用态。
- 智能选激活路径:纯技能→软链(回退 copy)入 `~/.dsh/skills/`;混合/有 bundle 的→既装包又链接 skill。
- 激活前审计:冲突检测 + prompt-injection 向量扫描(不是脚本扫描),阻断硬无效、警告可疑、显式确认后放行。
- 固化:版本 pin / 更新(重审)/ 回滚 / 导出导入清单。
- 一个可写设置页(Settings → Skill Forge)浏览 + 操作全部被接管技能。
- 一个 SKILL.md 让 agent 经 CLI 自驱生命周期。
- 可在 dshmarket 上架、`dsh plugin add dsh-skill-fusion` 一键安装即生效。

### 非目标(v1 不做)
- 不管理插件层(install/update/uninstall/hot-disable/backup 全归 dshmarket)。
- 不把社区技能放进 `DSH_BUNDLED_SKILL_DIR` 受信根(安全降级,见 §6)。
- 不重写 `dsh-skill-filesystem` 的发现契约;复用它,仅往它的根里放文件。
- 不做技能商店式在线 registry;发现是扫本地 + npm/GitHub fetch,非托管 catalog。
- 不做技能正文编辑器(编辑用 DSH 的 `write`/`edit` 工具即可)。

---

## 3. 整体架构

### 3.1 包形态:一体四面共享 `lib/*`

| 面 | 文件 | 职责 | 调用者 |
|---|---|---|---|
| Host 插件 | `lib/index.js` + `cordis.patch.yml` | `dsh.bundle` 激活进 profile 层;注册 same-origin JSON 路由 | GUI(浏览器经 fetch) |
| 浏览器 | `client/client.js` | `window.__ModuleLoader__.load` + `ctx.slots.register("settings.section")` 设置页 | 人(浏览器) |
| CLI | `bin/skill-fusion.js` | 壳调用同一份 `lib/*` 的子命令 | agent(bash) |
| 技能 | `skills/skill-fusion/SKILL.md` | 教 agent 用 CLI 驱动四阶段 | agent(模型) |

四者共享 `lib/{discover,audit,activate,freeze,manifest,sources/*}.js`。Host/Client/CLI 三面任一改逻辑三处同步;SKILL.md 是 agent 入口指向 CLI(避免 agent 直连 localhost JSON 路由的别扭)。形态同 adversarial-review(技能+CLI)叠加 dsh-skill-manager(host+client 设置页)。

### 3.2 数据目录

```
~/.dsh/skill-fusion/          # fusion 自有,不在任何被扫描根下(manifest 永不被当 skill)
├── manifest.json             # 所有权登记簿
├── audits/<name>.<hash>.json # 审计结果按内容哈希缓存(变才重审)
└── snapshots/<name>@<v>/     # 回滚快照(copy 模式)
~/.dsh/skills/<name>/         # 被激活技能落这(软链/copy),原生发现、沙箱化
```

`~/.dsh/skill-fusion/` 是 `~/.dsh/skills/` 的兄弟,不在被扫描根内,故 manifest/audits/snapshots 永不被 `dsh-skill-filesystem` 扫成 skill。

### 3.3 manifest schema(旁路所有权登记簿)

```jsonc
{
  "version": 1,
  "skills": {
    "adversarial-review": {
      "sourceKind": "npm",            // npm|github|claude|codex|agents|local|zip
      "sourceRef": "adversarial-review@2.10.0",
      "version": "2.10.0",
      "commit": null,                 // github 源填 commit sha
      "activationMode": "symlink",    // symlink|copy
      "activatedAt": "2026-08-26T12:00:00Z",
      "frozenVersion": null,          // 冻结阶段写入;非 null = 跳过自动更新检查
      "lastAudit": {
        "verdict": "warn",            // pass|warn|block
        "hash": "sha256:...",
        "at": "2026-08-26T12:00:00Z",
        "flags": [                    // warn/block 的具体向量,带行号
          { "kind": "ignore-prior-instructions", "line": 42, "severity": "warn" }
        ]
      },
      "status": "active"              // active|orphan|frozen
    }
  }
}
```

激活态 = 文件落在 `~/.dsh/skills/`(原生发现);所有权 = manifest 旁路。两条线不耦合:删 manifest 不删 skill(只是 fusion 不再认领它),删 skill 不删 manifest(fusion 标 orphan、下次启动清理)。

### 3.4 激活目标根与安全基线

落 `~/.dsh/skills`(user-dsh,rank 400)。**已验证**:该根**非 `trustedHost`**,skill body 经 `ctx.fs` 沙箱读取(`readSkillText` 仅当 `root.trustedHost === true` 才走裸 Node fs)。社区技能保持沙箱化、不享受受信待遇,安全模型不倒退。

---

## 4. 四阶段生命周期 + 数据流 + 错误处理

### 4.1 Stage 1 — Discover(只读浏览可装技能)

**输入**:`sourceKind` + 查询参数(关键词 / 包名 / repo / 路径)。
**输出**:候选列表 `[{name, description, sourceKind, sourceRef, version, commit, fetchPath, hasBundle}]`。

源适配器(`lib/sources/*.js`),每个返回候选不写盘:
- **npm**:查 npm registry(全局 `fetch`,Node 18+)按 keyword(`dsh-skill`/`claude-skill`/`skill`)或已知包名;拉 `package.json`,探测是否 ship 了 `skills/<name>/SKILL.md`、是否声明 `dsh.bundle`。
- **github**:拉 repo tree(github API 或 `git clone` 到 temp),递归找 `**/SKILL.md`(此源是唯一允许递归的,因为 GitHub repo 结构自由)。
- **claude**:读 `~/.claude/skills/`(一层)。
- **codex**:读 `~/.codex/skills/`(一层)。
- **agents**:读 `~/.agents/skills/`(DSH 本就激活这些;fusion 把它们显示为"导入候选"——可 promote 进 `~/.dsh/skills/` 以跨 agent 共享)。
- **local/zip**:读本地路径;zip 解压到 temp 后读。

Discover 是**目录视图**(可装技能的"货架"),与"已激活"集分开。设置页左栏=Discoverable,右栏=Activated,审计+激活桥接两者。Discover 阶段零写盘。

**错误处理**:网络失败 → 候选集标 `degraded`,保留已得候选不替换(对齐 dsh-skill-filesystem "unexpected failures preserve last-good" 语义);路径不存在 → 空候选(非错误);frontmatter 缺失 → 候选标 `parse-failed` 仍展示(交审计阶段阻断)。

### 4.2 Stage 2 — Audit(激活前安全 + 冲突)

**输入**:一个 discovered 候选。
**输出**:`{ verdict: pass|warn|block, checks: [...], hash }`。写 `~/.dsh/skill-fusion/audits/<name>.<hash>.json`(哈希缓存:内容变才重审)。

检查项:
1. **frontmatter 有效性**(hard block):`name` kebab-case、`description` 非空、`disable-model-invocation`/`user-invocable` 是合法布尔。fusion 不重复发现层的 skip 逻辑,但会把"会被 dsh-skill-filesystem skip"标为 block,理由写明。
2. **冲突检测**:
   - name 冲突:与 fusion 可见的全部根(`~/.dsh/skills`、`~/.agents/skills`、project)已存在 skill 同名 → block(除非 `--force`,激活会覆盖)。
   - trigger 重叠:候选 `whenToUse`/description 触发短语与现有 skill 触发短语碰撞 → warn(不 block;用户定夺)。
3. **prompt-injection 向量扫描**(warn 为主,见 §5):body 内标 `disregard above`/`ignore prior instructions`、外部 URL fetch 指令(外泄面)、触碰 `~/.dsh/.credentials`/env/secrets 的 `bash`/`pwsh` 指令、写 skill 资源目录外的指令。带行号列出。
4. **引用完整性**(block):`references/<file>` 被提及但源 bundle 里不存在 → block。

verdict 映射:pass→可激活;warn→设置页显式确认后激活;block→拒绝激活,UI 灰掉并写明理由。

**错误处理**:审计自身抛错 → verdict=`error`(非 block 非 pass),UI 提示"审计未完成,不可激活";不缓存(下次重审)。

### 4.3 Stage 3 — Activate(路径选择 + 写)

**输入**:`{name, source, sourceRef, mode?}`(`mode` 缺省则自动选)。
**路径选择**:
- 源是**已装 npm 包路径**或**本地/git 路径** → **symlink**:`~/.dsh/skills/<name>` → 源 `skills/<name>/`。
- symlink 失败(Windows 无 dev-mode / 源是 zip 拉取的 temp)→ **copy** 回退。
- 有 `dsh.bundle` 的包 → fusion 只 symlink 其 ship 的 skill(若该 skill 未被发现);fusion 不代行插件安装,插件层(install/update/uninstall)归 dshmarket。

**写动作**:建 `~/.dsh/skills/<name>/`(或软链);记 manifest(skill 条目 + lastAudit)。激活后 dsh-skill-filesystem watcher 自动发现(native)、dsh-skill-manager 只读页自动显示、HMR 自动刷新——零重造发现轮子。

**orphan 清理**:fusion 启动时对账 manifest vs 文件系统——软链悬空(源被 `pnpm remove`)→ 标 `orphan`,UI 提示重链或移除。

**错误处理**:目标名已占且非 fusion 拥有 → block(避免覆盖用户手放的 skill);copy 模式部分失败(引用漏拷)→ 回滚已写部分 + manifest 不落条目;symlink 失败自动转 copy,仍失败才报错。

### 4.4 Stage 4 — Freeze(版本 pin + 更新 + 回滚 + 导出)

- **Pin**:写 `frozenVersion`;更新检查跳过 pinned 项(除非 `--force`)。
- **Update**:重新 fetch 源(npm:最新 version;github:最新 commit);内容哈希变 → 重审计 → pass/warn-confirmed → 切链/重拷(symlink 只改指向,copy 重拷);旧态先入 `snapshots/`。
- **Rollback**:copy 模式 → 换到 `snapshots/<name>@<v>/`;symlink 模式 → git 源 checkout 旧 commit 重链。失败回滚到当前。
- **Export**:`skill-fusion-bundle-<ts>.json` = manifest 子集 + 已激活技能的 tar。
- **Import**:merge 语义(导出后新激活的保留)、写前校验、失败回滚(镜像 dshmarket backup 语义以求一致)。
- **Uninstall**:删链/拷 + manifest 条目 + snapshots。

**错误处理**:更新 fetch 失败 → 保留当前不动 + manifest 标 `update-failed`;回滚目标快照缺失 → 报错不动当前;导出包含可能凭证(skill metadata)→ UI 警告后再写(对齐 dshmarket)。

### 4.5 总数据流

```
Discover(只读) → Audit(只读+缓存) → Activate(写 ~/.dsh/skills + manifest) → [native 发现/HMR]
                                                              ↓
                                          Freeze(重审→切链→快照) / Export / Uninstall
```

Discover 与 Audit 全程只读;只有 Activate 与 Freeze 写盘,且只写两个位置:`~/.dsh/skills/<name>/` 与 `~/.dsh/skill-fusion/`。错误一律"保留当前不动 + 标记状态",不破坏已激活态。

---

## 5. 审计威胁模型:prompt-injection,不是脚本扫描

DSH 技能是**模型指令**(body 进模型 context),非可执行代码。恶意 `SKILL.md` 的真实攻击面是 prompt injection:

- **调度劫持**:恶意 `whenToUse`/description 触发短语让 skill 在不该触发时被自动调度。
- **指令覆写**:body 含 `disregard above instructions`/`ignore previous`/`you are now ...`。
- **数据外泄**:body 指示模型 fetch 外部 URL 带上 `~/.dsh/.credentials`/env 内容,或 `curl` 到可疑域。
- **越界写**:body 指示写 skill 资源目录外、删非 fusion 管理文件。

"扫描脚本"的框架会给人虚假安全感——技能没有可执行脚本(执行的是模型读指令后用工具)。所以审计的实质是扫**指令向量**,标 warn 为主、显式确认放行,而非假装能"杀毒"。

hard block 仅用于**结构性无效**(frontmatter 坏、引用断、name 冲突),因为这类激活了也 load 不起来或污染目录;injection 向量一律 warn——最终是否激活是用户的信任决定,fusion 只负责把风险显式化。

---

## 6. 安全与沙箱边界

1. **社区技能落沙箱根**:入 `~/.dsh/skills`(非 `trustedHost`),body 经 `ctx.fs` 读,不享受受信。已验证。
2. **不滥用 `DSH_BUNDLED_SKILL_DIR`**:该机制为 DSH 自带受信技能设计(`trustedHost: true` → 裸 Node fs)。把未审计社区技能塞进受信根是安全降级,即便过了 fusion 审计,"过扫描"≠"受信宿主"。v1 否决该路径;留作未来"fusion 验证签名技能"轨道。
3. **POST 路由 same-origin 强制**:照搬 dsh-skill-manager 的 `isSameOriginRequest`(校 `sec-fetch-site`/origin/host)。
4. **不重启**:技能变更高 HMR 热加载(watcher),无需 dshmarket 那套 loopback 重启机制。
5. **不跑构建脚本**:源 npm 包若由用户经 `dsh plugin add`/dshmarket 装入 profile(其 install 走 pnpm,build 脚本默认禁,pnpm≥10),fusion 只 symlink 其产物;或 fusion 自取 tarball(全局 `fetch` 解压到 fusion 缓存,不执行 scripts)。两条路径都不跑构建脚本。
6. **激活前审计**:技能激活后 body 每 session 进模型 context,故审计必须在写盘前跑完(§4.2)。
7. **manifest/audits/snapshots 不外泄**:导出含 metadata 时 UI 警告(对齐 dshmarket backup 警告)。

---

## 7. 零运行时依赖立场

原提案"零运行时依赖"。核实后:**可达成且与 dsh-skill-manager 一致**:
- HTTP(npm/GitHub 发现):全局 `fetch`(Node 18+,adversarial-review engines 也要求 ≥18)。
- fs:Node 内置。
- frontmatter 解析:自写行级正则解析(照 dsh-skill-manager 的 `parseFrontmatter`,无 yaml 依赖)——常见 case 够用;复杂 YAML 交给发现层权威 `dsh-skill-filesystem` 去 skip,fusion 不重复其校验。
- zip 解压:Node 内置 `zlib` + 手解 zip header,或接受 Node 22+ 的内置 zip(视目标 Node 版本;MVP 先支持 npm/github/local,zip 进 §11 未决)。

**结论**:`dependencies: {}`(零 own deps),仅 `peerDependencies`(react、cordis,与 dsh-skill-manager/dshmarket 同)。安全模型对标 dsh-plugin-check:只用 Node 内置 + 全局 fetch。若 zip 强需求,再评估单一可信小依赖(未决)。

---

## 8. 市场上架路径

照 dshmarket README 实证:
1. 发到 npm(`dsh-skill-fusion`),使 `dsh plugin add dsh-skill-fusion` 可装、tarball 优先、registry-verified 防 squat。
2. 声明 `dsh.bundle`(激活进 profile 层——fusion 自己必须正激活,不能重蹈 adversarial-review 覆辙)。
3. 公开 GitHub 仓(dshmarket 把 npm 与 repo 比对防 squat)。
4. 向 curated `awesome-dsh-plugin/awesome-dsh-plugin` registry 开**一个 PR**(市场与站点自动 pick up,通常一天内)。
5. 预期被标 CLI-surface(fusion 有 `bin/`)——正常,市场安装前会提示用户。

fusion 的 `cordis.patch.yml` 注册 host 路由 + 注入 client bundle;`package.json` 的 `dsh.client.inject` 含 `@deepseek-ai/dsh-client-ui-settings`(参考 dshmarket)以拿到设置运行时。

---

## 9. 测试策略

1. **纯函数单测**(`node --test`):frontmatter 解析、冲突检测、injection 向量匹配、manifest 序列化、路径选择决策表。
2. **激活集成测**:temp `DSH_HOME=/tmp/...` 重定向 `~/.dsh`,fixture skill 软链/copy 落 `~/.dsh/skills/<name>/`,断言文件到位 + frontmatter 合法。信任 `dsh-skill-filesystem` 的发现契约(其 README 已述),不重测它。
3. **源适配器**:mock `fetch` 响应,断言候选解析;测试**永不触网**。
4. **平台矩阵**:symlink 行为 POSIX vs Windows——CI 跑双平台,Windows 路径走 copy 回退分支。
5. **审计缓存**:同内容哈希不重审;内容变重审。
6. **orphan 清理**:模拟源被删,断言 manifest 标 orphan 且不破坏其他 skill。
7. **SKILL.md liveness**:冒烟——agent 读 `skills/skill-fusion/SKILL.md` 后能否正确调 CLI 完成一次 discover→audit→activate(人工或 e2e 脚本)。

---

## 10. 交付阶段化(虽全范围,仍分阶段降风险)

虽用户选全四阶段,实现仍分两阶段交付以控风险:

- **Phase 1(激活通路)**:包骨架 + Discover(npm/local)+ Audit(冲突+injection)+ Activate(软链/copy)+ manifest + 设置页(发现候选只读浏览 + 审计/激活可写操作)+ CLI 子集 + SKILL.md。**端到端打通 adversarial-review 类痛点**。
- **Phase 2(固化层)**:Freeze(pin/update/rollback)+ Export/Import + 多源(github/claude/codex/agents/zip)+ orphan 自动清理 + 更新触发重审。叠加在 Phase 1 已验证的激活层上。

每阶段自身可发布、可用、有测试。Phase 1 解决最初提案的痛点(adversarial-review 装了不生效),Phase 2 补全生命周期。

---

## 11. 风险与未决

1. **zip 解压**:Node 内置 zip 支持随版本异构。MVP 先不支持 zip,或限定 Node 22+;否则引入单一可信小依赖(破零 dep 立场)。待规格复核时定。
2. **trigger 重叠检测的精度**:何为"重叠"——子串?语义?MVP 用子串+停用词,标注为粗粒度 heuristic,不冒充语义。待定阈值。
3. **`~/.agents/skills` promote 语义**:DSH 本就激活该根的 skill;fusion 把它 promote 到 `~/.dsh/skills` 会造成同 skill 在两根(rank 400 vs 500)都被发现 → 取 rank 高者。需明确 promote 是"复制链接"还是"建议用户移动"。倾向后者(只建议,不自动写)。
4. **市场 CLI-surface 标记**:fusion 有 `bin/` 必被标。可接受;若想降标,可把 CLI 拆成独立包 `dsh-skill-fusion-cli`,fusion 本体纯 host+client。倾向不拆(v1 一体四面),待定。
5. **Hindsight 记忆未配**:本次 `hindsight_capture_initiative` 返回 401(无 API token)。不阻塞设计;后续配好再补登。
