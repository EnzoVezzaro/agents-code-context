# 01 — Philosophy & Agent-Agnostic Operation

> **The short version:** ACC doesn't own your agent. ACC doesn't replace
> your agent. ACC doesn't even require your agent. ACC just makes your
> repository *easier* for any agent to understand, navigate, modify, and
> validate.
>
> The full story of how I got here (and why "give the agent more context"
> was never the answer) is on [Medium (placeholder)](https://medium.com/PLACEHOLDER).

I'll be honest about where this comes from: a year of building things
with AI agents, and a very specific, very repetitive pain. The agents
were smart. The agents were fast. But every time I started a new session,
I had to explain the same things again — where things live, why a
deceptively simple change would break something else, which file we're
*never* touching. Eventually I stopped blaming the agent and started
blaming the repository. The repository is the thing that's always there.
So the repository should be the thing that carries the context.

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

You don't need a special runtime, a special model, or a special editor
for an ACC-enabled project. Plain and simple:

- No ACC-specific runtime or `acc-agent`
- No ACC-specific LLM wrapper or proprietary API
- No ACC-specific IDE or editor plugin
- No protocol handshake or registration step

An agent clones the repository and understands the framework by reading
standard instruction files (`AGENTS.md`, `.acc-memory.md`). No
installation, no plugin, no proprietary integration. If it can read
Markdown, it can work with ACC.

---

## 2. `AGENTS.md` Is the Primary Agent Interface

`AGENTS.md` is the instruction interface agents already understand. It's
the open convention used by Codex, Claude Code, Cursor, Copilot,
OpenCode, Gemini, and others. The format emerged from collaborative
efforts across the AI coding ecosystem — OpenAI Codex, Amp, Google Jules,
Cursor, and Factory — and is stewarded as a standard by the Agentic AI
Foundation under the Linux Foundation ([agents.md](https://agents.md/)).

ACC follows this convention rather than inventing a competing format.
The framework's operational rules are expressed in plain Markdown that
**any** coding agent can understand:

```markdown
When modifying a functionality:

1. Read its local AGENTS.md.
2. Inspect its .acc-memory.md if present.
3. Understand its graph relationships.
4. Preserve declared invariants.
5. Validate affected functionality after changes.
6. Update durable functionality knowledge when appropriate.
```

An agent that has never heard of ACC still understands these
instructions — they are plain Markdown. There's no secret sauce to
decode, no new format to learn.

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

**The rule that keeps ACC upgrade-proof:** the standard surface is used
exactly as the ecosystem defines it — plain Markdown, no schema, no
required sections, no YAML frontmatter in `AGENTS.md`. Everything
ACC-specific lives in its own namespace (`.acc/` and `.acc-memory.md`),
separated from the standard surface. If the standard evolves, ACC absorbs
the change without breaking existing repositories.

---

## 4. Knowledge Lives Next to Code

This is probably the rule I'm most stubborn about:

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

Central docs have a half-life. Someone moves `src/audio` to
`src/core/audio`, and `audio.md` is now a museum piece that an agent will
confidently read and confidently get wrong.

**Better** (follows the code):

```text
src/audio/
├── player.rs
├── buffer.rs
├── receiver.rs
├── AGENTS.md
└── .acc-memory.md
```

The documentation travels with the functionality. If the functionality
moves:

```bash
git mv src/audio src/core/audio
```

its knowledge and memory move with it. No doc to update, no stale file
to hunt down.

- **Code owns its knowledge.** Instructions and durable memory for a
  functionality live in the same directory as the code.
- **Configuration owns the machinery.** Cross-cutting concerns
  (standards, skills, tooling, orchestration) live in `.acc/config/`.
- Knowledge follows the **functionality boundary**, not the directory
  boundary.

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

ACC also interoperates with the adjacent open standards rather than
reinventing them:

- **Skills** — reusable capabilities are [SKILL.md packages](https://agentskills.io/) (YAML frontmatter + Markdown body). ACC reads skills from the standard `.agents/skills/` location and manages its own under `.acc/config/skills/`, using the same format.
- **MCP** — tool bridges reference standard [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server configurations (`.mcp.json` and agent-native configs). ACC does not define a competing format.
- **`llms.txt`** — ACC leaves project PRD files untouched; they compose freely with ACC's instruction surface (per the [llms.txt](https://llmstxt.org/) convention).

Because the standard surface is never forked, an ACC repository is
always a valid agents.md repository — today and after any future
evolution of the standard.

---

## 6. `.agents/` Has a Specific Role

`.agents/` is **not** a documentation directory. Its role follows the
ecosystem convention:

```text
.agents/
├── AGENTS.md              # Optional project-wide rules (project base tier)
└── skills/                # Optional SKILL.md packages (Agent Skills standard)
```

An agent entering the repository follows standard hierarchical
instruction discovery:

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

An ordinary agent that understands `AGENTS.md` works unchanged. ACC
simply makes the environment richer.

---

## 7. Configuration Remains Centralized

Things that are **not knowledge about the code** stay centralized under
`.acc/`:

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

This is one of those "wait, you don't have to maintain that?" moments.
ACC derives the architecture graph at query time instead of asking you
to maintain one. No `graph.yaml`. No `architecture.json` to keep in
sync. It reads:

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

The agent does not need to read the whole repository. It navigates the
graph:

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

See [03 — Epistemology & Architecture Graph](./03-epistemology.md) for
the graph model and truth categorization.

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

This navigation model MUST work with any capable coding agent. It's not
a nice-to-have; it's the whole point.

---

## 10. Portability Guarantee

If you switch from Cursor today to Claude tomorrow, your project's
accumulated context doesn't disappear. You don't lose your agent's
"memory" because the memory was never the agent's.

**Context lives in the repository** — in `AGENTS.md` (committed) and
`.acc-memory.md` (local, gitignored) — both agent-agnostic and
tool-agnostic.

This is one of the strongest reasons ACC is architected this way:
**context persistence across agents is a property of the repository, not
the agent.**

---

## 11. Technical & Security Constraints

| Constraint | Rule |
|------------|------|
| **Filesystem-first** | Paths and names are canonical references. No arbitrary opaque IDs. |
| **Language-agnostic core** | Core graph logic relies on files, folders, and Markdown. Language analyzers (Rust, TypeScript, Go, Python, etc.) are optional accuracy layers. |
| **No database** | V1 uses an in-memory graph. The repository is the sole source of truth. |
| **Offline-first** | No telemetry, no uploads, no hidden network calls. |
| **Strict security** | Inspection is safe on untrusted repos. Never execute arbitrary code, npm scripts, Makefiles, or build scripts. |

The last row is worth saying out loud: ACC is designed to be safe on
repositories you don't trust. It reads files and derives things — it
never runs your repo's scripts. (That's why `acc tool` / `acc shell`
are explicitly opt-in tooling, not core behavior.)

---

## 12. Dogfooding Requirement

ACC describes itself using ACC. The ACC repository contains:

- `AGENTS.md` contracts for its own modules
- An `.acc/config/` control plane with config, agents, workflows, and standards
- Full navigability using its own CLI commands

This is both a validation of the framework and a reference
implementation: if ACC cannot describe itself, the framework is
over-constrained. And if you want to see ACC in action, this repo is the
demo — everything you're reading is structured the way ACC says
repositories should be.

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

The invariant is load-bearing: it shapes every design decision in the
following documents. Any ACC feature that would violate it is rejected
by specification. It's also your escape hatch — ACC is always optional,
and you can always leave.
