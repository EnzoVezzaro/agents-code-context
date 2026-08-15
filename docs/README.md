# ACC — Agent Code Context

> A convention + tooling layer that makes any software repository
> agent-native, navigable, declarative, graph-oriented, and self-describing
> — **without** requiring an ACC-specific agent.

ACC is **agent-agnostic**. The repository itself communicates the
framework through standard, agent-readable files (`AGENTS.md`,
`.acc/config/`, `.acc-memory.md`). Any coding agent — Codex, Claude
Code, Cursor, OpenCode, Gemini, local agents, future agents — can enter
an ACC-enabled project and naturally follow the framework just by
reading files, running commands, and editing code.

The ACC CLI is an **optional deterministic accelerator**, not a
prerequisite for understanding a project.

---

## What ACC is

- A **convention** layered on the existing `AGENTS.md` ecosystem.
- A **control plane** (`.acc/config/`) for project-specific agents,
  workflows, and standards.
- A **memory layer** (`.acc-memory.md`, gitignored) for durable,
  functionality-local agent knowledge.
- A **tooling layer** (`acc` CLI) for deterministic context generation,
  graph derivation, validation, and search.

## What ACC is not

- **Not** a competing instruction-file standard. `AGENTS.md` stays
  Markdown.
- **Not** an agent wrapper. No `acc-agent`, no proprietary LLM, no
  ACC-specific runtime required for basic compliance.
- **Not** a database or opaque store. The repository is the sole source
  of truth; V1 uses an in-memory graph.
- **Not** online. No telemetry, no uploads, no hidden network calls.

## The hard invariant (compatibility)

> **Repository + `AGENTS.md` + `.acc/` = ACC-enhanced.**
> Removing `.acc/` (and `.acc-memory.md`, and `acc` itself) MUST leave
> a perfectly valid agents.md repository.

ACC augments standard conventions; it never replaces them.

---

## Documentation index

| Document | Scope |
|---|---|
| [01 — Philosophy & Agent-Agnostic Operation](./01-philosophy.md) | Core principles, why ACC, what it guarantees. |
| [02 — Repository Structure](./02-repository-structure.md) | `AGENTS.md`, `.acc/config/`, `.acc-memory.md`, dogfooding layout. |
| [03 — Epistemology & Architecture Graph](./03-epistemology.md) | Declared / Discovered / Inferred truth, derived graph, ownership. |
| [04 — CLI Command Specification](./04-cli-commands.md) | The `acc` CLI: every command, flags, stable diagnostic codes. |
| [05 — Context Engine](./05-context-engine.md) | `acc context`, progressive depth, provenance, output contract. |
| [06 — Diagnostic Codes](./06-diagnostic-codes.md) | `ACC0xx` codes, severity, stability contract. |
| [07 — JSON Output Schema](./07-json-schema.md) | Deterministic, versioned JSON contract for every command. |
| [08 — Memory Semantics](./08-memory-semantics.md) | `.acc-memory.md`: lifecycle, format, read/write rules. |
| [09 — AGENTS.md Authoring Guide](./09-authoring-guide.md) | How to write functional `AGENTS.md`, sections, cross-references. |
| [10 — Multi-Agent Orchestration](./10-multi-agent-orchestration.md) | Graph-driven partitioning, dynamic concurrency, isolation, handoff. |
| [11 — Tooling Subsystem](./11-tooling.md) | Automatic tool detection, plugins, permissions, capability discovery. |

---

## How an agent enters an ACC project

```text
AGENTS.md
    ↓
.agents/AGENTS.md (if present)
    ↓
functionality/
    ↓
functionality/AGENTS.md
    ↓
functionality/.acc-memory.md
    ↓
source
    ↓
graph (acc graph)
```

This navigation model works with **any** capable coding agent, with or
without the `acc` CLI installed.
