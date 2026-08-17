# `acc memory` — durable knowledge

Read and update functionality-local `.acc-memory.md` files — the
"scratchpad" of durable agent knowledge that does not belong in the
committed contract.

## When to use

- Engine OFF: record durable lessons at the end of a task — gotchas,
  invariants, design notes, decisions that would cost tokens to
  rediscover.
- Engine ON: the engine writes memory automatically after its AI review
  (only approved entries, into gitignored files). You may still add
  facts the engine cannot infer.

## Usage

```
acc memory show <path>          # print a functionality's memory
acc memory add <path> <text>    # append a timestamped entry
acc memory clear <path> [--force]
```

## Workflow

1. `acc memory show <path>` — read what is known before starting.
2. At the end of a task, `acc memory add <path> "lesson"` — a gotcha,
   an invariant, a rejected approach.
3. Keep entries specific: "token rotation is bounded by clock skew" —
   not "did some work here".

## Rules

- Plain Markdown, no schema.
- Gitignored (`.acc-memory.md`) — it is local knowledge, not a
  committed artifact (ACC054 warns when memory is committed).
- `memory.warn_bytes` (default 64 KB) warns when a file grows too large.
- Timestamps use `memory.timestamp_format` (`rfc3339` default, or
  `date`).

## Edge cases

- `acc memory add` timestamps the file it writes — the one intentional
  non-determinism (documented).
- Entries are capped (max 5 per AI review) to keep files small.
