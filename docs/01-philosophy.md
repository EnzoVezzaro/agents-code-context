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

- `acc-agent` or any ACC-specific runtime
- An ACC-specific LLM wrapper or proprietary API
- An ACC-specific IDE or editor plugin
- A protocol handshake or registration step

An agent clones the repository and understands the framework by reading standard instruction files (`AGENTS.md`, `.agents/acc/`, `.acc-memory.md`). No installation, no plugin, no proprietary integration.

---

## 2. `AGENTS.md` Is the Primary Agent Interface

`AGENTS.md` remains the **primary instruction interface**—it is the established convention used by Codex, Claude Code, Cursor, Copilot, OpenCode, and others.

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

An agent that has never heard of ACC still understands these instructions—they are plain Markdown.

---

## 3. ACC Is a Convention + Tooling Layer

The framework consists of five composable layers:

| Layer | Artifact | Purpose |
|-------|----------|---------|
| **Standard Instructions** | `AGENTS.md` | Primary agent interface (ecosystem convention) |
| **Local Contracts** | `functionality/AGENTS.md` | Functionality-scoped declarations |
| **Durable Memory** | `functionality/.acc-memory.md` | Agent-written, gitignored knowledge |
| **Control Plane** | `.agents/acc/` | Project config, agents, workflows, standards |
| **Deterministic Tooling** | `acc` CLI | Graph derivation, context, validation, search |

The agent is free to interact with these through filesystem operations, shell commands, standard tools, or ACC CLI commands. **No proprietary integration is required.**

---

## 4. Self-Describing Project

An ACC-enabled project **MUST** be understandable by an agent even if:

- ACC is not installed
- The agent has never used ACC
- The agent does not support ACC-specific tools

The repository MUST contain enough standard documentation for the agent to understand:

- Project structure and functionality boundaries
- Local instructions and architectural constraints
- Expected workflows and memory semantics
- Ownership and dependency relationships

ACC enhances this understanding but does not monopolize it.

---

## 5. Optional ACC Tooling

ACC MAY provide optimized tools that accelerate common operations:

| Command | Purpose |
|---------|---------|
| `acc context` | Focused, progressive, provenance-tagged context |
| `acc graph` | Derived architecture graph (text/mermaid/dot/json) |
| `acc inspect` | Path-level roles, owners, dependencies, constraints |
| `acc check` | Deterministic validation with stable `ACC0xx` codes |
| `acc memory` | Read/write `.acc-memory.md` |
| `acc impact` | Blast-radius analysis for changes |
| `acc dependencies` / `acc dependents` | Relationship traversal |
| `acc search` | Architecture-aware search |
| `acc discover` | Architectural suggestions (dry-run by default) |
| `acc document` | Conservative `AGENTS.md` templates |
| `acc init` | Initialize ACC structure in a repo |

An agent MAY use these when available. Their absence MUST NOT make the repository unintelligible. The standard fallback remains:

```text
read AGENTS.md
inspect source
inspect documentation
inspect .acc-memory.md
inspect project structure
```

---

## 6. Automatic Agent Behavior

The project's root `AGENTS.md` SHOULD instruct compatible agents to follow the framework automatically. The agent should naturally:

1. Discover the relevant functionality boundary
2. Read its `AGENTS.md` contract
3. Read its `.acc-memory.md` for durable knowledge
4. Inspect relevant source code
5. Understand graph relationships (via `acc graph` or manual inspection)
6. Make changes
7. Validate changes (`acc check` or manual review)
8. Update relevant documentation and memory

The user SHOULD NOT need to know the ACC workflow—the agent handles it.

---

## 7. ACC CLI as Deterministic Accelerator

The `acc` CLI provides deterministic operations that make the framework faster and more reliable:

- `acc context <path>` produces an optimized representation of information an agent could otherwise discover manually
- `acc check` provides deterministic validation against stable diagnostic codes
- `acc graph` derives the architecture graph on demand from the repository

The CLI is an **accelerator and validator**, not the sole mechanism through which agents understand the project.

---

## 8. Agent Compatibility Principle

ACC MUST prefer existing agent conventions over proprietary conventions.

- If an established agent standard can represent a requirement, ACC SHOULD use that standard
- ACC SHOULD NOT require agents to learn a new protocol merely to understand an ACC-enabled repository
- New ACC-specific metadata SHOULD augment standard conventions rather than replace them

---

## 9. Universal Entry Point

The universal entry point for an agent is the repository itself:

```text
AGENTS.md
    ↓
.agents/acc/
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

**Context lives in the repository**—in `AGENTS.md` (committed) and `.acc-memory.md` (local, gitignored)—both are agent-agnostic and tool-agnostic.

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
- An `.agents/acc/` control plane with config, agents, workflows, and standards
- Full navigability using its own CLI commands

This is both a validation of the framework and a reference implementation: if ACC cannot describe itself, the framework is over-constrained.

---

## 13. The Hard Invariant (Technical Restatement)

Formally:

```text
ACC-enhanced  =  Repository  +  AGENTS.md  +  .agents/acc/
```

```text
remove(.agents/)  →  valid AGENTS.md repository  (still usable by any agent)
remove(acc CLI)   →  valid AGENTS.md repository  (still usable by any agent)
```

```text
remove(AGENTS.md)  →  ordinary repository  (ACC offers no added value here)
```

The invariant is load-bearing: it shapes every design decision in the following documents. Any ACC feature that would violate it is rejected by specification.