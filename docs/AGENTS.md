# docs — ACC specification

## Purpose

Authoritative specification for the ACC framework: philosophy, repository
structure, epistemology, CLI, context engine, diagnostic codes, JSON
schema, memory semantics, and the `AGENTS.md` authoring guide.

## Responsibilities

- Define the hard invariant and agent-agnostic philosophy.
- Specify the `.acc/config/` control plane and `.acc-memory.md` memory layer.
- Define the derived architecture graph and truth categorization.
- Specify the `acc` CLI surface, flags, and stable exit codes.
- Maintain the `ACC0xx` diagnostic code registry and JSON `schema_version`.
- Provide the authoring guide for writing `AGENTS.md` in ACC-enhanced repos.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- The framework design decisions made in the root `AGENTS.md` and in
  `.acc/config/standards/architecture.md`.

## Outputs

- Markdown spec documents under `docs/` referenced by the CLI, agents,
  and the project's `AGENTS.md` files.

## Dependencies

- (root)        parent context

## Constraints

- Specifications MUST NOT require an ACC-specific agent.
- Diagnostic codes (`ACC0xx`) and JSON `schema_version` are stable;
  renumbering/renaming is forbidden.
- The hard invariant MUST hold: removing `.acc/` leaves a valid
  agents.md repository.
- All CLI behavior described here must be deterministic and offline.

## Architecture

The documentation index lives at `docs/README.md`. Each numbered file
covers one area:

- `01-philosophy.md` — core principles, agent-agnostic operation.
- `02-markdown-is-all-you-need.md` — the readings behind ACC and the framework's alignment.
- `03-repository-structure.md` — layout, control plane, memory.
- `04-epistemology.md` — declared/discovered/inferred, graph model.
- `05-cli-commands.md` — every command, flags, exit codes.
- `06-context-engine.md` — `acc context`, progressive depth.
- `07-diagnostic-codes.md` — the `ACC0xx` registry.
- `08-json-schema.md` — deterministic JSON envelope and payloads.
- `09-memory-semantics.md` — `.acc-memory.md` lifecycle and format.
- `10-authoring-guide.md` — how to write `AGENTS.md` for ACC.
- `11-multi-agent-orchestration.md` — graph-driven partitioning, concurrency, handoff.
- `13-security.md` — the security model: offline guarantees, read/write surface, untrusted input.

Changes to the CLI surface MUST be reflected here before release (see
`.acc/config/workflows/release.md`).
