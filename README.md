# Agent Code Context (ACC)

<div align="center">

![ACC Logo](https://img.shields.io/badge/ACC-Agent%20Code%20Context-red?style=for-the-badge&logo=github)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/network)
[![GitHub issues](https://img.shields.io/github/issues/EnzoVezzaro/agents-code-context)](https://github.com/EnzoVezzaro/agents-code-context/issues)

**A convention-first framework that makes any software repository agent-native, navigable, and self-describing—without proprietary runtimes.**

> I spent a year building side-by-side with AI agents. They’re fast, they’re smart — but every new session started with the same explanations. Where things live. Why that weird code exists. What not to touch. ACC is what happened when I got tired of explaining. The knowledge belongs to the project, so let it live with the project.

[Quickstart](#-quickstart) • [Documentation](./docs/README.md) • [Architecture](#-architecture) • [Contributing](./CONTRIBUTING.md) • [Community](#-community)

</div>

---

## Why ACC?

Modern AI coding agents are powerful. Claude Code, Cursor, Codex, OpenCode, Gemini… they can write a lot of code. The problem was never that they weren’t smart — it was that they didn’t know *my* project. Every session felt like onboarding from scratch.

ACC changes that by making the repository itself the source of truth.

| Without ACC | With ACC |
|-------------|----------|
| Agents re-discover architecture every session | Architecture declared in `AGENTS.md`, derived into a graph |
| No persistent memory between agents | `.acc-memory.md` captures durable agent knowledge |
| No validation of architectural intent | `acc check` emits stable `ACC0xx` diagnostics |
| Context is ad-hoc and token-heavy | `acc context` produces focused, provenance-tagged context |
| Agent-specific configs fragment the project | Single `.acc/config/` control plane, agent-agnostic |

---

## Core Principles

These are the non-negotiables that shaped ACC. They’re not features — they’re how I wanted to work.

- **🏗️ Convention over Configuration** — Built on the open [agents.md](https://agents.md/) standard: plain `AGENTS.md`, no schema
- **🔄 Agent-Agnostic** — Works with *any* coding agent; no wrapper, runtime, or API required
- **📁 Filesystem-First** — Repository is the sole source of truth; no database, no network calls
- **🔒 Offline & Secure** — No telemetry, no code execution, safe on untrusted repos
- **📊 Deterministic tools** — Same repo state + same flags = byte-identical output (critical for CI/agents)
- **🔗 Compatibility Invariant** — Removing `.acc/` and the CLI leaves a perfectly valid agents.md repository

---

## Quickstart

Getting started is intentionally simple. ACC works without the CLI — the CLI just makes it faster and verifiable.

### Prerequisites
- Node.js 18+ and a git repository with source code
- Any coding agent (Cursor, Claude Code, Codex, OpenCode, etc.)

> **The CLI is optional.** ACC is a convention first. Any coding agent reads the repository directly from `AGENTS.md` files. The `acc` CLI is a deterministic accelerator for humans and agents: install it when you want speed and machine-checkable guarantees.

### 1. Install the CLI (optional)

```bash
npm install -g acc-agents
# or, from a clone of this repository:
# npm link

acc --version
```

### 2. Initialize ACC in your project

```bash
acc init
```

This creates:
```
your-project/
├── AGENTS.md                 # Project-wide agent instructions (preserved if exists)
├── .acc/
│   └── config/
│       ├── config.yaml       # ACC configuration (optional, sensible defaults)
│       ├── agents/           # Project-specific agent profiles
│       ├── workflows/        # Reproducible procedures (feature, release, etc.)
│       └── standards/        # Project standards (architecture, coding, review)
└── .gitignore                # Updated to exclude .acc-memory.md
```

### 3. Define a functionality boundary

```bash
# Create a functionality directory with its contract
mkdir -p src/auth
acc document src/auth --apply
```

Edit `src/auth/AGENTS.md` to declare purpose, dependencies, ownership, constraints.

### 4. Let your agent work naturally

Your agent reads `AGENTS.md`, follows the instructions, and optionally uses `acc` commands:

```bash
# Agent explores the architecture
acc graph --format mermaid

# Agent gets focused context for a task
acc context src/auth --depth 1

# Agent validates before committing
acc check
```

### 5. Capture durable knowledge

```bash
# After a session, agent saves lessons learned
acc memory add src/auth "OAuth token refresh requires clock skew tolerance of 30s"
```

---

## Key Features

Here’s what that looks like in practice:

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
# .acc/config/config.yaml
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

## The CLI (Optional Accelerator)

The `acc` CLI is **not required** — the framework is plain files and works
without any tool. Think of the CLI as a power tool: it’s the same framework,
just faster, deterministic, and machine-checkable for both humans and agents.

```bash
acc init                # Scaffold .acc/config/ + .gitignore entry
acc check               # Validate; stable ACC0xx diagnostics
acc context <path>      # Focused, progressive agent context
acc graph [path]        # Derived architecture graph (text/mermaid/dot/json)
acc inspect <path>      # Roles, owners, deps, constraints, memory
acc dependencies <p>    # What a path depends on (declared vs discovered)
acc dependents <p>      # What depends on a path
acc impact <path>       # Blast radius: dependents, tests, constraints
acc search <query>      # Architecture-aware search (contracts/edges/code)
acc discover            # Suggestions from declared-vs-discovered diffs
acc document <path>     # Conservative AGENTS.md template
acc memory show|add|clear <path>   # Durable .acc-memory.md read/write
acc tools               # List capabilities (core + detected)
acc battle <project>    # Launch the standalone ABA benchmark (see below)
```

Every command supports `--json` for deterministic, machine-readable output
(a versioned envelope, see [docs/08](./docs/08-json-schema.md)), and the
terminal output is designed to be read by both humans and agents.

```bash
acc check --json        # CI-friendly
acc context src/auth --depth 1 --max-bytes 32768
acc graph --format mermaid
```

Offline. Deterministic: the same repository state plus the same flags
always produces byte-identical output. The CLI's own code is
zero-dependency; ABA is an optional dependency used only by `acc battle`.

Exit codes: `0` success · `1` ACC error · `2` usage error · `3` panic.

---

## ACC Battle Arena (ABA) — Standalone Test Harness

ABA (ACC Battle Arena) is a **standalone application** that answers "does
the ACC framework help an AI agent work with a repository better than no
ACC?" It spawns a local **Vite web app** (battle arena) that runs the same
repo + task series side by side — one panel with the ACC framework
installed, one without — with per-panel provider/model choice, live
streaming, and per-metric comparisons.

ABA lives in **its own repository** ([`aba/`](./aba/) is a self-contained
git repo — never pushed with this one), has **its own license** (MIT for
ABA code + FSL-1.1-MIT for the isbetter.ai-derived arena UI), and is
published to npm as **`acc-battle-arena`**. This package depends on it, so
`acc battle` works out of the box:

```bash
acc battle ./my-project          # open the battle arena
acc battle ./my-project --headless   # terminal benchmark
# or run it directly from the package:
npx acc-battle-arena ./my-project
```

See the ABA repo's [README](./aba/README.md) for details.

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
│  Control Plane         │  .acc/config/config, agents,       │
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
| [02 — "Markdown Is All You Need"](./docs/02-markdown-is-all-you-need.md) | The readings behind ACC, and where ACC takes it further |
| [03 — Repository Structure](./docs/03-repository-structure.md) | Layout, control plane, memory, compatibility |
| [04 — Epistemology & Graph](./docs/04-epistemology.md) | Truth categorization, graph model, resolution |
| [05 — CLI Reference](./docs/05-cli-commands.md) | Every command, flags, exit codes |
| [06 — Context Engine](./docs/06-context-engine.md) | Progressive depth, provenance, output contract |
| [07 — Diagnostic Codes](./docs/07-diagnostic-codes.md) | `ACC0xx` registry, stability contract |
| [08 — JSON Schema](./docs/08-json-schema.md) | Deterministic envelope, versioning policy |
| [09 — Memory Semantics](./docs/09-memory-semantics.md) | `.acc-memory.md` lifecycle, format, rules |
| [10 — Authoring Guide](./docs/10-authoring-guide.md) | Writing effective `AGENTS.md` files |
| [11 — Multi-Agent](./docs/11-multi-agent-orchestration.md) | Orchestration substrate, partitioning, isolation |
| [12 — Tooling Subsystem](./docs/12-tooling.md) | Automatic tool detection, plugins, permissions |
| [13 — Security Model](./docs/13-security.md) | Offline guarantees, read/write surface, untrusted input |

---

## Project Structure (Dogfooding)

ACC describes itself using ACC:

```
agents-code-context/
├── AGENTS.md                          # Root contract
├── .acc/config/                       # Control plane
│   ├── config.yaml
│   ├── agents/architect.md            # Architecture reviewer agent
│   ├── workflows/                     # feature.md, diagnostic.md, release.md
│   └── standards/architecture.md      # Project architecture standard
├── docs/                              # Specification (this directory)
│   ├── README.md                      # Documentation index
│   ├── 01-philosophy.md
│   ├── 02-markdown-is-all-you-need.md
│   ├── ...
│   └── 13-security.md
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
- **Sponsor** — [Support the project on GitHub](https://github.com/sponsors/EnzoVezzaro) ❤️

<div align="center">

[![Sponsor](https://img.shields.io/github/sponsors/EnzoVezzaro?label=Sponsor&logo=GitHub)](https://github.com/sponsors/EnzoVezzaro)

</div>

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- **[agents.md](https://agents.md/)** — the open AGENTS.md standard this project is built on. The format emerged from collaborative efforts across the AI coding ecosystem (OpenAI Codex, Amp, Google Jules, Cursor, and Factory) and is stewarded by the Agentic AI Foundation under the Linux Foundation.
- **[Agent Skills](https://agentskills.io/)** — the open SKILL.md format for reusable, portable agent capabilities.
- **[MCP (Model Context Protocol)](https://modelcontextprotocol.io/)** — the open protocol for connecting agents to tools and services.
- **[llms.txt](https://llmstxt.org/)** — the open convention for machine-readable project information.
- **[isbetter.ai](https://github.com/midudev/isbetter.ai)** by [midudev](https://github.com/midudev) — the battle arena behind ABA ([`aba/`](./aba/)) is adapted from it (MIT / FSL-1.1-MIT).
- **[Freebuff2API](https://github.com/Quorinex/Freebuff2API)** (MIT) — the optional local Freebuff proxy vendored into ABA.

<!-- tags: midudev https://github.com/midudev, Quorinex https://github.com/Quorinex/Freebuff2API, CodebuffAI https://github.com/CodebuffAI/freebuff -->

### Special thanks to Freebuff 💜

I built most of ACC with [Freebuff](https://freebuff.com/?ref=ref-0f42f217-e7d8-472f-b137-ca83dacb992b) ([GitHub](https://github.com/CodebuffAI/freebuff)). It’s free, no API keys, no subscription — just models you can actually use. For a solo developer in the Dominican Republic, that made a real difference. The research, the drafts, even parts of this README were written with Freebuff running locally.

> A note to the Freebuff team: thank you for making this possible. From the Dominican Republic: we need more models. Keep them coming. 🌎💜

<!-- tags: Freebuff https://github.com/CodebuffAI/freebuff -->

To **the open source community** — thank you for the revolutionary contributions that make projects like this possible. Gracias por los aportes. 🙌

---

<div align="center">

**Built for an AI-native development future.**  
Filesystem-first • Offline • Agent-agnostic • Deterministic tools

If you try ACC on your project, I’d love to hear how it goes — [⭐ Star this repo](https://github.com/EnzoVezzaro/agents-code-context) if you find it useful!

</div>