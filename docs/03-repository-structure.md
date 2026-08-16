# 03 — Repository Structure

## Overview

Think of an ACC-enabled project as three layers stacked on top of each
other, each with a distinct job:

```text
my-project/
├── AGENTS.md                     # Standard agent instructions (primary interface)
├── .agents/                      # Standard surface (optional)
│   ├── AGENTS.md                 # Project-wide rules (project base tier)
│   └── skills/                   # SKILL.md packages (Agent Skills standard)
├── .acc/                         # ACC-specific namespace
│   └── config/                   # ACC control plane
│       ├── config.yaml           # Framework configuration (optional, defaults apply)
│       ├── agents/               # Agent profiles
│       ├── workflows/            # Reusable procedures
│       ├── standards/            # Project standards
│       ├── skills/               # ACC-managed skills (SKILL.md packages)
│       ├── mcp/                  # MCP bridge definitions
│       ├── tools/                # Tool plugins
│       └── multi-agent/          # Orchestration configuration
├── src/
│   ├── payments/
│   │   ├── AGENTS.md             # Functionality contract (nearest file wins)
│   │   ├── checkout.rs
│   │   ├── ledger.rs
│   │   ├── gateway.rs
│   │   └── .acc-memory.md        # Durable memory (gitignored)
│   ├── network/
│   │   ├── AGENTS.md
│   │   ├── mesh.rs
│   │   ├── transport.rs
│   │   └── .acc-memory.md
│   └── auth/
│       ├── AGENTS.md
│       ├── session.ts
│       └── .acc-memory.md
└── .acc-memory.md                # Root-level durable memory (gitignored)
```

The strict boundary — who owns what:

| Layer | Role | Ownership |
|-------|------|-----------|
| `AGENTS.md` (root + nested) | Standard agent instructions (primary interface). | The ecosystem. Markdown, no proprietary schema. |
| `.agents/AGENTS.md` | Optional project-wide rules. | The ecosystem (project base tier). |
| `.agents/skills/` | Optional SKILL.md packages. | The ecosystem (Agent Skills standard). |
| `*/.acc-memory.md` | Functionality-local durable memory. | Agent-written, gitignored, moves with functionality. |
| `.acc/config/` | Project-level ACC control plane. | ACC-specific configuration, profiles, workflows, standards. |
| `acc` CLI | Deterministic accelerator. | Optional tooling, never required for understanding. |

The whole thing reads like a conversation: the standard says *this is
how agents find instructions*, `.acc/` says *this is where ACC-specific
machinery lives*, and code folders say *this is what we know about this
code*.

---

## 1. `AGENTS.md` — Standard Ecosystem

### Role

