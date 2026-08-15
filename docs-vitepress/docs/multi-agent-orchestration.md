# 10 — Multi-Agent Orchestration

## Overview

ACC MAY support a multi-agent mode. When enabled, the active coding agent MAY create and coordinate additional agents to complete a task.

> **Core Principle:** ACC manages the coordination substrate; the coding agent decides when parallel agents are useful.

This keeps it **agent-agnostic**. Cursor, Claude, Codex, OpenCode, or another agent can use the same project structure and ACC primitives.

---

## 1. Agent Hierarchy

A multi-agent session consists of:

```
coordinator
    │
    ├── worker
    ├── worker
    ├── worker
    └── ...
```

### Coordinator Responsibilities

The coordinator is responsible for:
- **Task decomposition** — breaking work into independent scopes
- **Assigning work** — mapping scopes to workers
- **Maintaining global context** — shared architecture, constraints, progress
- **Resolving conflicts** — detecting and handling concurrent modifications
- **Integrating results** — combining worker outputs into a coherent whole
- **Final validation** — running tests, rebuilding the graph, verifying architecture

### Worker Responsibilities

Workers are responsible for their assigned scopes.
- Workers MUST receive the relevant ACC context for their assigned functionality.
- Workers operate against the same project architecture but receive context appropriate to their task.
- Workers MUST return structured results (see §10).

---

## 2. Agent-Agnostic Design

Multi-agent support MUST NOT require a specific coding agent.

- ACC SHOULD expose a generic orchestration model that compatible agents can use.
- ACC MUST NOT assume that every coding agent supports native sub-agent spawning.
- If the connected agent supports sub-agents, ACC MAY provide the project context and coordination facilities needed by those agents.
- If the agent does not support sub-agents, the project remains fully functional as a single-agent project.

---

## 3. Activation

Multi-agent functionality MUST be explicitly configurable.

### Configuration (`.acc/config/config.yaml`)

```yaml
multi_agent:
  enabled: true
  max_concurrency: 8
  max_depth: 2
  task_timeout: 300
  resource_limits:
    cpu_percent: 80
    memory_mb: 4096
    token_budget: 1000000
  isolation_mode: "git_worktree"
  conflict_policy: "sequentialize"
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Master switch; when `false`, no multi-agent orchestration occurs. |
| `max_concurrency` | integer | `4` | Maximum number of concurrent workers. |
| `max_depth` | integer | `1` | Maximum recursive spawning depth (0 = no recursion). |
| `task_timeout` | integer (seconds) | `300` | Per-worker task timeout. |
| `resource_limits` | object | `{}` | CPU, memory, token/budget limits. |
| `isolation_mode` | string | `"git_worktree"` | `"git_worktree"`, `"branch"`, `"directory"`, `"snapshot"`, `"process"`. |
| `conflict_policy` | string | `"sequentialize"` | `"sequentialize"`, `"reassign"`, `"merge"`, `"discard"`, `"ask_user"`. |

**When disabled:** multi-agent orchestration MUST NOT occur.
**When enabled:** the coordinator MAY spawn additional agents when useful.
Sensible defaults MUST be provided for all keys.

---

## 4. Dynamic Agent Count

The coordinator SHOULD be able to dynamically determine the required number of workers.

### Example

**User:** "Refactor the networking subsystem."

**Coordinator determination:**
```
Agent 1 → connection management
Agent 2 → protocol
Agent 3 → peer discovery
Agent 4 → tests
Agent 5 → documentation
```

Or it may determine that a single agent is sufficient.

**ACC MUST NOT force parallelism** when the task is inherently sequential.

---

## 5. Functionality-Based Partitioning

ACC SHOULD use the functionality graph to help partition work.

### Preferred Partitioning

```
functionality A → Agent 1
functionality B → Agent 2
functionality C → Agent 3
```

Rather than arbitrarily splitting files.

Agents SHOULD receive ownership of **coherent functionality scopes**.

This reduces:
- Conflicting edits
- Duplicated reasoning
- Inconsistent architecture
- Unnecessary context
- Merge conflicts

---

## 6. Dependency-Aware Scheduling

The coordinator SHOULD use the ACC graph to determine whether tasks can execute concurrently.

### Example: Sequential Dependency

```
A ──→ B ──→ C
```

Tasks affecting A and C may not safely execute simultaneously if C depends on A's result.

### Example: Independent Branches

```
A ──→ B
C ──→ D
```

May be executed concurrently when no relevant dependency exists.

**The graph SHOULD therefore act as a scheduling aid.**

---

## 7. Functionality Ownership

During a multi-agent task, an agent MAY temporarily own a functionality.

### Example

```
auth/transport
    owner = worker-2
