# `acc check` — validate against ACC rules

Run the diagnostic scan and report every `ACC0xx` violation with stable
codes, severity, and provenance.

## When to use

- Engine OFF: at the start of a task (know the current violations) and
  at the end (prove you introduced none). **The task is not done until
  `acc check` is clean.**
- Engine ON: the engine runs the deterministic scan on every trigger;
  read `ACC_WARN.md` before finishing instead.
- Before a release or a merge — as the deterministic gate.

## Usage

```
acc check [--json] [--exit-zero] [--severity error|warn|info] [--code ACCxxx]
```

## Flags

- `--exit-zero` — always exit 0 (for CI pipelines that only want the
  report). Default: non-zero exit when any error-severity diagnostic is
  present.
- `--severity` — keep error + warn + info (filter is cumulative:
  `warn` keeps error and warn; `error` keeps errors only).
- `--code ACCxxx` — filter to one diagnostic code.
- `--json` — structured diagnostics.

## What it answers

- Missing contracts (a boundary with code but no `AGENTS.md`).
- Undeclared dependencies (discovered dep with no declared counterpart →
  ACC022).
- Boundary violations (forbidden deps from config → ACC024/ACC025).
- Duplicate ownership (ACC030), unowned dependency targets (ACC031),
  orphan code (ACC072), orphan memory (ACC050).
- Drift in both directions: docs ahead of code (declared dep no code
  references) and docs behind code (code does something the docs don't
  declare).

## Workflow

1. `acc check` — see the full report.
2. Fix the code or the docs (never the report — it regenerates).
3. `acc check` again — confirm clean (or only the acceptable warnings).
4. In CI: `acc check --json` and gate on error severity.

## Example

```text
$ acc check
ACC022  warn    src/payments/mod.rs
  discovered dep 'payments → ui' not declared
ACC040  info    .lock
  no analyzer for extension
→ 1 warning, 0 errors
```

## Edge cases

- On an empty repo `acc check` succeeds with valid JSON (no crash).
- Output is byte-identical across runs.
- Diagnostic codes are stable: ACC022 means the same thing this year as
  next (see docs/07-diagnostic-codes.md).
