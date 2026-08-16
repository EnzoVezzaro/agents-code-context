# 12 — Tooling Subsystem

> **TLDR:** how ACC gives agents the right tools
> without the agent having to ask "which tool do I need?" ACC looks at
> your project, figures out what's available, and exposes it — with a
> permission model so nothing dangerous happens by default.

Tooling is where ACC stops being a read-only map and starts offering the
agent a way to act — safely. This page covers how tools are discovered,
exposed, and gated.

## Overview

ACC tooling is a **first-class subsystem** that provides automatic,
project-aware capabilities to agents. The agent should not need to ask
"which ACC tool do I need?" — ACC determines this from project state
and task context.

> **Core Principle:** ACC tooling MUST be automatic, project-aware,
> agent-agnostic, and extensible.

The philosophy, in one sentence: the agent is the brain, ACC is the
hands — and the hands only do what they're told within bounds.

---

## 1. Architecture

```
                         ACC
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     Context            Graph             Memory
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    Tool Manager
                          │
              ┌───────────┴───────────┐
              │                       │
          Core Tools              Plugins
              │                       │
      ┌───────┼────────┐       ┌──────┼──────┐
      │       │        │       │      │      │
   Filesystem Search  Git    Docker GitHub Obsidian
   Shell      Tests   Check   DB     Cloud   ...
```

The agent is the intelligence. ACC is the deterministic context, memory,
graph, tooling, and coordination substrate.

---

## 2. Core Tools

ACC provides a minimal set of core tools by default. These are
**capabilities exposed through one deterministic ACC tool interface**,
not nine independent programs.

| Tool | Capability | Deterministic |
|------|------------|---------------|
| `filesystem` | Read/write/list files, glob patterns | Yes |
| `search` | Architecture-aware search (contracts, edges, code) | Yes |
| `shell` | Execute commands in project sandbox | Configurable |
| `git` | Read repo state, diff, log, status | Yes |
| `project` | Detect project type, package manager, scripts | Yes |
| `context` | Generate focused context (`acc context`) | Yes |
| `graph` | Derive architecture graph (`acc graph`) | Yes |
| `memory` | Read/write `.acc-memory.md` | Yes |
| `check` | Validate repository (`acc check`) | Yes |

### Core Tool Contract

Every core tool MUST:
- Be deterministic: same inputs + same project state = same output
- Respect the project root boundary (no escaping)
- Carry provenance on all results
- Honor the permission model (§8)
- Work offline (no network calls)

---

## 3. Automatic Project Detection

ACC automatically detects project technologies from configuration files.
No configuration, no guesswork — it reads your `package.json` or
`Cargo.toml` and knows what's available.

| File | Ecosystem | Detected Capabilities |
|------|-----------|----------------------|
| `package.json` | Node.js | npm/pnpm/yarn, scripts, TypeScript, test framework, linter, formatter, build |
| `Cargo.toml` | Rust | cargo, rustfmt, clippy, cargo test, cargo bench |
| `pyproject.toml` / `requirements.txt` | Python | pip/poetry/uv, pytest, ruff, black, mypy |
| `go.mod` | Go | go toolchain, gofmt, golangci-lint, go test |
| `pom.xml` / `build.gradle` | Java | maven/gradle, test, checkstyle |
| `composer.json` | PHP | composer, phpunit, phpstan, php-cs-fixer |
| `Gemfile` | Ruby | bundler, rspec, rubocop |
| `Dockerfile` | Docker | docker build, docker compose |
| `kubernetes/` / `helm/` | Kubernetes | kubectl, helm, kustomize |

### Detection Algorithm

1. **Walk filesystem** from project root
2. **Match known configuration files** (ordered by specificity)
3. **Parse declared capabilities**:
   - `package.json → scripts`, `devDependencies`, `dependencies`
   - `Cargo.toml → [dev-dependencies]`, `[[bench]]`, `[[test]]`
   - `pyproject.toml → [tool.*]`, `[project.optional-dependencies]`
