# Agent Code Context (ACC)

<div align="center">

![ACC Logo](https://img.shields.io/badge/ACC-Agent%20Code%20Context-red?style=for-the-badge&logo=github)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/EnzoVezzaro/agents-code-context?style=social)](https://github.com/EnzoVezzaro/agents-code-context/network)
[![GitHub issues](https://img.shields.io/github/issues/EnzoVezzaro/agents-code-context)](https://github.com/EnzoVezzaro/agents-code-context/issues)

**Give your agent purpose.** A codebase an agent can read and understand.

> I spent a year building side-by-side with AI agents. They're fast, they're smart — but every new session started with the same explanations. Where things live. Why that weird code exists. What not to touch. ACC is what happened when I got tired of explaining. The knowledge belongs to the project, so let it live with the project.

[Quickstart](#quickstart) • [Documentation](./docs/README.md) • [Architecture](#-architecture) • [Contributing](./CONTRIBUTING.md) • [Community](#-community)

</div>

---

## Why ACC?

Modern AI coding agents are powerful. Claude Code, Cursor, Codex, OpenCode, Gemini… they can write a lot of code. The problem now is not that they aren't smart or fast — the problem is that they don’t know the project. Every session felt like onboarding from scratch. Let's change that!

ACC gives your agent purpose by making the repository itself the source of truth.

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

- **🏗️ Convention over Configuration** — Built on the open [agents.md](https://agents.md/) standard: `AGENTS.md` stays plain Markdown, no proprietary schema. ACC adds optional `.acc/config/` for templates and engine settings while the ecosystem establishes conventions.
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
npm install -g acc-code-context
# or, from a clone of this repository:
# npm link

acc --version
```

### 2. Bootstrap your entire codebase (one command)

```bash
acc engine --init-context
```

This does everything at once:
1. **Scaffolds** `.acc/config/`, root `AGENTS.md`, root `.acc-memory.md`, `.gitignore`
2. **Creates** every missing `AGENTS.md` contract from the codebase
3. **Declares** discovered dependencies (additive, never removes existing declarations)
4. **Writes** `ACC_WARN.md` with the full drift report (violations + docs-behind/ahead-of-code)
5. **Fills** `AGENTS.md` contracts with AI-generated context (when AI is enabled) or reports which contracts still need manual context (fill)

After that single command your repo looks like this:
```
your-project/
├── AGENTS.md                 # Root contract (created if absent)
├── .acc/
│   ├── config/
│   │   ├── config.yaml       # ACC configuration (sensible defaults)
│   │   ├── agents/           # Project-specific agent profiles
│   │   ├── workflows/        # Reproducible procedures
│   │   └── standards/        # Project standards
│   └── state/                # Engine trigger state (disposable)
├── src/
│   └── auth/
│       └── AGENTS.md         # Auto-generated contract for src/auth
├── ACC_WARN.md               # Drift report (gitignored, regenerated)
└── .acc-memory.md            # Root memory (gitignored)
```

### 3. Validate the result

```bash
acc check                    # See any remaining diagnostics
acc graph src/auth           # Full knowledge: topology + diagnostics + memory + drift
acc context src/auth         # Focused agent context for a task
```

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

### Alternative: manual setup

If you prefer to set things up step by step:

```bash
acc init --scan                       # Scaffold .acc/config/ + AGENTS.md + .gitignore
mkdir -p src/auth
acc document src/auth --apply         # Create a template for src/auth
# Edit src/auth/AGENTS.md to declare purpose, deps, ownership
acc check                             # Validate
acc graph --format mermaid            # See the architecture
```

---

## Key Features

Here’s what that looks like in practice:

### Architecture Graph Derivation
Derive a live architecture graph from `AGENTS.md` declarations + source imports + filesystem structure—in memory, at query time. Nodes carry diagnostics, memory state, and edge counts; the summary shows aggregate health.

```bash
acc graph                    # Full graph with summary
acc graph src/auth           # Scoped knowledge for one boundary
acc graph --format mermaid   # Visual diagram
acc graph --format json      # Machine-readable
acc graph --max-depth 1      # Depth-limited view
```

### Focused Context Engine
`acc context <path>` produces progressive, provenance-tagged context—exactly what an agent needs, sized for context windows.

```bash
acc context src/auth --depth 1 --max-bytes 32768
```

### Deterministic Validation
`acc check` runs the full derivation pipeline and emits stable diagnostic codes (`ACC0xx`).

```bash
acc check --json  # CI-friendly output
```

### Durable Memory Layer
`.acc-memory.md` files (gitignored) capture agent-learned knowledge—gotchas, decisions, tried-and-rejected—without polluting committed contracts.

```bash
acc memory add src/auth "JWT validation rejects tokens with 'kid' header mismatch"
acc context src/auth --include memory
```

### Interrupt Memory
When the agent is stopped or corrected by a human, it **must** record
the reason in `.acc-memory.md` under "Interrupts & Corrections" so it
does not repeat the same mistake. Every interruption is logged with
timestamp, reason, and corrected action.

### Templates
The system uses templates from `.acc/config/templates/` to generate
all ACC files. Edit the `.md` files there to customize output.

- **Without engine**: `acc init` creates scaffold + template files
  (AGENTS.md with `<placeholder>` items for a human to fill).
- **With engine**: `acc engine --init-context` calls `acc init` then
  the AI fills the templates with real content.
- **Custom template**: `acc init --template <path>` or
  `acc engine --init-context --template <path>`.

```bash
acc init                              # scaffold with default templates
acc init --template my-template.md    # scaffold with custom template
```

### Always-On AI Engine (`acc engine`)
The engine does automatically what the coding agent should have done:
it reviews changed code, keeps `AGENTS.md` contracts and `.acc-memory.md`
knowledge in sync, and regenerates `ACC_WARN.md` (the developer-facing
drift alarm). Deterministic scan always; AI phase only when triggered
(default 3 commits) and only on the **changed** code.

```bash
acc engine --watch          # always-on daemon (engine ON)
acc engine --supervisor     # score proposals vs rules (≥85%) before writing
acc engine --init-context   # bootstrap a repo into full ACC context
```

**Engine limits (measured).** The AI phase is hard-budgeted so the
repository size never affects per-review cost: contract ≤ 4 KB, slice
≤ 1.5 KB, ≤ 10 changed files, ≤ 6 KB of changed code, ≤ 5 knowledge
entries. Benchmarked live (22 → 3,900 files, NVIDIA NIM): drift
detection held at 4/4 sizes with constant ~4.6 KB per-review context,
ACC files doubled the drift items the model reported, and the graph
stayed ~180 bytes/item with no prose at every scale — the engine
doesn't get dumber as the repo grows. (On the one run where the model
hallucinated — a small repo — the deterministic scan + supervisor
caught it: a made-up path fails `acc check` and never reaches the 85%
approval threshold.) See
[Engine limits](./docs/05-cli-commands.md#engine-limits-measured) and
[The over-feeding problem](./docs/04-epistemology.md#the-over-feeding-problem-and-how-acc-avoids-it).

```bash
npm run benchmark:engine   # live: degradation + ACC contribution + graph size
```

### Architecture-Aware Search
Search contracts, dependencies, and code with functionality-boundary awareness.

```bash
acc search "authentication" --kind contracts
acc search "database" --kind edges
```

---

## The CLI (Optional Accelerator)

The `acc` CLI is **not required** — the framework is plain files and works
without any tool. Think of the CLI as a power tool: it's the same framework,
just faster, deterministic, and machine-checkable for both humans and agents.

```bash
acc init                # Scaffold .acc/config/ + .gitignore entry
acc check               # Validate; stable ACC0xx diagnostics
acc context <path>      # Focused, progressive agent context
acc graph [path]        # Derived architecture graph with diagnostics, memory, drift
acc slice <path>        # Compact AI-optimized graph slice (context router)
acc inspect <path>      # Roles, owners, deps, constraints, memory
acc dependencies <p>    # What a path depends on (declared vs discovered)
acc dependents <p>      # What depends on a path
acc impact <path>       # Blast radius: dependents, tests, constraints
acc search <query>      # Architecture-aware search (contracts/edges/code)
acc discover            # Suggestions from declared-vs-discovered diffs
acc build [--yes]       # Create missing AGENTS.md contracts from code
acc document <path>     # Conservative AGENTS.md template
acc fill                # Report which contracts still need human context
acc memory show|add|clear <path>   # Durable .acc-memory.md read/write
acc install             # Deploy the ACC skill to an agent environment
acc engine [path]       # Always-on AI intelligence engine (sync + AI phase)
acc engine --init-context  # Bootstrap a repo: scaffold + contracts + memory + drift
acc ai                  # Manage AI providers (list, add, remove, default, models)
acc review <path>       # On-demand AI compliance scoring (0-100)
acc tools               # List capabilities (core + detected + plugins)
acc battle <project>    # Launch the standalone ABA benchmark (see below)
```

Every command supports `--json` for deterministic, machine-readable output
(a versioned envelope, see [docs/08](./docs/08-json-schema.md)), and the
terminal output is designed to be read by both humans and agents.

```bash
acc check --json        # CI-friendly
acc context src/auth --depth 1 --max-bytes 32768
acc graph src/auth --json    # Knowledge slice for a boundary
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

<!-- tags: midudev https://github.com/midudev, Quorinex https://github.com/Quorinex/Freebuff2API, CodebuffAI https://github.com/CodebuffAI/freebuff, anomalyco https://github.com/anomalyco/opencode -->

### Special thanks to Freebuff 💜 and OpenCode 💜

I built most of ACC with [Freebuff](https://freebuff.com/?ref=ref-0f42f217-e7d8-472f-b137-ca83dacb992b) ([GitHub](https://github.com/CodebuffAI/freebuff)). It's free, no API keys, no subscription — just models you can actually use. For a solo developer in the Dominican Republic, that made a real difference. The research, the drafts, even parts of this README were written with Freebuff running locally.

I also spent countless hours with [OpenCode](https://opencode.ai) ([GitHub](https://github.com/anomalyco/opencode)) — the open source coding agent that runs in your terminal, supports 75+ providers, and includes free models out of the box. OpenCode made it possible to prototype, test, and iterate on ACC without spending a dime. The same spirit of making AI accessible to everyone.

> A note to the Freebuff and OpenCode teams: thank you for making this possible. From the Dominican Republic: keep bringing more powerful models to our people. 🌎💜

<!-- tags: Freebuff https://github.com/CodebuffAI/freebuff, OpenCode https://github.com/anomalyco/opencode -->

To **the open source community** — thank you for the revolutionary contributions that make projects like this possible. Gracias por los aportes. 🙌

---

## 🤖 AI-Assisted Contributions

ACC is built as a community project, and I want to make something visible through the project itself:

> **I believe free software can build incredible things. Not because the price tag doesn't matter, or because technology doesn't matter, or even the code doesn't matter, but because neither of them is what makes software great. It's the people behind it — the ones who care enough to build, share, and keep it alive.**

We prioritize free AI models and open tooling whenever capable options are available. At the same time, we don't require contributors to use a particular provider, model, or harness.

Instead, AI-assisted pull requests can declare what was used, and the repository can verify it.

### How it works

A contributor can optionally add `.github/pr.yml` with the tooling used:

```yaml
harness: opencode
provider: google
model: gemini-2.5-flash
```

The contributor declares only what they used. They do **not** declare whether the model is free.

The repository maintains its own provider and harness policy in `.github/pr_allow_providers.yml`:

```yaml
providers:
  google:
    free_api_access: true
    models:
      (all):
      free-model:
        - gemini-3.5-flash
        - gemini-2.5-flash

harnesses:
  opencode:
    allowed: true
  claude-code:
    allowed: true
```

CI then verifies the harness, provider, and model against this policy and posts the result as a bot comment.

### Why we do this

This isn't about judging how contributors work. It's about transparency and experimentation. We want this project to be a living demonstration of what the open-source community can build with freely available tools.

> **We don't tell contributors which AI they must use. We ask them to tell us what they used, and we verify it.**

See [AI Contributions](./docs/ai-contributions.md) for the full specification.

---

<div align="center">

**Built for an AI-native development future.**  
Filesystem-first • Offline • Agent-agnostic • Deterministic tools

If you try ACC on your project, I’d love to hear how it goes — [⭐ Star this repo](https://github.com/EnzoVezzaro/agents-code-context) if you find it useful!

</div>