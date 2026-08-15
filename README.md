# Agent Code Context (ACC)

<div align="center">

![ACC Logo](https://img.shields.io/badge/ACC-Agent%20Code%20Context-4F46E5?style=for-the-badge&logo=github)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/network)
[![GitHub issues](https://img.shields.io/github/issues/EnzoVezzaro/agents-code-context)](https://github.com/EnzoVezzaro/agents-code-context/issues)

**A convention-first framework that makes any software repository agent-native, navigable, and self-describing—without proprietary runtimes.**

[Quickstart](#-quickstart) • [Documentation](./docs/README.md) • [Architecture](#-architecture) • [Contributing](./CONTRIBUTING.md) • [Community](#-community)

</div>

---

## Why ACC?

Modern AI coding agents (Claude Code, Cursor, Codex, OpenCode, Gemini, etc.) are powerful but lack persistent, structured project context. They re-read files on every session, miss architectural intent, and can't share knowledge across agents or sessions.

**ACC solves this by making the repository itself the source of truth.**

| Without ACC | With ACC |
|-------------|----------|
| Agents re-discover architecture every session | Architecture declared in `AGENTS.md`, derived into a graph |
| No persistent memory between agents | `.acc-memory.md` captures durable agent knowledge |
| No validation of architectural intent | `acc check` emits stable `ACC0xx` diagnostics |
| Context is ad-hoc and token-heavy | `acc context` produces focused, provenance-tagged context |
| Agent-specific configs fragment the project | Single `.agents/acc/` control plane, agent-agnostic |

---

## Core Principles

- **🏗️ Convention over Configuration** — Builds on `AGENTS.md`, the emerging standard for agent instructions
- **🔄 Agent-Agnostic** — Works with *any* coding agent; no wrapper, runtime, or API required
- **📁 Filesystem-First** — Repository is the sole source of truth; no database, no network calls
- **🔒 Offline & Secure** — No telemetry, no code execution, safe on untrusted repos
- **📊 Deterministic** — Same repo state + same flags = byte-identical output (critical for CI/agents)
- **🔗 Compatibility Invariant** — Removing `.agents/` leaves a perfectly valid `AGENTS.md` repository

---

## Quickstart

### Prerequisites
- A git repository with source code
- Any coding agent (Cursor, Claude Code, Codex, OpenCode, etc.)

### 1. Initialize ACC in your project

```bash
# Install the CLI (when available)
# cargo install acc-cli  # or your preferred method

# Initialize ACC structure
acc init
```

This creates:
```
your-project/
├── AGENTS.md                 # Project-wide agent instructions (preserved if exists)
├── .agents/
│   └── acc/
│       ├── config.yaml       # ACC configuration (optional, sensible defaults)
│       ├── agents/           # Project-specific agent profiles
│       ├── workflows/        # Reproducible procedures (feature, release, etc.)
│       └── standards/        # Project standards (architecture, coding, review)
└── .gitignore                # Updated to exclude .acc-memory.md
```

### 2. Define a functionality boundary

```bash
# Create a functionality directory with its contract
mkdir -p src/auth
acc document src/auth --apply
```

Edit `src/auth/AGENTS.md` to declare purpose, dependencies, ownership, constraints.

### 3. Let your agent work naturally

Your agent reads `AGENTS.md`, follows the instructions, and optionally uses `acc` commands:

```bash
# Agent explores the architecture
acc graph --format mermaid

# Agent gets focused context for a task
acc context src/auth --depth 1

# Agent validates before committing
acc check
```

### 4. Capture durable knowledge

```bash
# After a session, agent saves lessons learned
acc memory add src/auth "OAuth token refresh requires clock skew tolerance of 30s"
```

---

## Key Features

### 🎯 Architecture Graph Derivation
Derive a live architecture graph from `AGENTS.md` declarations + source imports + filesystem structure—in memory, at query time.

```bash
acc graph --format mermaid    # Visual diagram
acc graph --format json       # Machine-readable
```

### 📋 Focused Context Engine
`acc context <path>` produces progressive, provenance-tagged context—exactly what an agent needs, sized for context windows.

```bash
acc context src/auth --depth 1 --max-bytes 32768
```

### ✅ Deterministic Validation
`acc check` runs the full derivation pipeline and emits stable diagnostic codes (`ACC0xx`).

```bash
acc check --json  # CI-friendly output
```

### 🧠 Durable Memory Layer
`.acc-memory.md` files (gitignored) capture agent-learned knowledge—gotchas, decisions, tried-and-rejected—without polluting committed contracts.

```bash
acc memory add src/auth "JWT validation rejects tokens with 'kid' header mismatch"
acc context src/auth --include memory
```

### 🤖 Multi-Agent Orchestration (Optional)
Enable structured multi-agent workflows with graph-driven partitioning, isolation, and deterministic validation.

```yaml
# .agents/acc/config.yaml
multi_agent:
  enabled: true
  max_concurrency: 4
  isolation_mode: "git_worktree"
```

### 🔍 Architecture-Aware Search
Search contracts, dependencies, and code with functionality-boundary awareness.

```bash
acc search "authentication" --kind contracts
acc search "database" --kind edges
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        ACC Layers                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Commands          │  acc init, check, context, graph,  │
│  (Deterministic)       │  inspect, impact, search, ...      │
├─────────────────────────────────────────────────────────────┤
│  Context Engine        │  Progressive depth, provenance,    │
│  (Focused Output)      │  section assembly, budget caps     │
├─────────────────────────────────────────────────────────────┤
│  Graph Derivation      │  Filesystem + AGENTS.md + Analyzers│
│  (In-Memory)           │  → Declared/Discovered/Inferred    │
├─────────────────────────────────────────────────────────────┤
│  Diagnostics           │  Stable ACC0xx codes, severity,    │
│  (Validated)           │  config overrides                  │
├─────────────────────────────────────────────────────────────┤
│  Memory                │  .acc-memory.md read/write         │
│  (Durable)             │  Well-known headings, provenance   │
├─────────────────────────────────────────────────────────────┤
│  Control Plane         │  .agents/acc/config, agents,       │
│  (Project Config)      │  workflows, standards              │
└─────────────────────────────────────────────────────────────┘
```

**Truth Categorization** — Every graph fact carries provenance:
- **Declared** 📝 — From `AGENTS.md` (authoritative)
- **Discovered** 🔍 — From source imports (observational)
- **Inferred** 💡 — From `acc discover` (suggestions only)
- **Memory** 🧠 — From `.acc-memory.md` (agent knowledge)

---

## Documentation

| Document | Description |
|----------|-------------|
| [01 — Philosophy](./docs/01-philosophy.md) | Core principles, agent-agnostic operation |
| [02 — Repository Structure](./docs/02-repository-structure.md) | Layout, control plane, memory, compatibility |
| [03 — Epistemology & Graph](./docs/03-epistemology.md) | Truth categorization, graph model, resolution |
| [04 — CLI Reference](./docs/04-cli-commands.md) | Every command, flags, exit codes |
| [05 — Context Engine](./docs/05-context-engine.md) | Progressive depth, provenance, output contract |
| [06 — Diagnostic Codes](./docs/06-diagnostic-codes.md) | `ACC0xx` registry, stability contract |
| [07 — JSON Schema](./docs/07-json-schema.md) | Deterministic envelope, versioning policy |
| [08 — Memory Semantics](./docs/08-memory-semantics.md) | `.acc-memory.md` lifecycle, format, rules |
| [09 — Authoring Guide](./docs/09-authoring-guide.md) | Writing effective `AGENTS.md` files |
| [10 — Multi-Agent](./docs/10-multi-agent-orchestration.md) | Orchestration substrate, partitioning, isolation |

---

## Project Structure (Dogfooding)

ACC describes itself using ACC:

```
agents-code-context/
├── AGENTS.md                          # Root contract
├── .agents/acc/                       # Control plane
│   ├── config.yaml
│   ├── agents/architect.md            # Architecture reviewer agent
│   ├── workflows/                     # feature.md, diagnostic.md, release.md
│   └── standards/architecture.md      # Project architecture standard
├── docs/                              # Specification (this directory)
│   ├── README.md                      # Documentation index
│   ├── 01-philosophy.md
│   ├── ...
│   └── 10-multi-agent-orchestration.md
└── .acc-memory.md                     # Root memory (gitignored)
```

Run `acc check` in this repo—it validates itself.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- Code style & conventions
- Adding diagnostic codes (strict stability process)
- Extending the CLI
- Documentation standards
- Release process

### Good First Issues
- Improve heuristic parsing in `AGENTS.md` extraction
- Add language analyzer for Python/Go/Java
- Enhance `acc context` output formatting
- Write tests for diagnostic codes
- Improve documentation examples

---

## Community

- **GitHub Discussions** — Questions, ideas, show-and-tell
- **Issues** — Bug reports, feature requests
- **Discord** — Real-time chat (link TBD)
- **Twitter/X** — [@ACCFramework](https://twitter.com/ACCFramework) (placeholder)

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- The `AGENTS.md` ecosystem pioneers (Codex, Claude Code, Cursor, Copilot)
- Open-source projects demonstrating agent-native patterns
- Contributors who believe repositories should be self-describing

---

<div align="center">

**Built for an AI-native development future.**  
Filesystem-first • Offline • Agent-agnostic • Deterministic

[⭐ Star this repo](https://github.com/EnzoVezzaro/agents-code-context) if you find ACC useful!

</div>