`AGENTS.md` follows the hierarchical inheritance convention defined by
the open [agents.md](https://agents.md/) standard. Agents read the
nearest file in the directory tree:

```text
project/AGENTS.md          → project-wide context
  └── src/AGENTS.md        → src-specific context (nearest file wins)
        └── src/payments/AGENTS.md  → payments-specific context
```

A directory containing an `AGENTS.md` represents a **functionality
boundary**. One functionality = one local `AGENTS.md`. That's the single
most useful mental model in this whole spec.

### Rules

- **Markdown only** — Plain, human-readable. No proprietary schema.
- **No mandatory structure** — No YAML frontmatter, no decorators, no required sections. A directory's `AGENTS.md` is valid even if it is one paragraph of prose.
- **Heuristic parsing** — ACC reads `AGENTS.md` heuristically, looking for conventional section headings (`Purpose`, `Responsibilities`, `Ownership`, `Inputs`, `Outputs`, `Dependencies`, `Constraints`, `Architecture`, `Workflows`) but **never requires** them.
- **Inheritance by position** — A directory with no `AGENTS.md` is not a functionality boundary; it inherits context from the nearest ancestor that has one.

### Authoring Reference

See [10 — AGENTS.md Authoring Guide](./10-authoring-guide.md).

---

## 2. `.agents/` — Standard Surface

`.agents/` follows the ecosystem convention. It is **not** an ACC
documentation directory — think of it as the "standard parts" shelf.

### `.agents/AGENTS.md` (Optional)

Project-wide base rules, inherited by every agent. This matches the
"project base" tier used across the agent ecosystem. If present, ACC
treats it as project-wide context that applies to the whole repository.

```text
.agents/AGENTS.md
        ↓
project-wide rules
```

A repository without `.agents/AGENTS.md` is fully valid — the root
`AGENTS.md` remains the primary interface.

### `.agents/skills/` (Optional)

Reusable capabilities in the standard [SKILL.md format](https://agentskills.io/) (YAML frontmatter + Markdown body), discovered by agents that support the Agent Skills standard:

```text
.agents/skills/
└── <skill-name>/
    ├── SKILL.md
    ├── scripts/        # optional
    ├── references/     # optional
    └── assets/         # optional
```

ACC reads standard skill locations as well as its own (see §4, `skills/`).

---

## 3. `.acc/config/` — ACC Control Plane

### Role

The `.acc/config/` directory is the **project-level control plane**
specific to ACC. It is optional, versioned (committed to git), and
follows the tool-owned namespace convention used by other agent tooling
(`.cursor/`, `.claude/`, `.github/`). Removing it leaves a valid
agents.md repository (see [01 — Philosophy §13](./01-philosophy.md#13-the-hard-invariant-technical-restatement)).

### Directory Structure

```text
.acc/config/
├── config.yaml              # Framework configuration (optional, sensible defaults)
├── agents/                  # Project-specific agent profiles
│   └── architect.md
├── workflows/               # Reusable, reproducible procedures
│   └── feature.md
├── standards/               # Project standards referenced by AGENTS.md
│   └── architecture.md
├── skills/                  # ACC-managed skills (SKILL.md packages)
│   └── <skill-name>/
│       └── SKILL.md
├── mcp/                     # MCP bridge definitions
│   └── <bridge-name>/
│       └── plugin.yaml
├── tools/                   # Tool plugins
│   └── <plugin-name>/
│       ├── plugin.yaml
│       └── index.js
└── multi-agent/             # Multi-agent orchestration config
    └── config.yaml
```

### `config.yaml`

Project-level ACC configuration. **Optional** — sensible defaults apply
when absent. Keys (all optional):

```yaml
# Minimal valid config (empty file, or file absent)
---
# Optional keys:
schema_version: 1

language_analyzers:
  rust: true
  typescript: true
  go: true
  python: true

ignore:
  - "target/"
  - "node_modules/"
  - "*.lock"
  - ".git/"
  - "dist/"
  - "build/"

diagnostics:
  # Example: downgrade circular reference warning to info
  # warn_only: ["ACC014"]
  warn_only: []

ownership:
  strict: false

multi_agent:
  enabled: false
  max_concurrency: 4
  max_depth: 1
  task_timeout: 300
  resource_limits:
    cpu_percent: 80
    memory_mb: 4096
    token_budget: 1000000
  isolation_mode: "git_worktree"
  conflict_policy: "sequentialize"

tools:
  auto_discover: true
  defaults:
    filesystem: true
    search: true
    shell: true
    git: true
    project: true
    context: true
    graph: true
    memory: true
    check: true
  detected:
    enabled: true
  plugins:
    enabled: true
    directory: ".acc/config/tools"
  permissions:
    filesystem:
      read: true
      write: true
      glob: true
    shell:
      enabled: true
      approval: "auto"
      allowed_commands: []
    git:
      read: true
      write: true
    network:
      enabled: false
```

`config.yaml` MUST NOT be required for any command to run. Its absence
means: "use defaults." This keeps ACC usable on a git clone with zero
configuration — no setup ceremony, no config file to generate before you
can do anything.

When the `multi_agent` section is absent, the defaults shown above
apply. The `enabled: false` default ensures backward compatibility —
existing projects are unaffected.

### `agents/` — Agent Profiles

`agents/<name>.md` describes a project-specific agent persona.
Human-readable Markdown. Example:

```markdown
# architect

You are the architecture reviewer for this project.

When asked to review changes:
1. Run `acc graph --format mermaid` to see the current derived graph.
2. Run `acc impact <changed-path>` to find what could break.
3. Verify declared invariants in the relevant AGENTS.md files.
4. Report violations with diagnostic codes.

Constraints:
- Never override declared ownership.
- Flag inferred suggestions as "Inferred", never as authoritative.
```

Agent profiles are **convention, not protocol**. An agent reads them as
Markdown and follows the instructions. Nothing executes.

### `workflows/` — Reusable Procedures

`workflows/<name>.md` is a reproducible procedure. Human-readable
Markdown combining instructions + ACC commands. Example:

```markdown
# feature.md — Add a new functionality

1. Isolate the functionality: identify the directory boundary.
2. Read the parent AGENTS.md to understand inheritable context.
3. Create <dir>/AGENTS.md (use `acc document <dir>` for a template).
4. Implement the functionality.
5. Run `acc check` to validate references and contracts.
6. Run `acc graph` to confirm relationships match intent.
7. Run `acc impact <dir>` to identify affected tests/dependents.
8. Update .acc-memory.md with what you learned.
```

### `standards/` — Project Standards

`standards/<name>.md` are project standards referenced from
`AGENTS.md`. Human-readable Markdown. E.g., `standards/architecture.md`
defines the project's architecture expectations, referenced by multiple
`AGENTS.md` files via plain prose ("See `.acc/config/standards/architecture.md`").

References in `AGENTS.md` to standards are ordinary Markdown links or
prose — ACC does not enforce a special link format.

### `skills/` — ACC-Managed Skills

`skills/<name>/` holds ACC-managed skills. Skills use the standard
[SKILL.md format](https://agentskills.io/) so they remain portable
across agents:

```text
skills/
└── payments/
    ├── SKILL.md
    └── references/
```

Skills are **not** central knowledge bases. They are reusable capability
definitions that agents can opt in to use. A skill might declare:

- Required dependencies
- Standard patterns to follow
- Common test patterns
- Related functionalities

The actual knowledge about a specific payments system lives in
`src/payments/AGENTS.md` and `src/payments/.acc-memory.md`, not in the
skill definition itself. A skill is "how we do payments in general"; the
contract is "how *this* payments system works."

### `mcp/` — MCP Bridge Definitions

`mcp/<name>/` defines ACC bridges to external services. Bridges
reference standard MCP server configurations (`.mcp.json`, agent-native
configs) rather than redefining them:

```text
mcp/
└── github/
    ├── plugin.yaml
    └── index.js
```

MCP configurations are **not** central knowledge. They define how the
agent communicates with external services (GitHub API, LLM providers,
etc.) but the actual repository knowledge remains local.

### `tools/` — Tool Plugins

`tools/<name>/` defines external tooling plugins:

```text
tools/
└── docker/
    ├── plugin.yaml
    └── index.js
```

---

## 4. `*/AGENTS.md` — Local Functionality Instructions

### Role

Each functionality directory **MAY** contain its own `AGENTS.md`. These
are local instructions that apply to that functionality only. This is
the "knowledge lives next to code" rule from
[01 — Philosophy §4](./01-philosophy.md#4-knowledge-lives-next-to-code)
made concrete.

### Rules

- **Inheritance** — A directory with no `AGENTS.md` inherits context from the nearest ancestor that has one.
- **Override** — A local `AGENTS.md` can override or extend ancestor context.
- **Code-attached** — Best practice is to keep `AGENTS.md` in the same directory as the code it describes.

### Example Layout

```text
src/payments/
├── AGENTS.md                     # Local payments functionality rules
├── checkout.rs
├── ledger.rs
├── gateway.rs
└── .acc-memory.md                # Local durable memory
```

The `src/payments/AGENTS.md` might declare:

```markdown
Purpose: Payment processing and reconciliation.

Dependencies: src/database, src/ledger

Ownership: payments-team

Constraints: Must not block the checkout path.

Standards: See .acc/config/standards/idempotency
```

---

## 5. `*/.acc-memory.md` — Durable Memory

### Role

Per-functionality durable memory, agent-written and gitignored. This is
the scratchpad where an agent writes the things it learned that shouldn't
go in the committed contract — the "I wish I'd known this before I
started" notes. See [09 — Memory Semantics](./09-memory-semantics.md)
for the full semantics.

Path: `<functionality-dir>/.acc-memory.md`

### Lifecycle

- **Created** by an agent when it learns something durable about a functionality that is not yet (or should not be) in `AGENTS.md`.
- **Read** before modifying a functionality to recover lessons learned.
- **Updated** after successful modification, when new durable knowledge is worth keeping.
- **Deleted** when the functionality is removed.

### Format

Plain Markdown. Human-readable. No schema. ACC treats unstructured prose
as memory; structured memory uses well-known headings as keys (see
[09 — Memory Semantics](./09-memory-semantics.md)).

### Git

`*.acc-memory.md` **MUST** be listed in `.gitignore`. Memory is local
and agent-specific; committing it would create conflicts across agents
and users. The repository's `AGENTS.md` is the durable, committed
contract; `.acc-memory.md` is the scratchpad.

If a team wants shared durable knowledge, it belongs in `AGENTS.md`
(committed), not in `.acc-memory.md`.

### Fallback

Any agent can read `.acc-memory.md` as plain Markdown. `acc memory`
commands are a convenient accelerator; absence of the CLI does not make
the file unreadable. The fallback is literally `cat`.

---

## 6. Compatibility Matrix

The reassuring table: what happens if you remove pieces of ACC.

| Component removed | Project usability |
|-------------------|-------------------|
| `.acc/config/` | Still valid agents.md repository; agents read `AGENTS.md` directly. |
| `.acc/config/skills` | Functionality knowledge still in `*/AGENTS.md` and `*/.acc-memory.md`. |
| `.acc/config/mcp` | MCP config optional; functionality knowledge unaffected. |
| `.acc/config/tools` | Tool config optional; functionality knowledge unaffected. |
| `.acc/config/agents` | Agent profiles optional; agents still work. |
| `acc` CLI | Still valid agents.md repository; agents fall back to reading files. |
| `*.acc-memory.md` | Lose durable memory, but `AGENTS.md` remains the durable contract. |
| `AGENTS.md` | Ordinary repository; ACC offers no added value here. |

Every row above is a design requirement, not an accident. ACC is
furniture, not load-bearing walls.

---

## 7. Path Conventions Used by This Spec

- Paths in code blocks and JSON output are POSIX-style (`/` separator).
- `AGENTS.md` is always lowercase on disk on case-insensitive filesystems; ACC treats `AGENTS.md` case-insensitively when matching, but writes the canonical `AGENTS.md` form.
- Paths and names are **canonical references**. ACC avoids arbitrary opaque IDs; a functionality is identified by its directory path.