4. **Register detected tools** as available capabilities
5. **Emit diagnostics** for conflicts or missing tools (`ACC110`–`ACC119`)

### Example: Node.js Project

```json
{
  "scripts": {
    "test": "vitest",
    "lint": "eslint .",
    "build": "tsc"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "eslint": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

ACC detects:
```
Node project
  ├── Package manager: npm (from package-lock.json)
  ├── Test runner: vitest (from scripts.test)
  ├── Linter: eslint (from scripts.lint)
  ├── Type checker: tsc (from scripts.build + typescript dep)
  └── Formatter: prettier (if in devDependencies)
```

**ACC uses existing tools** — it does NOT install alternatives.

---

## 4. Tool Registry

### Configuration (`.acc/config/config.yaml`)

```yaml
tools:
  # Master switch for auto-discovery
  auto_discover: true

  # Core tools (always available unless explicitly disabled)
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

  # Detected project tools
  detected:
    enabled: true
    # Override specific detected tools
    # node: true
    # rust: false

  # Plugin tools (external)
  plugins:
    enabled: true
    directory: ".acc/config/tools"
    # Explicit plugin list (optional)
    # - docker
    # - github

  # Permissions (see §8)
  permissions:
    filesystem:
      read: true
      write: true
      glob: true
    shell:
      enabled: true
      approval: "auto"  # "auto" | "ask" | "deny"
      allowed_commands: []  # empty = all (subject to approval)
    git:
      read: true
      write: true
    network:
      enabled: false
```

### Registry Structure (Internal)

```json
{
  "core": {
    "filesystem": { "version": "1.0", "capabilities": ["read", "write", "glob", "stat"] },
    "search": { "version": "1.0", "capabilities": ["contracts", "edges", "code"] },
    ...
  },
  "detected": {
    "node": {
      "package_manager": "npm",
      "scripts": { "test": "vitest", "lint": "eslint .", "build": "tsc" },
      "tools": { "test": "vitest", "lint": "eslint", "typecheck": "tsc" }
    }
  },
  "plugins": {}
}
```

---

## 5. Tool Lifecycle

ACC manages tool lifecycle automatically:

```
discover
   ↓
register
   ↓
validate
   ↓
activate
   ↓
monitor
   ↓
invalidate
   ↓
refresh
```

### Automatic Refresh Triggers

| Event | Action |
|-------|--------|
| `package.json` / `Cargo.toml` / etc. modified | Re-run project detection |
| `.acc/config/config.yaml` modified | Re-evaluate tool registry |
| Plugin added/removed | Re-scan plugins |
| `acc tools --refresh` invoked | Full refresh |

### Example: Adding ESLint

1. User adds `eslint` to `package.json` devDependencies
2. File watcher / `acc tools` detects change
3. ACC re-runs Node.js detection
4. ESLint capability registered
5. Next `acc tools` shows `✓ eslint`

**No `acc install eslint` required** unless explicitly requested.

---

## 6. Deterministic Tooling

ACC tooling operations MUST be deterministic when inputs and project
state are identical.

### Determinism Requirements

| Operation | Deterministic? | Notes |
|-----------|----------------|-------|
| `acc graph` | **Yes** | Core graph derivation |
| `acc context` | **Yes** | Context engine |
| `acc check` | **Yes** | Validation pipeline |
| `acc search` | **Yes** | Architecture-aware search |
| `acc tools` | **Yes** | Registry state |
| `shell` execution | **Configurable** | Depends on command; ACC provides sandbox |
| Project detection | **Yes** | Pure filesystem parsing |

### Non-Deterministic Sources (Isolated)

- Agent reasoning (LLM choices)
- External command output (timestamps, PIDs)
- Network calls (blocked by default)
- Random seeds (not used in ACC core)

ACC provides **deterministic substrate**; agent decisions may vary.

---

## 7. Context-Aware Tool Exposure

ACC exposes tools relevant to the agent's current task scope. Same
codebase, different toolkits depending on where the agent is working.

### Capability Scoping

When agent works on `src/auth/`:

```text
ACC provides:
  ├── context (src/auth + dependencies)
  ├── graph (subgraph rooted at src/auth)
  ├── memory (src/auth/.acc-memory.md)
  ├── filesystem (src/auth/ + declared deps)
  ├── search (scoped to auth functionality)
  ├── shell (sandboxed to project)
  ├── git (read-only by default)
  └── detected tools (test, lint, typecheck for auth)
