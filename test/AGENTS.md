# test — test suites

## Purpose

End-to-end and unit tests for the `acc` CLI and the core engine. The
suite is the executable form of the documentation: every command and
every implemented diagnostic code is exercised against the real binary.

## Responsibilities

- `cli.test.js` — end-to-end CLI behavior: init, check, graph, context,
  memory, document, build, fill, inspect, and project-root safety.
- `framework.test.js` — comprehensive command-surface coverage: dispatch,
  every command's flags, and one test per implemented `ACC0xx`
  diagnostic (including git-backed ACC053 and config-failure ACC060).
- `agents.test.js` — heuristic `AGENTS.md` parsing.
- `graph.test.js` — graph derivation (declared/discovered edges, cycles,
  boundary resolution).
- `yaml.test.js` — the minimal YAML-subset config parser.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- The `bin/acc.js` binary and `lib/` modules under test.
- Temporary fixture repositories built at runtime.

## Outputs

- `node --test` results; the `npm test` script runs `test/*.test.js`.

## Dependencies

- bin/ (CLI under test)
- lib/ (engine under test)

## Constraints

- MUST run offline and never touch the network.
- MUST be deterministic and fast (fixtures in `os.tmpdir()`).
- MUST cover every implemented diagnostic code and every command — a
  documented command with no test is a regression waiting to happen.
- Never require real credentials, real repositories, or Docker.

## Architecture

Node's built-in `node:test` runner with zero test dependencies. Tests
shell out to the real CLI (`execFileSync`) so they validate the shipped
surface, not mocks.

## Workflows

- See `.acc/config/workflows/feature.md` — every new command ships with
  its framework test.
- Run `npm test` before committing.
