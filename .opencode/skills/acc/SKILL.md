---
name: acc
description: >-
  Gives the agent the ACC CLI capability. Use whenever the repository is
  ACC-enabled (has AGENTS.md at the root or in subdirectories) and you
  need to understand, navigate, or validate its agent context — before
  reading large amounts of source, before making changes, or when
  keeping the AGENTS.md contracts and knowledge in sync. ACC is a
  deterministic, offline CLI: derive the architecture graph (acc graph),
  get a focused context slice for any path (acc context, acc slice),
  answer relationship questions (acc dependencies, acc dependents, acc
  impact, acc inspect), search the contracts (acc search), validate
  against ACC rules (acc check), scaffold missing contracts (acc build,
  acc document, acc fill, acc discover, acc memory), manage the optional
  AI engine (acc ai: select provider → api key → model; acc engine:
  always-on AI that keeps the ACC files in sync; acc review: on-demand
  compliance score; acc engine --init-context: bootstrap a repo), and
  read the drift report (ACC_WARN.md). Do NOT use for non-AGENTS.md
  repositories — ACC understands repositories that follow the agents.md
  convention; it is never a substitute for reading code. The CLI is
  deterministic: same repo + same flags = byte-identical output, offline,
  no API keys, safe on untrusted repositories.
version: 0.6.2
license: MIT
allowed-tools:
  - Bash(acc *)
---

# ACC — Agent Code Context

ACC is a **deterministic, offline CLI** that makes repositories that
follow the agents.md convention (`AGENTS.md` + source) continuously
understandable by agents. **This skill is the agent's interface to the
ACC CLI**: it teaches you when to run which command, what each one
answers, and how to keep the ACC files in sync.

The product is the CLI. The repository stays a standard agents.md
repository — nothing in it depends on ACC. The skill is a capability you
carry; the CLI (`acc`) is what you run against the repo.

## Core contract

- **The CLI is deterministic and offline.** Same repo + same flags =
  byte-identical output. No network, no API keys, safe on untrusted
  repositories. Every command emits `--json` when you need structure.
- **The engine is the optional always-on intelligence layer** (AI SDK
  v5, token-gated). It runs the *same deterministic CLI commands* — like
  another agent working on the project — but focused on one thing only:
  keeping the ACC files in sync. When the engine is ON, the coding agent
  ignores ACC file upkeep and just codes; when it is OFF, the coding
  agent owns them.

## Setup

1. Verify the CLI is available: `acc --version`. If not:
   `npm install -g acc-agents`.
2. If you see this file, the skill is loaded. To install it into another
   environment:
   `npx skills add EnzoVezzaro/agents-code-context --skill acc` (or
   `acc install` for the project-local Agent Skills location).
3. Run `acc tools` once per session to read the authoritative capability
   manifest — tiers, commands, flags, capabilities. Keep cwd at the
   project root.
4. Check the project root for `ACC_WARN.md` (the drift report). If it
   exists, read it — it lists code violations and documentation drift.

## Operating principles

- **Prefer ACC over blind exploration.** `acc context`, `acc graph`,
  `acc slice`, `acc dependencies`, `acc impact` and `acc inspect` tell
  you what is related *before* you read large amounts of source. Fall
  back to broad repository search only when ACC cannot answer the
  question.
- **Determinism is the floor.** Every CLI command is deterministic and
  safe to pipe into JSON (`--json`). The deterministic scan catches
  drift at every scale regardless of the AI.
- **Declared facts win.** `AGENTS.md` is the project's contract;
  discovered facts (imports) complement it; inferred facts are never
  asserted as authoritative.
- **Never fight the engine.** Engine ON → ignore the ACC files and just
  code (read `ACC_WARN.md` before finishing). Engine OFF → you own them:
  run `acc check` at the start and end of a task, update contracts and
  memory as you go.

## Commands

