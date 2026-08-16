---
name: Feature request
about: Suggest a new command, flag, or behavior for ACC
title: "[feat] "
labels: ["enhancement"]
assignees: []
---

## Problem

<!-- What are you trying to do that ACC can't do today? The concrete
     situation matters more than the proposed solution. -->

## Proposed behavior

<!-- What should `acc <something>` do? Describe the command, its flags,
     and the output you'd expect (terminal and --json). -->

## Does it touch a contract?

- [ ] JSON output / `schema_version` (docs/08-json-schema.md)
- [ ] Diagnostic codes (`ACC0xx`, docs/07-diagnostic-codes.md)
- [ ] The `AGENTS.md` convention itself
- [ ] The `.acc/config/` control plane
- [ ] None of the above

<!-- Contract changes need a version-bump discussion — see the release
     workflow (.acc/config/workflows/release.md). Never propose reusing a
     diagnostic code or renumbering an existing one. -->

## Additional context

<!-- Links, related issues, sketches, motivating examples. -->
