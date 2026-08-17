# `acc dependencies` / `acc dependents` — relationship queries

Answer "what does this depend on" and "what depends on this" without
reading source.

## When to use

- Before changing an API or moving code — know who consumes it.
- When adding a dependency — know whether it is already declared.
- When the repository is unfamiliar — map the neighborhood cheaply.
- Instead of grepping for imports: the graph already knows.

## Usage

```
acc dependencies <path> [--direct|--transitive] [--max-depth N] [--declared|--discovered] [--json]
acc dependents   <path> [--direct|--transitive] [--max-depth N] [--declared|--discovered] [--json]
```

## Flags

- `--direct` (default) — one hop; `--transitive` — the closure.
- `--max-depth N` — cap the transitive closure depth.
- `--declared` — edges declared in AGENTS.md; `--discovered` — edges
  derived from imports/analyzer.
- `--json` — structured edges.

## Workflow

1. `acc dependencies <path>` — what this scope needs (direct).
2. `acc dependents <path>` — what depends on it (who breaks).
3. Cross-check declared vs discovered: a discovered edge that is not
   declared is a gap (`acc check` → ACC022).
4. For blast radius, follow up with `acc impact <path>`.

## Example

```text
$ acc dependencies src/auth
src/database (declared)
src/logging  (discovered)

$ acc dependents src/database
src/auth (declared)
src/api  (discovered)
```

## Edge cases

- A declared dependency on a parent boundary covers references to its
  children (no false gap).
- Deterministic output; edges are sorted.
