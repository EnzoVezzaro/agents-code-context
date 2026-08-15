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
- Control plane: `.agents/acc/config.yaml`, agents, workflows, standards

### Changed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- No code execution, no network calls, path boundary enforcement

---

## [0.1.0] - TBD

### Added
- First stable release of ACC specification
- Core philosophy: agent-agnostic, filesystem-first, offline
- Hard invariant: removing `.agents/` leaves valid `AGENTS.md` repo
- Deterministic JSON output with `schema_version`
- Stable `ACC0xx` diagnostic codes
- Progressive context engine with provenance
- Architecture graph derivation (declared/discovered/inferred)

### Notes
This is the initial public release. The specification is complete for V1.