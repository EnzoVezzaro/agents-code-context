# lib — core engine + command modules

## Purpose

The ACC engine and CLI surface. Two layers, cleanly separated:

- `lib/core/` — the domain logic: graph derivation, diagnostics,
  config loading, memory, AI providers, engine loop, skill shipping,
  and the deterministic output layer. Pure logic — no argv parsing,
  no terminal formatting.
- `lib/commands/` — one thin handler per `acc` command: parses argv,
  calls the core, formats the result. See `lib/commands/AGENTS.md`.

The split is why `lib/core/ai.js` and `lib/commands/ai.js` coexist:
the former is the provider/model logic, the latter is the `acc ai`
CLI handler that calls it.

## Responsibilities (core)

- Derive the architecture graph from `AGENTS.md` declarations + source
  references + filesystem structure, in memory, at query time
  (`core/graph.js`).
- Run the validation pipeline and emit stable `ACC0xx` diagnostics with
  severity, path, and structured detail (`core/diagnostics.js`).
- Load `.acc/config/config.yaml` with sensible defaults and safe
  degradation on malformed input (`core/config.js`).
- Read/write `.acc-memory.md` files with provenance (`core/memory.js`,
  `core/gitmeta.js`).
- Heuristically parse plain-Markdown `AGENTS.md` contracts without
  imposing a schema (`core/agents.js`).
- Provide the deterministic JSON envelope and stable sort rules
  (`core/output.js`) and the minimal YAML-subset parser for config
  (`core/yaml.js`).
- Provide filesystem primitives: project-root detection, UTF-8-safe
  reads, file walking with ignore patterns, deterministic ordering
  (`core/util.js`).
- Own the deterministic, offline-safe argument parser (`core/args.js`).
- Manage AI providers + model resolution (AI SDK v5) (`core/ai.js`).
- Run the always-on engine loop (triggers, sync, supervisor)
  (`core/engine.js`, `core/trigger.js`, `core/warnfile.js`).
- Ship the canonical skill (`core/skill.js`).

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

Two flat layers: `core/` is pure functions over the filesystem
(`buildGraph` derives the graph at query time; `check` runs the
diagnostic pipeline; `config.load` merges defaults with the optional
control plane; `output` guarantees determinism; `engine` is the
always-on loop on top of the same deterministic commands).
`commands/` is one thin module per command. Nothing here touches the
network or executes code.

## Workflows

- See `.acc/config/workflows/diagnostic.md` for adding a diagnostic code.
- See `.acc/config/workflows/feature.md` for adding a command.
