---
layout: home

hero:
  name: ACC
  text: Agent Code Context
  tagline: A framework and CLI that makes any repository agent-native, navigable, and self-describing — without requiring an ACC-specific agent.
  actions:
    - theme: brand
      text: What is ACC?
      link: /philosophy
    - theme: alt
      text: CLI reference
      link: /cli-commands

features:
  - title: Agent-agnostic
    details: No ACC-specific agent, wrapper, or runtime. Any coding agent reads AGENTS.md and follows the framework as plain Markdown.
  - title: agents.md compliant
    details: Built as a strict superset of the AGENTS.md standard — root and nested files, plain Markdown, nearest file wins. ACC never forks the standard.
  - title: Derived graph
    details: The architecture graph is computed on demand — declared in AGENTS.md, discovered from code. No hand-maintained graph file to go stale.
  - title: Deterministic CLI
    details: acc context, acc check, acc graph and friends produce byte-identical output for the same repository state. Stable ACC0xx diagnostics.
  - title: Durable memory
    details: .acc-memory.md files capture agent-learned knowledge — gotchas, decisions, tried-and-rejected — without polluting committed contracts.
  - title: Offline & safe
    details: No telemetry, no uploads, no executed scripts. Safe to run on untrusted repositories.
---
