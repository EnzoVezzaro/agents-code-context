# 05 — CLI Command Specification

> **TLDR:** the `acc` CLI, command by command. If you
> want the *experience* rather than the spec, the fastest path is:
> `acc init` on a repo, then `acc graph`, `acc check`, and
> `acc context <path>`. Everything below is the precise contract those
> commands obey.

Every command below is a promise — deterministic output, stable codes,
documented behavior — because agents build on top of this. Read it once
to know what's here; the examples are the fastest way to remember it.

## Conventions

- All commands support `--json` producing deterministic JSON per [08 — JSON Output Schema](./08-json-schema.md).
- All commands support `--quiet` (suppress non-error output) and `--root <path>` (override project root detection).
- Paths are POSIX-style, relative to the project root unless absolute.
- Exit codes: `0` success, `1` ACC error (diagnostics present/invocation failed), `2` usage error, `3` panic/bug. `acc check` returns `1` if any error-level diagnostic is emitted.
- No command performs network access, executes build scripts, or runs untrusted code.

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON output instead of terminal prose. |
| `--root <path>` | Override project root detection. |
| `--quiet` | Suppress informational output; errors only. |
| `--help` / `-h` | Command help. |
| `--version` / `-V` | CLI version (top-level only). |

Every `--json` output includes a top-level `schema_version` integer and
a `command` string identifying the producer. See [08 — JSON Output Schema](./08-json-schema.md).

---

## `acc init`

**Purpose:** Convert an ordinary or `AGENTS.md`-bearing repository into
an ACC-enhanced one. Does not fabricate docs. Preserves any existing
`AGENTS.md` and `.agents/` content. It's the "move in the furniture"
command — it only adds, never rewrites.

**Flags:**
- `--force` — regenerate `.acc/config/config.yaml` from defaults if it already exists. Default: idempotent — existing files are left untouched and reported as `Exists`.
- `--scan` — scan the codebase and prepare the project without prompting (see Behavior 4).
- `--no-scan` — never scan or prepare, even in an interactive terminal.
- `--root <path>` — initialize at a non-detected root.
- `--json` — emit JSON.

