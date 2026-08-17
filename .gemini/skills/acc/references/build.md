# `acc build [path]` — create missing contracts

Create missing `AGENTS.md` contract files for undocumented code.
Additive only — never rewrites existing content.

## When to use

- Engine OFF: when `acc check` reports missing contracts; after adding a
  new module, run `acc build` to scaffold its contract.
- Engine ON: the engine's sync phase runs `acc build` automatically on
  trigger. You do not need to run it manually.

## Usage

```
acc build [path] [--yes] [--from-discovery] [--json]
```

## Flags

- `--yes` — write the files (dry-run by default).
- `--from-discovery` — pre-fill inferred dependencies/owners from
  discovered edges.
- `--json` — structured output: `missing`, `created`,
  `memory_created`.

## Workflow

1. `acc build` — see which contracts are missing (dry-run).
2. `acc build --yes` — create them, each with an initial
   `.acc-memory.md` record.
3. `acc fill` — get per-file instructions for completing the
   placeholders.
4. `acc check` — confirm no missing contracts remain.

## Example

```text
$ acc build --yes
Created src/metrics/AGENTS.md
Created src/metrics/.acc-memory.md
Nothing to build.   ← when the project is fully documented
```

## Edge cases

- A project is "fully documented" when `acc build` has nothing left to
  create.
- Never rewrites an existing contract — additive only.
- Deterministic: identical results on fresh copies.
