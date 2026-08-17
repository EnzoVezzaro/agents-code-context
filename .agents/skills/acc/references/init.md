# `acc init [directory]` — initialize ACC structure

Scaffold ACC in a directory: `.acc/config/config.yaml`, the control
plane subdirectories, root `.acc-memory.md`, and a `.gitignore` entry.
Additive — never rewrites existing content.

## When to use

- First-time setup of a repository that wants the full ACC control
  plane.
- Before `acc engine --init-context` (which calls init internally).
- For a fresh repo with full context in one command, prefer
  `acc engine --init-context`.

## Usage

```
acc init [directory] [--force] [--scan] [--no-scan]
```

## Flags

- `--scan` — also build missing AGENTS.md contracts from the codebase
  (the init-context path forces this).
- `--no-scan` — scaffold only.
- Interactive terminals ask whether to scan; CI / piped stdin never
  scan by default (deterministic and safe on untrusted repositories).

## Workflow

1. `acc init .` — scaffold the control plane.
2. `acc init . --scan` — also map the codebase and create missing
   contracts.
3. `acc fill` — see what still needs human context.
4. `acc engine --init-context` — the full bootstrap (scaffold +
   contracts + dependencies + drift report) in one command.

## Edge cases

- Additive: existing files are never rewritten (unless `--force`).
- Deterministic on non-interactive runs.
- Root detection never escapes above the user's home directory.
