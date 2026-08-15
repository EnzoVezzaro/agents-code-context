# 04 — CLI Command Specification

## Conventions

- All commands support `--json` producing deterministic JSON per
  [07 — JSON Output Schema](./07-json-schema.md).
- All commands support `--quiet` (suppress non-error output) and
  `--root <path>` (override project root detection).
- Paths are POSIX-style, relative to the project root unless absolute.
- Exit codes: `0` success, `1` ACC error (diagnostics present / invocations
  failed), `2` usage error, `3` panic/bug. `acc check` returns `1` if any
  error-level diagnostic is emitted.
- No command performs network access, executes build scripts, or runs
  untrusted code.

## Global flags (apply to all commands)

| Flag | Description |
|---|---|
| `--json` | Emit JSON output instead of terminal prose. |
| `--root <path>` | Override project root detection. |
| `--quiet` | Suppress informational output; errors only. |
| `--color <auto\|always\|never>` | ANSI color control. Default `auto`. |
| `--no-progress` | Suppress progress indicators. |
| `--help` / `-h` | Command help. |
| `--version` / `-V` | CLI version (top-level only). |

Every `--json` output includes a top-level `schema_version` integer and
a `command` string identifying the producer. See
[07 — JSON Output Schema](./07-json-schema.md).

---

## `acc init`

**Purpose:** Convert an ordinary or `AGENTS.md`-bearing repository into
an ACC-enhanced one. Does not fabricate docs. Preserves any existing
`AGENTS.md` and `.agents/` content.

**Flags:**
- `--force` — overwrite existing `.agents/acc/config.yaml` if present.
  Default: refuse, exit `1` with informative message.
- `--root <path>` — initialize at a non-detected root.
- `--json` — emit JSON.

**Behavior:**

1. Detect the project root (nearest ancestor that has a `.git/`, a
   `package.json`, `Cargo.toml`, `go.mod`, or a writable directory).
2. If no `AGENTS.md` exists at root: **print** a conservative template to
   stdout (not auto-written) and instruct the user to review and commit.
   `acc init` does not author `AGENTS.md` on disk without explicit intent.
   The template covers: Purpose, Responsibilities, Ownership,
   Dependencies, Constraints, Workflows hint.
3. Create `.agents/acc/` with minimal scaffold:
   - `config.yaml` — minimal valid config (`schema_version: 1` + defaults).
   - Empty `agents/`, `workflows/`, `standards/` directories.
4. Ensure `.gitignore` excludes `.acc-memory.md` (append if missing).
5. Never delete or rewrite existing files. Existing `AGENTS.md`,
   `.agents/`, or `.gitignore` content is preserved verbatim; `acc init`
   only **adds**.

**Terminal output:** concise summary of what was created / what already
existed.

**Exit:** `0` on success, `1` if `.agents/acc/config.yaml` exists and
`--force` not given.

---

## `acc check`

**Purpose:** Validate the repository against ACC rules: broken
references, missing contracts, forbidden dependencies, duplicate
ownership, stale docs. Returns stable diagnostic codes (e.g. `ACC001`).

**Flags:**
- `--json`
- `--root <path>`
- `--watch` — re-run on filesystem change, emit only new diagnostics (V1.1).
- `--exit-zero` — always exit `0` regardless of diagnostics (for CI lint
  modes). Default: exit `1` if any error-level diagnostic.
- `--severity <error\|warn\|info>` — minimum severity to emit.
  Default: emit all.
- `--code <ACC0xx>` —
  filter to a specific diagnostic code (repeatable).

