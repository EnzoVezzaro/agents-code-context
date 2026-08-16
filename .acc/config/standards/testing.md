# testing.md — ACC Testing Standards

This standard defines testing conventions for the ACC project.

## Test Organization

- **Unit tests**: Co-located with source (`src/**/*_test.rs`, `*.test.ts`, `*_test.go`, `test_*.py`).
- **Integration tests**: `tests/` directory at project root.
- **Fixtures**: `tests/fixtures/` for sample repositories.

## Test Categories

| Category | Command | Purpose |
|----------|---------|---------|
| Unit | `cargo test`, `npm test`, `go test`, `pytest` | Fast, isolated logic tests. |
| Integration | `cargo test --test integration` | Full CLI command tests. |
| Dogfooding | `acc check` on ACC repo | Framework validates itself. |
| Determinism | Custom | Byte-identical JSON across runs. |

## Test Requirements

### All Code

- Unit tests for all public functions and CLI command handlers.
- Edge cases: empty input, invalid input, boundary conditions.
- Error paths tested (not just happy path).

### CLI Commands

- Test every flag combination documented in specs.
- Test `--json` output matches schema (docs/08-json-schema.md).
- Test exit codes: 0 (success), 1 (diagnostics), 2 (usage), 3 (panic).
- Test determinism: same input → byte-identical output.

### Graph Derivation

- Test declared/discovered/inferred edge resolution.
- Test truth resolution (declared wins).
- Test ownership conflict detection.
- Test multi-language analyzer scenarios.

### Context Engine

- Test progressive depth (0, 1, 2, N).
- Test `--include`/`--exclude` filtering.
- Test `--max-bytes` truncation behavior.
- Test provenance on every output item.

### Diagnostics

- Test every `ACC0xx` code fires on its trigger condition.
- Test severity filtering (`--severity`).
- Test `warn_only` config override.
- Test JSON `detail` payload shape.

## CI Pipeline

```yaml
# Pseudocode for CI stages
stages:
  - lint:        # cargo clippy, eslint, golangci-lint, ruff
  - test:        # cargo test, npm test, go test, pytest
  - dogfood:     # acc check on ACC repo
  - schema:      # validate JSON outputs against schema
  - determinism: # run acc context twice, diff output
```

## Coverage Targets

- Overall: ≥ 80% line coverage.
- Critical paths (graph derivation, context engine): ≥ 90%.
- New code: ≥ 90% for modified files.

## Test Data

- Use real fixture repositories in `tests/fixtures/`.
- Fixtures cover: simple, nested, cyclic, multi-language, edge cases.
- Fixtures are versioned with the code; update when derivation changes.