# lib — core engine

## Purpose

The core ACC engine: graph derivation, diagnostics, config loading,
memory, and the deterministic output layer. Everything the CLI needs to
turn a repository into provenance-tagged, agent-ready context.

## Responsibilities

- Derive the architecture graph from `AGENTS.md` declarations + source
  references + filesystem structure, in memory, at query time (`graph.js`).
- Run the validation pipeline and emit stable `ACC0xx` diagnostics with
  severity, path, and structured detail (`diagnostics.js`).
- Load `.acc/config/config.yaml` with sensible defaults and safe
  degradation on malformed input (`config.js`).
- Read/write `.acc-memory.md` files with provenance (`memory.js`,
  `gitmeta.js`).
- Heuristically parse plain-Markdown `AGENTS.md` contracts without
  imposing a schema (`agents.js`).
- Provide the deterministic JSON envelope and stable sort rules
  (`output.js`) and the minimal YAML-subset parser for config
  (`yaml.js`).
- Provide filesystem primitives: project-root detection, UTF-8-safe
  reads, file walking with ignore patterns, deterministic ordering
  (`util.js`).
- Own the deterministic, offline-safe argument parser (`args.js`).

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- Repository filesystem (`AGENTS.md`, source, `.acc/config/`,
  `.acc-memory.md`).

## Outputs

- In-memory graph objects, diagnostic lists, config objects, memory
  records — consumed by `lib/commands/`.

## Dependencies

- (leaf — no internal library dependencies)

## Constraints

- MUST NOT execute arbitrary code, npm scripts, or build scripts.
- MUST NOT make network calls or upload repository contents.
- MUST NOT require a database; V1 is an in-memory graph.
- Declared facts MUST win over discovered facts; inferred facts are
  never asserted as authoritative.
- Output MUST be deterministic: same repo + same flags = byte-identical.
- Diagnostic codes and `schema_version` are stable; renumbering is
  forbidden after release.

## Architecture

Pure functions over the filesystem. `buildGraph` derives the graph at
query time; `check` runs the diagnostic pipeline; `config.load` merges
defaults with the optional control plane; `output` guarantees
determinism. Nothing here touches the network or executes code.

## Workflows

- See `.acc/config/workflows/diagnostic.md` for adding a diagnostic code.
- See `.acc/config/workflows/feature.md` for adding a command.
