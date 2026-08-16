# ACC — Agent Code Context

> A convention + tooling layer that makes any software repository
> agent-native, navigable, declarative, graph-oriented, and self-describing
> — **without** requiring an ACC-specific agent.

If you've ever spent an afternoon telling an AI coding agent things like
*"no, that module exists because of the reentrancy thing"* or *"please stop
touching that file"*, you already know the problem ACC tries to solve.
Here's the short version of how I got here:

> I spent a year building things side-by-side with AI agents. The agents
> could write an absurd amount of code. The problem was never that they
> weren't smart — it was that they didn't know *my* project. I kept
> explaining the same decisions, over and over, to every new session.
> ACC is what happened when I got tired of explaining. **The knowledge
> belongs to the project — so let it live with the project.**
>
> [Medium — the full story (placeholder)](https://medium.com/PLACEHOLDER)

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

ACC augments standard conventions; it never replaces them. Think of ACC
as furniture you can move into a house you already live in — take the
furniture out and the house is still exactly the same house.

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

**Where to start:** if you only read one thing, make it
[01 — Philosophy](./01-philosophy.md). It's the *why*; the rest of the
docs are the *how*.

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
without the `acc` CLI installed. It's just files and Markdown — the same
stuff agents already read. ACC simply makes the walk from *"I need to
change something"* to *"I understand what I'm changing"* a lot shorter.
