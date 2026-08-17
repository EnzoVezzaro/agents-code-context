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

[![Sponsor](https://img.shields.io/github/sponsors/EnzoVezzaro?label=Sponsor&logo=GitHub)](https://github.com/sponsors/EnzoVezzaro)

</div>

ACC is **agent-agnostic**. It installs as a skill any agent can load
(`acc install` targets Claude Code, Codex, Cursor, OpenCode, Gemini
CLI, VS Code agents, and custom agents — the core stays identical, only
the skill's deployment path changes). The repository itself stays
standard: `AGENTS.md` + source. The skill teaches the agent how to
operate on any compatible agents.md repository with the deterministic
CLI and the optional always-on AI engine.

---

## Install ACC as an agent skill

ACC is deployed as an **agent capability**, not a per-repository
framework. The repository stays a standard `AGENTS.md` repository; the
skill teaches any agent how to operate on it deterministically (engine
ON/OFF contract, command surface, workflows).

Two distribution channels, one source: npm distributes the **engine**
(`acc` CLI); the **skill** ships as an Agent Skill from the same GitHub
repository. The canonical skill lives at `skills/acc/` in the ACC repo
— both install paths below read that one file.

### Universal install (Agent Skills standard)

```bash
npx skills add EnzoVezzaro/agents-code-context --skill acc
```

Per agent, or globally (available to every project):

```bash
npx skills add EnzoVezzaro/agents-code-context --skill acc --agent codex
npx skills add EnzoVezzaro/agents-code-context --skill acc --global
```

ACC's skill is just another Agent Skill — installed **into the agent**,
never into the repository.

### Via the CLI (`acc install`)

From the repository itself (needs the `acc` CLI):

```bash
acc install                              # → .agents/skills/acc/SKILL.md (generic)
acc install --agent claude               # → .claude/skills/acc/SKILL.md
acc install --agent opencode             # → .opencode/skills/acc/SKILL.md
```

`acc install` copies the canonical skill **plus its `references/`**
(engine limits, over-feeding) into the target — the same files `npx
skills` publishes.

Once installed, the agent loads ACC from its skill environment: run
`acc tools` for the capability manifest, `acc context`/`acc graph`/`acc
slice` before touching code, and follow the engine ON/OFF workflow in
the skill. See [05 — CLI Commands § acc install](./05-cli-commands.md#acc-install-—-deploy-acc-as-an-agent-skill)
for the full contract.

---

## What ACC is

ACC is **one more agent skill** — a capability deployed into an agent's
skill environment, not a framework layered onto the repository:

```text
Repository                 AI Agent
──────────                 ─────────
AGENTS.md                  skills/acc/
source                     tools/acc
```

The repository stays **standard** (`AGENTS.md` + source). ACC lives on
the agent side and knows how to operate on **any compatible agents.md
repository** — discover, inspect, context, dependencies, boundaries,
search, validate, execute. The project doesn't need to know ACC exists.

Optional per-project conventions ACC understands and can maintain when
present (all removable without breaking anything):

- A **control plane** (`.acc/config/`) for project-specific agents,
  workflows, and standards.
- A **memory layer** (`.acc-memory.md`, gitignored) for durable,
  functionality-local agent knowledge.
- A **deterministic CLI** (`acc` CLI) for context generation, graph
  derivation, validation, and search — plus the always-on AI engine.

## What ACC is not

A few things it intentionally avoids:

- **Not** a competing instruction-file standard. `AGENTS.md` stays
  Markdown.
- **Not** an agent wrapper. No `acc-agent`, no proprietary LLM, no
  ACC-specific runtime required for basic compliance.
- **Not** a database or opaque store. The repository is the sole source
  of truth; V1 uses an in-memory graph.
- **Not** online. No telemetry, no uploads, no hidden network calls.
- **Not** a per-repository framework. A repository never "must have
  `.acc/`" — ACC is a capability of the agent that works against any
  agents.md repository.

## The hard invariant (compatibility)

> **Any agents.md repository + an agent with the ACC skill installed =
> fully navigable.**
> Removing the skill (or the CLI) MUST leave a perfectly valid agents.md
> repository. The repository never depends on ACC.

ACC augments standard conventions; it never replaces them. Think of ACC
as a tool the agent carries — the repository is just a house that
already has rooms, doors, and `AGENTS.md` on the wall.

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
| [13 — Security Model](./13-security.md) | What ACC guarantees (offline, no code execution, path boundary), what it reads/writes, untrusted input. |

**Where to start:** if you only read one thing, make it
[01 — Philosophy](./01-philosophy.md). It’s the *why*; the rest of the
docs are the *how*.

---

## Benchmarks & limits

- **Engine limits (measured)** — hard budgets on the AI phase and the
  live degradation/contribution/graph-size numbers:
  [05 — CLI Commands § Engine limits](./05-cli-commands.md#engine-limits-measured).
- **The over-feeding problem** — why ACC never feeds the whole
  repository to a model, and the structural answer (routing index +
  per-scope context + budgets + trigger gating):
  [04 — Epistemology](./04-epistemology.md#the-over-feeding-problem-and-how-acc-avoids-it).
- **Live benchmark run** — `docs/benchmarks/engine-2026-08-17.md`
  (NVIDIA NIM, nemotron nano; re-run anytime with
  `npm run benchmark:engine`).

---

## How an agent enters an ACC project

It’s a simple walk — the same walk any agent already does with `AGENTS.md`:

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
stuff agents already read. ACC makes that walk from *"I need to change
something"* to *"I understand what I'm changing"* a lot shorter.

---

<div align="center">

*made with ❤️ from 🇩🇴*

</div>
