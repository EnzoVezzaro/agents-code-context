# 04 — Epistemology & Architecture Graph

> **TLDR:** every fact ACC shows you has a *source*
> and an *authority level*. When ACC says "this module depends on that
> module," you (or your agent) deserve to know *how ACC knows* — and
> whether it's a fact worth trusting, an observation, or just a guess.

Every edge, node, and label in the derived graph carries one of three
labels — declared, discovered, or inferred — and ACC is careful about
which is which. This page defines those three kinds of truth, how they
are resolved when they disagree, and why the distinction is what makes
the graph worth trusting.

## 1. The Graph Is Derived, Not Maintained

Good news first: you never maintain a graph file. No `graph.yaml`, no
`architecture.json`, nothing to keep in sync with reality.

ACC **MUST NOT** require standalone graph files such as `graph.yaml` or
`architecture.json`.

The architecture graph is **derived** at query time from three sources:

1. **Declared contracts** in `AGENTS.md` files
2. **Discovered imports/references** in source code (via language analyzers)
3. **Filesystem structure** (directories, functionality boundaries)

The repository is the sole source of truth. `acc graph` computes the
graph on demand; it never reads a pre-existing graph file, and it never
writes one. Your repo stays your repo — the graph is a projection that
exists in memory while the command runs.

---

## 2. Strict Categorization of Truth

Every fact in the graph carries an explicit **provenance tag** — one of
four categories. Think of it as labeling each fact with *where it came
from* and *how much to trust it*.

### Declared 📝

Architectural authority explicitly written in `AGENTS.md`.

**Examples:**
- `Dependencies:` section in `src/payments/AGENTS.md` listing `src/database/` as a dependency
- `Ownership:` section in `src/database/AGENTS.md` naming the database team/module
- `Constraints:` section stating "Must not depend on `src/ui/`"

**Source:** `src/payments/AGENTS.md` (human-authored, committed)

**Authority:** **Authoritative**. Declared facts override discovered
facts when they conflict. The graph shows the declared fact; discovered
facts that contradict it become diagnostics (see [07 — Diagnostic Codes](./07-diagnostic-codes.md)).

### Discovered 🔍

Observed from implementation by language analyzers or filesystem heuristics.

**Examples:**
- `src/payments/mod.rs` imports `src/database::Connection` → discovered dependency `payments → database`
- `tests/payments_test.go` imports `src/payments` → discovered dependent `payments-test → payments`
- No language analyzer available → fallback: structural relationships from filesystem

**Source:** `Discovered from Rust imports`, `Discovered from filesystem structure`, etc.

**Authority:** **Observational**. Discovered facts are the ground truth
of what the code *actually does*, but they are second-class relative to
**declared** architectural intent for the purpose of the control plane.
When discovered and declared disagree, the declared intent wins for
architecture, and the disagreement is surfaced as a diagnostic.

### Inferred 💡

Suggestions/guesses produced by ACC, usually from a diff between declared
and discovered.

**Examples:**
- `acc discover` finds that `src/database/` imports `src/payments/` but no `AGENTS.md` declares this dependency → suggests adding it
- A directory has no `AGENTS.md` but contains substantial code → suggests creating one (via `acc document`)
- Two `AGENTS.md` files both claim ownership of `src/payments/`

**Source:** `Inferred by acc discover from declared/discovered diff`

**Authority:** **None**. Inferred facts are suggestions. ACC **MUST
NEVER** silently assert inferred information as authoritative
architecture.

Inferred facts are always returned with the provenance tag `Inferred`
and MUST be surfaced explicitly — they MUST NOT be merged into the
declared graph without confirmation. A guess is a starting point for a
human decision, never a fact on its own.

### Memory 🧠

Agent-authored durable knowledge from `.acc-memory.md`.

**Examples:**
- "The payment gateway client in `gateway.rs` is non-reentrant"
- "Idempotent retries deferred to v2. Reason: gateway reentrancy"

**Source:** `src/payments/.acc-memory.md`

**Authority:** **Orientational**. Memory is agent knowledge, not
architectural authority. ACC MUST NOT use memory to derive graph edges,
owners, or constraints. It tells you what to watch out for, not how the
system is supposed to be built.

---

## 3. Provenance Contract