```

### Multi-Agent Tool Distribution

```text
Coordinator gets:
  ├── graph (full)
  ├── context (all scopes)
  ├── git (read + write)
  ├── check (validation)
  └── shell (integration commands)

Worker 1 (auth/transport) gets:
  ├── context (auth/transport + deps)
  ├── graph (auth subtree)
  ├── memory (auth/transport)
  ├── filesystem (auth/transport)
  ├── shell (cargo test, scoped)
  └── detected (Rust tools)

Worker 2 (auth/protocol) gets:
  ├── context (auth/protocol + deps)
  ├── graph (auth subtree)
  ├── memory (auth/protocol)
  ├── filesystem (auth/protocol)
  ├── shell (cargo test, scoped)
  └── detected (Rust tools)
```

**Tool availability follows functionality and agent scope.**

---

## 8. Permission Model

Because ACC allows agents to execute operations, permissions MUST be
explicit and configurable. The model is deliberately simple: three
levels, defaults you can trust.

### Permission Levels

| Level | Operations | Default |
|-------|------------|---------|
| `safe` | Read files, search, inspect git, graph, context, memory read | ✅ Enabled |
| `moderate` | Write files, run tests, run builds, run linters, typecheck | ⚠️ Configurable |
| `dangerous` | Delete files, network access, package install, git push, deploy | ❌ Disabled |

### Configuration

```yaml
tools:
  permissions:
    # Safe operations (always allowed)
    safe:
      filesystem_read: true
      search: true
      git_read: true
      graph: true
      context: true
      memory_read: true

    # Moderate operations (require approval policy)
    moderate:
      filesystem_write: true
      shell_enabled: true
      shell_approval: "auto"  # "auto" | "ask" | "deny"
      git_write: true
      run_tests: true
      run_build: true
      run_lint: true
      run_typecheck: true

    # Dangerous operations (explicit opt-in)
    dangerous:
      filesystem_delete: false
      network_enabled: false
      package_install: false
      git_push: false
      deploy: false
```

### Approval Policies

| Policy | Behavior |
|--------|----------|
| `auto` | Allow without prompt (for safe/moderate in trusted contexts) |
| `ask` | Prompt user/agent for each operation |
| `deny` | Block operation, emit diagnostic |

---

## 9. Agent Capability Discovery

Agents discover available tools via a standard interface.

### `acc tools` Output

```bash
$ acc tools
Core tools
  ✓ filesystem
  ✓ search
  ✓ shell
  ✓ git
  ✓ project
  ✓ context
  ✓ graph
  ✓ memory
  ✓ check

Detected project tools (Node.js)
  ✓ npm
  ✓ vitest
  ✓ eslint
  ✓ tsc

Optional plugins
  ○ docker
  ○ github
