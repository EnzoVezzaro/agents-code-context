# 05 — Context Engine

> **What this page is about:** `acc context` is the command you'll reach
> for most. It's the answer to the question "what does the agent actually
> need to know to touch this code?" — without dumping the whole repo on
> it.

## 1. Goal

`acc context <path>` produces **focused, progressive, agent-ready
context** for a given path. It explicitly MUST NOT dump the whole
repository.

The context engine is the central value of `acc`: it compresses the
repository's architectural knowledge for a specific functionality into
something an agent can read in a few thousand tokens instead of
megabytes of source. It's the difference between "here's everything"
and "here's exactly what you need."

---

## 2. Progressive Depth

### Flag

`--depth <N>` (default `1`).

| `--depth` | Meaning |
|-----------|---------|
| `0` | Immediate functionality boundary + local contract only. No transitive expansion. |
| `1` (default) | Above + direct dependencies' contracts (their `AGENTS.md` only). |
| `2` | Above + 2-hop transitive dependencies' contracts. |
| `N` | N-hop transitive expansion of contracts. |

### Depth Limits Contract Expansion, Not Graph Traversal

`--depth N` limits **transitive expansion of contract context** — how far
away from `<path>` we pull in `AGENTS.md` contents. The underlying graph
(used by `acc graph`, `acc dependencies --transitive`, `acc impact`) is
always fully derivable. Depth is about **how much context we show the
agent**, not about how much we can compute. The full map always exists;
depth controls how much of it you hand over.

### Why the Default Is Conservative

The default (`1`) keeps output small. An agent reading context for
`src/auth/` gets:

- `src/auth/AGENTS.md` (local contract)
- Inherited `AGENTS.md` chain (root → `src/auth/`)
- Direct dependencies' contracts (e.g., `src/database/AGENTS.md`, `src/logging/AGENTS.md`)

It does NOT get second-hop contracts unless asked. This keeps agent
prompt size manageable while preserving the most load-bearing
architectural context. More is not better — the right amount is better.

---

## 3. Output Sections

`acc context <path>` emits six sections (filterable via `--include` / `--exclude`):

### 3.1 Hierarchy

The inherited `AGENTS.md` chain from the project root to the resolved
functionality boundary. For each ancestor:
- path
- whether it has a local `AGENTS.md`
- the local contract's source path (provenance: declared)
- a one-line summary of its primary responsibility (if parseable)

**Example (terminal):**
```text
## Hierarchy
  project root        AGENTS.md           Source: AGENTS.md
  └─ src/             AGENTS.md           Source: src/AGENTS.md
      └─ src/auth/    AGENTS.md           Source: src/auth/AGENTS.md
```

### 3.2 Contract

