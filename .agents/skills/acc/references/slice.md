# `acc slice <path>` — the AI-optimized graph slice

The context router: a compact, machine-friendly slice of the graph for a
path — the relationships an agent needs, nothing else. This is the slice
the engine uses per boundary.

## When to use

- Before touching a path in a large repository — get the tiny context
  boundary instead of whole-directory reads.
- When you need a JSON slice to hand to a model or a script.
- When you want the impact summary (files / boundaries / tests touched)
  without running the full `acc impact`.

## Usage

```
acc slice <path> [--json]
```

## What you get

Per scope:

- `governed_by` — the applicable `AGENTS.md` files (root + local).
- `owns` — the files and sub-boundaries the scope owns.
- `depends_on` — declared + discovered dependencies with provenance.
- `dependents` — what depends on this scope.
- `tested_by` — the tests that exercise it.
- `requires` — skills and standards declared for the scope.
- `impact` — files / boundaries / tests touched.

## Workflow

1. `acc slice <path> --json` — get the compact relationship slice.
2. Read the `governed_by` contracts before changing anything in the
   scope.
3. Use `depends_on` to know what the code needs and `dependents` to know
   what breaks.

## Example

```json
{ "scope": "src/payments",
  "governed_by": ["AGENTS.md", "src/payments/AGENTS.md"],
  "depends_on": [{ "to": "src/database", "provenance_kind": "declared" }],
  "dependents": ["src/api"],
  "tested_by": ["tests/payments/ledger_test.rs"],
  "impact": { "files": 3, "boundaries": 2, "tests": 1 } }
```

## Edge cases

- The slice stays small and constant regardless of repository size —
  it is the answer to the over-feeding problem (see
  [over-feeding.md](over-feeding.md)).
- Deterministic and byte-identical across runs.
