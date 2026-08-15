# ACC — Agent Code Context

## Purpose

`acc` is a CLI and framework that makes software repositories agent-native,
navigable, declarative, graph-oriented, and self-describing — without
requiring an ACC-specific agent. The repository is the sole source of
truth; the `acc` CLI is an optional deterministic accelerator.

## Responsibilities

- Preserve 100% compatibility with the existing `AGENTS.md` ecosystem.
  Removing `.agents/` or the `acc` CLI MUST leave a valid `AGENTS.md`
  repository.
- Derive the architecture graph from `AGENTS.md` (declared) + source
  imports (discovered) + filesystem structure, in-memory, at query time.
- Produce focused, progressive, provenance-tagged agent-ready context
  via `acc context`.
- Validate repositories with stable diagnostic codes (`ACC0xx`).
- Stay offline, filesystem-first, language-agnostic in core, and safe
  on untrusted repositories (no code execution, no network).

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- Repository filesystem (files, folders, `AGENTS.md`, source).
- `.agents/acc/config.yaml` (optional; defaults when absent).

## Outputs

- Terminal prose and JSON (`--json`) for every command.
- `.acc-memory.md` files (via `acc memory` subcommands only).
- `AGENTS.md` templates (via `acc document --apply` only).
- Diagnostics with stable `ACC0xx` codes.

## Dependencies

- docs/       (this project's specification and guides)

## Constraints

- MUST NOT introduce a competing instruction-file standard. `AGENTS.md`
  stays Markdown with no proprietary schema.
- MUST NOT require an ACC-specific agent, LLM wrapper, IDE, or runtime.
- MUST NOT execute arbitrary code, npm scripts, Makefiles, or build
  scripts (untrusted-repo safety).
- MUST NOT make telemetry calls or upload repository contents (offline-first).
- MUST NOT require a database; V1 uses an in-memory graph.
- Declared facts win over discovered facts; inferred facts are never
  asserted as authoritative (see docs/03-epistemology.md).
- Diagnostic codes (`ACC0xx`) and JSON `schema_version` are stable;
  renumbering/renaming is forbidden after release.

## Architecture

The project is organized as a set of functionality boundaries, each with
its own `AGENTS.md`. V1 implementation language: see `docs/04-cli-commands.md`
for the CLI contract and `docs/03-epistemology.md` for the graph model.

Layers (top to bottom):

1. CLI command layer — argument parsing, output formatting (terminal/JSON).
2. Context engine — progressive depth, provenance, section assembly.
3. Graph derivation — filesystem walk, `AGENTS.md` heuristic parse,
   language analyzers (optional), truth resolution.
4. Diagnostics — stable code registry, severity, config overrides.
5. Memory — `.acc-memory.md` read/write.
6. Control plane — `.agents/acc/` config + agents/workflows/standards.

See docs/README.md for the full documentation index.

## Workflows

- See `.agents/acc/workflows/feature.md` for adding a new functionality.
- See `.agents/acc/workflows/diagnostic.md` for adding a new diagnostic code.
- See `.agents/acc/workflows/release.md` for the release checklist.

## Agent operating instructions

When modifying this repository:

1. Read the relevant `AGENTS.md` (this file, or the functionality-local one).
2. Inspect `.acc-memory.md` if present in the functionality directory.
3. Understand graph relationships (`acc graph`, `acc dependencies`).
4. Preserve declared invariants (the Constraints section above and in
   each functionality's `AGENTS.md`).
5. Validate affected functionality after changes (`acc check`, `acc impact`).
6. Update durable functionality knowledge in `.acc-memory.md` when appropriate.
7. When changing behavior that affects the JSON or diagnostic contract,
   bump `schema_version` per docs/07-json-schema.md and never reuse a
   diagnostic code per docs/06-diagnostic-codes.md.

An agent that has never heard of ACC can follow these instructions as
plain Markdown. The `acc` CLI commands are accelerators; the fallback is
reading files and source directly.
