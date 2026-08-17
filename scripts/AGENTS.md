# scripts — developer tooling

## Purpose

Repo-local developer scripts: release, version, and consistency
automation. `package.json` is the single source of truth for the ACC
version; every other version-bearing manifest and every installed skill
copy must agree with it — the scripts below enforce that.

## Responsibilities

- `bump-version.mjs` — bump the version in `package.json` (and cut the
  CHANGELOG `[Unreleased]` section) so the docs site, which reads the
  version from `package.json` at build time, always matches the release.
- `check-versions.js` — verify every version-bearing host manifest
  (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
  `gemini-extension.json`, `plugin.json`, `plugin.yaml`) agrees with
  `package.json`. Run in CI before a release; a manifest that went
  stale together with the others is exactly what this catches.
- `check-skill-copies.js` — verify every installed copy of the skill
  (`.agents/skills/acc`, `.claude/skills/acc`, ...) is byte-identical
  to the canonical `skills/acc/` source (modulo the `__ACC_VERSION__`
  placeholder). Run after editing `skills/acc/` — the install step is a
  copy, not a link, so copies drift if nobody checks.
- `benchmark-engine.cjs` / `test-metrics.mjs` — engine benchmarks and
  the test metrics report.
- Stay zero-dependency: plain Node scripts, no install step.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Dependencies

- bin/ (the version shown by `acc --version` comes from `package.json`, which this script updates)
- docs/ (the docs build reads the version from `package.json` at build time)
- skills/acc/ (the canonical skill that `check-skill-copies.js` guards)
- The host adapter manifests (`plugin.json`, `plugin.yaml`,
  `.claude-plugin/`, `.codex-plugin/`, `.grok-plugin/`,
  `gemini-extension.json`) — guarded by `check-versions.js`.

## Constraints

- MUST NOT drift from `package.json`; the docs build reads the version
  from there (`docs/.vitepress/config.ts` injects `__ACC_VERSION__`).
- MUST keep the `npm run bump -- <version>` interface stable; the Release
  workflow (`.github/workflows/release.yml`) expects the version to be
  verified against `package.json`.
- MUST NOT require a database, network, or any ACC-specific runtime.
