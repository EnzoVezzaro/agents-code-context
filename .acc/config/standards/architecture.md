# architecture.md — ACC Project Architecture Standard

This standard is referenced by `AGENTS.md` files across the ACC repo.
It defines the project's architecture expectations and the rules that
govern how functionality boundaries relate.

## Hard Invariant

```text
ACC-enhanced  =  Repository  +  AGENTS.md  +  .acc/
```

Removing `.acc/` or the `acc` CLI MUST leave a valid `AGENTS.md`
repository. This invariant is load-bearing for every design decision.

## Layered Architecture

```text
CLI command layer        argument parsing, output formatting
        ↓
Context engine           progressive depth, provenance, section assembly
        ↓
Graph derivation         filesystem + AGENTS.md parse + language analyzers
        ↓
Diagnostics              stable code registry, severity, overrides
        ↓
Memory                   .acc-memory.md read/write
        ↓
Control plane            .acc/config/ config.yaml + agents/workflows/standards
```

Each layer depends only on layers below it. No upward dependencies. No
circular dependencies at the layer level.

## Functionality Boundaries

A directory with an `AGENTS.md` is a functionality boundary. The ACC
repo's boundaries are:

- `` (root) — the `acc` framework and CLI itself.
- `docs/` — the specification and authoring guides.

As implementation modules are added, each becomes its own boundary with
its own `AGENTS.md` (e.g., `src/cli/AGENTS.md`, `src/graph/AGENTS.md`).

## Truth Categorization

| Kind | Authority | Source |
|------|-----------|--------|
| Declared | Authoritative | `AGENTS.md` sections. |
| Discovered | Observational | Language analyzers + filesystem. |
| Inferred | None | `acc discover` suggestions. |
| Memory | Orientational | `.acc-memory.md` entries. |

Declared wins over discovered when they disagree; the disagreement
becomes a diagnostic. Inferred is never asserted as architecture.
Memory is never used for graph derivation.

See docs/03-epistemology.md.

## Stability Contracts

- `ACC0xx` diagnostic codes: stable forever. No renumbering.
- JSON `schema_version`: breaking changes require a major bump.
- CLI flag names: stable post-1.0; renaming is forbidden.

## Security

- No code execution (no `npm scripts`, `Makefiles`, build scripts).
- No network calls.
- Symlinks escaping the project root are not followed.
- Paths escaping the project root are refused (ACC080).

## Dependency Rules

- All dependencies MUST be declared in `AGENTS.md` using canonical paths.
- Discovered but undeclared dependencies surface as `ACC022` warnings.
- Forbidden dependencies are enforced via `.acc/config/config.yaml`.
- Circular dependencies are warned (`ACC014`) but not forbidden.

## Ownership Rules

- Every functionality MUST have a declared owner (team or parent path).
- Ownership is exclusive: one owner per functionality.
- Unowned dependency targets emit `ACC031` warnings.
- Duplicate ownership emits `ACC030` errors.

## Constraint Rules

- Constraints are declared invariants in `AGENTS.md`.
- Constraints are plain text; ACC surfaces them but does not enforce.
- Constraints apply to the declaring functionality and its subtree.
- Constraints are surfaced in `acc context` and `acc impact`.