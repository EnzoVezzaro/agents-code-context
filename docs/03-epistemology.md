# 03 — Epistemology & Architecture Graph

## 1. The graph is derived, not maintained

ACC MUST NOT require standalone graph files such as `graph.yaml`.

The architecture graph is **derived** at query time from:

- declared contracts in `AGENTS.md` files
- discovered imports / references in source code
- filesystem structure (directories, functionality boundaries)

The repository is the sole source of truth. `acc graph` computes the
graph on demand from the repository; it never reads a pre-existing graph
file, and it never writes one.

---

## 2. Strict categorization of truth

Every fact in the graph carries an explicit **provenance tag**.

### Declared

Architectural authority explicitly written in `AGENTS.md`.

Examples:

- `Dependencies:` section in `src/audio/AGENTS.md` listing `src/database/`
  as a dependency.
- `Ownership:` section in `src/database/AGENTS.md` naming the database
  team / module.
- `Constraints:` section stating "Must not depend on `src/ui/`."

Source: `src/audio/AGENTS.md` (human-authored, committed).

Authority: **authoritative**. Declared facts override discovered facts
when they conflict. The graph shows the declared fact; discovered facts
that contradict it become diagnostics (see [06 — Diagnostic Codes](./06-diagnostic-codes.md)).

### Discovered

Observed from implementation by language analyzers or filesystem heuristics.

Examples:

- `src/audio/mod.rs` imports `src/database::Connection` → discovered
  dependency `audio → database`.
- `tests/audio_test.go` imports `src/audio`  → discovered dependent `audio-test → audio`.
- No language analyzer available → fallback: a functionality A that
  contains a directory named `audio` moving into a directory `database`
  via `mv` may be discovered as a structural relationship.

Source: `Inferred from Rust imports`, `Discovered from filesystem
structure`, etc.

Authority: **observational**. Discovered facts are the ground truth of
what the code actually does, but they are second-class relative to
**declared** architectural intent for the purpose of the control plane.
When discovered and declared disagree, the declared intent wins for
architecture, and the disagreement is surfaced as a diagnostic.

### Inferred

Suggestions / guesses produced by ACC, usually from a diff between
declared and discovered.

Examples:

- `acc discover` finds that `src/database/` imports `src/audio/` but no
  `AGENTS.md` declares this dependency → suggests adding it.
- A directory has no `AGENTS.md` but contains substantial code → suggests
  creating one (via `acc document`).
- Two `AGENTS.md` files both claim ownership of `src/audio/` →

Source: `Inferred by acc discover from declared/discovered diff`.

Authority: **none**. Inferred facts are suggestions. ACC MUST NEVER
silently assert inferred information as authoritative architecture.

Inferred facts are always returned with the provenance tag `Inferred` and
MUST be surfaced explicitly — they MUST NOT be merged into the declared
graph without confirmation.

---

## 3. Provenance contract

Every piece of context emitted by any ACC command carries a provenance
tag:

```text
Source: src/audio/AGENTS.md                         → Declared
Source: Discovered from Rust imports                → Discovered
Source: Inferred by acc discover                    → Inferred
```

### In JSON output

```json
{
  "provenance": {
    "kind": "declared",                             // "declared" | "discovered" | "inferred"
    "source": "src/audio/AGENTS.md",
    "detail": "Dependencies section"
  }
}
```

Provenance is mandatory for graph nodes, graph edges, context items, and
suggestions. Commands MUST refuse to emit a fact without provenance.

---

## 4. Graph model

### Nodes

A node is a **functionality boundary** — a directory containing or
inheriting an `AGENTS.md`.

```json
{
  "id": "src/audio",
  "path": "src/audio",
  "name": "audio",
  "has_local_contract": true,
  "owners": ["audio-team"],          // declared, optional
  "roles": ["module"],               // declared, optional
  "provenance": {
    "kind": "declared",
    "source": "src/audio/AGENTS.md"
  }
}
```