**Behavior:**
1. Detect the project root (nearest ancestor with `.git/`, `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, or a writable directory).
2. Create `.acc/config/` with minimal scaffold:
   - `config.yaml` — minimal valid config (`schema_version: 1` + defaults)
   - Empty `agents/`, `workflows/`, `standards/` directories
3. Ensure `.gitignore` excludes `.acc-memory.md` (append if missing).
4. **Create the root `.acc-memory.md` initial record** (only when the file
   is missing or empty). The record is seeded with project provenance
   read from `.git` as plain files (no git binary is executed):
   - **Clone date** — the `YYYY-MM-DD` of the first reflog entry in
     `.git/logs/HEAD`, falling back to the filesystem birthtime/mtime of
     the `.git` directory.
   - **GitHub init data** — when the `origin` in `.git/config` is a
     GitHub URL, the owner/repo and default branch (from `.git/HEAD`)
     are recorded, e.g. `- GitHub: EnzoVezzaro/aba-arena (default branch: main)`.
   If the repository is not git or the files are absent, the record omits
   those lines — init still succeeds.
5. **Scan-and-prepare prompt (interactive only):** when stdin is a
   terminal and neither `--scan` nor `--no-scan` is given, init asks
   *"Scan the codebase and prepare the project? [y/N]"*. If confirmed
   (or with `--scan`), init runs the diagnostics scan (`acc check`) and
   creates the missing `AGENTS.md` contract files (`acc build --yes
   --from-discovery`), then reports the diagnostic summary and the files
   it created. Non-interactive runs (CI, piped stdin, `--no-scan`) never
   scan, keeping init deterministic and safe on untrusted repositories.
6. If no `AGENTS.md` exists at root: **print** a conservative template to stdout (not auto-written) and instruct the user to review and commit. `acc init` does not author a root `AGENTS.md` on disk without explicit intent.
7. Never delete or rewrite existing files. Existing `AGENTS.md`, `.agents/`, or `.gitignore` content is preserved verbatim; `acc init` only **adds**.

**Terminal output:** concise summary of what was created / what already existed (including the root memory record), plus (when scanning) the diagnostic summary and the created contract files.

**Exit:** `0` on success (idempotent — re-running on an already-initialized repo also exits `0`), `2` on usage error.

**Example:**
```bash
$ acc init
Created .acc/config/config.yaml
Created .acc/config/agents/
Created .acc/config/workflows/
Created .acc/config/standards/
Updated .gitignore (added .acc-memory.md)
Created .acc-memory.md (clone date + GitHub origin recorded)
Scan the codebase and prepare the project? [y/N] y
Scanned codebase: 3 diagnostics (0 errors, 1 warning, 2 infos)
Created 1 missing AGENTS.md file:
  src/metrics/AGENTS.md
No AGENTS.md found at root — printed template to stdout. Review and commit.
```

---

## `acc install` — deploy ACC as an agent skill

**Purpose:** ACC is an agent capability, not a per-repository framework.
The skill teaches any agent how to operate on the repository (engine
ON/OFF contract, command surface, workflows) — the repository itself
stays a standard agents.md repository.

**Two distribution channels, one source.** npm distributes the engine
(the `acc` CLI); the skill is distributed as an **Agent Skill** from the
same GitHub repository. The canonical skill lives at `skills/acc/` in
the ACC repo — `npx skills` and `acc install` both read that one file,
so they always install the same skill.

### Universal install (Agent Skills standard)

```bash
npx skills add EnzoVezzaro/agents-code-context --skill acc
```

Globally (available to every agent), or per project:

```bash
npx skills add EnzoVezzaro/agents-code-context --skill acc --agent codex
npx skills add EnzoVezzaro/agents-code-context --skill acc --global
```

This is the standard flow used by the skills ecosystem — ACC's skill is
just another Agent Skill. It is installed **into the agent**, never into
the repository.

### Via the CLI (`acc install`)

`acc install` copies the same canonical skill (SKILL.md + `references/`)
into a project-local agent directory.

**Flags:**
- `--agent <name>` — target a well-known project-local directory:
  `generic` (`.agents/skills/acc`), `claude` (`.claude/skills/acc`),
  `cursor` (`.cursor/skills/acc`), `codex` (`.codex/skills/acc`),
  `opencode` (`.opencode/skills/acc`), `gemini` (`.gemini/skills/acc`),
  `vscode` (`.vscode/skills/acc`). Default: `generic`.
- `--dir <path>` — install to an explicit path (absolute, or relative to
  the project root) — e.g. a global agent skills directory.
- `--force` — overwrite an existing `SKILL.md`.
- `--json`, `--root <path>`.

Deterministic, offline, idempotent: it copies the fixed canonical skill
and never executes anything. An existing skill is left untouched
without `--force`. The installed skill is detected by the graph as a
`skill` node (`.agents/skills/<name>/SKILL.md`), so `acc slice` surfaces
it in `requires.skills`.

### Native host adapters

The ACC repository also ships per-ecosystem adapter manifests so each
agent can discover and load the skill natively — the same pattern used
by ponytail and other skill repos:

| Host | Adapter | What it does |
|---|---|---|
| OpenCode | `opencode.json` + `.opencode/plugins/acc.mjs` | Exposes the `acc` CLI as a native OpenCode tool |
| Claude Code | `.claude-plugin/marketplace.json` + `plugin.json` | Marketplace + plugin entry point |
| Codex | `.codex-plugin/plugin.json` | Plugin with `skills: ./skills/` + interface |
| Grok | `.grok-plugin/marketplace.json` | Marketplace entry point |
| Gemini CLI | `gemini-extension.json` | Extension manifest (`contextFileName: AGENTS.md`) |
| Cursor | `.cursor/rules/acc.mdc` | Always-on rule teaching the CLI |
| Generic | `plugin.json` + `plugin.yaml` | Generic / Hermes-style plugin manifests |

All version-bearing manifests must agree with `package.json` —
`npm run check:versions` enforces it, and `npm run bump` keeps them in
sync automatically. The skill itself installs into each agent's native
skills directory via `acc install --agent <name>`; the installed copies
are verified byte-identical to `skills/acc/` by `npm run
check:skill-copies`.

---

## `acc check`

**Purpose:** Validate the repository against ACC rules: broken
references, missing contracts, forbidden dependencies, duplicate
ownership, stale docs. Returns stable diagnostic codes (e.g., `ACC001`).
This is the "did anything drift" command.

**Flags:**
- `--json`
- `--root <path>`
- `--exit-zero` — always exit `0` regardless of diagnostics (for CI lint modes). Default: exit `1` if any error-level diagnostic.
- `--severity <error\|warn\|info>` — minimum severity to emit. Default: emit all.
- `--code <ACC0xx>` — filter to a specific diagnostic code (repeatable).

(Watch mode lives on the engine: `acc engine --watch` re-runs the full
scan on filesystem change. `acc check` itself is a one-shot command.)

**Behavior:** runs the full derivation pipeline (see [04 — Epistemology](./04-epistemology.md#8-graph-derivation-algorithm-v1-in-memory)) and surfaces diagnostics per [07 — Diagnostic Codes](./07-diagnostic-codes.md).

**Diagnostic codes and severities are stable** and documented in `06`.
Adding new codes is a minor-version bump; renumbering is forbidden.

**Terminal output:** one line per diagnostic:
```text
ACC022  warn    src/payments/mod.rs    discovered dependency 'src/payments → src/ui' not declared
ACC031  warn    src/database/AGENTS.md   dependency target 'src/payments' has no declared owner
ACC040  info    .    no language analyzer for extension '.lock'
```

**Exit:** `1` if any error-level diagnostic, else `0`. `--exit-zero` overrides to `0`.

**Example:**
```bash
$ acc check
ACC022  warn    src/auth/mod.rs    discovered dependency 'src/auth → src/ui' not declared
ACC031  warn    src/database/AGENTS.md   dependency target 'src/auth' has no declared owner
ACC040  info    .    no language analyzer for extension '.rs'

Found 3 diagnostics (0 errors, 2 warnings, 1 info)
```

---

## `acc inspect <path>`

**Purpose:** Return roles, owners, dependencies, constraints, and memory
status for a path. One command to answer "what is this thing, who owns
it, and what is it allowed to do?"

**Flags:** `--json`, `--root <path>`, `--with-memory` (default: include existence of `.acc-memory.md` but not contents; with `--with-memory`, include the file's contents).

**Behavior:** resolves the path to its nearest functionality boundary
(directory with `AGENTS.md`, or the root node if none), and reports:
- Resolved functionality path
- Declared roles (from `AGENTS.md` heuristic parse)
- Declared owners (if any)
- Declared constraints (if any)
- Declared dependencies (direct, declared)
- Discovered dependencies (direct, discovered)
- Inherited context from ancestor `AGENTS.md` files
- `.acc-memory.md` existence (and contents if `--with-memory`)
- Local contract source path (which `AGENTS.md` is authoritative)

Every item carries provenance.

**Terminal output:** labeled sections.

**Example:**
```bash
$ acc inspect src/auth
Path: src/auth
Functionality: src/auth (has local contract)
Roles: [module]
Owners: [auth-team]
Dependencies (declared): src/database, src/logging
Dependencies (discovered): src/database, src/logging, ⚠ src/ui (undeclared)
Constraints:
  - Must not depend on src/ui. (Source: src/auth/AGENTS.md)
Inherits from: ["", "src/"]
Memory: exists at src/auth/.acc-memory.md
Local contract: src/auth/AGENTS.md
```

---

## `acc context <path>` ⭐

**Purpose:** The central context engine. Generate focused, progressive,
agent-ready context for a path. **Does not dump the whole repository.**
This is the command that makes an agent stop guessing — it hands over
exactly the context for the job.

**Flags:**
- `--depth <N>` — depth of transitive expansion. `0` = immediate functionality only. `N` = include dependencies/dependents up to N hops. Default: `1` (conservative — immediate functionality + its direct dependencies' contracts). See [06 — Context Engine](./06-context-engine.md).
- `--include <kind[,kind...]>` — filter sections: `contract`, `dependencies`, `dependents`, `constraints`, `implementations`, `memory`, `impact`. Default: all except `impact` (impact requires explicit traversal; use `acc impact` for that).
- `--exclude <kind[,kind...]>` — remove sections from default set.
- `--max-bytes <N>` — hard cap on total output bytes. Default: `65536`. Accompanied by a truncation marker in output when hit.
- `--json`, `--root <path>`

**Behavior:** see [06 — Context Engine](./06-context-engine.md) for the full assembled-context contract. Briefly, the output has six sections:

1. **Hierarchy** — inherited `AGENTS.md` chain (root → path), each with provenance.
2. **Contract** — the local `AGENTS.md` contents (parsed structure + raw text reference).
3. **Dependencies** — direct then transitive (per `--depth`), declared vs. discovered, each with provenance.
4. **Constraints** — declared invariants applying to this path, inherited and local.
5. **Implementations** — high-level summary of the source under the path (file count, total bytes, per-extension file histogram — never source dumps). Included by default; drop with `--exclude implementations`.
6. **Memory** — functionality's `.acc-memory.md` (existence by default; contents with `--include memory`).

Every section, every item, every line carries provenance.

**Progressive depth semantics:**

| `--depth` | Meaning |
|-----------|---------|
| `0` | Immediate functionality boundary + local contract. No transitive expansion. |
| `1` (default) | Above + direct dependencies' contracts (their `AGENTS.md` only). |
| `2` | Above + direct + 2-hop transitive dependencies' contracts. |
| `N` | N-hop transitive expansion. |

Depth limits the **transitive expansion of contract context**, not the
graph traversal itself. `acc graph` and `acc dependencies --transitive`
remain unrestricted by `--depth`.

**Terminal output:** structured, sectioned. Compact enough for agent
digest; JSON output is intended for programmatic consumption.

**Example:**
```bash
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
Bytes: 128472
Languages:
  rust: 6 files
  toml: 2 files
Source: Discovered from filesystem

## Memory
.acc-memory.md present at src/auth/.acc-memory.md
(use --include memory to view contents)

Context bytes: 1842 / 65536
```

---

## `acc graph [path]`

**Purpose:** Generate the derived architecture graph — the full
knowledge graph for your repository. Nodes carry diagnostics, memory
state, and edge counts; the summary shows aggregate health. This is
the map that tells an agent "here's the terrain" instead of making it
explore everything blindly.

**Flags:**
- `--format <text|mermaid|dot|json>` — output format. Default `json` (configurable via `graph.default_format` in `.acc/config/config.yaml`; `--json` forces it).
- `--json` — shorthand for `--format json`.
- `--root <path>`
- `--provenance` — include provenance annotations on every edge/node. Default: on for JSON and `text`; off for `mermaid` and `dot` unless specified (or enabled via `graph.default_provenance` in config).
- `--nodes` — emit only nodes (no edges). Useful for inventory.
- `--max-depth <N>` — limit traversal depth. Default: unlimited.

**Behavior:** derives the graph per [04 — Epistemology](./04-epistemology.md) and enriches every node with:
- `diagnostics` — ACC0xx violations for that boundary (filtered from the full check).
- `memory` — `.acc-memory.md` existence, file path, byte size, and entry count.
- `edges` — inbound, outbound, and total dependency edge counts.

The result also includes a `summary` with aggregate counts: total boundaries, diagnostics breakdown (errors/warnings/infos), edge totals, memory coverage, drift report status, and engine state.

If `path` is given, scope the subgraph rooted at that functionality. Scoped output includes ownership edges to the root and all transitive dependency edges.

**`text` output:**
```text
Summary: 4 boundary(ies), 6 edge(s)
  Diagnostics: 2 (0 errors, 1 warnings, 1 infos)
  Memory: 1/4 boundary(ies) have memory
  Drift report: present

Nodes:
  . owners: [team-core] 1 diag(s)
  src/auth owners: [team-auth] mem: 128b
  src/db owners: [team-db]
  src/ui owners: [team-ui]

Edges:
  src/auth → src/db  [dependency]
  src/auth → .  [ownership]
  src/ui → src/auth  [dependency] (discovered)
```

**`json` output:** nodes carry `diagnostics`, `memory`, and `edges` objects; result includes `summary`.

**`mermaid` output:** a `graph LR` diagram; long paths rendered as short labels with a path legend at the foot. Inferred edges rendered dashed.

**`dot` output:** Graphviz-compatible DOT.

**Example:**
```bash
$ acc graph --format mermaid
graph LR
  root[/] --> src[src/]
  src --> auth[src/auth/]
  src --> db[src/database/]
  src --> log[src/logging/]
  auth -.-> ui[src/ui/]:::inferred
  auth --> db
  auth --> log
  classDef inferred stroke-dasharray: 5 5;
```

---

## `acc slice <path>`

**Purpose:** The context router — the compact, AI-optimized slice of
 the knowledge-graph index for a path. The graph is an index of
 relationships, not a knowledge store; `acc slice` answers "what governs
 this", "what owns this", "what does this depend on", "what depends on
 this", "what tests this", "what skills/standards apply", and "what is
 the impact budget" — never the whole repository.

**Flags:**
- `--json` — emit the slice as structured JSON.
- `--root <path>`

**Behavior:**
1. Resolve the target (file, test, directory, or boundary) to its
   owning functionality boundary.
2. Collect from the derived graph:
   - `governed_by` — the nearest `AGENTS.md` contract chain (root → scope).
   - `owns` — files and tests belonging to the scope boundary.
   - `depends_on` / `dependents` — declared and discovered dependency edges.
   - `tested_by` — for a file target, the tests covering it; for a
     boundary, the tests it owns.
   - `requires` — skills (`.agents/skills/`, `.acc/config/skills/`) and
     standards (`.acc/config/standards/`) referenced from the contract.
   - `impact` — the expansion budget over the scope + transitive
     dependents: files, boundaries, tests, contracts.
3. Never includes prose, contracts, or memory — the slice points at the
   filesystem; `acc context` assembles readable context on demand.

**Terminal output:**
```text
SCOPE: src/auth
GOVERNED_BY:
  AGENTS.md
  src/auth/AGENTS.md
OWNS (files):
  src/auth/token.rs
OWNS (tests):
  src/auth/token_test.rs
DEPENDS_ON:
  src/database (declared)
DEPENDENTS:
  src/app (declared)
TESTED_BY:
  src/auth/token_test.rs
SKILLS:
  oauth
STANDARDS:
  idempotency
IMPACT: 2 files, 2 boundaries, 1 test, 2 contracts
```

**Exit:** `0` on success, `2` on usage error or missing path.

---

## `acc dependencies <path>` & `acc dependents <path>`

**Purpose:** List declared vs. discovered relationships, distinguishing
each. Distinguish direct vs. transitive. One answers "what does this
depend on?", the other answers "what depends on this?"

**Flags (both commands):**
- `--direct` — only direct dependencies/dependents. Default if neither flag given.
- `--transitive` — include transitive closure up to `--max-depth`.
- `--max-depth <N>` — cap transitive depth. Default: unlimited.
- `--declared` — filter to declared edges.
- `--discovered` — filter to discovered edges.
- `--json`, `--root <path>`

**`dependencies` semantics:** what `path` depends on.
**`dependents` semantics:** what depends on `path` (inverse traversal).

**Output rows:** `to/from` path + edge kind + provenance + (if transitive) hop count.

**Example:**
```bash
$ acc dependencies src/auth --transitive --max-depth 2
src/auth → src/database    (declared, hop=0)   Source: src/auth/AGENTS.md
src/auth → src/logging     (declared, hop=0)   Source: src/auth/AGENTS.md
src/auth → src/ui          (discovered, hop=0) Source: Discovered from Rust imports
src/auth → src/config      (declared, hop=1)   Source: src/database/AGENTS.md
src/auth → src/metrics     (declared, hop=1)   Source: src/database/AGENTS.md
```

---

## `acc impact <path>`

**Purpose:** Answer "what could break?" Returns affected tests, direct/
transitive dependents, and constraints. The blast-radius report you run
*before* you touch anything scary.

**Flags:**
- `--include <kind>` — `dependents`, `tests`, `constraints` (default all).
- `--json`, `--root <path>`
- `--max-depth <N>` — cap transitive depth. Default: `3` (sensible blast radius).

**Behavior:**
1. Derive the graph.
2. Compute the transitive dependents closure of `path`.
3. Cross-reference with test directories (functionality boundaries named `tests/`, `test/`, or under a standard test path) to identify affected tests.
4. Collect declared constraints from all affected `AGENTS.md` files.
5. Output a blast-radius report.

**Output rows:** dependent path + relationship + provenance + (if test) marker `[test]`.

**Example:**
```bash
$ acc impact src/auth
src/app/           (dependent, hop=1, declared)     Source: src/app/AGENTS.md
tests/auth/        (dependent, hop=2, discovered)   [test] Source: Discovered from Go imports
tests/integration/ (dependent, hop=3, discovered)   [test] Source: Discovered from Go imports

Constraints from affected:
- src/app/AGENTS.md: "All auth calls must be audited."
- tests/auth/AGENTS.md: "Test coverage must not drop below 80%."
```

---

## `acc search <query>`

**Purpose:** Architecturally relevant search across contracts,
relationships, and code. Not a plain text search — it understands
functionality boundaries and edges. It finds *where the thing lives in
the architecture*, not just where the string appears.

**Flags:**
- `--kind <contracts\|edges\|code\|all>` — default `all`.
- `--limit <N>` — cap results. Default `50`.
- `--json`, `--root <path>`
- `--regex` — treat `query` as a regex (otherwise literal substring).
- `--path <prefix>` — restrict search to a subdirectory.

**Behavior:**
- `contracts`: matches in `AGENTS.md` files (heading text, responsibilities, constraints).
- `edges`: matches across dependency edge `from`/`to` paths and kinds.
- `code`: matches in source files under functionality boundaries, respecting `.acc/config/config.yaml:ignore` and using language analyzers for tokenization if available.

Each result carries provenance.

**Example:**
```bash
$ acc search "database" --kind contracts
src/database/AGENTS.md:3  Purpose: Database connection pool and query builder.
src/auth/AGENTS.md:12     Dependencies: src/database
src/api/AGENTS.md:8       Constraints: Must not access src/database directly.
```

---

## `acc discover`

**Purpose:** Generate architectural suggestions based on diffs between
declared contracts and discovered code. **Must not silently rewrite the
repository.** Think of it as a diff between what you *said* the
architecture is and what the code *does* — with suggested fixes you get
to approve.

**Flags:**
- `--apply` — apply suggestions that modify `AGENTS.md` or create files. Default: dry-run; suggestions printed only. `--apply` prompts for confirmation per suggestion (or `--yes` to skip prompts).
- `--yes` — with `--apply`, apply all suggestions without prompting.
- `--kind <kind[,kind...]>` — filter suggestion kinds: `missing-contract`, `missing-dependency`, `stale-dependency`, `unknown-owner`, `orphan-code`. Default: all.
- `--json`, `--root <path>`

**Suggestion kinds** (each maps to one or more diagnostic codes from [06](./07-diagnostic-codes.md)):

| Kind | Meaning |
|------|---------|
| `missing-contract` | Directory with code but no `AGENTS.md`. Suggests `acc document <path>`. |
| `missing-dependency` | Discovered dep not declared. Suggests adding to `Dependencies:`. |
| `stale-dependency` | Declared dep not discovered. Suggests removal or investigation. |
| `unknown-owner` | Dependency target with no owner declared. Suggests declaring owner. |
| `orphan-code` | Source files outside any functionality boundary. Suggests boundary creation. |

> `direction-mismatch` (declared A→B but discovered B→A) is documented in
> [07 — Diagnostic Codes](./07-diagnostic-codes.md#21-declared-vs-discovered-mismatches-acc020acc029)
> as `ACC021` but is **not implemented in V1** — it is future work.

All suggestions are `Inferred` provenance. With `--apply`, suggestions
that affect `AGENTS.md` go through `acc document` machinery
(conservative templates, reviewed).

**Example:**
```bash
$ acc discover
[missing-contract] src/metrics/ has code but no AGENTS.md
  → Run: acc document src/metrics --apply

[missing-dependency] src/auth → src/ui (discovered in src/auth/mod.rs)
  → Add to src/auth/AGENTS.md Dependencies: src/ui

[stale-dependency] src/auth → src/legacy (declared but not discovered)
  → Review: remove from src/auth/AGENTS.md or investigate
```

---

## `acc document <path>`

**Purpose:** Generate a conservative `AGENTS.md` template/proposal for an
undocumented functionality. Never auto-creates with ACC-specific schema;
templates use the standard Markdown sections from [10 — AGENTS.md Authoring Guide](./10-authoring-guide.md).

**Flags:**
- `--apply` — write `<path>/AGENTS.md`. Default: print to stdout.
- `--force` — overwrite an existing `AGENTS.md`. Default: refuse.
- `--from-discovery` — pre-fill template with discovered dependencies and owners (marked `<!-- inferred -->`). Default: blank template.
- `--json`, `--root <path>`

**Behavior:**
1. If `<path>` has an `AGENTS.md` and `--apply` without `--force` → exit `1`.
2. Generate a template with standard sections: `Purpose`, `Responsibilities`, `Ownership`, `Inputs`, `Outputs`, `Dependencies`, `Constraints`, `Architecture`, `Workflows`.
3. If `--from-discovery`, fill `Dependencies` and `Ownership` with discovered values, each line marked `<!-- inferred: ... -->` so a human can confirm or remove. Inferred content is never asserted as declared.
4. With `--apply`, writes to `<path>/AGENTS.md`; the on-disk file has no ACC-specific schema.

**Example:**
```bash
$ acc document src/metrics --from-discovery
# metrics

## Purpose

<!-- inferred: Metrics collection and export for the platform. -->

## Responsibilities

- Collect runtime metrics
- Export to Prometheus/OpenTelemetry

## Ownership

<!-- inferred: platform-team -->

## Dependencies

<!-- inferred: src/database -->
<!-- inferred: src/config -->

## Constraints

## Architecture

## Workflows

- See .acc/config/workflows/feature.md for the standard feature workflow.
```

---

## `acc build [path]`

**Purpose:** Create the documentation files missing from a project. Scans
the codebase for directories that contain source code but no `AGENTS.md`
contract and generates a conservative `AGENTS.md` template for each
(via the same `acc document` machinery). The project is "fully
documented" when `acc build` has nothing left to create. Dry-run by
default — it never silently rewrites the repository.

**Flags:**
- `--yes` — create the missing files. Default: dry-run (list only).
- `--from-discovery` — pre-fill templates with discovered dependencies and owners (marked `<!-- inferred -->`). Default: blank templates.
- `--json`, `--root <path>`

**Behavior:**
1. Derive the graph and walk the filesystem (same scan as `acc check` / `acc discover`).
2. Collect directories with source code that have no `AGENTS.md` in the directory itself or any ancestor. A `path` positional scopes the scan to that subtree; without one, the whole project root is scanned.
3. Generate a conservative template per directory (standard Markdown sections per [10 — AGENTS.md Authoring Guide](./10-authoring-guide.md)).
4. With `--yes`, write each file (skipping any that already exist) **and** create an initial `.acc-memory.md` record for the same directory (skipping any that already have content). Without it, print the list and a hint to re-run with `--yes`.

**Terminal output:**
```text
$ acc build
[missing] src/metrics/AGENTS.md
[missing] src/auth/AGENTS.md

Run with --yes to create 2 files.

$ acc build --yes
Created src/metrics/AGENTS.md
Created src/auth/AGENTS.md
Created 2 .acc-memory.md initial records:
  src/metrics/.acc-memory.md
  src/auth/.acc-memory.md

$ acc build --yes
Nothing to build — every code directory already has an AGENTS.md contract.
```

**Exit:** `0` on success, `2` on usage error.

---

## `acc fill [path]`

**Purpose:** Produce a generic, agent-ready fill directive for completing
the `AGENTS.md` files that `acc build` generated (or any `AGENTS.md` in
the project). Read-only: it analyzes which sections are **missing**,
**empty**, or still holding **template placeholders** and lists them per
file, so a coding agent can work through the list and replace the
placeholders with accurate content. It never writes to the repository —
the agent (LLM) does that by following the directive.

**Flags:** `--json`, `--root <path>`; an optional `path` positional scopes
the scan to a subtree.

**Behavior:**
1. Walk the project root for `AGENTS.md` files (skipping `.acc/`).
2. For each, compare the section headings against the standard set
   (`Purpose`, `Responsibilities`, `Ownership`, `Inputs`, `Outputs`,
   `Dependencies`, `Constraints`, `Architecture`).
3. Classify each section: **missing** (no heading), **empty** (heading
   with no content), or **placeholder** (content that still matches the
   `acc build`/`acc document` template — `<...>` items, the "Describe what
   ... does in one sentence." purpose line, "Owner: <...>", or the
   `<Prose describing ...>` architecture line).
4. Emit the fill directive plus the per-file checklist. JSON output uses
   the stable envelope with `result.files[].{file,status,missing,empty,placeholders}`.

**Terminal output:**
```text
$ acc fill
acc fill — instructions for completing AGENTS.md files

Fill directive: Read each AGENTS.md file below and the source code it
documents, then replace every placeholder with accurate, concise content.
Keep the Markdown structure and the section headings exactly as they are.
Base the content on the actual source; do not invent facts. If a section
has nothing to add, write "None." instead of guessing. Work through the
list top to bottom.

Files to fill:
  1. src/auth/AGENTS.md
     - Purpose: 1 placeholder item
     - Ownership: 1 placeholder item
     - Dependencies: 1 placeholder item
     ...

Summary: 2 of 3 AGENTS.md files need filling · 1 complete · 12 placeholder items
```

**Exit:** `0` on success, `2` on usage error.

---

## `acc memory`

**Purpose:** Read and update functionality-local `.acc-memory.md` files.
This is the interface to the "scratchpad" — durable agent knowledge that
shouldn't go in the committed contract.

### `acc memory show <path>`

Print a functionality's `.acc-memory.md` (or a "no memory yet" message). `--json` returns `{path, exists, contents}`.

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

## `acc ai` — manage AI providers

**Purpose:** The CLI-managed setup for the engine's AI phase. AI
configuration uses the AI SDK v5 (`ai` + provider packages). Core ACC
stays offline and deterministic; AI is explicit opt-in — `ai.enabled`
defaults to `false` and nothing is loaded, required, or contacted
unless a command requests a model.

**The setup flow is: select provider → api key → model.**

```text
$ acc ai add --provider openrouter --api-key sk-or-v1-… --model nvidia/nemotron-3-nano-30b-a3b:free
Added provider 'openrouter': openai / nvidia/nemotron-3-nano-30b-a3b:free
  API key stored in .env as ACC_OPENROUTER_KEY (gitignored)
  Provider saved to .acc/config/ai.yaml
```

Interactively (no flags), `acc ai add` walks the three steps: it lists
the known providers (OpenAI, Anthropic, Google, OpenRouter, NVIDIA NIM,
Groq, Together), asks for the API key, and — when `--model` is not
given — loads the provider's available models dynamically from its
models endpoint so you can pick one.

### Subcommands

- `acc ai` — list configured providers and their status (`ready`,
  `invalid`, `not installed`, `missing API key`). Offline, no network.
- `acc ai add [--provider <id>] [--api-key <key>] [--model <model>]
  [--id <id>] [--base-url <url>] [--yes]` — add a provider. `--provider`
  selects from the known catalog (or `--base-url` for a custom
  OpenAI-compatible endpoint); `--api-key` is stored in the project's
  `.env` as `ACC_<ID>_KEY`; `--model` is used as-is, or loaded
  dynamically when omitted (interactive only). `--yes` requires all
  values as flags (deterministic, no prompts).
- `acc ai remove <id>` — remove a provider and delete its key from
  `.env`.
- `acc ai default <id>` — set the default provider.
- `acc ai models <id>` — load the provider's available models from its
  models endpoint (network call, requires the key to be set).

### Where keys and providers live

- **API keys** — `.env` (gitignored), as `ACC_<PROVIDER_ID>_KEY`.
  Keys are read into the environment when the config loads; they are
  never written to the config file and never committed.
- **Providers** — `.acc/config/ai.yaml`, a CLI-managed control file
  loaded on top of `config.yaml` (CLI wins). The human-written
  `config.yaml` is never rewritten; you can still declare providers
  there by hand.

Models are instantiated on demand via `getModel()` (lib/core/ai.js) only
when a command explicitly needs one.

**Terminal output:**
```text
AI: enabled
Default: main
  main: openai / gpt-4o — ready
  local: anthropic / claude-sonnet-4-5 — missing API key (ANTHROPIC_API_KEY)
```

**Exit:** `0` on success, `2` on usage error.

---

## `acc engine [path]` — the always-on AI intelligence engine

**Purpose:** the engine does automatically what the coding agent working
on the project should have done. It keeps the ACC files (`AGENTS.md`
contracts, `.acc-memory.md` knowledge, `ACC_WARN.md` drift) in sync
with the code.

**Who maintains the ACC files?**

- **Engine ON** — run `acc engine --watch` (the always-on daemon). The
  coding agent can then **ignore the ACC files and just code**; the
  engine reviews changed code, updates knowledge/memory, and regenerates
  `ACC_WARN.md`. The agent should read `ACC_WARN.md` before finishing.
- **Engine OFF** — the coding agent is **exclusively responsible** for
  the ACC files. Every task must include the ACC workflow (`acc context`
  / `acc impact` / `acc check` / update `AGENTS.md` / `acc memory add`)
  — see the ACC skill (`.agents/skills/acc/SKILL.md`, installed with
  `acc install`) and `.acc/config/workflows/`.

Three phases:

1. **Deterministic (always, offline)** — derives the graph, runs the
   diagnostic scan, computes per-boundary graph slices and the
   dependency-gap plan (discovered deps not yet declared).
2. **AI (only when `ai.enabled`)** — for each scoped boundary with a
   contract, asks the configured model to review the contract against
   the **changed source code** (the files the trigger identified) plus
   the derived slice, and produce durable knowledge and drift proposals.
3. **Supervisor (optional, `--supervisor`)** — a second model pass scores
   the engine's proposals against ACC rules (0–100). Below the config
   threshold (default `85`), the engine iterates on its own proposals
   with the supervisor's feedback until compliant or `max_iterations`
   (default `3`) is reached. Knowledge is written only after approval.

**Flags:**
- `--apply` — apply the deterministic sync (`acc build` + `acc discover`
  additive kinds: missing contracts, declared discovered deps) and, in
  the AI phase, write knowledge entries to `.acc-memory.md` (gitignored)
  — only after the supervisor approves (when enabled). Contract rewrites
  / skill / standard gaps are always proposals only.
- `--force` — bypass the trigger and run the AI phase now.
- `--supervisor` — enable the supervisor scoring loop.
- `--init-context` — bootstrap a repository into a fully
  ACC-contextualized state: scaffold ACC (`acc init --scan`), create the
  root `AGENTS.md` contract, create every missing per-boundary contract
  from the codebase (`acc build --yes --from-discovery`), declare
  discovered dependencies (additive), write `ACC_WARN.md`, and report
  what still needs human context (`acc fill`). Deterministic, additive,
  idempotent — never rewrites existing content.
- `--watch` — live server mode: keep the process alive in the terminal,
  re-run the engine on filesystem changes (debounced 1.5s), and stream
  phase logs, AI results, and supervisor scores to stdout. Ctrl-C exits.
- `--model <id>` — use a specific configured AI provider.
- `--json`, `--root <path>`.

**Trigger (token protection):** the AI phase only runs when enough
change has accumulated, per `engine.trigger` in config (default: `3`
commits). With `mode: commits`, the engine counts commits since its last
triggered run by reading the git reflog as plain files (no git binary);
with `mode: changes`, it keeps a content-hash snapshot and counts
changed files. `mode: always` never waits. The baseline (last processed
commit / snapshot) is stored in the gitignored `.acc/state/engine.json`.
Without git, commits mode falls back to triggered (never skips work).

**Code-aware evaluation:** the trigger also exposes the list of changed
files (content-hash diff against the previous run's snapshot) in both
modes. The AI prompt embeds that changed code (budgeted) so the model
reviews the actual code, not just the derived relationships.

**Supervisor config** (`.acc/config/config.yaml`):
```yaml
engine:
  supervisor:
    enabled: false      # or pass --supervisor
    threshold: 85       # minimum approval score (0-100)
    max_iterations: 3   # iterate on feedback until compliant
```

**AI resilience (`.acc/config/config.yaml`):** the engine's AI phase
handles failing providers deterministically and reports every failure so
the developer can fix it:

```yaml
engine:
  ai:
    retries: 3                    # attempts per provider call before giving up on it
    retry_delay_ms: 1000          # pause between attempts
    fallback: true                # try the next configured provider when one fails
    max_consecutive_failures: 3   # watch mode: stop the server after this many
                                  # consecutive runs where every provider failed
```

- **Provider fallback** — when a provider fails (bad key, endpoint
  error, timeout), the engine tries the next configured provider in
  priority order (requested → `ai.default` → config order). Providers
  that cannot be resolved (e.g. missing API key) are skipped and
  reported as `skipped provider 'id': <reason>`; the working provider is
  reported in the `AI:` line.
- **Per-call retries** — each provider call is attempted up to
  `retries + 1` times with a pause between attempts; every failed
  attempt is recorded and shown as `retries needed:` / failed-attempt
  lines, so transient failures are visible, not silent.
- **All providers exhausted** — the run reports every boundary's error
  (`✗ AI call failed for <dir>: <provider> attempt N: <message>`) and
  the full failed-attempt list. Nothing is written, nothing is thrown —
  the deterministic scan and `ACC_WARN.md` still complete.
- **Watch mode** — `acc engine --watch` retries automatically after a
  failure (no filesystem change needed). After
  `max_consecutive_failures` consecutive runs where every provider was
  exhausted, it prints `FATAL: N consecutive AI failures — stopping the
  engine.` and exits `1`, so the developer sees the error instead of a
  silent server burning tokens.

**ACC_WARN.md (drift report):** every engine run — AI or not, `--apply`
or dry-run — regenerates `ACC_WARN.md` in the project root. It is the
developer-facing alarm for drift, listing:

- **Code violations** — every `ACC0xx` error/warn diagnostic from the scan.
- **Docs behind code** — discovered dependencies the docs don't declare
  (and orphan code): the code moved ahead of the documentation.
- **Docs ahead of code** — declared dependencies no code references: the
  docs promise something the code doesn't deliver.
- **AI findings** — per-boundary drift / knowledge / skill+standard gaps
  from the last triggered AI run, with the supervisor verdict when
  enabled.

The report is deterministic whenever the AI phase is disabled/skipped
(no timestamps). It is gitignored derived state — fix the code or the
docs, never the report. The engine output shows a one-line summary:
`⚠️  ACC_WARN.md updated — N diagnostics, N docs-behind, N docs-ahead`.

**Terminal output:**
```text
ACC engine — deterministic scan
Boundaries: 4 · Files: 3 · Tests: 2 · Skills: 1 · Standards: 1
Edges: 2 declared, 1 discovered · Cycles: 0
Diagnostics: 3 (0 errors, 1 warning, 2 infos)
Slices: 4 · Dependency gaps: 1
  gap: src/auth → src/logging (discovered reference in src/auth/token.rs)

Sync (dry-run): 0 contract(s) missing, 2 suggestion(s) — run with --apply to apply

Trigger: commits 1/3 — waiting for 1/3 commits

AI: enabled but waiting (waiting for 1/3 commits) — run with --force to trigger now
```

**Exit:** `0` on success, `2` on usage error.

### Engine limits (measured)

The engine is deliberately **budgeted** — every input to the AI phase is
capped so a single review stays small and predictable, no matter how
large the repository is:

| Budget | Value | What it bounds |
|--------|-------|----------------|
| Contract | 4,000 chars | the boundary's `AGENTS.md` text sent to the model |
| Slice | 1,500 chars | the derived graph slice JSON for the boundary |
| Changed files | 10 files | how many changed files are embedded in the prompt |
| Changed code | 6,000 chars | total source text embedded for the AI to review |
| Knowledge | 5 entries | max knowledge proposals written per boundary |
| Supervisor | 0–100, iterates ≤ 3 | the approval score and re-work loop |

These caps are what make the AI phase **size-independent**: the model
never sees "the whole repo" — only a bounded slice of one boundary at a
time. See the benchmark below for what happens as the repository grows.

#### Intelligence degradation (measured, 2026-08-17)

`scripts/benchmark-engine.cjs` (live; needs a `TEST_*_KEY`) measures how
the AI phase holds up as repositories grow from 22 to ~3,900 files
(NVIDIA NIM, `nemotron-3-nano-omni-30b-a3b-reasoning`):

| Size | Files | Drift detected | Hallucinated | Contract OK | Knowledge ≤5 | Context bytes |
|------|------:|:--------------:|:------------:|:------------:|:------------:|--------------:|
| small | 22 | ✅ | ❌ | ✅ | ✅ | 879 |
| medium | 110 | ✅ | ✅ | ✅ | ✅ | 4,654 |
| large | 828 | ✅ | ✅ | ✅ | ✅ | 4,654 |
| xlarge | 3,908 | ✅ | ✅ | ✅ | ✅ | 4,654 |

**Finding 1 — size does not degrade detection.** Drift was caught in
4/4 sizes. Because the engine slices the repository per boundary, the
model's working context stays constant (~4.6 KB) from 110 files to
3,900 files — the repository grows, the per-review context does not.

**Finding 2 — the deterministic layer is the guarantee.** The scan's
dependency-gap detection caught the seeded drift at *every* size
regardless of the AI. The AI adds nuance (knowledge, drift prose,
skill/standard gaps); the deterministic scan is what guarantees the
engine never silently misses drift. (One nuance from the run: on the
22-file repo the model hallucinated a path — invented a file that
doesn't exist. The supervisor + the deterministic scan catch this: a
hallucinated path can't survive `acc check`, and the supervisor scores
it down before it's written. On larger repos, with more real context to
anchor on, it didn't happen.)

**Finding 3 — ACC files measurably help.** Same medium repo, same code:

| ACC files | Drift items | Hallucinated | Contract bytes |
|-----------|------------:|:------------:|---------------:|
| On (contracts + memory) | 2 | ✅ | 4,504 |
| Off (plain `AGENTS.md` + code) | 1 | ✅ | 55 |

With contracts + memory the model reports **2× the drift items** — the
constraint text and gotchas give the AI concrete things to check
against, instead of it having to infer intent from a 55-byte contract.

**Finding 4 — graph compactness is constant.** The derived index stays
~180 bytes/item with no prose at any scale:

| Size | Files | Index bytes | Bytes/file | Bytes/item | Prose? |
|------|------:|------------:|-----------:|-----------:|:------:|
| small | 22 | 8,720 | 396 | 188 | no |
| medium | 110 | 42,636 | 388 | 182 | no |
| large | 828 | 319,350 | 386 | 180 | no |
| xlarge | 3,908 | 1,491,690 | 382 | 179 | no |

Bytes/file is flat (~380) — the index is a routing table of ids, types,
hashes and provenance, never a copy of the repo. Full report:
`docs/benchmarks/engine-2026-08-17.md`. Re-run with
`npm run benchmark:engine` (see README).

**What this means, in plain English:** the engine doesn't get dumber as
the repository grows (drift caught at 4/4 sizes, per-review context
flat at ~4.6 KB), the ACC contracts + memory make the model's review
about 2× more thorough (2 drift items vs 1 without them), and the graph
stays tiny at any scale (~180 bytes/item, no prose — it's a routing
table, not a copy of the repo). On the one run where the model
hallucinated (small repo), the deterministic scan + supervisor are the
safety net — a made-up path can't pass `acc check` or reach the
85% approval threshold.

---

## `acc review [path]` — on-demand AI compliance review

**Purpose:** the manual, on-demand counterpart to the engine's
supervisor: ask "is this scope compliant with the ACC rules right now?"
and get a deterministic scan plus a supervisor-scored verdict (0–100)
without touching any state. An external agent or developer can run it
at any time — it never waits for the engine trigger.

**Flags:**
- `--model <id>` — use a specific configured AI provider.
- `--json`, `--root <path>`.

**Behavior:**
1. **Deterministic scan (always, offline)** — the same scan the engine
   runs: graph, diagnostics, per-boundary slices, dependency gaps.
2. **AI phase (only when `ai.enabled`)** — for each scoped boundary
   with a contract, reviews the contract against its derived slice
   (drift, knowledge, skill/standard gaps) and scores it with the
   supervisor prompt. The supervisor's `issues` are the actionable
   feedback.
3. **Read-only** — never writes `AGENTS.md`, memory, or `ACC_WARN.md`.

Without a path, the whole repository is reviewed. The overall verdict
is the weakest boundary's score (min), so one broken boundary fails the
review. AI disabled or missing API key → exit `0` with the deterministic
scan and a clear explanation of what to configure.

**Terminal output:**
```text
ACC review — whole repository
Scan: 3 diagnostics (0 errors, 1 warning, 2 infos) · 1 dependency gap(s)
AI: openai / gpt-4o (id: main) · threshold 85

  src/auth — 92/85 ✓ approved
  src/payments — 78/85 ✗ below threshold
    supervisor issues:
      - Declared dependency src/payments → src/legacy is stale; no code references it.

Overall: 78/85 — NOT COMPLIANT
```

**Exit:** `0` on success, `2` on usage error.

---

## `acc tools`

**Purpose:** List available tools and capabilities. The primary interface
for agents and developers to discover what they can do — with an
**explicit tier separation** so an external agent never confuses
deterministic commands with intelligence commands.

**Tiers (in the JSON manifest):**
- `tiers.cli` — **deterministic, offline, zero-intelligence.** Same repo
  + same flags = byte-identical output. No network, no API keys, safe on
  untrusted repositories. Any agent or developer can call these directly.
- `tiers.engine` — **the intelligence subsystem**: `ai` (offline
  provider control), `engine` (the always-on AI engine — deterministic
  scan always, AI phase requires `ai.enabled` + a provider API key
  (`api_key_env`), token-gated by the trigger), and `review` (on-demand
  AI compliance scoring). `battle`/ABA is deliberately NOT listed — it
  is a separate product, not part of the ACC capability surface.

Each command entry carries `{ name, tier, deterministic,
requires_api_key, summary, capabilities[] }`, so a consuming agent can
filter by tier before calling.

**Flags:**
- `--json` — emit JSON capability manifest (tiers + per-command metadata).
- `--root <path>`
- `--category <core\|detected\|plugins\|commands\|all>` — filter. Default: `all`.

**Behavior:**
1. Load tool registry and project detection.
2. Return the command manifest split by tier, core tools, detected
   project tools, and plugins with capabilities.
3. Include the tier descriptions and the no-network guarantee for CLI.

**Terminal output:**
```text
Core tools
  ✓ filesystem (read, write, glob)
  ✓ search (contracts, edges, code)
  ✓ context (progressive_depth, provenance)
  …

CLI — deterministic (offline, no API key)
  ✓ init           Initialize ACC structure in a directory
  ✓ check          Validate repository against ACC rules
  ✓ graph          Derive the architecture graph (text, mermaid, dot, json)
  ✓ slice          Compact AI-optimized graph slice for a path (context router)
  …
  ✓ install        Install the ACC skill into an agent environment
  ✓ tools          List available tools and capabilities (this manifest)

Engine — intelligence subsystem (AI phase requires API key)
  ⚡ ai            List AI providers and status (offline)
  ⚡ engine        Keep ACC files and knowledge in sync (deterministic scan + optional AI)
  ⚡ review        On-demand AI compliance review of a scope

Detected project tools (from package.json scripts)
  ✓ build — npm run build

Plugins (from .acc/config/tools/)
  ○ docker
```

**JSON output:** the manifest is `result.commands[]` (per-command
`{ name, tier, deterministic, requires_api_key, summary, capabilities[] }`)
plus `tiers` (cli/engine), `core`, `detected`, `plugins`, and `note`
under the standard envelope ([08 — JSON Output Schema](./08-json-schema.md)).

**Exit:** `0` on success, `2` on invalid category, `1` if registry invalid.

---

## Command Summary Table

| Command | Purpose | Modifies repo? |
|---------|---------|----------------|
| `acc init` | Initialize `.acc/config/`, preserve `AGENTS.md`. | Yes — adds files. |
| `acc check` | Validate, emit diagnostics. | No. |
| `acc inspect <path>` | roles/owners/deps/constraints/memory. | No. |
| `acc context <path>` | Focused, progressive context. | No. |
| `acc graph [path]` | Derived graph with diagnostics, memory, drift (text/mermaid/dot/json). | No. |
| `acc dependencies <path>` | What it depends on. | No. |
| `acc dependents <path>` | What depends on it. | No. |
| `acc impact <path>` | Blast radius. | No. |
| `acc search <query>` | Architecture-aware search. | No. |
| `acc discover` | Suggest architectural fixes (dry-run by default). | Only with `--apply`. |
| `acc document <path>` | Generate `AGENTS.md` template. | Only with `--apply`. |
| `acc build [path]` | Create missing `AGENTS.md` contract files. | Only with `--yes`. |
| `acc fill [path]` | Fill directive for completing placeholder `AGENTS.md` files. | No. |
| `acc install` | Install the ACC skill into an agent environment. | Yes — writes `SKILL.md`. |
| `acc memory show/add/clear <path>` | `.acc-memory.md` read/write. | Yes — `add`/`clear` only. |
| `acc tools` | List capabilities. | No. |

Reserved for future versions (not yet registered in the CLI): the
`acc agents` family.

---

## Reserved for Multi-Agent (Future)

| Command | Purpose | Modifies repo? |
|---------|---------|----------------|
| `acc agents` | List active agents in current session. | No. |
| `acc agents status` | Show progress of all agents. | No. |
| `acc agents inspect <id>` | Show details for a specific agent. | No. |
| `acc agents stop <id>` | Stop a specific agent. | No. |
| `acc agents logs <id>` | View agent logs. | No. |

**Note:** These commands are not part of V1. They are documented here for
forward compatibility. See [11 — Multi-Agent Orchestration](./11-multi-agent-orchestration.md).

---

## Test Metrics (`npm run test:metrics`)

Run the whole suite with a formatted report — one command:

```bash
npm run test:metrics            # table of suites + coverage + health
npm run test:metrics -- --json  # machine-readable aggregate
npm run test:metrics -- --quiet # summary only
```

The report shows per-suite pass/fail/skip/time, the CLI vs engine tier
coverage from the `acc tools` manifest, pass rate, and the final verdict.
Each suite runs in its own process, so a crash in one never hides the
others. Live suites (`engine.live`, `engine.quality`) skip without
`TEST_*_KEY` env keys and are counted as skipped.

---

## Stability Contract

- Diagnostic codes (`ACC0xx`) are stable; renumbering forbidden (see [06](./07-diagnostic-codes.md)).
- JSON shape per command is versioned via `schema_version`; breaking changes require a major version bump (see [07](./08-json-schema.md)).
- CLI flag names are stable post-1.0; adding flags is minor; renaming is forbidden.
- Terminal prose is informational and MAY change between versions; agents consume JSON, not prose.

The rules above are why you can build CI and agent workflows on `acc`
and trust they won't silently break. Codes, flags, and JSON are the
contract; everything pretty is allowed to evolve.

---

## V1 Implementation Status

The reference implementation (`bin/acc.js`, zero runtime dependencies)
implements every command in this document: the deterministic CLI
(`init`, `check`, `inspect`, `context`, `graph`, `slice`, `dependencies`,
`dependents`, `impact`, `search`, `discover`, `document`, `build`, `fill`,
`install`, `memory`, `tools`) and the intelligence tier (`ai`, `engine`,
`review`). Language analyzers fall back on filesystem structure per
[03 §7](./04-epistemology.md#7-language-analyzers--optional-accuracy).

`acc agents` is reserved and documented for future versions (see
[11 — Multi-Agent Orchestration](./11-multi-agent-orchestration.md)).

In `acc tools`, `battle` is exposed under its own `launcher` tier (not
as a CLI or engine capability), so external agents see it as the
separate-product launcher it is.

`acc battle` launches the standalone ABA benchmark harness — ABA is a
separate application and is never required by the framework. It is
published as the npm package `acc-battle-arena` (a dependency of
`acc-code-context`, so `acc battle` works out of the box), and lives in its own
repository with its own license. **When ABA is not already available,
`acc battle` installs it on first use**: it clones the aba-arena
repository into the per-user cache (`~/.cache/acc/aba-arena`) and
installs its dependencies, then runs it. By default it spawns the ABA
web app (battle arena: side-by-side ACC vs no-ACC benchmarks, live
streaming, per-panel provider/model); `--headless` runs a single
terminal benchmark instead. Docker is optional for ABA: benchmarks run
on an isolated snapshot copy, in a container when Docker is available
and on the host otherwise (`--local` forces host mode).