Every piece of context emitted by any ACC command carries a provenance
tag:

```text
Source: src/payments/AGENTS.md                     → Declared
Source: Discovered from Rust imports                → Discovered
Source: Inferred by acc discover                    → Inferred
Source: src/payments/.acc-memory.md                 → Memory
```

### In JSON Output

```json
{
  "provenance": {
    "kind": "declared",                          // "declared" | "discovered" | "inferred" | "memory"
    "source": "src/payments/AGENTS.md",
    "detail": "Dependencies section"
  }
}
```

Provenance is mandatory for graph nodes, graph edges, context items, and
suggestions. Commands MUST refuse to emit a fact without provenance.
This is a hard contract, not a best-effort thing — it's the only way an
agent (or a human) can tell "this is what we decided" from "this is what
I noticed" from "this is a guess" from "this is a lesson learned."

---

## 4. Graph Model

### Nodes

A node is a **functionality boundary** — a directory containing or
inheriting an `AGENTS.md`.

```json
{
  "id": "src/payments",
  "path": "src/payments",
  "name": "payments",
  "has_local_contract": true,
  "owners": ["payments-team"],       // declared, optional
  "roles": ["module"],               // declared, optional
  "provenance": {
    "kind": "declared",
    "source": "src/payments/AGENTS.md"
  }
}
```

