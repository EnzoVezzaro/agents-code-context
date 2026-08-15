# 01 — Philosophy & Agent-Agnostic Operation

## Core Principle

> **ACC does not own the agent.**
> **ACC does not replace the agent.**
> **ACC does not require the agent.**
> **ACC makes the repository easier for any agent to understand, navigate, modify, and validate.**

The ideal result:

```text
Any capable coding agent
    +
Any ACC-enabled repository
    =
Natural development with persistent, structured project context
```

---

## 1. No Wrapper Requirement

An ACC-enabled project **MUST NOT** require any of the following for basic framework compliance:

- An ACC-specific runtime or `acc-agent`
- An ACC-specific LLM wrapper or proprietary API
- An ACC-specific IDE or editor plugin
- A protocol handshake or registration step

An agent clones the repository and understands the framework by reading standard instruction files (`AGENTS.md`, `.acc-memory.md`). No installation, no plugin, no proprietary integration.

---

## 2. `AGENTS.md` Is the Primary Agent Interface

`AGENTS.md` is the primary instruction interface. It is the open convention used by Codex, Claude Code, Cursor, Copilot, OpenCode, Gemini, and others, and is stewarded as a standard by the Agentic AI Foundation under the Linux Foundation ([agents.md](https://agents.md/)).

ACC follows this convention rather than inventing a competing format. The framework's operational rules are expressed in plain Markdown that **any** coding agent can understand:

```markdown
When modifying a functionality:

1. Read its local AGENTS.md.
2. Inspect its .acc-memory.md if present.
3. Understand its graph relationships.
4. Preserve declared invariants.
5. Validate affected functionality after changes.
6. Update durable functionality knowledge when appropriate.
```

An agent that has never heard of ACC still understands these instructions — they are plain Markdown.

---

## 3. ACC Is a Strict Superset of the AGENTS.md Standard

ACC adds a thin layer on top of the standard without forking it:

| Layer | Artifact | Purpose | Standard? |
|-------|----------|---------|-----------|
| **Instructions** | `AGENTS.md` (root + nested) | Primary agent interface, nearest file wins | agents.md standard |
| **Project-wide rules** | `.agents/AGENTS.md` (optional) | Inherited project base rules | agents.md ecosystem convention |
| **Local contracts** | `functionality/AGENTS.md` | Functionality-scoped declarations | agents.md standard |
| **Durable memory** | `functionality/.acc-memory.md` | Agent-written, gitignored knowledge | ACC-only |
| **Control plane** | `.acc/config/` | Project config, agents, workflows, standards | ACC-only |
| **Deterministic tooling** | `acc` CLI | Graph derivation, context, validation, search | ACC-only |

**The rule that keeps ACC upgrade-proof:** the standard surface is used exactly as the ecosystem defines it — plain Markdown, no schema, no required sections, no YAML frontmatter in `AGENTS.md`. Everything ACC-specific lives in its own namespace (`.acc/` and `.acc-memory.md`), separated from the standard surface. If the standard evolves, ACC absorbs the change without breaking existing repositories.

---

## 4. Knowledge Lives Next to Code

**A fundamental ACC rule:**

> **Never create a central description of something that can be described next to the thing itself.**

**Bad** (centralized, eventually becomes stale):

```text
.agents/
├── audio.md
├── networking.md
├── authentication.md
├── database.md
└── ...
```

**Better** (follows the code):

```text
src/audio/
├── player.rs
├── buffer.rs
├── receiver.rs
├── AGENTS.md
└── .acc-memory.md
```

The documentation travels with the functionality. If the functionality moves:

```bash
git mv src/audio src/core/audio
```

its knowledge and memory move with it.

- **Code owns its knowledge.** Instructions and durable memory for a functionality live in the same directory as the code.
- **Configuration owns the machinery.** Cross-cutting concerns (standards, skills, tooling, orchestration) live in `.acc/config/`.
- Knowledge follows the **functionality boundary**, not the directory boundary.

An agent entering `src/audio/` immediately gets, in one place:

```text
code
+
instructions
+
architecture
+
relationships
+
memory
+
standards
```

---

## 5. The Standard Surface: agents.md Compatibility

ACC is built on the agents.md standard and uses it verbatim:

- **Root `AGENTS.md`** — project-wide instructions (the standard's canonical file).
- **Nested `AGENTS.md` files** — each functionality directory may carry one; the nearest file wins (the standard's inheritance model).
- **Plain Markdown, no schema** — no required sections, no frontmatter, no decorators. ACC parses heuristically and never requires structure.
- **Optional `.agents/AGENTS.md`** — project base rules inherited by every agent, following the ecosystem convention for the `.agents/` directory.

ACC also interoperates with the adjacent open standards rather than reinventing them:

- **Skills** — reusable capabilities are [SKILL.md packages](https://agentskills.io/) (YAML frontmatter + Markdown body). ACC reads skills from the standard `.agents/skills/` location and manages its own under `.acc/config/skills/`, using the same format.
- **MCP** — tool bridges reference standard MCP server configurations (`.mcp.json` and agent-native configs). ACC does not define a competing format.
- **`llms.txt`** — ACC leaves project PRD files untouched; they compose freely with ACC's instruction surface.

Because the standard surface is never forked, an ACC repository is always a valid agents.md repository — today and after any future evolution of the standard.

---

## 6. `.agents/` Has a Specific Role

`.agents/` is **not** a documentation directory. Its role follows the ecosystem convention:

```text
.agents/
├── AGENTS.md              # Optional project-wide rules (project base tier)
└── skills/                # Optional SKILL.md packages (Agent Skills standard)
```

An agent entering the repository follows standard hierarchical instruction discovery:

```text
.agents/AGENTS.md
        ↓
project-wide rules

src/audio/AGENTS.md
        ↓
audio rules

src/audio/player.rs
        ↓
implementation
```

An ordinary agent that understands `AGENTS.md` works unchanged. ACC simply makes the environment richer.

---

## 7. Configuration Remains Centralized

Things that are **not knowledge about the code** stay centralized under `.acc/`:

```text
.acc/
└── config/
    ├── config.yaml        # Framework configuration (optional, defaults apply)
    ├── agents/            # Agent profiles
    ├── workflows/         # Reusable procedures
    ├── standards/         # Project standards
    ├── skills/            # ACC-managed skills (SKILL.md packages)
    ├── mcp/               # MCP bridge definitions
    ├── tools/             # Tool plugins
    └── multi-agent/       # Orchestration configuration
```

### The Clean Distinction

| Location | Purpose |
|----------|---------|
| `AGENTS.md` (root + nested) | Standard agent instructions |
| `.agents/AGENTS.md` (optional) | Project-wide rules (standard) |
| `.agents/skills/` (optional) | Standard skill packages |
| Code folder | Functionality knowledge |
| `*/.acc-memory.md` | Local persistent agent memory |
| `.acc/config/` | ACC-specific configuration |

> **Knowledge follows the code. Configuration follows ACC. The graph connects them.**

---

## 8. The Graph Emerges from the Repository

ACC derives the architecture graph at query time instead of asking the developer to maintain one:

```text
imports
dependencies
references
AGENTS.md
functionality documentation
metadata
tests
standards
skills
MCP capabilities
```

The agent does not need to read the whole repository. It navigates the graph:

```text
Task
 ↓
Functionality
 ↓
Relevant folder
 ↓
AGENTS.md
 ↓
Relevant files
 ↓
Dependencies
 ↓
Related functionality
 ↓
Memory
 ↓
Standards
 ↓
Implementation
```

See [03 — Epistemology & Architecture Graph](./03-epistemology.md) for the graph model and truth categorization.

---

## 9. Universal Entry Point

The universal entry point for an agent is the repository itself:

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

This navigation model MUST work with any capable coding agent.

---

## 10. Portability Guarantee

If a user switches from Cursor today to Claude tomorrow, the project's accumulated context does not disappear.

**Context lives in the repository** — in `AGENTS.md` (committed) and `.acc-memory.md` (local, gitignored) — both agent-agnostic and tool-agnostic.

This is one of the strongest reasons ACC is architected this way: **context persistence across agents is a property of the repository, not the agent.**

---

## 11. Technical & Security Constraints

| Constraint | Rule |
|------------|------|
| **Filesystem-first** | Paths and names are canonical references. No arbitrary opaque IDs. |
| **Language-agnostic core** | Core graph logic relies on files, folders, and Markdown. Language analyzers (Rust, TypeScript, Go, Python, etc.) are optional accuracy layers. |
| **No database** | V1 uses an in-memory graph. The repository is the sole source of truth. |
| **Offline-first** | No telemetry, no uploads, no hidden network calls. |
| **Strict security** | Inspection is safe on untrusted repos. Never execute arbitrary code, npm scripts, Makefiles, or build scripts. |

---

## 12. Dogfooding Requirement

ACC MUST describe itself using ACC. The ACC repository contains:

- `AGENTS.md` contracts for its own modules
- An `.acc/config/` control plane with config, agents, workflows, and standards
- Full navigability using its own CLI commands

This is both a validation of the framework and a reference implementation: if ACC cannot describe itself, the framework is over-constrained.

---

## 13. The Hard Invariant (Technical Restatement)

Formally:

```text
ACC-enhanced  =  Repository  +  AGENTS.md  +  .acc/
```

```text
remove(.acc/)    →  valid agents.md repository  (still usable by any agent)
remove(acc CLI)  →  valid agents.md repository  (still usable by any agent)
```

```text
remove(AGENTS.md)  →  ordinary repository  (ACC offers no added value here)
```

The invariant is load-bearing: it shapes every design decision in the following documents. Any ACC feature that would violate it is rejected by specification.
