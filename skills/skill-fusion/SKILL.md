---
name: skill-fusion
description: Manage the skill lifecycle in DeepSeek Harness - discover, audit, activate, and freeze any skill package. Use when the user wants to install/activate a skill from a local folder, npm, GitHub, ~/.claude/skills, or ~/.codex/skills, check it for prompt-injection risks before activation, or list/uninstall already-managed skills.
---

# Skill Fusion (技能熔炉)

Drive the skill lifecycle via the `skill-fusion` CLI. Activated skills land in `~/.dsh/skills/<name>/` and are discovered natively by DSH.

## Commands

### Discover (5 sources)

- `skill-fusion discover --local <dir> [--q <query>]` - list installable skills found in a local folder.
- `skill-fusion discover --claude [<dir>]` - scan `~/.claude/skills/` (or override dir).
- `skill-fusion discover --codex [<dir>]` - scan `~/.codex/skills/` (or override dir).
- (npm and github discovery via the GUI or route API; CLI `activate` fetches directly)

### Audit

- `skill-fusion audit --local <dir> --name <name>` - pre-activation audit (conflict + prompt-injection vectors); prints `pass|warn|block` and flagged vectors.
- `skill-fusion audit --claude [<dir>] --name <name>` - same audit for Claude-rooted skills.
- `skill-fusion audit --codex [<dir>] --name <name>` - same audit for Codex-rooted skills.

### Activate

- `skill-fusion activate --local <dir> --name <name> [--mode symlink|copy]` - audit then activate from a local folder.
- `skill-fusion activate --claude [<dir>] --name <name>` - audit then activate from `~/.claude/skills/`.
- `skill-fusion activate --codex [<dir>] --name <name>` - audit then activate from `~/.codex/skills/`.
- `skill-fusion activate --npm <pkg> --name <name>` - download tarball, audit, activate.
- `skill-fusion activate --github <owner/repo> [--ref <ref>] --name <name>` - download tarball, audit, activate.

### Lifecycle

- `skill-fusion list` - show fusion-managed skills (source, activation mode, status, frozen version; flags orphans whose source vanished).
- `skill-fusion uninstall --name <name>` - remove activation + manifest entry.
- `skill-fusion freeze --name <name> --version <v>` - pin a skill at a version; frozen skills are skipped by update.
- `skill-fusion unfreeze --name <name>` - unpin a frozen skill.
- `skill-fusion update [--name <name>]` - check for content changes, re-audit, re-activate; snapshots current state first for rollback. Without --name, updates all unfrozen skills.
- `skill-fusion rollback --name <name>` - restore a skill from its pre-update snapshot.
- `skill-fusion export --out <path>` - export a JSON bundle (manifest + skill content) for backup/migration.
- `skill-fusion import --from <path>` - import a bundle into the current manifest (merge: existing skills kept).

## Workflow

For a user request like "activate the skill at ./my-skill": run `discover --local .` to confirm the candidate, `audit` to surface risks to the user, get user confirmation if `warn`/`block`, then `activate`. Always show the audit verdict before activating.

For "activate skill X from Claude" or "install skill from GitHub repo owner/repo": use `--claude` or `--github` flag respectively. npm and GitHub sources download a tarball before audit+activate.

For "freeze this skill" or "update all skills": use `freeze`/`unfreeze`/`update`/`rollback`/`export`/`import` as appropriate. `update` always snapshots before re-activating, so `rollback` is available after any update.
