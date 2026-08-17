# `acc search <query>` — architecture-aware search

Search across contracts, edges, and code — understanding structure, not
just matching strings.

## When to use

- Instead of grep when you want context (who declares this dependency,
  which contract mentions this term).
- When you need the scope of a symbol across boundaries.
- As the fallback when `acc context` / `acc slice` cannot answer.

## Usage

```
acc search <query> [--kind contracts|edges|code|all] [--limit N] [--regex] [--path prefix] [--json]
```

## Flags

- `--kind` — what to search: AGENTS.md contracts, graph edges, or code.
- `--regex` — treat the query as a regular expression.
- `--limit N` — cap the number of matches.
- `--path prefix` — narrow to a subtree.
- `--json` — structured matches.

## Workflow

1. `acc search <term> --kind contracts` — find every contract that
   mentions the term (dependencies, constraints, standards).
2. `acc search <term> --kind edges` — find declared/discovered
   relationships involving it.
3. `acc search <term> --kind code` — find the code references.
4. Combine with `acc context <path>` for the full picture of a match.

## Example

```text
$ acc search "database" --kind contracts
src/database/AGENTS.md:3  Purpose: Database connection pool and query builder.
src/auth/AGENTS.md:12     Dependencies: src/database
src/api/AGENTS.md:8       Constraints: Must not access src/database directly.
```

## Edge cases

- Code search uses a path-aware matcher that ignores method-call
  matches, quoted string values, and bracket markers — fewer false
  positives than bare grep.
- Deterministic: matches are sorted.
