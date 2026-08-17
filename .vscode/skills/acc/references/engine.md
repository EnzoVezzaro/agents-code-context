# `acc engine [path]` — the always-on AI engine

The engine does automatically what the coding agent should have done: it
keeps the ACC files (`AGENTS.md` contracts, `.acc-memory.md` knowledge,
`ACC_WARN.md` drift) in sync with the code. It runs the **same
deterministic CLI tools** — like another agent working on the project —
but focused on one thing only: the ACC documentation.

## When to use

- Engine ON: run `acc engine --watch` and just code — the engine
  reviews changed files, updates knowledge/memory, and regenerates
  `ACC_WARN.md`. Read `ACC_WARN.md` before finishing.
- Engine OFF: you own the ACC files — follow the per-command workflows
  in the other references on every task.
- One-shot: `acc engine --force` to trigger the AI review now, or
  `acc engine --init-context` to bootstrap a repo into full ACC context.

## Usage

```
acc engine [path] [--apply] [--force] [--supervisor] [--init-context] [--watch] [--model <id>] [--json]
```

## The three phases

1. **Deterministic scan** (always, offline) — graph, diagnostics,
   per-boundary slices, dependency-gap plan. This catches drift at every
   scale, AI or not.
2. **AI review** (only when `ai.enabled` + trigger fires) — for each
   boundary with a contract, reviews the contract against the changed
   code + derived slice, producing knowledge and drift proposals.
3. **Supervisor** (`--supervisor`, optional) — scores the proposals
   0–100 against ACC rules; below the threshold (default 85) it iterates
   on its own proposals until compliant or `max_iterations`. Nothing is
   written below the threshold.

## Flags

- `--apply` — apply the deterministic sync (create missing contracts,
  declare discovered deps) and write approved knowledge to
  `.acc-memory.md`. Contract rewrites are always proposals only.
- `--force` — bypass the trigger (run the AI phase now).
- `--supervisor` — enable the scoring loop.
- `--init-context` — bootstrap a repo into full ACC context: scaffold
  ACC, create the root contract, create every missing per-boundary
  contract, declare discovered deps, write `ACC_WARN.md`, report what
  still needs human context. Deterministic, additive, idempotent.
- `--watch` — live server: keep the process alive in the terminal,
  re-run on filesystem changes (debounced), stream phase logs, AI
  results, and supervisor scores. Ctrl-C exits. **Stops with a FATAL
  error after `engine.ai.max_consecutive_failures`
  all-providers-failed runs.**
- `--model <id>` — use a specific configured provider.

## Trigger (token protection)

The AI phase only runs when enough change accumulated (default: 3
commits; `changes` mode counts changed files, `always` never waits).
The trigger exposes the changed files, so the AI evaluates the actual
code — never just the git log.

## Drift report

Every run regenerates `ACC_WARN.md` at the project root — code
violations, docs-behind-code, docs-ahead-of-code, AI findings. It is the
developer-facing alarm; fix the code or the docs, never the report.

## Workflow

1. `acc ai add` — configure a provider (select provider → key → model).
2. `acc engine --watch [--supervisor]` — leave it running while you
   code, or `acc engine --force` for a one-shot review.
3. Read `ACC_WARN.md` before finishing — it lists what drifted and what
   the engine flagged.

## Edge cases

- With AI disabled, the engine is purely deterministic (scan + sync
  plan + drift report) — still useful.
- Provider rate limits / quota exhaustion are reported as errors, never
  thrown; the engine degrades cleanly.
- Knowledge is written only when the supervisor approved (or no
  supervisor is configured) — rejected proposals are never persisted.
