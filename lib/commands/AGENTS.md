# lib/commands — command modules

## Purpose

One module per `acc` command. Each module owns its flags, behavior, and
result shape; the dispatcher in `bin/acc.js` owns the envelope and exit
codes.

## Responsibilities

- Implement the documented command surface (per the CLI command spec):
  `init`, `check`,
  `inspect`, `context`, `graph`, `dependencies`, `dependents`, `impact`,
  `search`, `discover`, `document`, `build`, `fill`, `memory`, `tools`,
  `battle`.
- Validate their own args (unknown options → usage error, exit `2`).
- Return `{ result }` for `--json`, `{ text }` for terminal output, and
  `{ error, exit }` for failures.
- Keep terminal output and JSON output consistent with each other.
- Never modify the repository except where explicitly documented
  (`init`, `build --yes`, `document --apply`, `discover --apply`,
  `memory add/clear`).

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- Parsed argv (`{ positionals, values, unknown }`) and the context
  (`root`, `config`, flags).

## Outputs

- Command results consumed by `bin/acc.js` for rendering.

## Dependencies

- lib/ (core engine: graph, diagnostics, config, memory, output, util)
- lib/templates.js (conservative AGENTS.md + config templates)

## Constraints

- MUST be offline and side-effect-free unless the command's documented
  behavior says otherwise.
- MUST return usage errors (`exit 2`) for unknown options and invalid
  values, ACC errors (`exit 1`) for repository-level failures.
- MUST emit stable `ACC0xx` codes and deterministic JSON.
- Dry-run must be the default for anything that writes
  (`build`, `document`, `discover`).

## Architecture

Flat module map: one file per command (plus `relations.js` sharing the
traversal logic for `dependencies`/`dependents`/`impact`). All modules
are pure functions of `(argv, ctx)`.

## Workflows

- See `.acc/config/workflows/feature.md` for adding a new functionality.
- See `.acc/config/workflows/diagnostic.md` for adding a diagnostic code.
