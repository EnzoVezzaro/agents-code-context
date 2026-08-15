# release.md — Release Checklist

Stable contract checklist before publishing an `acc` release. The
hard rules below MUST pass — they are load-bearing for downstream agents
and CI.

## Stability (blocking)

- [ ] No `ACC0xx` diagnostic code was renumbered, renamed, or removed.
- [ ] No JSON field was removed or had its type changed without a
      `schema_version` major bump.
- [ ] No CLI flag was renamed or had its meaning changed.
- [ ] Diagnostic code severities were not changed; new `warn_only`
      overrides are per-project, not global.

## Compatibility (blocking)

- [ ] Removing `.acc/` from a test repo leaves a valid `AGENTS.md`
      repository (the hard invariant).
- [ ] No ACC operation executes code, build scripts, or network calls.
- [ ] `acc init` preserves any existing `AGENTS.md` and `.agents/` content.
- [ ] `.acc-memory.md` remains gitignored by `acc init`.

## Determinism (blocking)

- [ ] `acc context <path> --json` produces byte-identical output across
      runs with the same repo state and flags.
- [ ] JSON object keys are sorted; arrays are sorted per spec.
- [ ] No timestamps, random IDs, or locale-dependent formatting in JSON.

## Smoke

- [ ] `acc check` on the ACC repo itself passes (dogfooding).
- [ ] `acc graph`, `acc context`, `acc inspect`, `acc impact`,
      `acc dependencies`, `acc dependents`, `acc search`, `acc discover`
      all run on the ACC repo without panicking.
- [ ] `--json` output of every command parses and matches the schema in
      docs/07-json-schema.md.

## Documentation

- [ ] docs/ reflects the released CLI surface.
- [ ] Any new diagnostic code is added to docs/06-diagnostic-codes.md.
- [ ] Any new JSON field is added to docs/07-json-schema.md.