**Behavior:** runs the full derivation pipeline (see
[03 — Epistemology & Architecture Graph](./03-epistemology.md#8-graph-derivation-algorithm-v1-in-memory))
and surfaces diagnostics per [06 — Diagnostic Codes](./06-diagnostic-codes.md).

**Diagnostic codes and severities are stable** and documented in `06`.
Adding new codes is a minor-version bump; renumbering is forbidden.

**Terminal output:** one line per diagnostic:

```text
ACC020  error   src/audio/AGENTS.md    declared dependency 'src/database' not discovered in code
ACC031  warn    src/database/AGENTS.md   dependency target 'src/audio' has no declared owner
ACC040  info    .agents/acc/config.yaml  no language analyzer for extension '.lock'
```

**Exit:** `1` if any error-level diagnostic, else `0`. `--exit-zero`
overrides to `0`.

---

## `acc inspect <path>`

**Purpose:** Return roles, owners, dependencies, constraints, and
memory status for a path.

**Flags:** `--json`, `--root <path>`, `--with-memory` (default: include
the existence of `.acc-memory.md` but not its contents unless asked; with
`--with-memory`, include the file's contents).

**Behavior:** resolves the path to its nearest functionality boundary
(directory with `AGENTS.md`, or the root node if none), and reports:

- resolved functionality path
- declared roles (from `AGENTS.md` heuristic parse)
- declared owners (if any)
- declared constraints (if any)
- declared dependencies (direct, declared)
- discovered dependencies (direct, discovered)
- inherited context from ancestor `AGENTS.md` files (figure)
- `.acc-memory.md` existence (and contents if `--with-memory`)
- local contract source path (which `AGENTS.md` is authoritative)

Every item carries provenance.

**Terminal output:** labeled sections.

---

## `acc context <path>` ⭐

**Purpose:** The central context engine. Generate focused, progressive,
agent-ready context for a path. **Does not dump the whole repository.**

**Flags:**
- `--depth <N>` — depth of transitive expansion. `0` = immediate
  functionality only. `N` = include dependencies/dependents up to N hops.
  Default: `1` (conservative — immediate functionality + its direct
  dependencies' contracts). See [05 — Context Engine](./05-context-engine.md).
- `--include <kind[,kind...]>` — filter sections: `contract`,
  `dependencies`, `dependents`, `constraints`, `implementations`, `memory`,
  `impact`. Default: all except `impact` (impact requires explicit
  traversal; use `acc impact` for that).
- `--exclude <kind[,kind...]>` — remove sections from default set.
- `--max-bytes <N>` — hard cap on total output bytes. Default: `65536`.
  Accompanied by a truncation marker in output when hit.
- `--json`, `--root <path>`

**Behavior:** see [05 — Context Engine](./05-context-engine.md) for the
full assembled-context contract. Briefly, the output has five sections:

1. **Hierarchy** — inherited `AGENTS.md` chain (root → path), each with
   provenance.
2. **Contract** — the local `AGENTS.md` contents (parsed structure +
   raw text reference).
3. **Dependencies** — direct then transitive (per `--depth`), declared
   vs. discovered, each with provenance.
4. **Constraints** — declared invariants applying to this path,
   inherited and local.
5. **Implementations** — a high-level summary of the source under the
   path (file count, function/module counts per language analyzer, not
   full source). With `--include implementations` only; never source
   dumps.

Every section, every item, every line carries provenance.

**Progressive depth semantics:**

| `--depth` | Meaning |
|---|---|
| `0` | Immediate functionality bound
ary boundary + local contract. No transitive expansion. |
| `1` (default) | Above + direct dependencies' contracts (their `AGENTS.md` only). |
| `2` | Above + direct + 2-hop transitive dependencies' contracts. |
| `N` | N-hop transitive expansion. |

Depth limits the **transitive expansion of contract context**, not the
graph traversal itself. `acc graph` and `acc dependencies
--transitive` remain unrestricted by `--depth`.

**Terminal output:** structured, sectioned. Compact enough for agent
digest; JSON output is intended for programmatic consumption.

---

## `acc graph [path]`

**Purpose:** Generate the derived architecture graph.

**Flags:**
- `--format <text\|mermaid\|dot\|json>` — output format. Default `text` (or
  `json` when `--json`).
- `--json` — shorthand for `--format json`.
- `--root <path>`
- `--provenance` — include provenance annotations on every edge/node in
  the output. Default: on for JSON; on for `text` at the foot; off for
  `mermaid` and `dot` unless specified.
- `--include <declared\|discovered\|inferred>` — filter edges by
  provenance. Default: all.
- `--nodes` — emit only nodes (no edges). Useful for inventory.
- `--max-depth <N>` — limit traversal depth. Default: unlimited.

**Behavior:** derives the graph per [03 — Epistemology](./03-epistemology.md)
and outputs in the requested format. If `path` given, scope the subgraph
rooted at that functionality.

**`mermaid` output:** a `graph LR` diagram; long paths rendered as
short labels with a path legend at the foot. Inferred edges rendered
dashed.

**`dot` output:** Graphviz-compatible DOT.

---

## `acc dependencies <path>` & `acc dependents <path>`

**Purpose:** List declared vs. discovered relationships, distinguishing
each. Distinguish direct vs. transitive.

**Flags (both commands):**
- `--direct` — only direct dependencies/dependents. Default if neither
  flag given.
- `--transitive` — include transitive closure up to `--max-depth`.
- `--max-depth <N>` — cap transitive depth. Default: unlimited.
- `--declared` — filter to declared edges.
- `--discovered` — filter to discovered edges.
- `--json`, `--root <path>`

**`dependencies` semantics:** what `path` depends on.
**`dependents` semantics:** what depends on `path` (inverse traversal).

**Output rows:** `to/from` path + edge kind + provenance + (if
transitive) hop count.

---

## `acc impact <path>`

**Purpose:** Answer "what could break?" Returns affected tests,
direct/transitive dependents, and constraints.

**Flags:**
- `--direct` / `--transitive` — default both (show direct + transitive).
- `--include <kind>` — `dependents`, `tests`, `constraints` (default all).
- `--json`, `--root <path>`
- `--max-depth <N>` — cap transitive depth. Default: `3` (sensible blast
  radius).

**Behavior:**

1. Derive the graph.
2. Compute the transitive dependents closure of `path`.
3. Cross-reference with test directories (functionality boundaries named
   `tests/`, `test/`, or under a standard test path) to identify affected
   tests.
4. Collect declared constraints from all affected `AGENTS.md` files.
5. Output a blast-radius report.

**Output rows:** dependent path + relationship + provenance + (if test)
marker `[test]`.

---

## `acc search <query>`

**Purpose:** Architecturally relevant search across contracts,
relationships, and code. Not a plain text search — it understands
functionality boundaries and edges.

**Flags:**
- `--kind <contracts\|edges\|code\|all>` — default `all`.
- `--limit <N>` — cap results. Default `50`.
- `--json`, `--root <path>`
- `--regex` — treat `query` as a regex (otherwise literal substring).
- `--path <prefix>` — restrict search to a subdirectory.

**Behavior:**

- `contracts`: matches in `AGENTS.md` files (heading text, responsibilities,
  constraints).
- `edges`: matches across dependency edge `from`/`to` paths and kinds.
- `code`: matches in source files under functionality boundaries,
  respecting `.agents/acc/config.yaml:ignore` and using language
  analyzers for tokenization if available.

Each result carries provenance.

---

## `acc discover`

**Purpose:** Generate architectural suggestions based on diffs between
declared contracts and discovered code. **Must not silently rewrite the
repository.**

**Flags:**
- `--apply` — apply suggestions that modify `AGENTS.md` or create files.
  Default: dry-run; suggestions printed only. `--apply` prompts for
  confirmation per suggestion (or `--yes` to skip prompts).
- `--yes` — with `--apply`, apply all suggestions without prompting.
- `--kind <kind[,kind...]>` — filter suggestion kinds: `missing-contract`,
  `missing-dependency`, `stale-dependency`, `unknown-owner`,
  `direction-mismatch`, `orphan-code`. Default: all.
- `--json`, `--root <path>`

**Suggestion kinds** (each maps to one or more diagnostic codes from
[06](./06-diagnostic-codes.md)):

| Kind | Meaning |
|---|---|
| `missing-contract` | Directory with code but no `AGENTS.md`. Suggests `acc document <path>`. |
| `missing-dependency` | Discovered dep not declared. Suggests adding to `Dependencies:`. |
| `stale-dependency` | Declared dep not discovered. Suggests removal or investigation. |
| `unknown-owner` | Dependency target with no owner declared. Suggests declaring owner. |
| `direction-mismatch` | Declared A→B but discovered B→A. Suggests review. |
| `orphan-code` | Source files outside any functionality boundary. Suggests boundary creation. |

All suggestions are `Inferred` provenance. With `--apply`, suggestions
that affect `AGENTS.md` go through `acc document` machinery (conservative
templates, reviewed).

---

## `acc document <path>`

**Purpose:** Generate a conservative `AGENTS.md` template / proposal for
an undocumented functionality. Never auto-creates with `ACC`-specific
schema; templates use the standard Markdown sections from
[09 — AGENTS.md Authoring Guide](./09-authoring-guide.md).

**Flags:**
- `--apply` — write `<path>/AGENTS.md`. Default: print to stdout.
- `--force` — overwrite an existing `AGENTS.md`. Default: refuse.
- `--from-discovery` — pre-fill template with discovered dependencies
  and owners (marked `<!-- inferred -->`). Default: blank template.
- `--json`, `--root <path>`

**Behavior:**

1. If `<path>` has an `AGENTS.md` and `--apply` without `--force` → exit `1`.
2. Generate a template with standard sections:
   `Purpose`, `Responsibilities`, `Ownership`, `Inputs`, `Outputs`,
   `Dependencies`, `Constraints`, `Architecture`.
3. If `--from-discovery`, fill `Dependencies` and `Ownership` with
   discovered values, each line marked `<!-- inferred: ... -->` so a
   human can confirm or remove. Inferred content is never asserted as
   declared.
4. With `--apply`, writes to `<path>/AGENTS.md`; the on-disk file has no
   ACC-specific schema.

---

## `acc memory`

**Purpose:** Read and update functionality-local `.acc-memory.md` files.

**Subcommands:**

### `acc memory show <path>`

Print a functionality's `.acc-memory.md` (or a "no memory yet" message).
`--json` returns `{path, exists, contents}`.

### `acc memory add <path> <text>`

Append a timestamped entry to `<path>/.acc-memory.md`. Creates the file
if absent. No schema — plain Markdown. Example appended line:

```markdown
## 2026-08-15T14:03:21Z

<text>
```

### `acc memory clear <path>`

Truncate the file (with `--force`; otherwise prompts). The file remains
(empty) to preserve the memory convention marker for that functionality.

**All `acc memory` subcommands support `--json` and `--root`.** They never
modify `AGENTS.md`. They never network.

---

## Command summary table

| Command | Purpose | Modifies repo? |
|---|---|---|
| `acc init` | Initialize `.agents/acc/`, preserve `AGENTS.md`. | Yes — adds files. |
| `acc check` | Validate, emit diagnostics. | No. |
| `acc inspect <path>` | roles/owners/deps/constraints/memory. | No. |
| `acc context <path>` | Focused, progressive context. | No. |
| `acc graph [path]` | Derived graph (text/mermaid/dot/json). | No. |
| `acc dependencies <path>` | What it depends on. | No. |
| `acc dependents <path>` | What depends on it. | No. |
| `acc impact <path>` | Blast radius. | No. |
| `acc search <query>` | Architecture-aware search. | No. |
| `acc discover` | Suggest architectural fixes (dry-run by default). | Only with `--apply`. |
| `acc document <path>` | Generate `AGENTS.md` template. | Only with `--apply`. |
| `acc memory show/add/clear <path>` | `.acc-memory.md` read/write. | Yes — `add`/`clear` only. |

---

## Stability contract

- Diagnostic codes (`ACC0xx`) are stable; renumbering forbidden (see
  [06](./06-diagnostic-codes.md)).
- JSON shape per command is versioned via `schema_version`; breaking
  changes require a major version bump (see [07](./07-json-schema.md)).
- CLI flag names are stable post-1.0; adding flags is minor; renaming is
  forbidden.
- Terminal prose is informational and MAY change between versions; agents
  consume JSON, not prose.
