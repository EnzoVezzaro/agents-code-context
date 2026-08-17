# `acc graph [path]` — the architecture graph

Derive the repository graph from `AGENTS.md` (declared) + source imports
(discovered) + filesystem structure, in memory, at query time. The graph
is an index, not the knowledge: it stores ids, types, hashes and
provenance — never prose.

## When to use

- First time in a codebase: see the boundaries at a glance.
- To understand which edges are declared (human-written) vs discovered
  (observed from imports) vs inferred.
- To check for dependency cycles before a refactor.
- When you need machine-readable structure for a script or a model
  (`--json`).

## Usage

```
acc graph [path] [--format text|mermaid|dot|json] [--nodes] [--provenance] [--max-depth N]
```

## Flags

- `--format` — output format. Default comes from config
  `graph.default_format` (json by default since 0.5.0); `text`,
  `mermaid`, `dot` render the readable forms.
- `--nodes` — text output: node list instead of edges.
- `--provenance` — annotate each edge with declared/discovered/inferred.
- `--max-depth N` — limit the emitted subgraph (inert without it).
- `--json` — full graph: nodes, edges, links, cycles.

## Workflow

1. `acc graph` — get the boundary/edge picture of the whole repo.
2. `acc graph <path>` — zoom into one boundary's neighborhood.
3. `acc graph --format mermaid` (or `dot`) — paste into a renderer when
   you need a visual.
4. For a per-scope question, prefer `acc slice <path>` — the compact
   AI-optimized view.

## Example

```text
$ acc graph --format text
src/auth → src/database   (declared, hop=0)   Source: src/auth/AGENTS.md
src/auth → src/logging    (discovered)         Source: src/auth/token.rs
src/database → src/config (declared, hop=1)   Source: src/database/AGENTS.md
```

## Edge cases

- The graph derives everything in memory per invocation — no on-disk
  cache, no database.
- `--nodes --json` returns nodes with no edges.
- Deterministic: identical output across runs for the same tree.
