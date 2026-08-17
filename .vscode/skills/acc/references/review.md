# `acc review [path]` — on-demand compliance review

Read-only AI compliance review of a scope: score 0–100 against ACC
rules, with the supervisor's per-boundary feedback. Never writes state.

## When to use

- When you want an independent compliance opinion before a release or a
  big change.
- When the engine's supervisor flagged something and you want details.
- As the AI-scored counterpart to the deterministic `acc check`.

## Usage

```
acc review [path] [--model <id>] [--json]
```

## Requirements

- `ai.enabled` + a provider key for the AI phase (configure with
  `acc ai add`).
- The deterministic scan is always included — review works even without
  a key (score is null, diagnostics still report).

## What you get

- Per-boundary `score`, `approved`, `issues`.
- An overall verdict — the weakest link wins (`min` of boundary
  scores).
- The deterministic diagnostics and dependency gaps underneath.

## Workflow

1. `acc review <path> --json` — get the score + issues.
2. Fix the highest-impact issues first (the weakest boundary drives the
  verdict).
3. Re-run `acc review` to confirm the score improved.
4. Keep `acc check` as the deterministic gate — review is advisory.

## Edge cases

- Read-only: never writes AGENTS.md, memory, or ACC_WARN.md.
- Missing key → clean error, score null, deterministic scan still runs —
  never a crash.
- Deterministic scan output is stable; the AI score varies with the
  model/provider.