- `id` = canonical POSIX path of the functionality directory. Paths are
  canonical references (see [02 — Repository Structure](./02-repository-structure.md#7-path-conventions-used-by-this-spec)).
- No arbitrary opaque IDs.
- A directory with no `AGENTS.md` is a structural node with
  `has_local_contract: false`; it inherits context from the nearest
  ancestor with a contract.

### Edges

An edge is a directed relationship between two functionality boundaries.

```json
{
  "from": "src/audio",
  "to": "src/database",
  "kind": "dependency",              // "dependency" | "dependents" | "ownership"
  "provenance": {
    "kind": "declared",              // or "discovered", "inferred"
    "source": "src/audio/AGENTS.md",
    "detail": "Dependencies section"
  }
}
```

Edge kinds:

| Kind | Meaning |
|---|---|
| `dependency` | `from` depends on `to` (declared or discovered). |
| `dependents` | `from` is depended-upon by `to` — computed inverse of `dependency`. |
| `ownership` | `from` owns `to` — declared in `AGENTS.md`; inferred ownership is a suggestion only. |

All graph edges are directed. All carry a `provenance` object.

---

## 5. Truth resolution

When declared and discovered disagree:

1. **Declared wins** for architecture authority. The graph reflects
   declared intent.
2. **Discovered facts are retained** as edge annotations and become
   diagnostics.
3. **The disagreement is surfaced**, never buried. Diagnostic codes from
   [06 — Diagnostic Codes](./06-diagnostic-codes.md) apply.

| Situation | Resolution |
|---|---|
| Declared dependency A→B, discovered dependency A→B | Aligned. One edge, declared provenance (discovered confirms). |
| Declared dependency A→B, no discovery of A→B | Edge kept (declared). Diagnostic `ACC020` possible stale dependency / undiscoveable. |
| No declared dependency A→B, discovered dependency A→B | Edge added with discovered provenance. `acc discover` suggests declaring it. |
| Declared dependency A→B, discovered dependency B→A | Conflict. Retain declared A→B. Diagnostic `ACC021` declared/discovered direction mismatch. |

---

## 6. Ownership — first-class concept

Ownership is a declared architectural fact, not inferred.

### Declared ownership

Found in `AGENTS.md` under a `Ownership` heading (heuristic) or similar
prose.

```markdown
## Ownership

Owner: audio-team
```

### Ownership conflicts

ACC MUST detect and warn about conflicting ownership:

- Two `AGENTS.md` files both claiming ownership of the same path →
  diagnostic `ACC030` (duplicate ownership).
- A path present in a declared dependency but not mentioned in any
  `AGENTS.md` ownership section → diagnostic `ACC031` (unowned
  dependency).
- A functionality's ownership changes between commits (if V1 reads git
  history — optional) → diagnostic `ACC032` (ownership drift).

### Inferred ownership

ACC MUST NOT assert inferred ownership as authoritative. If ACC guesses
an owner from code heuristics or file-branch patterns, it returns the
guess with `provenance.kind = "inferred"` and a diagnostic.

---

## 7. Language analyzers — optional accuracy

Core graph logic relies on files, folders, and Markdown — fully
language-agnostic. Language-specific import discovery is an **optional
abstraction layer** that improves edge accuracy when available.

### Analyzer interface (sketch)

```text
trait LanguageAnalyzer {
    fn name(&self) -> &str;             // "rust" | "typescript" | "go"
    fn file_extensions(&self) -> &[&str]; // ["rs"], ["ts","tsx"], ["go"]
    fn discover_imports(
        &self,
        path: &Path,
        project_root: &Path,
    ) -> Vec<DiscoveredReference>;
}
```

### Fallback

If no analyzer is available for a language:

- No discovered import edges for that code.
- The graph retains declared edges (from `AGENTS.md`).
- `acc graph` works with filesystem + Markdown only.
- `acc check` reports `ACC040` "no language analyzer for extension `.foo`"
  at most once per extension (informational, not error).

---

## 8. Graph derivation algorithm (V1, in-memory)

1. **Walk the filesystem** from the project root (respecting `.agents/acc/config.yaml:ignore`).
2. **Identify functionality boundaries**: directories containing an
   `AGENTS.md`. Each such directory becomes a node (plus the root node).
3. **Parse `AGENTS.md` files heuristically**: extract declared
   dependencies, ownership, roles, constraints. Provenance = declared.
4. **Run language analyzers** (enabled in config) over source files. Each
   resolved import between two functionality boundaries becomes a discovered
   edge. Provenance = discovered.
5. **Compute inverse edges** (dependents) from declared + discovered
   dependencies.
6. **Resolve conflicts** per §5, emitting diagnostics for mismatches.
7. **Detect ownership conflicts** per §6, emitting `ACC03x` diagnostics.
8. The graph lives in memory for the duration of the CLI invocation. No
   on-disk cache, no database.
9. **Output** per command format (terminal or JSON).

Complexity target for V1: O(N) filesystem walk + O(E) edge computation,
where N = file count and E = import count. Good enough for repo-scale
graphs without indexing.
