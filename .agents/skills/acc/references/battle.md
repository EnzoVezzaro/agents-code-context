# `acc battle <project>` — the ABA benchmark launcher

Launch the standalone **ACC Battle Arena (ABA)** benchmark: side-by-side
agent benchmarks (ACC vs no-ACC) on the same repository and task series.

## When to use

- To measure whether ACC actually helps agents on a given repository —
  never as part of normal development.
- The results feed the engine benchmarks
  (`scripts/benchmark-engine.cjs`).

## Usage

```
acc battle <project> [--local] [--network policy] [--preserve] [--timeout s] [--agent name:model]
```

## How it works

- **ABA is a separate product** — its own repository
  (`github.com/EnzoVezzaro/aba-arena`) and npm package
  (`acc-battle-arena`, a dependency of `acc-agents`). ACC never
  requires it; this command is the convenience launcher.
- **Auto-install:** when ABA is not already available (npm-installed
  package or local `aba/` checkout), `acc battle` clones the aba-arena
  repository into the per-user cache (`~/.cache/acc/aba-arena`,
  honoring `XDG_CACHE_HOME`) and installs its dependencies, then runs
  it. First run needs git + network; afterwards it starts instantly.
- **Default:** spawns the ABA web app (battle arena) in the browser.
  `--headless` runs a single terminal benchmark instead.
- **Sandbox:** benchmarks run on an isolated snapshot copy — the
  original repository is never modified. Docker is used when available;
  `--local` forces host mode.
- **Network policy:** `--network policy` controls the sandbox network.

## Workflow

1. `acc battle ./my-project --headless` — run one terminal benchmark.
2. Or `acc battle ./my-project` — open the interactive arena.
3. Read the results: per-agent success, tokens, cost, and the
   ACC-vs-no-ACC comparison.

## Edge cases

- Missing project argument / unknown flags exit 2.
- If installation fails (no git, no network), the command reports a
  clear error with manual install instructions — never a crash.
- ABA is outside the ACC security model: run it only on repositories you
  trust (see docs/13-security.md).
