# scripts — developer tooling

## Purpose

Repo-local developer scripts: release and version automation that keeps
`package.json` as the single source of truth for the ACC version.

## Responsibilities

- `bump-version.mjs` — bump the version in `package.json` (and cut the
  CHANGELOG `[Unreleased]` section) so the docs site, which reads the
  version from `package.json` at build time, always matches the release.
- Stay zero-dependency: plain Node scripts, no install step.

## Ownership

Owner: EnzoVezzaro/agents-code-context

## Dependencies

- bin/ (the version shown by `acc --version` comes from `package.json`, which this script updates)
- docs/ (the docs build reads the version from `package.json` at build time)

## Constraints

- MUST NOT drift from `package.json`; the docs build reads the version
  from there (`docs/.vitepress/config.ts` injects `__ACC_VERSION__`).
- MUST keep the `npm run bump -- <version>` interface stable; the Release
  workflow (`.github/workflows/release.yml`) expects the version to be
  verified against `package.json`.
- MUST NOT require a database, network, or any ACC-specific runtime.
