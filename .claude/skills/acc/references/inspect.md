# `acc inspect <path>` — one path, all the facts

Inspect roles, owners, dependencies, constraints, and memory for a path
in one glance.

## When to use

- When you need the owner / roles / constraints of a single path before
  changing it.
- When you want the memory (`.acc-memory.md`) for a functionality
  without opening files.
- As a quick "who owns this and what am I allowed to do" check.

## Usage

```
acc inspect <path> [--with-memory] [--json]
```

## Flags

- `--with-memory` — also read the path's `.acc-memory.md` knowledge.
- `--json` — structured output.

## What you get

- **Roles** — what the path is (boundary, file, test, skill, standard).
- **Owners** — who owns it (from `## Ownership` in the applicable
  AGENTS.md).
- **Dependencies** — declared + discovered.
- **Constraints** — the rules it must respect.
- **Memory** (with `--with-memory`) — durable lessons recorded for the
  functionality.

## Workflow

1. `acc inspect <path>` — read the facts.
2. Cross-check constraints against what you plan to do.
3. If memory exists, read it — it may record gotchas that cost tokens to
   rediscover.

## Example

```text
$ acc inspect src/payments --with-memory
owner: payments-team
depends_on: src/database (declared)
constraints: MUST NOT import src/billing directly
memory: ledger posting must go through the gateway module
```

## Edge cases

- A path with no contract still returns the discovered facts.
- Deterministic and offline.
