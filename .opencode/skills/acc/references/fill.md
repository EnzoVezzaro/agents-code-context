# `acc fill [path]` — complete placeholder contracts

Report which contracts still have placeholders or missing sections, with
per-file instructions for what to add.

## When to use

- After `acc build` / `acc engine --init-context`, to see what still
  needs human context (purpose, boundaries, constraints, standards).
- When you want a checklist of exactly what to write where in each
  contract.

## Usage

```
acc fill [path] [--json]
```

## What you get

Per AGENTS.md file: its status (`draft` / `complete`), every section
classified as **missing**, **empty**, or holding **template
placeholders**, and a directive for completing it.

## Workflow

1. `acc fill` — read the per-file checklist.
2. Replace the placeholders with accurate content — the deterministic
   machinery can scaffold the shape, but only the agent or developer
   knows the real intent.
3. `acc fill` again — confirm the file is `complete`.
4. `acc check` — confirm the contract is valid.

## Example

```text
$ acc fill
lib/util/AGENTS.md  draft
  ## Purpose          placeholder — describe what this module does
  ## Boundaries       missing — what it may not do
```

## Edge cases

- Read-only: `acc fill` never writes files.
- Deterministic output; sections are sorted.
