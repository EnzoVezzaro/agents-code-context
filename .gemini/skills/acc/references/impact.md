# `acc impact <path>` — change impact

Estimate what breaks if you change a path: its dependent closure,
affected boundaries, tests, and documented contracts.

## When to use

- Before every non-trivial change.
- When choosing between two implementation strategies — pick the lower
  blast radius.
- When a change crosses a boundary — the graph tells you which contracts
  are affected so you can update them.

## Usage

```
acc impact <path> [--max-depth N] [--include dependents|tests|constraints] [--json]
```

## Flags

- `--max-depth N` — cap the transitive dependent closure.
- `--include dependents|tests|constraints` — what to include in the
  estimate.
- `--json` — structured impact: closure, boundaries, tests, contracts.

## Workflow

1. `acc impact <path>` — read the blast radius before editing.
2. Note which boundaries and documented contracts are affected.
3. Engine OFF: after the change, update those boundaries' `AGENTS.md`
   and add memory lessons — `acc impact` tells you which ones to look at.
4. Re-run `acc check` after the change to prove you introduced no
   violations.

## Example

```text
$ acc impact src/auth
6 dependents
2 boundaries
3 tests
1 documented contract
```

## Edge cases

- Impact is derived from the graph, so it is deterministic and offline.
- The radius grows with `--max-depth`; keep it small for a first
  estimate.
