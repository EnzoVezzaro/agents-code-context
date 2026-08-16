# bin — CLI entry point

## Purpose

The `acc` command-line entry point: argument dispatch, global flag
handling, reserved-command routing, and exit-code enforcement.

## Responsibilities

- Dispatch `argv` to the correct command module in `lib/commands/`.
- Handle global flags (`--json`, `--root`, `--quiet`) before command parsing.
- Render the deterministic JSON envelope (`schema_version`, `command`,
  `acc_version`, `root`, `result`) via `lib/output.js`.
- Enforce the exit-code contract: `0` success, `1` ACC error, `2` usage
  error, `3` panic (docs/05).
- Print top-level help and version; route per-command `--help` to that
  command's usage line.
- Report reserved commands (`tool`, `shell`, `agents`) as future work
  without erroring.
- Forward `acc battle` to the standalone ABA child process and mirror its
  exit code.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Inputs

- `process.argv` from the caller.

## Outputs

- Terminal prose, or the JSON envelope on `--json`.
- Exit codes per the contract above.

## Dependencies

- lib/ (core engine and command modules)

## Constraints

- MUST NOT execute arbitrary code or perform network access.
- MUST keep `--json` output deterministic (sorted keys, no timestamps).
- MUST exit `2` on unknown commands/options and `1` on ACC errors.
- MUST stay dependency-free at runtime (Node built-ins only).

## Architecture

Thin dispatcher: extract global flags → resolve project root → load
config → parse remaining args → run the command module → render output →
exit. Command modules own their semantics; this file owns the envelope
and the exit codes.

## Workflows

- See `.acc/config/workflows/feature.md` for adding a new command.
- See `.acc/config/workflows/release.md` for the release checklist.
