# dsh-skill-fusion: 技能市场发现(Market Discovery)实现计划

- **日期**: 2026-08-27
- **状态**: 需求纠偏后新计划 —— Discover 从"精确路径发现"升级为"市场搜索 + 排名 + 浏览 + 一键用"
- **驱动**: 用户明确 —— "要能主动发现 claude/codex/github 上的 skill,按使用量排名,可搜索,不同类型直接加入 DSH 使用,而不是只能拷贝本地 skill"

---

## 1. 需求(纠正后)

技能熔炉的核心体验是**逛技能市场**,不是输入精确路径才能查到:

1. **搜索**: 输入关键词(如 `claude skill`、`code review`、`web design`)→ 同时搜 GitHub + npm
2. **排名**: 按 GitHub stars / npm 下载量(popularity)排序,展示热度徽标
3. **发现**: 不用知道精确仓库名/包名;搜索即得热门技能仓库/包
4. **展开**: 选中一个市场结果 → 列出该仓库/包内实际的 skills(树/文件清单)
5. **一键用**: 挑一个 skill → 审计 → 激活到 `~/.dsh/skills/` → DSH 原生发现即用

保留本地/claude/codex 扫描为次级 tab(已有),市场搜索成为默认主体验。

## 2. 数据源与排名

| 源 | API | 排名字段 | 备注 |
|---|---|---|---|
| GitHub | `GET /search/repositories?q=<query>+skill&sort=stars&order=desc` | `stargazers_count` | 未认证限 10 req/min,缓存 + 合理 per_page |
| npm | `GET /-/v1/search?text=<query>+skill&size=N` | `score.detail.popularity`(0-1) | registry.npmjs.org,公开 |

GitHub 结果 = 仓库级(repo),内含 skills(需 tree 展开);
npm 结果 = 包级(package),内含 skills(需 tarball 展开)。

## 3. 实现阶段

### M1 市场搜索适配器(TDD)
- `lib/sources/github.js` 加 `searchGithubRepos(query, {limit, fetchFn})`
- `lib/sources/npm.js` 加 `searchNpmPackages(query, {limit, fetchFn})`
- 均返回排名候选:`{name, description, sourceKind, marketKind, rank, rankKind, rankLabel, url, ref/version}`

### M2 聚合
- `lib/sources/market.js`:`searchMarket(query, {fetchFn})` 并行聚合两源,排序,去重
- 候选统一带 `rank`(stars 用数字,popularity 用 0-1,排序时先归一化或分类展示)

### M3 管线接入
- `lib/routes.js`:`GET /discover?source=market&q=<query>` → 排名聚合结果
- `lib/cli.js`:`skill-fusion discover --market <query>`(打印排名列表)
- `client/client.js`:Discover 默认"市场"tab → 搜索框 + 排名徽标卡片 + "展开技能"按钮(调 discover?source=github/npm 取内部 skills)→ 审计/激活

### M4 端到端 + PR
- e2e:mock fetch 下 `searchMarket` 聚合排序 + 路由 + CLI
- 全绿后 PR

## 4. 关键点
- 零 own deps,全局 `fetch`(Node 18+)
- GitHub 搜索结果缓存到 `~/.dsh/skill-fusion/cache/search-<query>.json`(规避限流,复用 tarball 缓存目录)
- 限流降级:搜索失败返回空列表 + 提示,不阻塞其他源
- 排名展示:`278k ★`(GitHub)/`popularity 1.000`(npm)
