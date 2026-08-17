# `acc discover [path]` — architectural suggestions

Suggest improvements: missing contracts, undeclared dependencies, stale
declarations, unknown owners, orphan code. **Dry-run by default** —
nothing is written without `--apply`.

## When to use

- Engine OFF: after a task, to catch what the docs should declare.
- Before `acc build` to see what kinds of issues exist.
- When you want a deterministic "gap report" between the declared
  architecture and the code.

## Usage

```
acc discover [path] [--kind kind[,kind...]] [--apply] [--yes] [--json]
```

## Kinds

- `missing-contract` — code without an AGENTS.md contract.
- `missing-dependency` — discovered dependency not declared.
- `stale-dependency` — declared dependency no code references (docs
  ahead).
- `unknown-owner` — a path with no ownership declared.
- `orphan-code` — code outside any documented boundary.

Defaults come from config `discover.default_kinds`; `--kind` overrides.

## Workflow

1. `acc discover` — see the suggestions (dry-run).
2. Apply the **additive** kinds only: `missing-contract`,
   `missing-dependency`, `orphan-code` —
   `acc discover --apply --kind missing-contract,missing-dependency,orphan-code`.
3. **Never auto-remove declared facts.** `stale-dependency` removals are
   human decisions — review them, then edit the contract by hand.
4. Re-run `acc check` to confirm the gaps closed.

## Safety invariant

The engine's sync phase deliberately uses only the additive kinds — it
never auto-removes declared facts or injects placeholder owners. Follow
the same rule when applying manually.

## Edge cases

- `--kind nonsense` exits 2 (usage error) — it does not silently ignore.
- `--apply` is idempotent: dependencies are never appended twice.
- Deterministic output across runs.
