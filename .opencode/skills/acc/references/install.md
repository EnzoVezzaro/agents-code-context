# `acc install` — deploy ACC as an agent skill

ACC is an agent capability, not a per-repository framework. This command
writes the ACC skill into a target directory so any agent learns how to
operate on the repository deterministically.

## When to use

- First-time setup of an agent environment that should know ACC.
- When you want the skill project-local (per repo) or user-global.

## Usage

```
acc install [--agent generic|claude|cursor|codex|opencode|gemini|vscode] [--dir <path>] [--force] [--json]
```

## Targets

- Default (or `--agent generic`): `<project>/.agents/skills/acc/` —
  the Agent Skills standard location (the graph also detects it).
- `--agent <name>`: a well-known project-local dir per agent
  (`.claude/skills/acc`, `.cursor/skills/acc`, `.codex/skills/acc`,
  `.opencode/skills/acc`, `.gemini/skills/acc`, `.vscode/skills/acc`).
- `--dir <path>`: an explicit path — e.g. a global agent skills dir.

## Workflow

1. `acc install` — installs SKILL.md + the full `references/` playbooks
   to the target.
2. Reload the agent environment so the skill loads.
3. Verify: `acc tools` inside the project should be listed by the agent
   as available.

## Universal install (same source)

```
npx skills add EnzoVezzaro/agents-code-context --skill acc
# or with --agent codex / --agent claude-code / --global
```

The engine CLI is distributed separately: `npm install -g acc-agents`.
Two channels, one source: the skill teaches any agent how to operate;
the CLI is the deterministic engine underneath.

## Edge cases

- Idempotent: an existing SKILL.md is left untouched unless `--force`.
- Unknown agents / conflicting flags (`--agent` + `--dir`) exit 2.
- Deterministic and offline — writes files, never executes anything.