| Command | Category | What it answers | Reference |
|---|---|---|---|
| `tools` | Discover | The full capability manifest (tiers, commands, flags) | [reference/tools.md](reference/tools.md) |
| `context <path>` | Discover | What owns this scope, what governs it, what it depends on | [reference/context.md](reference/context.md) |
| `graph [path]` | Discover | The repository's architecture graph (text/mermaid/dot/json) | [reference/graph.md](reference/graph.md) |
| `slice <path>` | Discover | A compact AI-optimized graph slice (context router) | [reference/slice.md](reference/slice.md) |
| `dependencies <path>` | Discover | What a path depends on (declared/discovered/transitive) | [reference/relations.md](reference/relations.md) |
| `dependents <path>` | Discover | What depends on a path (reverse edges) | [reference/relations.md](reference/relations.md) |
| `impact <path>` | Discover | What breaks if you change a path (closure, tests, contracts) | [reference/impact.md](reference/impact.md) |
| `search <query>` | Discover | Architecture-aware search across contracts, edges, code | [reference/search.md](reference/search.md) |
| `inspect <path>` | Discover | Roles, owners, dependencies, constraints, memory for a path | [reference/inspect.md](reference/inspect.md) |
| `check [path]` | Validate | ACC0xx violations: missing contracts, undeclared deps, drift | [reference/check.md](reference/check.md) |
| `discover [path]` | Maintain | Suggested improvements (dry-run; `--apply` writes) | [reference/discover.md](reference/discover.md) |
| `document <path>` | Maintain | A conservative AGENTS.md template to edit | [reference/document.md](reference/document.md) |
| `build [path]` | Maintain | Create missing AGENTS.md contracts for undocumented code | [reference/build.md](reference/build.md) |
| `fill [path]` | Maintain | Per-file instructions for completing placeholder sections | [reference/fill.md](reference/fill.md) |
| `memory <sub> <path>` | Maintain | Read/update functionality-local `.acc-memory.md` | [reference/memory.md](reference/memory.md) |
| `ai [add\|remove\|default\|models]` | Engine | Manage AI providers: select provider → key → model | [reference/ai.md](reference/ai.md) |
| `engine [path]` | Engine | Keep the ACC files in sync (deterministic + optional AI) | [reference/engine.md](reference/engine.md) |
| `review [path]` | Engine | On-demand AI compliance score (0–100, read-only) | [reference/review.md](reference/review.md) |
| `install` | Deploy | Install this skill into an agent environment | [reference/install.md](reference/install.md) |
| `init [dir]` | Bootstrap | Initialize ACC structure in a directory | [reference/init.md](reference/init.md) |
| `battle <project>` | External | Launch the ABA benchmark (installs its repo on first use) | [reference/battle.md](reference/battle.md) |

## Routing

- **Start of any task on a known path** → `acc check` (current
  violations) + `acc context <path>` (what governs it) + `acc impact
  <path>` (what could break). Engine OFF: update the contract and memory
  during the task, then `acc check` again to prove you introduced none.
- **New repository / first time in a codebase** → `acc tools` →
  `acc graph` to see the boundaries → `acc context` on the scope you
  touch. Read `ACC_WARN.md` if present.
- **Large or unfamiliar repository** → `acc slice` + `acc context`
  instead of reading whole directories; let ACC tell you what is related
  first (see [reference/over-feeding.md](reference/over-feeding.md)).
- **Relationship question** → `acc dependencies <path>` / `acc
  dependents <path>` / `acc impact <path>` — never grep for imports.
- **Drift warning** → read `ACC_WARN.md` at the root; fix the code or
  the docs, never the report. Then `acc check` to confirm.
- **AI engine not configured** → `acc ai add` (select provider → api key
  → model), then `acc engine` or `acc engine --watch`.
- **Bootstrap a fresh repo with full ACC context** →
  `acc engine --init-context` (scaffold + contracts + dependencies +
  drift report in one command).
- **Compliance question** → `acc check` (deterministic) or `acc review
  <path>` (AI-scored, requires a provider key).
- **Not sure which command** → `acc tools` lists everything with tiers;
  read the matching reference below.

## Sub-agents (optional roles)

The `agents/` directory ships optional sub-agents that take on ACC
roles the engine would otherwise fill. They are the **engine-OFF
alternative** — when the engine is not running, invoke the matching
agent instead of doing the work inline:

| Agent | Role | Use when |
|---|---|---|
| `acc-explorer` | Map the repo through the CLI before reading source | Entering an unfamiliar codebase, scoping a task |
| `acc-checker` | Run the ACC0xx scan and fix every violation until `acc check` is clean | Start/end of a task (engine OFF), failed `acc check` |
| `acc-filler` | Complete placeholder contracts with real content from the code | After `acc build` / `--init-context`, drafts remain |
| `acc-initializer` | Bootstrap a fresh repo with the full ACC framework | New repository, no ACC structure yet |
| `acc-documenter` | Keep AGENTS.md + memory in sync with the code | After a code change, engine OFF |
| `acc-reviewer` | Score repository ACC health 0–100, read-only | Pre-release gate, independent opinion |
| `acc-supervisor` | Score proposed ACC changes before they land | Engine OFF, extra pair of eyes on contract edits |

Each agent is one job in the ACC lifecycle — bootstrap (`acc-initializer`),
map (`acc-explorer`), validate & fix (`acc-checker`), complete (`acc-filler`),
sync (`acc-documenter`), audit (`acc-reviewer`), gate (`acc-supervisor`).

When the engine is ON it runs these roles automatically on its trigger
— read `ACC_WARN.md` instead of invoking them.

## References

The `reference/` directory holds a playbook per command — exact flags,
workflow steps, example output, and edge cases — plus the engine limits
(measured) and the over-feeding analysis. Read the reference for the
command you are about to run when you need its exact behavior. See
[README.md](README.md) for the skill itself.