```

### JSON Capability Discovery

```json
{
  "schema_version": 1,
  "core": {
    "filesystem": { "read": true, "write": true, "glob": true },
    "search": { "contracts": true, "edges": true, "code": true },
    "shell": { "enabled": true, "approval": "auto" },
    "git": { "read": true, "write": true },
    "project": { "type": "node", "package_manager": "npm" },
    "context": { "progressive_depth": true, "provenance": true },
    "graph": { "formats": ["text", "mermaid", "dot", "json"] },
    "memory": { "read": true, "write": true },
    "check": { "diagnostics": true, "severity_filter": true }
  },
  "detected": {
    "node": {
      "package_manager": "npm",
      "scripts": { "test": "vitest", "lint": "eslint .", "build": "tsc" },
      "tools": {
        "test": { "runner": "vitest", "command": "npm test" },
        "lint": { "runner": "eslint", "command": "npm run lint" },
        "typecheck": { "runner": "tsc", "command": "npm run build" }
      }
    }
  },
  "plugins": {},
  "permissions": {
    "safe": { "filesystem_read": true, ... },
    "moderate": { "filesystem_write": true, "shell_enabled": true, ... },
    "dangerous": { "network_enabled": false, ... }
  }
}
```

**Any agent** can call `acc tools --json` and understand its
capabilities. No ACC-specific knowledge required.

---

## 10. Plugin Architecture

Third-party tooling is implemented through the ACC plugin interface.

### Plugin Structure

```
.acc/config/tools/
├── docker/
│   ├── plugin.yaml
│   ├── index.js (or .py, .rs, .go)
│   └── README.md
├── github/
└── ...
```

### Plugin Manifest (`plugin.yaml`)

```yaml
name: docker
version: "1.0.0"
description: "Docker container management"
author: "ACC Team"
license: "MIT"

capabilities:
  - name: docker_build
    description: "Build Docker images"
    command: "docker build"
    permissions: ["shell"]
  - name: docker_run
    description: "Run Docker containers"
    command: "docker run"
    permissions: ["shell", "network"]
  - name: docker_compose
    description: "Manage Docker Compose stacks"
    command: "docker compose"
    permissions: ["shell"]

project_detection:
  files: ["Dockerfile", "docker-compose.yml", ".dockerignore"]
  ecosystems: ["any"]

dependencies:
  - "docker CLI"
  - "docker daemon"

permissions_required:
  - shell
  - network  # for docker run/pull
```

### Plugin Contract

A plugin MUST:
- Declare `name`, `version`, `capabilities`
- Define `project_detection` criteria
- List `permissions_required` (subset of ACC permission model)
- Implement capabilities as deterministic commands
- Return structured JSON output with provenance
- Honor ACC's project root boundary
- Work offline (no mandatory network calls)

### Plugin Lifecycle

1. **Discover** — Scan `.acc/config/tools/` on startup
2. **Validate** — Check manifest, dependencies, permissions
3. **Register** — Add capabilities to tool registry
4. **Activate** — Enable if project detection matches
5. **Monitor** — Watch for config/plugin changes

---

## 11. Tooling Profiles

ACC provides pre-configured profiles for common ecosystems.

### Built-in Profiles

| Profile | Detection | Tools Activated |
|---------|-----------|-----------------|
| `core` | Always | filesystem, search, shell, git, project, context, graph, memory, check |
| `node` | `package.json` | npm/pnpm/yarn, TypeScript, ESLint, Vitest/Jest, Prettier, Vite/Next |
| `rust` | `Cargo.toml` | cargo, rustfmt, clippy, cargo test, cargo bench, cargo audit |
| `python` | `pyproject.toml` | pip/poetry/uv, pytest, ruff, black, mypy, bandit |
| `go` | `go.mod` | go toolchain, gofmt, golangci-lint, go test, go vet |
| `java` | `pom.xml`/`build.gradle` | maven/gradle, JUnit, checkstyle, spotbugs |
| `docker` | `Dockerfile` | docker build, docker compose, hadolint |
| `kubernetes` | `kustomization.yaml`/`Chart.yaml` | kubectl, helm, kustomize, kubeconform |

### Profile Composition

Profiles compose automatically:

```
Project with package.json + Cargo.toml + Dockerfile
         │
         ▼
ACC activates:
  ├── core (always)
  ├── node (from package.json)
  ├── rust (from Cargo.toml)
  └── docker (from Dockerfile)
```

Only tools actually present in the project are enabled. Mixed-ecosystem
projects just work — no profile juggling.

---

## 12. Tool Commands

### `acc tools`

List available tools and capabilities.

```bash
# Human-readable
$ acc tools

# Machine-readable
$ acc tools --json

# Refresh registry
$ acc tools --refresh

