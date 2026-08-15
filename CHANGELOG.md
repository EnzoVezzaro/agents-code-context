# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
- Documentation site (VitePress) builds directly from the canonical docs via `docs-vitepress/scripts/sync-docs.mjs`

### Fixed
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