```

Other agents SHOULD avoid modifying the same functionality unless explicitly coordinated.
- Ownership MUST be visible to the coordinator.
- Ownership MAY be represented as session state rather than persisted into the repository.
- Temporary agent state MUST NOT pollute project source files.

---

## 8. Shared Context

All agents operate against the same project architecture but MUST receive context appropriate to their task.

### Shared Information (MAY include)

- Project instructions
- Project configuration
- Architecture graph
- Relevant functionality descriptions
- Relevant memory
- Relevant constraints
- Task specification

Agents SHOULD NOT receive the entire context of unrelated agents unless required.

---

## 9. Agent Memory

Workers MAY discover new information. Important discoveries SHOULD be returned to the coordinator.

### Example

```
Worker 2 discovered:
    transport cannot decode frames because listeners use
    different output configurations.
```

The coordinator may then decide whether this becomes:
- Functionality memory (`.acc-memory.md`)
- Project documentation
- An architectural decision

**Workers MUST NOT silently write conflicting architectural knowledge into shared memory.**

---

## 10. Result Handoff

Every worker SHOULD return a structured result.

### Example

```yaml
status: completed
scope: auth/transport
changes:
  - transport.rs
  - peer.rs
tests:
  - transport_tests
discoveries:
  - "Non-reentrant decode path blocks gapless playback"
risks:
  - "Reconnect path still depends on legacy queue"
validation: passed
```

The coordinator uses these results to continue the task.

---

## 11. Conflict Management

ACC SHOULD detect concurrent modifications to overlapping scopes.

If two agents attempt to modify the same functionality:
- ACC SHOULD notify the coordinator.
- The coordinator MUST resolve the conflict before finalizing the task.
- ACC MUST NOT silently choose one agent's changes over another's.

### Possible Strategies

| Strategy | Description |
|----------|-------------|
| `sequentialize` | Run conflicting tasks sequentially. |
| `reassign` | Move one task to a different agent. |
| `merge` | Attempt automatic merge of changes. |
| `discard` | Discard one agent's changes. |
| `ask_user` | Prompt user for resolution. |

The selected strategy SHOULD depend on project configuration and agent capabilities.

---

## 12. Isolation

Multi-agent execution SHOULD support isolated working states.

### Possible Implementations

- Git worktrees
- Temporary branches
- Isolated directories
- Filesystem snapshots
- Process-level isolation

The implementation MUST NOT assume that all agents can safely modify the same working tree simultaneously.

For high-risk parallel work, **isolated workspaces SHOULD be preferred.**

---

## 13. Integration

After workers finish:

```
coordinator
    ↓
collect results
    ↓
integrate changes
    ↓
rebuild graph
    ↓
validate architecture
    ↓
run relevant tests
    ↓
inspect memory/documentation
    ↓
final result
```

The coordinator MUST perform final validation.

**A worker passing its individual tests does NOT imply that the overall project is valid.**

---

## 14. Failure Handling

A worker failure MUST NOT automatically fail the entire task.

The coordinator SHOULD determine whether to:
- Retry
- Reassign
- Continue without the worker
- Reduce parallelism
- Ask the user

### Example

```
Agent 1 → success
Agent 2 → success
Agent 3 → failure
Agent 4 → success
```

The coordinator may retry Agent 3 or continue if its task is non-critical.

---

## 15. Recursive Agents

The coordinator MAY allow workers to spawn additional workers if configured.

### Example

```
coordinator
    ├── worker A
    │     ├── worker A1
    │     └── worker A2
    │
    └── worker B
```

However, **recursive spawning MUST be bounded.**

Configuration SHOULD support:
- `max_depth` — default should prevent uncontrolled recursive spawning.

---

## 16. Resource Control

ACC SHOULD support resource limits for multi-agent sessions.

### Possible Limits

- `max_concurrency`
- `max_depth`
- Maximum total agents
- CPU limits
- Memory limits
- Token/budget limits
- Execution timeout
- Task timeout

The coordinator MUST respect these limits.

> **"Spawn as many agents as needed" means: as many as are useful within configured resource boundaries — not unlimited uncontrolled process creation.**

---

## 17. User Visibility

Multi-agent operation SHOULD remain understandable without overwhelming the user.

### High-Level Progress

The user SHOULD see high-level progress such as:

```
Working on networking refactor...

4 agents active

✓ Peer discovery
✓ Protocol
→ Connection manager
→ Integration tests
```

The user SHOULD be able to inspect details when desired.

### Inspection Commands (implementation-defined)

```
acc agents
acc agents status
acc agents inspect 3
acc agents stop 3
```

Exact commands are implementation-defined.

---

## 18. Natural Development

The user SHOULD NOT need to manually orchestrate agents.

### Example

**User:** "Refactor the networking subsystem and make sure all tests continue passing."

**Coordinator naturally determines:**
```
this is a multi-functionality task
    ↓