- `id` = canonical POSIX path of the functionality directory. Paths are canonical references (see [02 §7](./03-repository-structure.md#7-path-conventions-used-by-this-spec)).
- No arbitrary opaque IDs. A node's name is its path — you never need a lookup table.
- A directory with no `AGENTS.md` is a structural node with `has_local_contract: false`; it inherits context from the nearest ancestor with a contract.

### Edges

An edge is a directed relationship between two functionality boundaries.

```json
{
  "from": "src/payments",
  "to": "src/database",
  "kind": "dependency",              // "dependency" | "dependents" | "ownership"
  "provenance": {
    "kind": "declared",              // or "discovered", "inferred"
    "source": "src/payments/AGENTS.md",
    "detail": "Dependencies section"
  }
}
```

**Edge kinds:**

| Kind | Meaning |
|------|---------|
| `dependency` | `from` depends on `to` (declared or discovered) |
| `dependents` | `from` is depended-upon by `to` — computed inverse of `dependency` |
| `ownership` | `from` owns `to` — declared in `AGENTS.md`; inferred ownership is a suggestion only |

All graph edges are directed. All carry a `provenance` object.

### The Knowledge-Graph Index (machine-only extension)

Alongside the architecture graph, ACC derives a **typed index**
(`items`/`links`) that is deliberately machine-only. It is an index of
relationships, not a knowledge store: nodes and edges carry **no prose,
no descriptions, no documentation, no knowledge** — those live in
`AGENTS.md` / `SKILL.md` / `.acc-memory.md` and are read from the
filesystem on demand. The index points at the filesystem; it never
duplicates it.

**Node metadata is minimal:** `id` (canonical POSIX path), `type`,
`parent`, `hash` (content hash for change detection), `flags`, and the
mandatory `provenance` tag. Nothing else.

**Node types (closed set):**

| Type | Meaning |
|------|---------|
| `boundary` | Functionality boundary (the architecture-graph nodes) |
| `agents` | An `AGENTS.md` contract file |
| `file` | A source file |
| `test` | A test file (test dirs or `*_test.*` / `*.test.*` / `*.spec.*` naming) |
| `skill` | A `SKILL.md` package (`.agents/skills/`, `.acc/config/skills/`) |
| `standard` | A standard (`.acc/config/standards/*.md`) |

**Edge kinds (closed set):** `dependency`, `ownership` (architecture),
plus `governs` (agents → boundary), `owns` (boundary → file/test),
`requires` (boundary → skill/standard referenced in its contract), and
`tested_by` (file → test). Edges carry only `from`, `to`, `kind`, and
`provenance`.

The index is **queried, not read**: `acc slice <path>` (and
`graphSlice()` in lib/core/graph.js) returns the compact AI-optimized slice
for a path — governed_by, owns, depends_on, dependents, tested_by,
requires, and the impact budget (files/boundaries/tests/contracts over
the scope + transitive dependents). That slice is the context boundary:
no agent ever needs the whole index, only the slice.

#### The over-feeding problem (and how ACC avoids it)

**The problem:** a large repository, fed to an agent whole, overwhelms
it. Every extra irrelevant file competes with the relevant one for
attention — and for tokens. Empirically, models degrade on tasks when
the prompt is padded with unrelated context (lost-in-the-middle
behavior), and the cost grows linearly with what you feed. Feeding a
100k-file repo to a model because the change touches one file is both
slow and *worse*: the signal-to-noise ratio collapses. This is the
**over-feeding problem** — context explosion that makes agents slower,
more expensive, and less accurate, all at once.

**ACC's answer is structural, not prompt-engineering:**

1. **The graph is a routing index, not a context dump.** It stores
   ids, types, hashes and provenance — never prose, never code, never
descriptions. Measured: ~180 bytes/item, flat (~380 bytes/file) from
22 files to 3,900 files (see
[05 — Engine limits](./05-cli-commands.md#engine-limits-measured)).
The graph stays small *because* it points at the filesystem instead
of copying it.
2. **Context is assembled per scope, on demand.** `acc context` and
   `acc slice` return only what a path needs, at the depth asked for.
   The engine reviews **one boundary at a time** with a hard budget
   (contract ≤ 4 KB, slice ≤ 1.5 KB, ≤ 10 changed files, ≤ 6 KB of
   changed code) — so a 3,900-file repo costs the same per review as
   a 22-file one.
3. **The engine is trigger-gated.** The AI phase only runs after
   enough real change accumulates (default 3 commits), and only on the
   changed code — never a periodic re-read of everything.
4. **Determinism is the floor.** The scan, graph and dependency gaps
   are deterministic and catch drift at every scale regardless of the
   AI. The AI layer adds nuance on top of a bounded slice; it is never
   the only thing looking.

Measured consequence: drift detection held at 4/4 sizes from 22 to
3,900 files with constant per-review context (~4.6 KB) — the repository
grows, the context given to the model does not. Full numbers:
`docs/benchmarks/engine-2026-08-17.md`.

---

## 5. Truth Resolution

When declared and discovered disagree, nobody shrugs — there's a
deterministic answer:

1. **Declared wins** for architecture authority. The graph reflects declared intent.
2. **Discovered facts are retained** as edge annotations and become diagnostics.
3. **The disagreement is surfaced**, never buried. Diagnostic codes from [07 — Diagnostic Codes](./07-diagnostic-codes.md) apply.

| Situation | Resolution |
|-----------|------------|
| Declared A→B, discovered A→B | Aligned. One edge, declared provenance (discovered confirms). |
| Declared A→B, no discovery of A→B | Edge kept (declared). Diagnostic `ACC020` possible stale dependency / undiscoverable. |
| No declared A→B, discovered A→B | Edge added with discovered provenance. `acc discover` suggests declaring it. |
| Declared A→B, discovered B→A | Conflict. Retain declared A→B. Diagnostic `ACC021` declared/discovered direction mismatch. |

The philosophy: your written intent wins, reality still gets heard, and
the gap between them becomes visible work instead of silent drift.

### Drift Is Directional

The disagreement between declared and discovered facts is surfaced with
its direction, so the developer knows which side is out of sync:

- **Docs behind code** — discovered references exist that no declaration
  covers (e.g. `src/auth` uses `src/logging` but no AGENTS.md says so).
  The code moved ahead of the documentation.
- **Docs ahead of code** — a declaration has no code backing (e.g.
  `src/auth` declares `src/database` but nothing references it). The
  documentation promises something the code doesn't deliver.

`acc engine` writes both directions to `ACC_WARN.md` in the project
root on every run, alongside the code-violation diagnostics, so drift
is impossible to miss. The graph tracks code-backed declarations
(`graph.codeBacked`) to distinguish "declared AND implemented" from
"declared but unimplemented" — both facts are kept, neither is erased.

---

## 6. Ownership — First-Class Concept

Ownership is a declared architectural fact, not inferred. "Who owns this
code" is a human decision; ACC just makes sure the decision is written
down and consistent.

### Declared Ownership

Found in `AGENTS.md` under an `Ownership` heading (heuristic) or similar prose.

```markdown
## Ownership

Owner: payments-team
```

### Ownership Conflicts

ACC MUST detect and warn about conflicting ownership:

- Two `AGENTS.md` files both claiming ownership of the same path → diagnostic `ACC030` (duplicate ownership)
- A path present in a declared dependency but not mentioned in any `AGENTS.md` ownership section → diagnostic `ACC031` (unowned dependency)
- A functionality's ownership changes between commits (if V1 reads git history — optional) → diagnostic `ACC032` (ownership drift)

### Inferred Ownership

ACC MUST NOT assert inferred ownership as authoritative. If ACC guesses
an owner from code heuristics or file-branch patterns, it returns the
guess with `provenance.kind = "inferred"` and a diagnostic. Guesses get
labeled as guesses.

---

## 7. Language Analyzers — Optional Accuracy

Core graph logic relies on files, folders, and Markdown — fully
language-agnostic. Language-specific import discovery is an **optional
abstraction layer** that improves edge accuracy when available.

### Analyzer Interface (Sketch)

```text
trait LanguageAnalyzer {
    fn name(&self) -> &str;                  // "rust" | "typescript" | "go" | "python"
    fn file_extensions(&self) -> &[&str];    // ["rs"], ["ts","tsx"], ["go"], ["py"]
    fn discover_imports(
        &self,
        path: &Path,
        project_root: &Path,
    ) -> Vec<DiscoveredReference>;
}
```

### Fallback

If no analyzer is available for a language, ACC degrades gracefully:

- No discovered import edges for that code.
- The graph retains declared edges (from `AGENTS.md`).
- `acc graph` works with filesystem + Markdown only.
- `acc check` reports `ACC040` "no language analyzer for extension `.foo`" at most once per extension (informational, not error).

The core works on any repo in any language; analyzers are the optional
turbo button.

---

## 8. Graph Derivation Algorithm (V1, In-Memory)

1. **Walk the filesystem** from the project root (respecting `.acc/config/config.yaml:ignore`).
2. **Identify functionality boundaries**: directories containing an `AGENTS.md`. Each such directory becomes a node (plus the root node).
3. **Parse `AGENTS.md` files heuristically**: extract declared dependencies, ownership, roles, constraints. Provenance = declared.
4. **Run language analyzers** (enabled in config) over source files. Each resolved import between two functionality boundaries becomes a discovered edge. Provenance = discovered.
5. **Compute inverse edges** (dependents) from declared + discovered dependencies.
6. **Resolve conflicts** per §5, emitting diagnostics for mismatches.
7. **Detect ownership conflicts** per §6, emitting `ACC03x` diagnostics.
8. The graph lives in memory for the duration of the CLI invocation. No on-disk cache, no database.
9. **Output** per command format (terminal or JSON).

Complexity target for V1: O(N) filesystem walk + O(E) edge computation,
where N = file count and E = import count. Good enough for repo-scale
graphs without indexing — no database, no daemon, no setup.

---

## 9. Determinism Guarantee

`acc graph`, `acc context`, `acc check`, and all graph-derived commands
with the same repository state and same flags MUST produce byte-identical
output across runs (modulo progress indicators, which `--json` and
`--quiet` suppress).

This is required because:
- Agents diff `acc graph` outputs to detect architectural drift
- CI uses `acc check --json` for regression checks on contract shapes
- Reproducibility is a core ACC value (see [01 — Philosophy §7](./01-philosophy.md))

Determinism is what turns the graph into a reliable signal: if the
output changes between runs, it means *the repository changed*, not that
ACC had a mood.

**Order rules:**
1. Nodes sorted lexicographically by `id` (POSIX byte order)
2. Edges sorted by `from`, then `to`, then `kind`
3. Provenance sort: declared < discovered < inferred < memory

The guarantee is locked by a test battery (`test/determinism.test.js`):
every read-only command is executed twice in fresh processes and must
produce byte-identical stdout; write commands must report identical
results on fresh copies. `acc tools` sorts directory listings and
`package.json` script names explicitly — filesystem `readdir` order is
never relied upon. Known exceptions are documented there (`acc battle`
spawns an external process; `acc memory add` timestamps the file it
writes; `acc ai` reflects the environment it runs in).
