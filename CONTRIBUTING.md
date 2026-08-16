# Contributing to ACC

Thank you for your interest in contributing to Agent Code Context (ACC)! This
document outlines how to contribute code, documentation, diagnostic codes, and
more. We're glad you're here — this is an open source project built for the
open source community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [What to Work On](#what-to-work-on)
- [Contribution Types](#contribution-types)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Adding Diagnostic Codes](#adding-diagnostic-codes)
- [Release Process](#release-process)

---

## Code of Conduct

This project follows our [Code of Conduct](./CODE_OF_CONDUCT.md). By
participating, you agree to uphold it. Be kind, be constructive, assume good
intent.

---

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR-USERNAME/agents-code-context.git
   cd agents-code-context
   ```

3. **Add the upstream remote:**

   ```bash
   git remote add upstream https://github.com/EnzoVezzaro/agents-code-context.git
   ```

4. **Create a feature branch:**

   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Development Setup

### Prerequisites

- **Node.js 18+** (the CLI's own code runs on stock Node)
- **Git 2.40+**
- **Docker** (optional, only for the standalone ABA benchmark harness — ABA
  falls back to host mode without it, and the framework itself never
  requires either)

### Project layout

```
bin/acc.js          # CLI entry point
lib/                # CLI implementation (config, graph, diagnostics, commands)
test/               # Unit + end-to-end tests (node:test, no framework)
docs/               # Canonical specification — also the VitePress site root
.acc/config/        # This repository's own ACC control plane (dogfood)
aba/                # ABA — standalone repo (never pushed with ACC);
                    # published to npm as acc-battle-arena, this package depends on it
```

### Build & Test

There is no build step — the CLI runs directly on Node:

```bash
# Run the test suite (25 tests, zero dependencies)
node --test 'test/*.test.js'

# Run ACC on itself (dogfooding)
node bin/acc.js check
node bin/acc.js graph
node bin/acc.js context docs --depth 1
```

### IDE Setup

The project is plain CommonJS JavaScript with JSDoc comments. Any editor
works; VS Code with the built-in TypeScript checker gives you JSDoc-aware
intellisense out of the box.

---

## What to Work On

- **Issues labeled `good first issue`** are a great starting point.
- **Check existing issues and discussions** before starting work to avoid
  duplicating effort.
- **RFC-style proposals** for architecture changes: open an issue describing
  the problem and the proposed design first — architecture changes need
  maintainer discussion.

---

## Contribution Types

### 🐛 Bug Fixes

1. Search existing [issues](https://github.com/EnzoVezzaro/agents-code-context/issues) first.
2. Create a minimal reproduction if possible.
3. Fix the bug **with a test case** (see [Testing](#testing)).
4. Run `acc check` to ensure no regressions on the ACC repo itself.

### ✨ New Features

1. Open an issue to discuss the feature first.
2. For CLI commands: update `docs/05-cli-commands.md` and `docs/08-json-schema.md`.
3. For diagnostic codes: follow [Adding Diagnostic Codes](#adding-diagnostic-codes).
4. Add tests and documentation in the same PR.

### 📚 Documentation

- Fix typos, clarify explanations, add examples.
- Update the canonical spec files in `docs/`.
- Update `.acc/config/` workflows, agents, and standards if relevant.
- The docs site is built **directly from `docs/`** (the numbered spec files
  are the site's pages — see `docs/.vitepress/config.ts`). There is no
  separate copy to keep in sync:
  ```bash
  cd docs && npm run build
  ```

### 🔧 Diagnostic Codes

See [Adding Diagnostic Codes](#adding-diagnostic-codes) below — this has a
strict stability process.

---

## Pull Request Process

1. **Make your changes** following our [Coding Standards](#coding-standards).

2. **Run the full test suite:**

   ```bash
   node --test 'test/*.test.js'
   ```

3. **Dogfood validation** (the CLI must pass on its own repo):

   ```bash
   node bin/acc.js check
   ```

4. **Verify determinism** (same input → byte-identical output):

   ```bash
   node bin/acc.js graph --json > /tmp/a.json
   node bin/acc.js graph --json > /tmp/b.json
   diff /tmp/a.json /tmp/b.json
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
   - [ ] Deterministic output preserved (no timestamps, no random data)
   - [ ] No breaking changes without a major version bump discussion

8. **Review:** At least one maintainer approval required. Architecture changes
   need maintainer discussion first.

---

## Coding Standards

See [.acc/config/standards/coding.md](./.acc/config/standards/coding.md) for the
detailed standards this repo dogfoods.

**Summary:**
- **JavaScript (CommonJS)**: 2-space indent, `'use strict'`, JSDoc on public
  functions, `const` over `let` where possible
- **No runtime dependencies** for the framework CLI — keep it that way
- **Determinism**: stable sorts, sorted JSON keys, no timestamps or random
  values in command output (memory entries are the only timestamped output)
- **POSIX paths** in all output; relative paths from the project root

---

## Testing

See [.acc/config/standards/testing.md](./.acc/config/standards/testing.md).

**Requirements:**
- Tests use the built-in `node:test` runner — no test framework dependency
- Unit tests for all public functions in `lib/`
- End-to-end tests for CLI commands (see `test/cli.test.js`)
- Determinism tests for JSON output
- Every bug fix ships with a regression test

---

## Documentation

See [docs/10-authoring-guide.md](./docs/10-authoring-guide.md) for `AGENTS.md`
authoring conventions.

**Specification updates:**
- CLI changes → `docs/05-cli-commands.md` + `docs/08-json-schema.md`
- Diagnostic codes → `docs/07-diagnostic-codes.md`
- Architecture → `docs/04-epistemology.md` + `.acc/config/standards/architecture.md`
- All docs use the numbered `NN-name.md` format; keep the index in `docs/README.md` current

---

## Adding Diagnostic Codes

**This is a load-bearing stability contract.** Follow
`.acc/config/workflows/diagnostic.md` exactly:

1. Pick the next available code in the correct category range (see
   `docs/07-diagnostic-codes.md` §2).
2. Fix severity permanently (`error`/`warn`/`info`).
3. Define the exact trigger predicate (repository state only, not agent behavior).
4. Define the JSON `detail` payload shape.
5. Add to the category table in `docs/07-diagnostic-codes.md`.
6. Wire the emission site in the derivation/check pipeline (`lib/diagnostics.js`).
7. Unit test the trigger predicate.
8. Dogfood: `acc check` on the ACC repo — the new code must NOT fire spuriously.
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
- No JSON field removal/type change without a major `schema_version` bump
- No CLI flag renaming
- No diagnostic severity changes
- Hard invariant holds (remove `.acc/` → still a valid agents.md repository)
- No code execution, no network calls
- Deterministic JSON output

**Maintainers** handle version bumping, tagging, and publishing to npm.

---

## Questions?

- Open a [GitHub Discussion](https://github.com/EnzoVezzaro/agents-code-context/discussions)
- Check existing [Issues](https://github.com/EnzoVezzaro/agents-code-context/issues)
- Review the [Documentation](./docs/README.md)

Thank you for contributing to ACC! 🎉