The local `AGENTS.md` contents at the resolved functionality boundary.
Two parts:
- **Parsed structure**: sections ACC heuristically detected (e.g., `Purpose`, `Dependencies`, `Ownership`, `Constraints`).
- **Raw text reference**: the file path so an agent can read the raw Markdown itself (ACC's heuristic parse is non-authoritative; the raw text is the source of truth).

Provenance: declared (`src/auth/AGENTS.md`).

### 3.3 Dependencies

Direct then transitive (per `--depth`). Each dependency row:
- `to` path
- edge kind (`dependency`)
- provenance: declared or discovered (both shown when they agree)
- declared constraints between `path` and the dependency, if any

Rows are sorted: declared first, then discovered, then inferred. Within
each bucket: lexicographic by path.

Transitive rows carry a `hop` count (1 = direct, 2 = one hop away, etc.).
Transitive expansion stops at `--depth`.

**Example (terminal):**
```text
## Dependencies (depth=1)
Declared:
  → src/database/      hop=0   Source: src/auth/AGENTS.md (Dependencies)
  → src/logging/       hop=0   Source: src/auth/AGENTS.md (Dependencies)

Discovered:
  → src/database/      hop=0   Source: Discovered from Rust imports (src/auth/mod.rs)
  ⚠ src/ui/            hop=0   Source: Discovered from Rust imports — undeclared
```

### 3.4 Constraints

Declared invariants applying to `<path>`:
- local (declared in the local `AGENTS.md`)
- inherited (declared in ancestor `AGENTS.md` files that apply to this subtree)

Each carries provenance. Inferred constraints are never emitted here;
constraints are declared-only by definition (see [03 — Epistemology](./03-epistemology.md#2-strict-categorization-of-truth)). A constraint
you see in context output is something a human wrote down on purpose.

### 3.5 Implementations

A high-level summary of the source under `<path>`:
- file count
- per-language summary (if a language analyzer is available): number of modules, top-level functions/classes, exported symbols — counts only, NOT source text.
- if no analyzer is available: file count + total bytes + extension histogram.

This section is included by default but can be excluded via
`--exclude implementations`. It NEVER contains source code dumps. It's
the "what's in here, roughly" section, not the code itself.

Provenance: discovered (from filesystem / language analysis).

### 3.6 Memory

The functionality's `.acc-memory.md` (existence by default; contents
with `--include memory`).

Provenance: memory (`Source: <path>/.acc-memory.md`).

---

## 4. Provenance Everywhere

Every section, every row, every line of context output has an explicit
provenance tag.

- Terminal format: a `Source: <ref>` annotation per row.
- JSON format: a `provenance` object per item (see [07 — JSON Output Schema](./07-json-schema.md)).

The context engine MUST refuse to emit a context item without
provenance. This is a hard contract, not a best-effort behavior — it's
the only way an agent (or human) can distinguish declared authority from
discovered observation from inferred suggestion from agent memory in the
output. No provenance, no output.

---

## 5. Output Budget

`--max-bytes <N>` (default `65536`).

A hard cap on total output bytes. When hit:
- Terminal output ends with a truncation marker:
  ```text
  … [truncated: 4096 bytes omitted; use --max-bytes to expand or --depth to narrow]
  ```
- JSON output sets `truncated: true` and `truncated_bytes_omitted: <N>` at the top level.

The agent or user can then raise `--max-bytes` or lower `--depth`.

The default `65536` is chosen so a single `acc context` call fits
comfortably within a standard agent context window without crowding out
the conversation. The cap is a feature: it forces the context to stay
useful instead of becoming the whole conversation.

---

## 6. Filtering

### `--include <kind[,kind...]>`

Restrict output to the named sections. Kinds: `hierarchy`, `contract`, `dependencies`, `constraints`, `implementations`, `memory`.

(`memory` is excluded by default; use `--include memory` to include the functionality's `.acc-memory.md` existence + contents.)

### `--exclude <kind[,kind...]>`

Remove sections from the default set. E.g., `--exclude implementations` for a contracts-only view.

`--include` and `--exclude` are mutually exclusive at the command level (specifying both is a usage error, exit `2`).

---

## 7. Memory Interaction

By default, `acc context` reports only the **existence** of
`<path>/.acc-memory.md`, not its contents.

With `--include memory`, the contents are included as a `## Memory`
section, with provenance `Source: <path>/.acc-memory.md`. Memory is
treated as agent-authored durable knowledge — neither declared nor
discovered architecture; it has its own provenance kind `memory`.

See [08 — Memory Semantics](./08-memory-semantics.md).

---

## 8. Determinism

`acc context <path>` with the same `<path>`, same repository state, and
same flags MUST produce byte-identical output across runs (modulo
progress indicators, which `--json` and `--quiet` suppress).

This is required because:
- Agents diff `acc context` outputs to detect architectural drift.
- CI uses `acc context --json` for regression checks on contract shapes.
- Reproducibility is a core ACC value (see [01 — Philosophy §7](./01-philosophy.md)).

**Order rules:**
1. Sections are always emitted in the order: Hierarchy, Contract, Dependencies, Constraints, Implementations, Memory.
2. Within a section, items are sorted per the rules in §3.
3. Paths sort lexicographically (POSIX byte order).
4. Provenance sort: declared < discovered < inferred < memory.

---

## 9. Failure Modes

| Failure | Behavior |
|---------|----------|
| Path does not exist | Exit `2` with usage error. |
| Path exists but has no `AGENTS.md` and no ancestor with one | Resolve to root node; emit Hierarchy with single root entry; Contract section reports "no local contract". Exit `0`. |
| `--depth` negative | Exit `2` usage error. |
| `--include` and `--exclude` both given | Exit `2` usage error. |
| Repository unreadable / permission denied | Exit `1` with error. |

Failure modes are explicit so scripts and agents can rely on exit codes
rather than parsing prose.

---

## 10. Example (Terminal)

```text
$ acc context src/auth --depth 1

## Hierarchy
  project root        AGENTS.md           Source: AGENTS.md
  └─ src/             AGENTS.md           Source: src/AGENTS.md
      └─ src/auth/    AGENTS.md           Source: src/auth/AGENTS.md

## Contract (src/auth/AGENTS.md)

Purpose:     Authentication and authorization for the API.
Ownership:   auth-team
Dependencies: src/database, src/logging
Constraints: Must not depend on src/ui.

Source: src/auth/AGENTS.md (parsed; raw file is source of truth)

## Dependencies (depth=1)
Declared:
  → src/database/   hop=0   Source: src/auth/AGENTS.md (Dependencies)
  → src/logging/    hop=0   Source: src/auth/AGENTS.md (Dependencies)
Discovered:
  → src/database/   hop=0   Source: Discovered from Rust imports (src/auth/mod.rs)
  ⚠ src/ui/         hop=0   Source: Discovered from Rust imports — undeclared

## Constraints
- Must not depend on src/ui.   Source: src/auth/AGENTS.md (Constraints)

## Implementations
Files: 8
Languages:
  rust: 6 files, 23 modules, 87 functions
  toml: 2 files
Source: Discovered from filesystem + rust language analyzer

## Memory
.acc-memory.md present at src/auth/.acc-memory.md
(use --include memory to view contents)

Context bytes: 1842 / 65536
```
