# architecture.md — ACC project architecture standard

This standard is referenced by `AGENTS.md` files across the ACC repo.
It defines the project's architecture expectations and the rules that
govern how functionality boundaries relate.

## Hard invariant

```text
ACC-enhanced  =  Repository  +  AGENTS.md  +  .agents/acc/
```

Removing `.agents/` or the `acc` CLI MUST leave a valid `AGENTS.md`
repository. This invariant is load-bearing for every design decision.

## Layered architecture

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
Control plane            .agents/acc/ config + agents/workflows/standards
```

Each layer depends only on layers below it. No upward dependencies. No
circular dependencies at the layer level.

## Functionality boundaries

A directory with an `AGENTS.md` is a functionality boundary. The ACC
repo's boundaries are:

- `` (root) — the `acc` framework and CLI itself.
- `docs/` — the specification and authoring guides.

As implementation modules are added, each becomes its own boundary with
its own `AGENTS.md` (e.g. `src/cli/AGENTS.md`, `src/graph/AGENTS.md`).

## Truth categorization

| Kind | Authority | Source |
|---|---|---|
| Declared | Authoritative | `AGENTS.md` sections. |
| Discovered | Observational | Language analyzers + filesystem. |
| Inferred | None | `acc discover` suggestions. |

Declared wins over discovered when they disagree; the disagreement
becomes a diagnostic. Inferred is never asserted as architecture.

See docs/03-epistemology.md.

## Stability contracts

- `ACC0xx` diagnostic codes: stable forever. No renumbering.
- JSON `schema_version`: breaking changes require a major bump.
- CLI flag names: stable post-1.0; renaming is forbidden.

## Security

- No code execution (no `npm scripts`, `Makefiles`, build scripts).
- No network calls.
- Symlinks escaping the project root are not followed.
- Paths escaping the project root are refused (ACC080).
