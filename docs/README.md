# ACC — Agent Code Context

> A convention + tooling layer that makes any software repository
> agent-native, navigable, declarative, graph-oriented, and self-describing
> — **without** requiring an ACC-specific agent.

If you've ever spent an afternoon telling an AI coding agent things like
*"no, that module exists because of the reentrancy thing"* or *"please stop
touching that file"*, you already know the problem ACC tries to solve.
Here's the TLDR of how I got here:

> I spent a year building things side-by-side with AI agents. The agents
> could write an absurd amount of code. The problem was never that they
> weren't smart — it was that they didn't know *my* project. I kept
> explaining the same decisions, over and over, to every new session.
> ACC is what happened when I got tired of explaining. **The knowledge
> belongs to the project — so let it live with the project.**
>
> [Medium — the full story: Markdown Is All You Need, So I Built ACC](https://medium.com/@enzovezzaro/markdown-is-all-you-need-so-i-built-acc-6f9f7283b758)
> (see also: ["Markdown Is All You Need" — the readings](./02-markdown-is-all-you-need.md))

<div align="center">

<iframe src="https://github.com/sponsors/EnzoVezzaro/button" title="Sponsor EnzoVezzaro" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>

</div>

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
| [02 — "Markdown Is All You Need"](./02-markdown-is-all-you-need.md) | The readings behind ACC, and where ACC takes the conversation further. |
| [03 — Repository Structure](./03-repository-structure.md) | `AGENTS.md`, `.acc/config/`, `.acc-memory.md`, dogfooding layout. |
| [04 — Epistemology & Architecture Graph](./04-epistemology.md) | Declared / Discovered / Inferred truth, derived graph, ownership. |
| [05 — CLI Command Specification](./05-cli-commands.md) | The `acc` CLI: every command, flags, stable diagnostic codes. |
| [06 — Context Engine](./06-context-engine.md) | `acc context`, progressive depth, provenance, output contract. |
| [07 — Diagnostic Codes](./07-diagnostic-codes.md) | `ACC0xx` codes, severity, stability contract. |
| [08 — JSON Output Schema](./08-json-schema.md) | Deterministic, versioned JSON contract for every command. |
| [09 — Memory Semantics](./09-memory-semantics.md) | `.acc-memory.md`: lifecycle, format, read/write rules. |
| [10 — AGENTS.md Authoring Guide](./10-authoring-guide.md) | How to write functional `AGENTS.md`, sections, cross-references. |
| [11 — Multi-Agent Orchestration](./11-multi-agent-orchestration.md) | Graph-driven partitioning, dynamic concurrency, isolation, handoff. |
| [12 — Tooling Subsystem](./12-tooling.md) | Automatic tool detection, plugins, permissions, capability discovery. |
| [13 — Security Model](./13-security.md) | What ACC guarantees (offline, no code execution, path boundary), what it reads/writes, untrusted input. |

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
