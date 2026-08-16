# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`acc fill [path]`** — a generic, read-only fill directive for
  completing `AGENTS.md` files. It walks the project, classifies every
  section of every `AGENTS.md` as **missing**, **empty**, or holding
  **template placeholders** (the `<...>` items, "Describe what ... does in
  one sentence.", "Owner: <...>", "<Prose ...>"), and emits a per-file
  checklist plus a directive a coding agent follows to replace the
  placeholders with accurate content. Companion to `acc build`.
- **`acc init` root memory record** — init now creates the root
  `.acc-memory.md` initial record (when missing) and seeds it with the
  project's provenance: the **clone date** (from `.git`, reflog first
  entry or filesystem birthtime) and, when the origin is GitHub, the
  owner/repo and default branch (from `.git/config` + `.git/HEAD`).
  All reads are pure filesystem — no git binary is ever executed.
- **`acc build` memory records** — alongside every `AGENTS.md` contract
  it creates, `acc build --yes` now also creates an initial
  `.acc-memory.md` record for that functionality. Dry-run output,
  idempotency, and "nothing to build" semantics are unchanged.
- **`acc build [path]`** — create all missing `AGENTS.md` contract files in a
  project (dry-run by default; `--yes` writes, `--from-discovery` pre-fills
  inferred dependencies/owners). A project is "fully documented" when `acc
  build` has nothing left to create.
- **`acc init` scan-and-prepare prompt** — in an interactive terminal, init
  now asks whether to scan the codebase and prepare the project; confirmed
  answers (or `--scan`) run the diagnostics scan (`acc check`) and create the
  missing contract files (`acc build --yes --from-discovery`). `--no-scan`
  and non-interactive runs (CI, piped stdin) never scan, keeping init
  deterministic and safe on untrusted repositories.
- ABA is now its own repository and npm package: `acc-battle-arena` (MIT + FSL-1.1-MIT for the isbetter.ai-derived UI). The `aba/` directory is a self-contained git repo, never pushed with ACC; `acc-agents` depends on the npm package so `acc battle` works out of the box
- ACC licensed under the same MIT license as the [agents.md](https://agents.md) standard
- Initial ACC framework specification and documentation
- CLI commands: `init`, `check`, `inspect`, `context`, `graph`, `dependencies`, `dependents`, `impact`, `search`, `discover`, `document`, `memory`
- Multi-agent orchestration specification (optional, config-gated)
- Diagnostic codes `ACC001`–`ACC109` with stability contract
- JSON output schema with deterministic envelope
- Memory semantics with `.acc-memory.md` files
- Authoring guide for `AGENTS.md`
- Control plane: `.acc/config/config.yaml`, agents, workflows, standards

### Changed
- Repository layout: control plane moved from `.agents/acc/` to `.acc/config/`; `.agents/` reserved for the standard surface (optional `.agents/AGENTS.md`, `.agents/skills/`)
- agents.md compliance: ACC is a strict superset of the AGENTS.md standard; skills use the SKILL.md format; MCP bridges reference standard configs
- Implemented the reference `acc` CLI (zero runtime dependencies, offline, deterministic) in `bin/acc.js` + `lib/`
- ABA (ACC Battle Arena) is a standalone benchmark application, launchable via `acc battle`; it is not part of the framework
- ABA runs without Docker: benchmarks always run on an isolated snapshot copy; Docker is used when available and falls back to the host otherwise (`--local` forces host mode)
- ABA spawns a Vite web app (battle arena) by default: side-by-side ACC vs no-ACC benchmarks with per-panel provider/model (Vercel AI SDK, keys stay in the browser), live streaming, metric pills with per-metric winners, blind mode, answer/code views, local history, and switchable repo; `--headless` keeps the terminal flow
- Published to npm as `acc-agents` (v0.1.0, renamed from `agents-code-context`); ABA generates the ACC panel context via the npm-installed CLI (npx fallback)
- Documentation site (VitePress) builds directly from `docs/` — the numbered spec files are the site's pages (`docs/.vitepress/config.ts`); no separate content copy or sync step
- CI rewritten for the Node CLI: tests, dogfood, determinism, schema validation, docs build, hard-invariant check
- `CONTRIBUTING.md` rewritten for the Node CLI project; `SECURITY.md` corrected to the implemented diagnostic codes

### Removed
- Dead code: `aba/models.cjs`, broken `aba/bin/aba.js` stub, duplicated helpers in `aba/importer.cjs` and `aba/results.cjs`, unused imports across `aba/` and `lib/`
- Fictional Rust/analyzer CI, release, and dependabot configurations
- Tracked junk: `.DS_Store`, legacy `site/` landing page, committed VitePress cache and generated pages
- Empty placeholder directories under `aba/`

### Fixed
- **Project-root detection escape** — `detectProjectRoot` no longer
  resolves to (or above) the user's home directory. A stray marker in the
  home dir (e.g. `~/package.json`) previously made the **entire home tree**
  the project root for any repository run in a nested sandbox, causing
  `acc build`/`acc graph` to walk caches, `node_modules`, and browser
  profiles for minutes (effectively hanging). Root detection now stops at
  the home boundary and falls back to the current directory.
- N/A (initial release)

### Security
- No code execution, no network calls, path boundary enforcement

---

## [0.1.0] - TBD

### Added
- First stable release of ACC specification
- Core philosophy: agent-agnostic, filesystem-first, offline
- Hard invariant: removing `.acc/` leaves valid agents.md repo
- Deterministic JSON output with `schema_version`
- Stable `ACC0xx` diagnostic codes
- Progressive context engine with provenance
- Architecture graph derivation (declared/discovered/inferred)

### Notes
This is the initial public release. The specification is complete for V1.