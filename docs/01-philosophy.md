# 01 — Philosophy & Agent-Agnostic Operation

## Core principle

> ACC does not own the agent.
> ACC does not replace the agent.
> ACC does not require the agent.
> ACC makes the repository easier for **any** agent to understand,
> navigate, modify, and validate.

The ideal result:

```text
Any agent
    +
Any ACC-enabled repository
    =
Natural development with persistent project context.
```

---

## 1. No wrapper requirement

An ACC-enabled project MUST NOT require:

- `acc-agent`
- an ACC-specific LLM wrapper
- a proprietary API
- an ACC-specific IDE
- an ACC-specific runtime

for basic framework compliance.

An agent clones the repository and understands the framework by reading
the repository's standard instruction files. No installation step,
no plugin, no protocol handshake.

---

## 2. `AGENTS.md` is the primary agent interface

`AGENTS.md` remains the primary instruction interface.

ACC follows the established `AGENTS.md` convention rather than inventing
a competing instruction format. The framework's operational rules are
expressed in `AGENTS.md` in language that **any** coding agent can
understand:

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
instructions — they are plain Markdown.

---

## 3. ACC is a convention + tooling layer

The framework consists of:

- standard agent instructions (`AGENTS.md`)
- functionality-local documentation (`functionality/AGENTS.md`)
- functionality-local memory (`functionality/.acc-memory.md`)
- project-level `.agents/.acc/` configuration
- deterministic ACC tooling (`acc` CLI)

The agent is free to interact with these through filesystem operations,
shell commands, standard tools, or ACC CLI commands. **No proprietary
integration is required.**

---

## 4. Self-describing project

An ACC-enabled project MUST be understandable by an agent even if:

- ACC is not installed
- the agent has never used ACC
- the agent does not support ACC-specific tools

The repository MUST contain enough standard documentation for the agent
to understand:

- project structure
- functionality boundaries
- local instructions
- architectural constraints
- expected workflow
- memory semantics

ACC enhances this understanding but does not monopolize it.

---

## 5. Optional ACC tooling

ACC MAY provide optimized tools:

- `acc context` — optimized context representation
- `acc graph` — derived architecture graph
- `acc inspect` — path-level inspection
- `acc check` — deterministic validation
- `acc memory` — memory operations
- `acc impact` — blast-radius analysis
- `acc dependencies` / `acc dependents`
- `acc search`
- `acc discover`
- `acc document`

An agent MAY use these when available. Their absence MUST NOT make the
repository unintelligible. The standard fallback remains:

```text
read AGENTS.md
inspect source
inspect documentation
inspect .acc-memory.md
inspect project structure
```

---

## 6. Agent automatic behavior

The project's `AGENTS.md` SHOULD instruct compatible agents to follow
the framework automatically. The agent should naturally:

1. discover the relevant functionality
2. read its instructions
3. read its `.acc-memory.md`
4. inspect relevant source
5. understand relationships
6. make changes
7. validate changes
8. update relevant documentation/memory

The user SHOULD NOT need to know the ACC workflow.

---

## 7. ACC CLI as deterministic accelerator

The `acc` CLI provides deterministic operations that make the framework
faster and more reliable.

`acc context <path>` may provide an optimized representation of
information an agent could otherwise discover manually.
`acc check` provides deterministic validation.

The CLI is an **accelerator and validator**, not the sole mechanism
through which agents understand the project.

---

## 8. Agent compatibility principle

ACC MUST prefer existing agent conventions over proprietary conventions.

If an established agent standard can represent a requirement, ACC SHOULD
use that standard. ACC SHOULD NOT require agents to learn a new protocol
merely to understand an ACC-enabled repository.

New ACC-specific metadata SHOULD augment standard conventions rather
than replace them.

---

## 9. Universal entry point

The universal entry point for an agent is the repository itself.

```text
AGENTS.md
    ↓
.agents/.acc/
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

## 10. Portability guarantee

If a user switches from Cursor today to Claude tomorrow, the project's
accumulated context does not disappear. Context lives in the repository
and in `.acc-memory.md` — both are agent-agnostic and tool-agnostic.

This is one of the strongest reasons ACC is architected this way:
**context persistence across agents** is a property of the repository,
not the agent.

---

## 11. Technical & security constraints

| Constraint | Rule |
|---|---|
| Filesystem-first | Paths and names are canonical references. No arbitrary opaque IDs. |
| Language-agnostic core | Core graph logic relies on files, folders, and Markdown. Language analyzers (Rust, TS, Go) are optional abstraction layers to improve accuracy. |
| No database | V1 uses an in-memory graph. The repository is the sole source of truth. |
| Offline-first | No telemetry, no uploads, no hidden network calls. |
| Strict security | Inspection is safe on untrusted repos. Never execute arbitrary code, npm scripts, Makefiles, or build scripts. |

---

## 12. Dogfooding requirement

ACC MUST describe itself using ACC. The ACC repository contains
`AGENTS.md` contracts for its own modules and an `.agents/.acc/` control
plane. It is fully navigable using its own CLI commands.

This is both a validation of the framework and a reference
implementation: if ACC cannot describe itself, the framework is
over-constrained.

---

## The hard invariant (technical restatement)

Formally:

```text
ACC-enhanced  =  Repository  +  AGENTS.md  +  .agents/.acc/
```

```text
remove(.agents/)  →  valid AGENTS.md repository  (still usable by any agent)
remove(acc CLI)   →  valid AGENTS.md repository  (still usable by any agent)
```

```text
remove(AGENTS.md)  →  ordinary repository  (ACC offers no added value here)
```

The invariant is load-bearing: it shapes every design decision in the
following documents. Any ACC feature that would violate it is rejected
by specification.
