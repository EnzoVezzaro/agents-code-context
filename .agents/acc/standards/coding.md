# coding.md — ACC Coding Standards

This standard defines coding conventions for the ACC project itself.
When contributing to ACC, follow these conventions.

## General

- **Language**: Rust (primary), with TypeScript/Go/Python for analyzers.
- **Style**: Follow the language's official style guide (rustfmt, prettier, gofmt, black).
- **Linting**: All code must pass `cargo clippy`, `eslint`, `golangci-lint`, `ruff` as applicable.
- **Tests**: Unit tests for all public functions; integration tests for CLI commands.

## Rust Specific

- Edition: 2021
- Minimum supported Rust version (MSRV): 1.75
- `cargo fmt --all` before commit
- `cargo clippy --all-targets --all-features -- -D warnings`
- Prefer `anyhow::Result` for application errors; `thiserror` for library errors.
- Use `serde` for serialization; derive `Debug`, `Clone` where appropriate.
- Async: `tokio` runtime; prefer `async fn` over block_on.

## TypeScript Specific

- Target: ES2022
- Module: NodeNext
- Strict mode: enabled
- ESLint: `@typescript-eslint/recommended`, `prettier`
- Tests: `vitest` with coverage

## Go Specific

- Version: 1.21+
- `gofmt` and `goimports` before commit
- `golangci-lint` with default config
- Tests: standard `testing` package; table-driven tests preferred.

## Python Specific

- Version: 3.11+
- `black` formatting (line length 100)
- `ruff` linting (all rules)
- `mypy` strict mode for typed modules
- Tests: `pytest` with `pytest-cov`

## CLI Design

- Follow POSIX conventions for flags and exit codes.
- `--json` on every command; deterministic output.
- `--quiet` suppresses progress; errors always shown.
- `--root` overrides project root detection.
- Subcommands use kebab-case: `acc memory add`, not `acc memory_add`.

## JSON Output

- Keys: snake_case
- Sorted object keys (deterministic)
- RFC3339 timestamps in UTC
- No trailing commas, no comments
- `schema_version` in envelope

## Documentation

- All public APIs documented with doc comments.
- `docs/` follows the numbered specification format.
- `AGENTS.md` files follow the authoring guide (docs/09).
- Update docs when changing CLI surface or JSON schema.

## Git

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- No direct pushes to main; PRs required.
- CI must pass before merge.
- `acc check` runs in CI.