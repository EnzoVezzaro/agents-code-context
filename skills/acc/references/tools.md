# `acc tools` — the capability manifest

Run once per session (or per repository) to read the authoritative
capability surface: tiers, commands, flags, capabilities. This is the
skill's map of the CLI — start here when you are unsure what the CLI can
answer.

## When to use

- At the start of every session, before the first repository question.
- When you are unsure whether a command exists or what flags it takes.
- When an external agent or script needs a machine-readable list of
  capabilities (`--json`).

## Usage

```
acc tools [--json] [--category core|detected|plugins|commands|all]
```

## What you get

- **Tier `cli`** — deterministic, offline, zero-intelligence, no API
  key: `init`, `check`, `inspect`, `context`, `graph`, `slice`,
  `dependencies`, `dependents`, `impact`, `search`, `discover`,
  `document`, `build`, `fill`, `memory`, `install`, `tools`.
- **Tier `engine`** — intelligence subsystem: `ai` (offline provider
  control), `engine` (always-on sync; AI phase needs a provider key,
  token-gated), `review` (on-demand compliance scoring).
- **Tier `launcher`** — external product launcher: `battle` (installs
  the aba-arena repo on first use and runs the ABA benchmark — a
  separate product, never part of the ACC capability surface).
- **`detected`** — project tools discovered from `package.json` scripts
  (offline, read-only). Gated by `tools.auto_discover`.
- **`plugins`** — declared plugins from `.acc/config/tools/` (gated by
  `tools.plugins.{enabled,directory}`).
- **Per-command metadata** — `{ tier, deterministic, requires_api_key,
  capabilities }` for every command.

The manifest never executes anything — it only reads the filesystem.

## Workflow

1. `acc tools` — read the tiers and command list.
2. Pick the command that answers your question (use the routing in
   SKILL.md).
3. Read that command's reference for flags and edge cases.

## Example

```text
$ acc tools
Core tools
  ✓ filesystem (read, write, glob)
  ✓ search (contracts, edges, code)
  ...

CLI — deterministic (offline, no API key)
  ✓ check      Validate repository against ACC rules
  ✓ context    Generate focused, progressive agent context for a path
  ...

Engine — intelligence subsystem (AI phase requires API key)
  ⚡ engine    Always-on AI intelligence engine
  ⚡ review    On-demand AI compliance review
```

## Edge cases

- On an empty repository (no `AGENTS.md`, no config) `acc tools` still
  succeeds with a valid manifest.
- `--category` filters the output; invalid categories exit 2.
- Output is byte-identical across runs — `readdir` and `package.json`
  key order are sorted explicitly.
