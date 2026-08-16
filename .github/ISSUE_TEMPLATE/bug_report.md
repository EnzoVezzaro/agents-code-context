---
name: Bug report
about: Something isn't working the way the docs say it should
title: "[bug] "
labels: ["bug"]
assignees: []
---

<!-- Thanks for taking the time to report this. A great bug report includes
     the exact command, the exact output, and the environment. -->

## Command / context

```bash
acc <command> <args>
```

## Expected behavior

<!-- What the docs (docs/05-cli-commands.md) say should happen. -->

## Actual behavior

<!-- Paste the real output. If it's JSON, paste it as-is — no paraphrasing. -->

## Reproduction

<!-- The smallest repo layout that triggers it. A few files and an
     AGENTS.md usually suffice. If it only happens on a specific repo,
     describe the structure (paths matter — no need to paste private code). -->

## Environment

- OS: <!-- e.g. macOS 14, Ubuntu 22.04, Windows 11 -->
- Node: <!-- `node --version` -->
- acc version: <!-- `acc --version` -->
- `acc check` on the affected repo: <!-- paste the output, even if clean -->

## Is this a diagnostic-code issue?

- [ ] A documented `ACC0xx` code is not emitted where the docs say it should be
- [ ] An undocumented or wrong code is emitted
- [ ] Not sure

<!-- If you checked a box, name the code and where it's documented
     (docs/07-diagnostic-codes.md). -->
