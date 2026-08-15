# Contributing to ACC

Thank you for your interest in contributing to Agent Code Context (ACC)! This document outlines the process for contributing code, documentation, diagnostic codes, and more.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Types](#contribution-types)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Adding Diagnostic Codes](#adding-diagnostic-codes)
- [Release Process](#release-process)

---

## Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/agents-code-context.git
   cd agents-code-context
   ```
3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/EnzoVezzaro/agents-code-context.git
   ```

---

## Development Setup

### Prerequisites

- **Rust** 1.75+ (for CLI): `rustup install stable`
- **Node.js** 20+ (for TypeScript analyzer): `nvm install 20`
- **Go** 1.21+ (for Go analyzer): `go install`
- **Python** 3.11+ (for Python analyzer): `pyenv install 3.11`
- **Git** 2.40+

### Build & Test

```bash
# Build the CLI
cargo build --release

# Run all tests
cargo test
cd analyzers/typescript && npm test
cd analyzers/go && go test ./...
cd analyzers/python && pytest

# Run ACC on itself (dogfooding)
./target/release/acc check
./target/release/acc graph --format mermaid
./target/release/acc context docs --depth 1
```

### IDE Setup

- **VS Code**: Install `rust-analyzer`, `ESLint`, `Go`, `Python` extensions.
- **CLion/IntelliJ**: Rust plugin, Go plugin, Python plugin.
- **Neovim**: `rust-tools.nvim`, `nvim-lspconfig` for all languages.

---

## Contribution Types

### 🐛 Bug Fixes

1. Search existing [issues](https://github.com/EnzoVezzaro/agents-code-context/issues) first.
2. Create a minimal reproduction if possible.
3. Fix with a test case.
4. Run `acc check` to ensure no regressions.

### ✨ New Features

1. Open an issue to discuss the feature first.
2. For CLI commands: update `docs/04-cli-commands.md` and `docs/07-json-schema.md`.
3. For diagnostic codes: follow [Adding Diagnostic Codes](#adding-diagnostic-codes).
4. Add tests and documentation.

### 📚 Documentation

- Fix typos, clarify explanations, add examples.
- Update `docs/` specification files.
- Update `.acc/config/` workflows, agents, standards if relevant.
- Run `acc check` after changes.

### 🔧 Diagnostic Codes

See [Adding Diagnostic Codes](#adding-diagnostic-codes) below — this has a strict process.

---

## Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following our [Coding Standards](#coding-standards).

3. **Run the full test suite:**
   ```bash
   cargo test
   cargo clippy --all-targets --all-features -- -D warnings
   cargo fmt --all -- --check
   # Plus language-specific linters
   ```

4. **Dogfood validation:**
   ```bash
   ./target/release/acc check
   ./target/release/acc graph
   ```

5. **Commit with conventional commits:**
   ```bash
   git commit -m "feat: add --watch flag to acc check"
   ```
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `security`.

6. **Push and open a PR:**
   ```bash
   git push origin feat/your-feature-name
   ```

7. **PR Requirements:**
   - [ ] All CI checks pass
   - [ ] `acc check` passes on the ACC repo
   - [ ] Tests added for new functionality
   - [ ] Documentation updated
   - [ ] No breaking changes without major version bump discussion

8. **Review:** At least one maintainer approval required. Architecture changes need architect review.

---

## Coding Standards

See [.acc/config/standards/coding.md](./.acc/config/standards/coding.md) for detailed language-specific standards.

**Summary:**
- Rust: `rustfmt`, `clippy -D warnings`, MSRV 1.75
- TypeScript: `prettier`, `eslint`, strict mode
- Go: `gofmt`, `golangci-lint`
- Python: `black` (100 cols), `ruff`, `mypy` strict
- All: deterministic JSON, sorted keys, RFC3339 UTC timestamps

---

## Testing

See [.acc/config/standards/testing.md](./.acc/config/standards/testing.md) for detailed standards.

**Requirements:**
- Unit tests for all public functions
- Integration tests for CLI commands
- Determinism tests for JSON output
- Coverage: ≥80% overall, ≥90% critical paths
- Dogfooding: `acc check` on ACC repo must pass

---

## Documentation

See [docs/09-authoring-guide.md](./docs/09-authoring-guide.md) for `AGENTS.md` conventions.

**Specification updates:**
- CLI changes → `docs/04-cli-commands.md` + `docs/07-json-schema.md`
- Diagnostic codes → `docs/06-diagnostic-codes.md`
- Architecture → `docs/03-epistemology.md` + `.acc/config/standards/architecture.md`
- All docs use numbered format; keep index in `docs/README.md` current.

---

## Adding Diagnostic Codes

**This is a load-bearing stability contract.** Follow `.acc/config/workflows/diagnostic.md` exactly:

1. Pick next available code in correct category range (see `docs/06-diagnostic-codes.md` §2).
2. Fix severity permanently (`error`/`warn`/`info`).
3. Define exact trigger predicate (repository state only, not agent behavior).
4. Define JSON `detail` payload shape.
5. Add to category table in `docs/06-diagnostic-codes.md`.
6. Wire emission site in derivation/check pipeline.
7. Unit test the trigger predicate.
8. Dogfood: `acc check` on ACC repo — new code must NOT fire spuriously.
9. Bump versions: minor `acc_version` + minor `schema_version`.

**Forbidden:**
- Renumbering existing codes
- Reusing retired numbers
- Changing released code severity
- Removing released codes (deprecate instead)

---

## Release Process

See `.acc/config/workflows/release.md` for the full checklist.

**Stability gates (blocking):**
- No diagnostic code renumbering/removal
- No JSON field removal/type change without major `schema_version` bump
- No CLI flag renaming
- No diagnostic severity changes
- Hard invariant holds (remove `.acc/` → valid agents.md repo)
- No code execution, network calls
- Deterministic JSON output

**Maintainers** handle version bumping, tagging, and publishing.

---

## Questions?

- Open a [GitHub Discussion](https://github.com/EnzoVezzaro/agents-code-context/discussions)
- Check existing [Issues](https://github.com/EnzoVezzaro/agents-code-context/issues)
- Review the [Documentation](./docs/README.md)

Thank you for contributing to ACC! 🎉