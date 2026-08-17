# acc

The ACC CLI capability for agents. Gives any coding agent the ability to
use and understand the deterministic `acc` CLI against an ACC-enabled
repository.

## What it does

ACC is a **deterministic, offline CLI** that understands repositories
following the agents.md convention (`AGENTS.md` + source). This skill
teaches an agent:

- **Discover** — derive the architecture graph, get focused context and
  compact graph slices for any path (`acc graph`, `acc context`,
  `acc slice`, `acc inspect`).
- **Relate** — answer dependency/dependent/impact questions without
  reading source (`acc dependencies`, `acc dependents`, `acc impact`,
  `acc search`).
- **Validate** — run the stable `ACC0xx` diagnostics (`acc check`).
- **Maintain** — scaffold missing contracts, declare discovered
  dependencies, complete placeholder sections, and record durable
  knowledge (`acc build`, `acc discover`, `acc document`, `acc fill`,
  `acc memory`).
- **Engine (optional)** — manage AI providers and let the always-on
  engine keep the ACC files in sync automatically (`acc ai`,
  `acc engine`, `acc review`, `acc engine --init-context`).

The repository stays a standard agents.md repository. ACC is a
capability the agent has — not a framework the repo must adopt. Remove
the skill and the CLI and nothing in the repository changes.

## How to invoke

The skill activates through the `acc` CLI. There is no `/acc` slash
command — the agent runs `acc <command>` directly from the project root.

```
acc tools                  # read the capability manifest first
acc context src/payments   # focused context before touching code
acc graph                  # the architecture, derived not hand-drawn
acc check                  # current violations (ACC0xx)
acc impact src/auth        # what breaks if I change this?
```

See [SKILL.md](SKILL.md) for the commands table and routing, and
`reference/` for a per-command playbook (flags, workflow, examples).

## Sub-agents

Optional role agents live in `agents/` — the engine-OFF alternative for
work the always-on engine would otherwise do:

```
acc-explorer      map the repo before reading source
acc-checker       run the ACC0xx scan and fix violations until clean
acc-filler        complete placeholder contracts with real content
acc-initializer   bootstrap a fresh repo with the full framework
acc-documenter    keep AGENTS.md + memory in sync after a change
acc-reviewer      score repository ACC health 0–100 (read-only)
acc-supervisor    score proposed ACC changes before they land
```

One agent per job in the ACC lifecycle: bootstrap → map → validate & fix
→ complete → sync → audit → gate.

## Example

```text
$ acc context src/payments --json
→ sections: hierarchy, contract, dependencies, constraints, memory
  contract.source: src/payments/AGENTS.md
  dependencies: declared → src/database; discovered ⚠ → src/ui

$ acc check
ACC022  warn    src/payments/mod.rs
  discovered dep 'payments → ui' not declared
→ 1 warning, 0 errors
```

## Install

```bash
npx skills add EnzoVezzaro/agents-code-context --skill acc   # into an agent
npm install -g acc-agents                                    # the CLI engine
acc install                                                  # project-local skill
```

## License

MIT — the same license as the ACC framework and the agents.md standard.
