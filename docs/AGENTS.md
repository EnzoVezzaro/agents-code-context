# docs — ACC specification

## Purpose

Authoritative specification for the ACC framework: philosophy, repository
structure, epistemology, CLI, context engine, diagnostic codes, JSON
schema, memory semantics, and the `AGENTS.md` authoring guide.

## Responsibilities

- Define the hard invariant and agent-agnostic philosophy.
- Specify the `.agents/acc/` control plane and `.acc-memory.md` memory layer.
- Define the derived architecture graph and truth categorization.
- Specify the `acc` CLI surface, flags, and stable exit codes.
- Maintain the `ACC0xx` diagnostic code registry and JSON `schema_version`.
- Provide the authoring guide for writing `AGENTS.md` in ACC-enhanced repos.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- The framework design decisions made in the root `AGENTS.md` and in
  `.agents/acc/standards/architecture.md`.

## Outputs

- Markdown spec documents under `docs/` referenced by the CLI, agents,
  and the project's `AGENTS.md` files.

## Dependencies

- (root)        parent context

## Constraints

- Specifications MUST NOT require an ACC-specific agent.
- Diagnostic codes (`ACC0xx`) and JSON `schema_version` are stable;
  renumbering/renaming is forbidden.
- The hard invariant MUST hold: removing `.agents/` leaves a valid
  `AGENTS.md` repository.
- All CLI behavior described here must be deterministic and offline.

## Architecture

The documentation index lives at `docs/README.md`. Each numbered file
covers one area:

- `01-philosophy.md` — core principles, agent-agnostic operation.
- `02-repository-structure.md` — layout, control plane, memory.
- `03-epistemology.md` — declared/discovered/inferred, graph model.
- `04-cli-commands.md` — every command, flags, exit codes.
- `05-context-engine.md` — `acc context`, progressive depth.
- `06-diagnostic-codes.md` — the `ACC0xx` registry.
- `07-json-schema.md` — deterministic JSON envelope and payloads.
- `08-memory-semantics.md` — `.acc-memory.md` lifecycle and format.
- `09-authoring-guide.md` — how to write `AGENTS.md` for ACC.

Changes to the CLI surface MUST be reflected here before release (see
`.agents/acc/workflows/release.md`).
