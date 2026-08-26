---
name: skill-fusion
description: Manage the skill lifecycle in DeepSeek Harness - discover, audit, activate, and freeze any skill package. Use when the user wants to install/activate a skill from a local folder, npm, or GitHub, check it for prompt-injection risks before activation, or list/uninstall already-managed skills.
---

# Skill Fusion (技能熔炉)

Drive the skill lifecycle via the `skill-fusion` CLI. Activated skills land in `~/.dsh/skills/<name>/` and are discovered natively by DSH.

## Commands

- `skill-fusion discover --local <dir> [--q <query>]` - list installable skills found in a local folder.
- `skill-fusion audit --local <dir> --name <name>` - run the pre-activation audit (conflict + prompt-injection vectors); prints `pass|warn|block` and flagged vectors with line numbers.
- `skill-fusion activate --local <dir> --name <name> [--mode symlink|copy]` - audit then activate (symlink preferred, copy fallback). Refuses if a skill of that name already exists at the root.
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

For "freeze this skill" or "update all skills": use `freeze`/`unfreeze`/`update`/`rollback`/`export`/`import` as appropriate. `update` always snapshots before re-activating, so `rollback` is available after any update.