inspect graph
    ↓
identify independent work
    ↓
spawn appropriate workers
    ↓
coordinate results
    ↓
integrate
    ↓
validate
```

The user should experience this as **one development task**.

---

## 19. Determinism

Multi-agent reasoning MAY be nondeterministic.

**ACC's underlying operations MUST remain deterministic.**

The following MUST remain deterministic:
- Project discovery
- Instruction resolution
- Graph construction
- Memory parsing
- Validation
- Conflict detection
- Context assembly
- Structured tool output

The choice to spawn agents is an **agent-level decision**.

---

## 20. Agent-Agnostic Fallback

If the active agent cannot spawn sub-agents:
- ACC MUST continue to operate normally.
- The same task MAY be executed sequentially by one agent.
- The framework MUST NOT require native multi-agent support from the underlying coding agent.

---

## 21. Core Principle

Multi-agent ACC is:

```
ONE PROJECT
    +
ONE SHARED ARCHITECTURE
    +
MANY SPECIALIZED WORKERS
    +
ONE COORDINATOR
    +
DETERMINISTIC VALIDATION
```

- Agents may think and work independently.
- The project architecture remains shared.
- The coordinator integrates the work.
- ACC verifies the final result.

---

## 22. Configuration Reference

### Full `.acc/config/config.yaml` with Multi-Agent Section

```yaml
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

diagnostics:
  warn_only: []

forbidden_deps: []

ownership:
  strict: false

multi_agent:
  enabled: true
  max_concurrency: 8
  max_depth: 2
  task_timeout: 300
  resource_limits:
    cpu_percent: 80
    memory_mb: 4096
    token_budget: 1000000
  isolation_mode: "git_worktree"
  conflict_policy: "sequentialize"
```

### Defaults (when `multi_agent` section is absent)

```yaml
multi_agent:
  enabled: false
  max_concurrency: 4
  max_depth: 1
  task_timeout: 300
  resource_limits: {}
  isolation_mode: "git_worktree"
  conflict_policy: "sequentialize"
```

---

## 23. Integration with ACC Commands

### `acc check`

When multi-agent is enabled, `acc check` MAY validate:
- Resource limits are reasonable
- Isolation mode is supported
- Conflict policy is valid

### `acc graph`

The graph derivation is unchanged — it remains deterministic and offline. The graph is used by the coordinator for scheduling and partitioning decisions.

### `acc context`

Workers receive context via `acc context --depth N --path <scope>` with appropriate filtering.

### `acc impact`

The coordinator uses `acc impact` to understand blast radius before assigning work.

### Reserved Commands (Future)

These commands are reserved for future multi-agent CLI support:

| Command | Purpose |
|---------|---------|
| `acc agents` | List active agents in current session. |
| `acc agents status` | Show progress of all agents. |
| `acc agents inspect <id>` | Show details for a specific agent. |
| `acc agents stop <id>` | Stop a specific agent. |
| `acc agents logs <id>` | View agent logs. |

**Note:** These commands are not part of V1. They are documented here for forward compatibility.

---

## 24. Diagnostic Codes

The following diagnostic codes relate to multi-agent orchestration:

| Code | Severity | Description |
|------|----------|-------------|
| `ACC100` | error | Multi-agent enabled but isolation mode not supported. |
| `ACC101` | error | `max_concurrency` exceeds resource limits. |
| `ACC102` | warn | Worker modified functionality owned by another worker. |
| `ACC103` | error | Recursive spawning exceeds `max_depth`. |
| `ACC104` | warn | Worker task timeout exceeded. |
| `ACC105` | info | Multi-agent mode disabled; running sequentially. |

These codes are reserved. See [06 — Diagnostic Codes](./diagnostic-codes.md) for the full registry.

---

## 25. Summary

| Principle | Implication |
|-----------|-------------|
| **Agent-agnostic** | Works with any coding agent; no ACC-specific runtime. |
| **Graph-driven partitioning** | Functionality graph determines safe parallelism. |
| **Dynamic concurrency** | Coordinator decides worker count; ceiling is configurable. |
| **Ownership model** | Prevents conflicting edits; visible to coordinator. |
| **Structured handoff** | Workers return structured results; coordinator integrates. |
| **Isolation support** | Git worktrees, branches, snapshots for safe parallel work. |
| **Failure resilience** | Single worker failure doesn't fail the task. |
| **Bounded recursion** | `max_depth` prevents uncontrolled spawning. |
| **Resource limits** | CPU, memory, token budgets enforced. |
| **Deterministic substrate** | ACC operations remain deterministic; agent decisions may not. |
| **Graceful fallback** | Single-agent mode fully functional when multi-agent unavailable. |