# Show specific category
$ acc tools --category core
$ acc tools --category detected
$ acc tools --category plugins
```

### `acc tool <name>`

Execute a specific tool capability.

```bash
# Run project's test command
$ acc tool test

# Run linter
$ acc tool lint

# Type check
$ acc tool typecheck

# Build
$ acc tool build

# With JSON output
$ acc tool test --json
```

### `acc shell <command>`

Execute arbitrary shell command (subject to permissions).

```bash
$ acc shell "cargo test --package auth"
$ acc shell "npm run lint" --json
```

---

## 13. Integration with Multi-Agent Orchestration

Tool availability is scoped to agent roles (§7).

### Coordinator Toolset

```text
Full graph, full context, validation, git write, shell (integration)
```

### Worker Toolset

```text
Scoped context, scoped graph, scoped filesystem, scoped shell, relevant detected tools
```

### Tool Distribution Algorithm

1. Coordinator analyzes task → identifies functionality scopes
2. For each scope, determines required tools:
   - Core tools (always)
   - Detected tools for that functionality's language
   - Plugins relevant to the scope
3. Workers receive capability manifest via `acc tools --json --scope <path>`

---

## 14. Diagnostic Codes

| Code | Severity | Message | Trigger |
|------|----------|---------|---------|
| `ACC110` | warn | `tool '<name>' declared but not found in PATH` | Project declares tool (e.g., `eslint`) but binary missing |
| `ACC111` | error | `tool '<name>' version mismatch: expected <v>, found <v>` | Detected tool version doesn't match declared range |
| `ACC112` | warn | `multiple package managers detected: <list>` | Both `package-lock.json` and `pnpm-lock.yaml` present |
| `ACC113` | info | `project type '<type>' detected but no tools configured` | Ecosystem detected but no tools section in config |
| `ACC114` | error | `plugin '<name>' failed validation: <reason>` | Plugin manifest invalid or dependencies missing |
| `ACC115` | error | `permission denied: <operation> requires <level> permission` | Agent attempted operation beyond granted permissions |
| `ACC116` | warn | `shell command '<cmd>' exited with code <n>` | Shell tool command failed (non-zero exit) |
| `ACC117` | info | `tool registry refreshed: <n> tools added, <m> removed` | Automatic or manual refresh completed |
| `ACC118` | error | `plugin '<name>' capability '<cap>' not implemented` | Plugin declares capability but no handler |
| `ACC119` | warn | `detected tool '<name>' conflicts with core tool '<name>'` | Name collision between detected and core |

---

## 15. Security Considerations

- **No network by default** — `network.enabled: false` in permissions
- **Project root boundary** — All filesystem ops bounded to project root
- **Shell sandbox** — Commands run with restricted environment
- **No auto-install** — ACC never installs tools without explicit permission
- **Audit trail** — All tool invocations logged with provenance
- **Plugin isolation** — Plugins run with declared permissions only

The pattern is consistent: default to safe, opt in to powerful, and
always leave a trail.

---

## 16. Stability Contract

- Core tool names stable post-1.0
- Capability discovery JSON schema versioned via `schema_version`
- Plugin interface versioned separately; breaking changes = major bump
- Diagnostic codes `ACC110`–`ACC119` stable; no renumbering
- Permission model additive only; new levels = minor bump

---

## 17. Summary

| Principle | Implementation |
|-----------|----------------|
| **Automatic** | Project detection, tool registration, lifecycle management |
| **Deterministic** | Core tools produce byte-identical output for same state |
| **Project-aware** | Uses declared tools (package.json scripts, Cargo.toml) |
| **Agent-agnostic** | Capability discovery via `acc tools --json` |
| **Extensible** | Plugin interface with manifest, detection, permissions |
| **Scoped** | Tools follow functionality boundaries and agent roles |
| **Permissioned** | Three-level model (safe/moderate/dangerous) |
| **Minimal core** | 9 core tools cover most needs; plugins for rest |

The agent is the intelligence. ACC is the deterministic substrate.
