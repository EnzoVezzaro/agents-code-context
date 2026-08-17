# `acc context <path>` — focused agent context

Assemble the minimum context for a scope before reading source. This is
the anti-over-feeding command: it returns only what the path needs, with
provenance on every section.

## When to use

- At the start of every task on a path you will modify.
- Before reading a directory listing or grepping a boundary.
- When the repository is large or unfamiliar and you need to know what
  a scope owns, what governs it, and what it depends on — cheaply.

## Usage

```
acc context <path> [--depth N] [--max-bytes N] [--include kinds] [--exclude kinds] [--json]
```

## Flags

- `--depth N` — transitive contract expansion depth (default from config
  `context.default_depth`, usually 1).
- `--max-bytes N` — output budget (default 64 KB).
- `--include / --exclude kinds` — sections: `hierarchy`, `contract`,
  `dependencies`, `constraints`, `implementations`, `memory`. Defaults
  come from config `context.default_include`.
- `--json` — structured output with `sections[*].source` provenance.

## Workflow

1. `acc context <path>` — read the hierarchy, contract, dependencies,
   constraints, and memory for the scope.
2. Use the dependencies section to decide what else to read (only the
   ones you actually touch).
3. Trust the provenance: `Source: AGENTS.md` (declared) vs `Discovered
   from imports` (observed) — never assert discovered facts as
   authoritative architecture.

## Example

```text
$ acc context src/payments --depth 1
## Hierarchy
  project root        Source: AGENTS.md
  └─ src/payments/    Source: src/payments/AGENTS.md

## Dependencies (depth=1)
Declared:
  → src/database/   Source: src/payments/AGENTS.md
Discovered:
  ⚠ src/ui/        Source: Discovered from imports — undeclared
```

## Edge cases

- A path with no contract still returns the hierarchy and discovered
  dependencies — useful for understanding undocumented code.
- `--max-bytes` truncates with a marker; raise it for very deep scopes.
- Output is deterministic and byte-identical across runs.
