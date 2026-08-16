# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Diagnostic engine completeness** — `acc check` now emits diagnostics
  that were previously registered but unreachable:
  - `ACC022` (discovered dependency not declared) — was missing from
    `acc check` entirely; now diffs declared vs. discovered edges.
  - `ACC031` (unowned dependency target) — was registered but never
    emitted.
  - `ACC050` (orphan `.acc-memory.md`) and `ACC072` (orphaned code) —
    could never fire because the implicit root node covered everything;
    anchoring is now based on actual `AGENTS.md` contracts.
- **Declared edges cover sub-boundaries** — a declared dependency on
  `lib/` now satisfies discovered references to `lib/commands/` when
  diffing `ACC022`.
- **Discovered-edge matcher refinements** — path-like token matching:
  no substring matches inside larger words, no method-call matches
  (a regex `.test(`), no quoted string values, no bracket markers
  (the impact output's `[test]` tag).
- **Comprehensive framework test suite** (`test/framework.test.js`) —
  every command surface and every implemented `ACC0xx` diagnostic is
  exercised end-to-end against the real CLI (37 → 111 tests total).
- **Functionality contracts** — `AGENTS.md` for `bin/`, `lib/`,
  `lib/commands/`, and `test/`; the flagship repo now reports
  "Nothing to build" from `acc build`.
- **Docs** — "Markdown is all you need" page
  (`docs/02-markdown-is-all-you-need.md`), a security-model page
  (`docs/13-security.md`), a friendlier landing, a shared
  markdown-file favicon, and payments-based examples throughout.
- JavaScript language analyzer enabled in the dogfooded config.

### Changed
- **Docs renumbered to match navigation order** — the "Markdown is
  all you need" page moved from `12-` to `02-` and the pages after it
  shifted up, so every spec file's number matches its sidebar position
  (01 → 13). URLs are unchanged (rewrites keep the same slugs).

### Fixed
- **`acc check --severity` filter was inverted** — `--severity warn`
  dropped errors and kept infos; it now keeps error + warn (and
  `--severity error` keeps errors only), per the diagnostics spec.
- **`acc graph --max-depth` was declared but inert** — now limits the
  emitted subgraph; `--nodes --json` also returns no edges.
- **`acc <command> --help` showed top-level help** — command-level
  usage was dead code in the dispatcher; now routed correctly.
- **VitePress build artifacts polluting the graph** — `docs/.vitepress/`
  is now excluded from derivation.

---

## [0.4.0] - 2026-08-15

### Added
- **`acc fill [path]`** — a generic, read-only fill directive for
  completing `AGENTS.md` files. It walks the project, classifies every
  section of every `AGENTS.md` as **missing**, **empty**, or holding
  **template placeholders**, and emits a per-file checklist plus a
  directive a coding agent follows to replace the placeholders with
  accurate content. Companion to `acc build`.

### Fixed
- **Project-root detection escape** — `detectProjectRoot` no longer
  resolves to (or above) the user's home directory. A stray marker in
  the home dir (e.g. `~/package.json`) previously made the **entire
  home tree** the project root for any repository run in a nested
  sandbox, causing `acc build`/`acc graph` to walk caches,
  `node_modules`, and browser profiles for minutes. Root detection now
  stops at the home boundary and falls back to the current directory.

---

## [0.3.0] - 2026-08-15

### Added
- **`acc build [path]`** — create all missing `AGENTS.md` contract files
  in a project (dry-run by default; `--yes` writes, `--from-discovery`
  pre-fills inferred dependencies/owners). A project is "fully
  documented" when `acc build` has nothing left to create.
- **`acc init` scan-and-prepare prompt** — in an interactive terminal,
  init now asks whether to scan the codebase and prepare the project;
  confirmed answers (or `--scan`) run the diagnostics scan (`acc check`)
  and create the missing contract files. `--no-scan` and non-interactive
  runs (CI, piped stdin) never scan, keeping init deterministic and safe
  on untrusted repositories.
- **Memory provenance** —
  - `acc init` creates the root `.acc-memory.md` initial record (when
    missing) seeded with the project's clone date (from `.git`, reflog
    first entry or filesystem birthtime) and, when the origin is GitHub,
    the owner/repo and default branch. All reads are pure filesystem —
    no git binary is ever executed.
  - `acc build --yes` creates an initial `.acc-memory.md` record
    alongside every `AGENTS.md` contract it creates.

---

## [0.2.0] - 2026-08-15

### Added
- **Reference `acc` CLI** (zero runtime dependencies, offline,
  deterministic) in `bin/acc.js` + `lib/`: `init`, `check`, `inspect`,
  `context`, `graph`, `dependencies`, `dependents`, `impact`, `search`,
  `discover`, `document`, `build`, `fill`, `memory`, `tools`.
- **Documentation site (VitePress)** built directly from `docs/` — the
  numbered spec files are the site's pages; no separate content copy.
- **ABA as a standalone project** — its own repository and npm package
  (`acc-battle-arena`); the `aba/` directory is a self-contained git
  repo, never pushed with ACC; `acc-agents` depends on the package so
  `acc battle` works out of the box. Runs without Docker (isolated
  snapshot copy; container when available, host otherwise); spawns a
  Vite web app (battle arena) by default with per-panel
  provider/model, live streaming, metric pills, blind mode, and
  `--headless` terminal flow.

### Changed
- Published to npm as `acc-agents` (renamed from `agents-code-context`).
- CI rewritten for the Node CLI: tests, dogfood, determinism, schema
  validation, docs build, hard-invariant check; GitHub Pages deploy for
  the docs site.
- `CONTRIBUTING.md` rewritten for the Node CLI project; `SECURITY.md`
  corrected to the implemented diagnostic codes.
- agents.md compliance: ACC is a strict superset of the AGENTS.md
  standard; control plane lives in `.acc/config/`.

### Removed
- Dead code (`aba/models.cjs`, broken `aba/bin/aba.js` stub, duplicated
  helpers), fictional Rust/analyzer CI, release, and dependabot
  configurations, tracked junk (`.DS_Store`, legacy `site/` landing,
  committed VitePress cache and generated pages), empty placeholder
  directories under `aba/`.

---

## [0.1.0] - 2026-08-15

### Added
- First stable release of the ACC specification:
  - Core philosophy: agent-agnostic, filesystem-first, offline;
    hard invariant — removing `.acc/` leaves a valid agents.md repo.
  - Architecture graph derivation (declared/discovered/inferred) with
    provenance everywhere.
  - Stable `ACC0xx` diagnostic codes with a stability contract.
  - Deterministic JSON output with `schema_version`.
  - Progressive context engine with provenance and budget caps.
  - Memory semantics (`.acc-memory.md` files).
  - `AGENTS.md` authoring guide.
  - Control plane: `.acc/config/config.yaml`, agents, workflows,
    standards.
  - Multi-agent orchestration specification (optional, config-gated).
- MIT license (same as the agents.md standard).
