# 02 — Repository Structure

## Overview

A single ACC-enabled project directory has three load-bearing layers:

```text
my-project/
├── AGENTS.md                     # Standard agent instructions (primary interface)
├── my-code/
│   ├── AGENTS.md                 # Functionality-local contract
│   ├── .acc-memory.md            # Functionality-local durable memory (gitignored)
│   └── src/
│       └── ...
├── another-thing/
│   ├── AGENTS.md
│   └── ...
└── .agents/
    └── acc/                      # Project-level ACC control plane
        ├── config.yaml
        ├── agents/
        │   └── architect.md
        ├── workflows/
        │   └── feature.md
        └── standards/
            └── architecture.md
```

The strict boundary:

| Layer | Role | Ownership |
|-------|------|-----------|
| `AGENTS.md` | Standard agent instructions (local functionality contract). | The ecosystem. Markdown, no proprietary schema. |
| `.agents/acc/` | Project-level ACC control plane. | ACC-specific configuration, profiles, workflows, standards. |
| `.acc-memory.md` | Functionality-local durable memory. | Agent-written, gitignored, human-readable Markdown. |
| `acc` CLI | Deterministic accelerator. | Optional tooling, never required for understanding. |

---

## 1. `AGENTS.md` — Standard Ecosystem

### Role

`AGENTS.md` is the **primary agent interface**. It follows the existing hierarchical inheritance convention used by Codex, Claude Code, Cursor, Copilot, OpenCode, and others:

```text
project/AGENTS.md          → project-wide context
  └── src/AGENTS.md        → src-specific context (inherits + overrides)
        └── src/audio/AGENTS.md  → audio-specific context
```

A directory containing an `AGENTS.md` represents a **"functionality boundary."** One functionality = one local `AGENTS.md`.

### Rules

- **Markdown only** — Plain, human-readable. No proprietary schema.
- **No mandatory structure** — No YAML frontmatter, no decorators, no required sections. A directory's `AGENTS.md` is valid even if it is one paragraph of prose.
- **Heuristic parsing** — ACC reads `AGENTS.md` heuristically, looking for conventional section headings (`Purpose`, `Responsibilities`, `Ownership`, `Inputs`, `Outputs`, `Dependencies`, `Constraints`, `Architecture`, `Workflows`) but **never requires** them.
- **Inheritance by position** — A directory with no `AGENTS.md` is not a functionality boundary; it inherits context from the nearest ancestor that has one.

### Authoring Reference

See [09 — AGENTS.md Authoring Guide](./09-authoring-guide.md).

---

## 2. `.agents/acc/` — ACC Control Plane

### Role

The `.agents/acc/` directory is the **project-level control plane** specific to ACC. It is extensible, optional, and versioned (committed to git).

> **Path convention:** The spec text uses `.agents/.acc/` in prose. On disk this is the directory `.agents/acc/` (a single `acc` child of `.agents/`). Both spellings refer to the same path.

### Directory Structure

```text
.agents/acc/
├── config.yaml          # Framework configuration
├── agents/              # Project-specific agent profiles
│   └── architect.md
├── workflows/           # Reusable, reproducible procedures
│   └── feature.md
├── standards/           # Project standards referenced by AGENTS.md
│   └── architecture.md
└── plugins/             # Third-party tooling plugins (optional)
    └── <plugin-name>/
        ├── plugin.yaml
        └── ...
```

### `config.yaml`

Project-level ACC configuration. **Optional** — sensible defaults apply when absent. Keys (all optional):

