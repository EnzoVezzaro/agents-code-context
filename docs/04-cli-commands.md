# 04 — CLI Command Specification

## Conventions

- All commands support `--json` producing deterministic JSON per [07 — JSON Output Schema](./07-json-schema.md).
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
| `--color <auto\|always\|never>` | ANSI color control. Default `auto`. |
| `--no-progress` | Suppress progress indicators. |
| `--help` / `-h` | Command help. |
| `--version` / `-V` | CLI version (top-level only). |

Every `--json` output includes a top-level `schema_version` integer and a `command` string identifying the producer. See [07 — JSON Output Schema](./07-json-schema.md).

---

## `acc init`

**Purpose:** Convert an ordinary or `AGENTS.md`-bearing repository into an ACC-enhanced one. Does not fabricate docs. Preserves any existing `AGENTS.md` and `.agents/` content.

**Flags:**
- `--force` — overwrite existing `.acc/config/config.yaml` if present. Default: refuse, exit `1` with informative message.
- `--root <path>` — initialize at a non-detected root.
- `--json` — emit JSON.

**Behavior:**
1. Detect the project root (nearest ancestor with `.git/`, `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, or a writable directory).
2. If no `AGENTS.md` exists at root: **print** a conservative template to stdout (not auto-written) and instruct the user to review and commit. `acc init` does not author `AGENTS.md` on disk without explicit intent.
3. Create `.acc/config/` with minimal scaffold:
   - `config.yaml` — minimal valid config (`schema_version: 1` + defaults)
   - Empty `agents/`, `workflows/`, `standards/` directories
4. Ensure `.gitignore` excludes `.acc-memory.md` (append if missing).
5. Never delete or rewrite existing files. Existing `AGENTS.md`, `.agents/`, or `.gitignore` content is preserved verbatim; `acc init` only **adds**.

**Terminal output:** concise summary of what was created / what already existed.

**Exit:** `0` on success, `1` if `.acc/config/config.yaml` exists and `--force` not given.

**Example:**
```bash
$ acc init
Created .acc/config/config.yaml
Created .acc/config/agents/
Created .acc/config/workflows/
Created .acc/config/standards/
Updated .gitignore (added .acc-memory.md)
No AGENTS.md found at root — printed template to stdout. Review and commit.
```

---

## `acc check`

**Purpose:** Validate the repository against ACC rules: broken references, missing contracts, forbidden dependencies, duplicate ownership, stale docs. Returns stable diagnostic codes (e.g., `ACC001`).

**Flags:**
- `--json`
- `--root <path>`
- `--watch` — re-run on filesystem change, emit only new diagnostics (V1.1)
- `--exit-zero` — always exit `0` regardless of diagnostics (for CI lint modes). Default: exit `1` if any error-level diagnostic.
- `--severity <error\|warn\|info>` — minimum severity to emit. Default: emit all.
- `--code <ACC0xx>` — filter to a specific diagnostic code (repeatable).

**Behavior:** runs the full derivation pipeline (see [03 — Epistemology](./03-epistemology.md#8-graph-derivation-algorithm-v1-in-memory)) and surfaces diagnostics per [06 — Diagnostic Codes](./06-diagnostic-codes.md).

**Diagnostic codes and severities are stable** and documented in `06`. Adding new codes is a minor-version bump; renumbering is forbidden.

**Terminal output:** one line per diagnostic:
```text
ACC020  error   src/audio/AGENTS.md    declared dependency 'src/database' not discovered in code
ACC031  warn    src/database/AGENTS.md   dependency target 'src/audio' has no declared owner
ACC040  info    .acc/config/config.yaml  no language analyzer for extension '.lock'
```

**Exit:** `1` if any error-level diagnostic, else `0`. `--exit-zero` overrides to `0`.

**Example:**
```bash
$ acc check
ACC020  error   src/auth/AGENTS.md    declared dependency 'src/database' not discovered in code
ACC031  warn    src/database/AGENTS.md   dependency target 'src/auth' has no declared owner
ACC014  warn    src/auth/AGENTS.md    circular reference: src/auth → src/database → src/auth

Found 3 diagnostics (1 error, 2 warnings)
```

---

## `acc inspect <path>`

**Purpose:** Return roles, owners, dependencies, constraints, and memory status for a path.

**Flags:** `--json`, `--root <path>`, `--with-memory` (default: include existence of `.acc-memory.md` but not contents; with `--with-memory`, include the file's contents).

**Behavior:** resolves the path to its nearest functionality boundary (directory with `AGENTS.md`, or the root node if none), and reports:
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

**Purpose:** The central context engine. Generate focused, progressive, agent-ready context for a path. **Does not dump the whole repository.**

**Flags:**
- `--depth <N>` — depth of transitive expansion. `0` = immediate functionality only. `N` = include dependencies/dependents up to N hops. Default: `1` (conservative — immediate functionality + its direct dependencies' contracts). See [05 — Context Engine](./05-context-engine.md).
- `--include <kind[,kind...]>` — filter sections: `contract`, `dependencies`, `dependents`, `constraints`, `implementations`, `memory`, `impact`. Default: all except `impact` (impact requires explicit traversal; use `acc impact` for that).
- `--exclude <kind[,kind...]>` — remove sections from default set.
- `--max-bytes <N>` — hard cap on total output bytes. Default: `65536`. Accompanied by a truncation marker in output when hit.
- `--json`, `--root <path>`

**Behavior:** see [05 — Context Engine](./05-context-engine.md) for the full assembled-context contract. Briefly, the output has six sections:

1. **Hierarchy** — inherited `AGENTS.md` chain (root → path), each with provenance.
2. **Contract** — the local `AGENTS.md` contents (parsed structure + raw text reference).
3. **Dependencies** — direct then transitive (per `--depth`), declared vs. discovered, each with provenance.
4. **Constraints** — declared invariants applying to this path, inherited and local.
5. **Implementations** — high-level summary of the source under the path (file count, function/module counts per language analyzer, not full source). With `--include implementations` only; never source dumps.
6. **Memory** — functionality's `.acc-memory.md` (existence by default; contents with `--include memory`).

Every section, every item, every line carries provenance.

**Progressive depth semantics:**

| `--depth` | Meaning |
|-----------|---------|
| `0` | Immediate functionality boundary + local contract. No transitive expansion. |
| `1` (default) | Above + direct dependencies' contracts (their `AGENTS.md` only). |
| `2` | Above + direct + 2-hop transitive dependencies' contracts. |
| `N` | N-hop transitive expansion. |

Depth limits the **transitive expansion of contract context**, not the graph traversal itself. `acc graph` and `acc dependencies --transitive` remain unrestricted by `--depth`.

**Terminal output:** structured, sectioned. Compact enough for agent digest; JSON output is intended for programmatic consumption.

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
Languages:
  rust: 6 files, 23 modules, 87 functions
  toml: 2 files
Source: Discovered from filesystem + rust language analyzer

## Memory
.acc-memory.md present at src/auth/.acc-memory.md
(use --include memory to view contents)

Context bytes: 1842 / 65536
```

---

## `acc graph [path]`

**Purpose:** Generate the derived architecture graph.

**Flags:**
- `--format <text\|mermaid\|dot\|json>` — output format. Default `text` (or `json` when `--json`).
- `--json` — shorthand for `--format json`.
- `--root <path>`
- `--provenance` — include provenance annotations on every edge/node. Default: on for JSON; on for `text` at the foot; off for `mermaid` and `dot` unless specified.
- `--include <declared\|discovered\|inferred>` — filter edges by provenance. Default: all.
- `--nodes` — emit only nodes (no edges). Useful for inventory.
- `--max-depth <N>` — limit traversal depth. Default: unlimited.

**Behavior:** derives the graph per [03 — Epistemology](./03-epistemology.md) and outputs in the requested format. If `path` given, scope the subgraph rooted at that functionality.

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

## `acc dependencies <path>` & `acc dependents <path>`

**Purpose:** List declared vs. discovered relationships, distinguishing each. Distinguish direct vs. transitive.

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

**Purpose:** Answer "what could break?" Returns affected tests, direct/transitive dependents, and constraints.

**Flags:**
- `--direct` / `--transitive` — default both (show direct + transitive).
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

**Purpose:** Architecturally relevant search across contracts, relationships, and code. Not a plain text search — it understands functionality boundaries and edges.

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

**Purpose:** Generate architectural suggestions based on diffs between declared contracts and discovered code. **Must not silently rewrite the repository.**

**Flags:**
- `--apply` — apply suggestions that modify `AGENTS.md` or create files. Default: dry-run; suggestions printed only. `--apply` prompts for confirmation per suggestion (or `--yes` to skip prompts).
- `--yes` — with `--apply`, apply all suggestions without prompting.
- `--kind <kind[,kind...]>` — filter suggestion kinds: `missing-contract`, `missing-dependency`, `stale-dependency`, `unknown-owner`, `direction-mismatch`, `orphan-code`. Default: all.
- `--json`, `--root <path>`

**Suggestion kinds** (each maps to one or more diagnostic codes from [06](./06-diagnostic-codes.md)):

| Kind | Meaning |
|------|---------|
| `missing-contract` | Directory with code but no `AGENTS.md`. Suggests `acc document <path>`. |
| `missing-dependency` | Discovered dep not declared. Suggests adding to `Dependencies:`. |
| `stale-dependency` | Declared dep not discovered. Suggests removal or investigation. |
| `unknown-owner` | Dependency target with no owner declared. Suggests declaring owner. |
| `direction-mismatch` | Declared A→B but discovered B→A. Suggests review. |
| `orphan-code` | Source files outside any functionality boundary. Suggests boundary creation. |

All suggestions are `Inferred` provenance. With `--apply`, suggestions that affect `AGENTS.md` go through `acc document` machinery (conservative templates, reviewed).

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

**Purpose:** Generate a conservative `AGENTS.md` template/proposal for an undocumented functionality. Never auto-creates with ACC-specific schema; templates use the standard Markdown sections from [09 — AGENTS.md Authoring Guide](./09-authoring-guide.md).

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

## `acc memory`

**Purpose:** Read and update functionality-local `.acc-memory.md` files.

### `acc memory show <path>`

Print a functionality's `.acc-memory.md` (or a "no memory yet" message). `--json` returns `{path, exists, contents}`.

### `acc memory add <path> <text>`

Append a timestamped entry to `<path>/.acc-memory.md`. Creates the file if absent. No schema — plain Markdown. Example appended line:

```markdown
## 2026-08-15T14:03:21Z

<text>
```

### `acc memory clear <path>`

Truncate the file (with `--force`; otherwise prompts). The file remains (empty) to preserve the memory convention marker for that functionality.

**All `acc memory` subcommands support `--json` and `--root`.** They never modify `AGENTS.md`. They never network.

---

## `acc tools`

**Purpose:** List available tools and capabilities. The primary interface for agents to discover what they can do.

**Flags:**
- `--json` — emit JSON capability manifest.
- `--root <path>`
- `--category <core\|detected\|plugins\|all>` — filter by category. Default: `all`.
- `--refresh` — force re-discovery of project tools and plugins.

**Behavior:**
1. Load tool registry from `.acc/config/config.yaml` and project detection.
2. Return core tools, detected project tools, and plugins with capabilities.
3. Include permission model and project type.

**Terminal output:**
```text
Core tools
  ✓ filesystem
  ✓ search
  ✓ shell
  ✓ git
  ✓ project
  ✓ context
  ✓ graph
  ✓ memory
  ✓ check

Detected project tools (Node.js)
  ✓ npm
  ✓ vitest
  ✓ eslint
  ✓ tsc

Optional plugins
  ○ docker
  ○ github
```

**JSON output:** See [11 — Tooling Subsystem](./11-tooling.md#9-agent-capability-discovery) for full schema.

**Exit:** `0` on success, `1` if registry invalid.

---

## `acc tool <name>`

**Purpose:** Execute a specific tool capability (e.g., test, lint, typecheck, build).

**Flags:**
- `--json`
- `--root <path>`
- `--args <string...>` — additional arguments passed to the tool command.
- `--scope <path>` — limit execution to a functionality scope.

**Behavior:**
1. Resolve tool name to capability in registry (core, detected, or plugin).
2. Check permissions (moderate: `shell_enabled`, `run_tests`, etc.).
3. Execute the associated command in project sandbox.
4. Return structured result with stdout, stderr, exit code, duration.

**Available tools (project-dependent):**
- `test` — run project test suite (`npm test`, `cargo test`, `pytest`, etc.)
- `lint` — run linter (`npm run lint`, `cargo clippy`, `ruff check`, etc.)
- `typecheck` — run type checker (`npm run build`, `cargo check`, `mypy`, etc.)
- `build` — run build (`npm run build`, `cargo build`, etc.)
- `format` — run formatter (`npm run format`, `cargo fmt`, `black`, etc.)
- `audit` — run security audit (`npm audit`, `cargo audit`, `bandit`, etc.)

**Example:**
```bash
$ acc tool test
Running: npm test
✓ 42 tests passed in 3.2s

$ acc tool lint --json
{
  "tool": "lint",
  "command": "npm run lint",
  "exit_code": 0,
  "stdout": "No issues found",
  "stderr": "",
  "duration_ms": 1240
}
```

**Exit:** Tool's exit code (0 = success, non-zero = failure), `2` if tool not found, `1` if permission denied.

---

## `acc shell <command>`

**Purpose:** Execute arbitrary shell command in project sandbox (subject to permissions).

**Flags:**
- `--json`
- `--root <path>`
- `--cwd <path>` — working directory (default: project root, must be within project).
- `--timeout <seconds>` — max execution time. Default: 300.
- `--env <KEY=VALUE>` — additional environment variables (repeatable).

**Behavior:**
1. Validate command against permission model (`shell_enabled`, `shell_approval`).
2. Resolve working directory within project root.
3. Execute command with timeout.
4. Return structured result.

**Security:** Command runs with:
- Restricted environment (no secrets unless explicitly passed)
- Project root as working directory boundary
- No network access unless `network.enabled: true`
- Resource limits from `multi_agent.resource_limits` (if applicable)

**Example:**
```bash
$ acc shell "cargo test --package auth"
Running: cargo test --package auth
auth :: tests::test_token_validation ... ok
auth :: tests::test_refresh_flow ... ok
```

**Exit:** Command's exit code, `1` if permission denied, `2` if validation failed.

---

## Command Summary Table

| Command | Purpose | Modifies repo? |
|---------|---------|----------------|
| `acc init` | Initialize `.acc/config/`, preserve `AGENTS.md`. | Yes — adds files. |
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
| `acc tools` | List capabilities. | No. |
| `acc tool <name>` | Execute tool (test, lint, typecheck, build, format, audit). | Depends on tool. |
| `acc shell <command>` | Execute arbitrary shell command. | Depends on command. |

---

## Reserved for Multi-Agent (Future)

| Command | Purpose | Modifies repo? |
|---------|---------|----------------|
| `acc agents` | List active agents in current session. | No. |
| `acc agents status` | Show progress of all agents. | No. |
| `acc agents inspect <id>` | Show details for a specific agent. | No. |
| `acc agents stop <id>` | Stop a specific agent. | No. |
| `acc agents logs <id>` | View agent logs. | No. |

**Note:** These commands are not part of V1. They are documented here for forward compatibility. See [10 — Multi-Agent Orchestration](./10-multi-agent-orchestration.md).

---

## Stability Contract

- Diagnostic codes (`ACC0xx`) are stable; renumbering forbidden (see [06](./06-diagnostic-codes.md)).
- JSON shape per command is versioned via `schema_version`; breaking changes require a major version bump (see [07](./07-json-schema.md)).
- CLI flag names are stable post-1.0; adding flags is minor; renaming is forbidden.
- Terminal prose is informational and MAY change between versions; agents consume JSON, not prose.

---

## V1 Implementation Status

The reference implementation (`bin/acc.js`, zero runtime dependencies)
implements the core commands in this document: `init`, `check`, `inspect`,
`context`, `graph`, `dependencies`, `dependents`, `impact`, `search`,
`discover`, `document`, `memory`, and `tools`. Language analyzers fall back
on filesystem structure per [03 §7](./03-epistemology.md#7-language-analyzers--optional-accuracy).

`acc tool`, `acc shell`, and `acc agents` are reserved and documented for
future versions (see [11 — Tooling Subsystem](./11-tooling.md) and
[10 — Multi-Agent Orchestration](./10-multi-agent-orchestration.md)).

`acc battle` launches the standalone ABA benchmark harness — ABA is a
separate application and is never required by the framework. By default it
spawns the ABA web app (battle arena: side-by-side ACC vs no-ACC
benchmarks, live streaming, per-panel provider/model); `--headless` runs a
single terminal benchmark instead. Docker is optional for ABA: benchmarks
run on an isolated snapshot copy, in a container when Docker is available
and on the host otherwise (`--local` forces host mode).