```yaml
# Minimal valid config (empty file, or file absent)
---

# Optional keys:
schema_version: 1              # ACC control-plane schema version

language_analyzers:            # Enable per-language import discovery
  rust: true
  typescript: true
  go: true
  python: true                 # Optional: enable when analyzer available

ignore:                        # Paths excluded from graph + search
  - "target/"
  - "node_modules/"
  - "*.lock"
  - ".git/"
  - "dist/"
  - "build/"

diagnostics:                   # Diagnostic tuning
  forbidden_deps:              # Pairs (dependee → forbidden dependency)
    - from: "src/audio/"
      to: "src/database/"
  warn_only: ["ACC014"]        # Downgrade specific codes to warn

ownership:
  strict: false                # true → duplicate ownership is an error

multi_agent:                   # Multi-agent orchestration (see docs/10)
  enabled: false               # Master switch
  max_concurrency: 4           # Maximum concurrent workers
  max_depth: 1                 # Maximum recursive spawning depth
  task_timeout: 300            # Per-worker timeout (seconds)
  resource_limits:
    cpu_percent: 80
    memory_mb: 4096
    token_budget: 1000000
  isolation_mode: "git_worktree"  # "git_worktree" | "branch" | "directory" | "snapshot" | "process"
  conflict_policy: "sequentialize" # "sequentialize" | "reassign" | "merge" | "discard" | "ask_user"

tools:                         # Tooling subsystem (see docs/11)
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
    directory: ".agents/acc/plugins"
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

`config.yaml` MUST NOT be required for any command to run. Its absence means: "use defaults." This keeps ACC usable on a git clone with zero configuration.

When the `multi_agent` section is absent, the defaults shown above apply. The `enabled: false` default ensures backward compatibility — existing projects are unaffected.

### `agents/` — Agent Profiles

`agents/<name>.md` describes a project-specific agent persona. Human-readable Markdown. Example:

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

Agent profiles are **convention, not protocol**. An agent reads them as Markdown and follows the instructions. Nothing executes.

### `workflows/` — Reusable Procedures

`workflows/<name>.md` is a reproducible procedure. Human-readable Markdown combining instructions + ACC commands. Example:

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

`standards/<name>.md` are project standards referenced from `AGENTS.md`. Human-readable Markdown. E.g., `standards/architecture.md` defines the project's architecture expectations, referenced by multiple `AGENTS.md` files via plain prose ("See `.agents/acc/standards/architecture.md`").

References in `AGENTS.md` to standards are ordinary Markdown links or prose — ACC does not enforce a special link format.

---

## 3. `.acc-memory.md` — Durable Memory

### Role

Per-functionality durable memory, agent-written and gitignored.

Path: `<functionality-dir>/.acc-memory.md`

### Lifecycle

- **Created** by an agent (or a human) when it learns something durable about a functionality that is not yet (or should not be) in `AGENTS.md`.
- **Read** before modifying a functionality to recover lessons learned.
- **Updated** after successful modification, when new durable knowledge is worth keeping.
- **Deleted** when the functionality is removed.

### Format

Plain Markdown. Human-readable. No schema. ACC treats unstructured prose as memory; structured memory uses well-known headings as keys (see [08 — Memory Semantics](./08-memory-semantics.md)).

### Git

`.acc-memory.md` **MUST** be listed in `.gitignore`. Memory is local and agent-specific; committing it would create conflicts across agents and users. The repository's `AGENTS.md` is the durable, committed contract; `.acc-memory.md` is the scratchpad.

If a team wants shared durable knowledge, it belongs in `AGENTS.md` (committed), not in `.acc-memory.md`.

### Fallback

Any agent can read `.acc-memory.md` as plain Markdown. `acc memory` commands are a convenient accelerator; absence of the CLI does not make the file unreadable.

---

## 4. `acc` CLI (Tooling Layer)

The CLI is an optional, deterministic accelerator.

- Installed separately from the repository.
- Reads `AGENTS.md`, `.agents/acc/`, and source.
- Writes `.acc-memory.md` only via explicit `acc memory` commands.
- Never modifies `AGENTS.md` except via explicit `acc document` or `acc discover --apply` commands that require confirmation.

See [04 — CLI Command Specification](./04-cli-commands.md).

---

## 5. Reference Layout

A complete ACC-enabled reference directory:

```text
my-project/
├── AGENTS.md
├── .gitignore
├── .agents/
│   └── acc/
│       ├── config.yaml
│       ├── agents/
│       │   ├── architect.md
│       │   ├── reviewer.md
│       │   └── debugger.md
│       ├── workflows/
│       │   ├── feature.md
│       │   ├── release.md
│       │   ├── bugfix.md
│       │   └── refactor.md
│       ├── standards/
│       │   ├── architecture.md
│       │   ├── coding.md
│       │   ├── review.md
│       │   └── testing.md
│       └── plugins/
│           ├── docker/
│           │   ├── plugin.yaml
│           │   └── index.js
│           └── github/
│               ├── plugin.yaml
│               └── index.py
├── src/
│   ├── AGENTS.md
│   ├── audio/
│   │   ├── AGENTS.md
│   │   ├── .acc-memory.md          # gitignored
│   │   └── ...
│   └── database/
│       ├── AGENTS.md
│       ├── .acc-memory.md          # gitignored
│       └── ...
├── tests/
│   ├── AGENTS.md
│   └── ...
└── docs/
    └── ...
```

---

## 6. Compatibility Matrix

| Component removed | Project usability |
|-------------------|-------------------|
| `.agents/acc/` | Still valid `AGENTS.md` repository; agents read `AGENTS.md` directly. |
| `acc` CLI | Still valid `AGENTS.md` repository; agents fall back to reading files. |
| `.acc-memory.md` | Lose durable memory, but `AGENTS.md` remains the durable contract. |
| `AGENTS.md` | Ordinary repository; ACC offers no added value. |

---

## 7. Path Conventions Used by This Spec

- Paths in code blocks and JSON output are POSIX-style (`/` separator).
- `.agents/acc/` and `.agents/.acc/` refer to the same path; the on-disk canonical form is `.agents/acc/`.
- `AGENTS.md` is always lowercase on disk on case-insensitive filesystems; ACC treats `AGENTS.md` case-insensitively when matching, but writes the canonical `AGENTS.md` form.
- Paths and names are **canonical references**. ACC avoids arbitrary opaque IDs; a functionality is identified by its directory path.